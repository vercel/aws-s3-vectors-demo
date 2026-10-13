import fs from "fs";
import path from "path";
import { PutVectorsCommand } from "@aws-sdk/client-s3vectors";
import { config } from "dotenv";
import { readMovies, year, type Movie } from "./movies";

config({ path: ".env.local" });
config();

/**
 * Uploads the precomputed embeddings. Runs at build time via `vercel.json`.
 *
 * PutVectors is an upsert keyed on the vector key, so re-running is harmless and
 * every deploy converges on the same contents.
 */

/** PutVectors accepts at most 500 vectors per request. */
const BATCH_SIZE = 500;

async function main() {
  const { getClient } = await import("../aws/client");
  const { VECTOR_BUCKET_NAME, INDEX_NAME, DIMENSION } =
    await import("../aws/config");

  const client = getClient();
  const movies = await readMovies();
  const { embeddings, manifest } = readEmbeddings(DIMENSION);

  if (manifest.count !== movies.length) {
    throw new Error(
      `embeddings.json holds ${manifest.count} vectors but the CSV yields ` +
        `${movies.length} movies. Re-run \`pnpm db:precompute\`.`,
    );
  }
  if (manifest.ids[0] !== movies[0].id) {
    throw new Error(
      `Embedding order does not match the CSV order. Re-run ` +
        `\`pnpm db:precompute\`.`,
    );
  }

  for (let i = 0; i < movies.length; i += BATCH_SIZE) {
    const batch = movies.slice(i, i + BATCH_SIZE);
    await client.send(
      new PutVectorsCommand({
        vectorBucketName: VECTOR_BUCKET_NAME,
        indexName: INDEX_NAME,
        vectors: batch.map((movie, offset) => ({
          key: movie.id,
          data: {
            float32: Array.from(
              embeddings.subarray(
                (i + offset) * DIMENSION,
                (i + offset + 1) * DIMENSION,
              ),
            ),
          },
          metadata: metadataFor(movie),
        })),
      }),
    );
    console.log(
      `Uploaded ${Math.min(i + BATCH_SIZE, movies.length)} / ${movies.length} vectors`,
    );
  }

  console.log(`Seeded ${movies.length} movies into ${INDEX_NAME}`);
}

/**
 * Only what the results list renders. `overview` is declared non-filterable at
 * index creation because filterable metadata is capped at 2 KB per vector and
 * every filterable key gets indexed whether it is filtered on or not.
 *
 * `genres` is omitted rather than sent empty: S3 Vectors rejects an empty array
 * in metadata with a ValidationException, and 28 of these movies have no genres
 * listed. Absent and empty mean the same thing to the UI, which renders whatever
 * genres it finds.
 */
function metadataFor(movie: Movie) {
  return {
    title: movie.title,
    year: year(movie),
    ...(movie.genres.length > 0 ? { genres: movie.genres } : {}),
    voteAverage: movie.voteAverage,
    overview: movie.overview,
  };
}

function readEmbeddings(dimension: number) {
  const dir = path.resolve(process.cwd(), "lib/db");
  const binPath = path.join(dir, "embeddings.bin");
  const manifestPath = path.join(dir, "embeddings.json");

  if (!fs.existsSync(binPath) || !fs.existsSync(manifestPath)) {
    throw new Error(
      `Missing precomputed embeddings. Run \`pnpm db:precompute\` first.`,
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    model: string;
    dimension: number;
    count: number;
    ids: string[];
  };

  if (manifest.dimension !== dimension) {
    throw new Error(
      `embeddings.bin holds ${manifest.dimension}-dimension vectors but the ` +
        `index expects ${dimension}. Re-run \`pnpm db:precompute\`.`,
    );
  }

  const buffer = fs.readFileSync(binPath);
  const embeddings = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );

  return { embeddings, manifest };
}

main().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
