import fs from "fs";
import path from "path";
import { config } from "dotenv";
import { readMovies, embeddingText } from "./movies";

config({ path: ".env.local" });
// `vercel pull` writes here instead of .env.local.
config({ path: ".vercel/.env.development.local" });
config();

/**
 * Embeds the whole catalogue once and commits the result. Run by hand:
 *
 *   pnpm db:precompute
 *
 * Deliberately NOT part of the build. Embedding ~4,800 movies on every deploy
 * would make each preview slower and more expensive, and would make builds
 * non-deterministic for no benefit — the dataset is a fixed CSV. At 1024
 * dimensions the output is about 19 MB: large for a git repository, but it is
 * written once and never diffed, and it buys a demo that ranks well. See
 * lib/aws/config.ts for the measurements behind that dimension choice.
 */

const BATCH_SIZE = 100;

async function main() {
  const { DIMENSION, EMBEDDING_MODEL } = await import("../aws/config");
  const { embedDocuments } = await import("../ai/embeddings");

  const movies = await readMovies();
  console.log(`Embedding ${movies.length} movies with ${EMBEDDING_MODEL}`);

  const vectors: number[][] = [];
  for (let i = 0; i < movies.length; i += BATCH_SIZE) {
    const batch = movies.slice(i, i + BATCH_SIZE);
    vectors.push(...(await embedDocuments(batch.map(embeddingText))));
    console.log(
      `Embedded ${Math.min(i + BATCH_SIZE, movies.length)} / ${movies.length}`,
    );
  }

  // Flat Float32Array, movie order matching readMovies(). Written alongside a
  // manifest so the seed script can detect a stale pairing instead of uploading
  // vectors attached to the wrong titles.
  const flat = new Float32Array(vectors.length * DIMENSION);
  vectors.forEach((vector, i) => flat.set(vector, i * DIMENSION));

  const dir = path.resolve(process.cwd(), "lib/db");
  fs.writeFileSync(path.join(dir, "embeddings.bin"), Buffer.from(flat.buffer));
  fs.writeFileSync(
    path.join(dir, "embeddings.json"),
    JSON.stringify(
      {
        model: EMBEDDING_MODEL,
        dimension: DIMENSION,
        count: vectors.length,
        ids: movies.map((movie) => movie.id),
      },
      null,
      2,
    ) + "\n",
  );

  const megabytes = (flat.byteLength / 1024 / 1024).toFixed(1);
  console.log(`Wrote embeddings.bin (${megabytes} MB) and embeddings.json`);
}

main().catch((error) => {
  console.error("Precompute failed:", error);
  process.exit(1);
});
