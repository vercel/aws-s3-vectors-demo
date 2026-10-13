import { QueryVectorsCommand } from "@aws-sdk/client-s3vectors";
import { performance } from "perf_hooks";
import { getClient } from "@/lib/aws/client";
import { VECTOR_BUCKET_NAME, INDEX_NAME } from "@/lib/aws/config";
import { embedQuery } from "@/lib/ai/embeddings";

export interface SearchResult {
  id: string;
  title: string;
  year: number;
  genres: string[];
  voteAverage: number;
  overview: string;
  /** Cosine distance — lower is closer. */
  distance?: number;
}

export interface SearchResults {
  results: SearchResult[];
  queryTimeMs: string;
  /** Milliseconds spent embedding the query. */
  embedTimeMs?: string;
}

export const RESULT_LIMIT = 8;

/**
 * Longest query we will embed, in characters.
 *
 * `q` arrives from the URL, so it is attacker-controlled and unauthenticated, and
 * every distinct value costs real money: one AI Gateway embedding plus one
 * S3 Vectors query, with no cache in front of them. Titan accepts around 8,000
 * tokens, and embedding is billed per token, so an uncapped query lets a single
 * request cost roughly 50x what a normal one does. 200 characters is far more
 * than any real "describe a movie" search needs.
 *
 * This caps the size of each request, not the number of them. A public deployment
 * should also sit behind rate limiting — see the README.
 */
const MAX_QUERY_LENGTH = 200;

/**
 * Embed the query, then ask S3 Vectors for its nearest neighbours.
 *
 * The embedding call and the vector query are timed separately because they are
 * charged and scaled separately, and because the model call is usually the larger
 * share — worth making visible rather than hiding inside one number.
 */
export async function search(query: string): Promise<SearchResults> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (!trimmed) {
    return { results: [], queryTimeMs: "0.00" };
  }

  const embedStart = performance.now();
  const queryVector = await embedQuery(trimmed);
  const embedTimeMs = (performance.now() - embedStart).toFixed(2);

  const queryStart = performance.now();
  const { vectors } = await getClient().send(
    new QueryVectorsCommand({
      vectorBucketName: VECTOR_BUCKET_NAME,
      indexName: INDEX_NAME,
      queryVector: { float32: queryVector },
      topK: RESULT_LIMIT,
      returnDistance: true,
      returnMetadata: true,
    }),
  );
  const queryTimeMs = (performance.now() - queryStart).toFixed(2);

  // Everything rendered comes back as vector metadata, so a search never touches
  // the CSV — the index is the only datastore in the request path.
  const results = (vectors ?? []).map((vector) => {
    const metadata = (vector.metadata ?? {}) as Record<string, unknown>;
    return {
      id: vector.key!,
      title: String(metadata.title ?? ""),
      year: Number(metadata.year ?? 0),
      genres: Array.isArray(metadata.genres)
        ? (metadata.genres as string[])
        : [],
      voteAverage: Number(metadata.voteAverage ?? 0),
      overview: String(metadata.overview ?? ""),
      distance: vector.distance,
    };
  });

  return { results, queryTimeMs, embedTimeMs };
}
