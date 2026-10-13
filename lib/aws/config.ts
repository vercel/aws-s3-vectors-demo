/**
 * Every environment variable this app reads, in one place.
 *
 * The Vercel Marketplace AWS integration injects five variables when you connect
 * an S3 Vectors resource to a project. Note that the bucket variable is spelled
 * S3_VECTOR_BUCKET_NAME (singular "VECTOR") while the service, the SDK package
 * and the IAM namespace are all plural "s3vectors" — funneling it through here
 * means the odd spelling appears exactly once in the codebase.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Connect an S3 Vectors resource to this project, ` +
        `then run \`vercel env pull\`. The resource connection must include the ` +
        `Development environment for the values to be readable locally.`,
    );
  }
  return value;
}

export const AWS_REGION = required("AWS_REGION");
export const AWS_ROLE_ARN = required("AWS_ROLE_ARN");

/** Name of the provisioned vector bucket. Has a random suffix — never hardcode it. */
export const VECTOR_BUCKET_NAME = required("S3_VECTOR_BUCKET_NAME");

/** ARN of the same bucket. Used to read the bucket's tags — see lib/db/setup.ts. */
export const VECTOR_BUCKET_ARN = required("AWS_RESOURCE_ARN");

/**
 * The integration provisions a bucket but no index, so the index is ours to
 * create and name. Both values below are immutable once the index exists.
 */
export const INDEX_NAME = process.env.S3_VECTOR_INDEX_NAME ?? "movies";
export const DIMENSION = 1024;
export const DISTANCE_METRIC = "cosine";

/**
 * Titan Text Embeddings V2 supports 1024, 512 and 256 dimensions, and the smaller
 * sizes are prefixes of the largest (the model is trained with Matryoshka
 * representation learning), so you can compare them by truncating one set of
 * embeddings rather than re-embedding.
 *
 * Doing that on a 12-query relevance set over this corpus: 1024 dimensions found
 * the expected movie in the top 8 for 11 of 12 queries with an MRR of 0.68, 512
 * managed 10 of 12 at 0.47, and 256 only 7 of 12 at 0.37. Truncating is cheaper —
 * it would cut the committed embeddings from 19 MB to 4.7 MB and shrink storage
 * and per-query data processed in proportion — but at this corpus size those
 * amounts are fractions of a cent per month, and the ranking difference is
 * plainly visible in a list of eight results. Full width wins.
 */
export const EMBEDDING_MODEL = "amazon/titan-embed-text-v2";

/**
 * Filterable metadata is capped at 2 KB per vector, and every filterable key is
 * indexed whether or not you filter on it. Movie overviews are long and we only
 * ever display them, so they are declared non-filterable. This is set at index
 * creation and cannot be changed afterwards.
 */
export const NON_FILTERABLE_METADATA_KEYS = ["overview"];

/**
 * Guards against a mismatch that produces spectacularly misleading errors.
 *
 * Both `node --env-file` and most dotenv loaders refuse to override a variable
 * that is already exported in the shell. A developer with AWS_REGION set for
 * unrelated work silently talks to the wrong region, where the bucket does not
 * exist — and AWS answers with AccessDenied rather than "no such bucket",
 * because the ARN it built points somewhere real but forbidden.
 */
export function assertRegionMatchesBucket(): void {
  const arnRegion = VECTOR_BUCKET_ARN.split(":")[3];
  if (arnRegion && arnRegion !== AWS_REGION) {
    throw new Error(
      `AWS_REGION is "${AWS_REGION}" but the vector bucket lives in ` +
        `"${arnRegion}" (per AWS_RESOURCE_ARN). You most likely have AWS_REGION ` +
        `exported in your shell, which takes precedence over .env.local. ` +
        `Unset it and try again.`,
    );
  }
}
