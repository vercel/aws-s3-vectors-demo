import {
  CreateIndexCommand,
  GetIndexCommand,
  ListTagsForResourceCommand,
} from "@aws-sdk/client-s3vectors";
import { config } from "dotenv";

config({ path: ".env.local" });
// `vercel pull` writes here instead of .env.local.
config({ path: ".vercel/.env.development.local" });
config();

/**
 * Creates the vector index, idempotently. Runs at build time via `vercel.json`.
 *
 * Unlike the DynamoDB and DSQL integrations, which hand you a ready-to-use table
 * or database, the S3 Vectors integration provisions a bucket and nothing else.
 * The index — including its dimension, distance metric and metadata
 * configuration, all immutable — is the application's to define.
 */
async function main() {
  // Imported lazily so dotenv has populated the environment before config.ts
  // reads it and before client.ts validates the region.
  const { getClient } = await import("../aws/client");
  const {
    VECTOR_BUCKET_NAME,
    VECTOR_BUCKET_ARN,
    INDEX_NAME,
    DIMENSION,
    DISTANCE_METRIC,
    NON_FILTERABLE_METADATA_KEYS,
  } = await import("../aws/config");

  const client = getClient();

  /**
   * The role's permissions boundary only authorises CreateIndex when the request
   * tags the new index with the install's VercelInstallId, and the same tag is
   * then required on every data-plane call. Tags do not inherit from the bucket
   * to the index, so the value has to be copied across explicitly.
   *
   * An app cannot read its own session tags, but it may read the bucket's, and
   * Vercel tags the bucket at provisioning time. Skipping this step produces an
   * AccessDenied that blames a permissions boundary and never mentions tags.
   */
  const tags = await client.send(
    new ListTagsForResourceCommand({ resourceArn: VECTOR_BUCKET_ARN }),
  );
  const installId = tags.tags?.VercelInstallId;
  if (!installId) {
    throw new Error(
      `The vector bucket has no VercelInstallId tag, so CreateIndex will be ` +
        `denied. Found tags: ${Object.keys(tags.tags ?? {}).join(", ") || "none"}.`,
    );
  }

  /**
   * Attempt the create first and treat a collision as success, rather than
   * checking whether the index exists beforehand.
   *
   * The obvious order — GetIndex, then create if absent — does not work with this
   * role. Its permissions are conditioned on a tag of the index itself, and a
   * condition cannot be evaluated against a resource that does not exist, so
   * GetIndex on a missing index is denied rather than answered: you get a 403
   * that reads exactly like a genuine permissions problem, not a 404. Creating
   * first sidesteps the ambiguity, because ConflictException unambiguously means
   * the index is already there.
   */
  try {
    await client.send(
      new CreateIndexCommand({
        vectorBucketName: VECTOR_BUCKET_NAME,
        indexName: INDEX_NAME,
        dataType: "float32",
        dimension: DIMENSION,
        distanceMetric: DISTANCE_METRIC,
        metadataConfiguration: {
          nonFilterableMetadataKeys: NON_FILTERABLE_METADATA_KEYS,
        },
        tags: { VercelInstallId: installId },
      }),
    );
    console.log(
      `Created index ${INDEX_NAME} (${DIMENSION} dimensions, ${DISTANCE_METRIC})`,
    );
    return;
  } catch (error: any) {
    if (error.name !== "ConflictException") {
      throw error;
    }
  }

  // The index already existed. Now that we know it is there, GetIndex is
  // answerable, so check that its immutable settings match what we need.
  const { index } = await client.send(
    new GetIndexCommand({
      vectorBucketName: VECTOR_BUCKET_NAME,
      indexName: INDEX_NAME,
    }),
  );
  assertUsable(
    index ?? {},
    DIMENSION,
    DISTANCE_METRIC,
    NON_FILTERABLE_METADATA_KEYS,
    INDEX_NAME,
  );
  console.log(
    `Index ${INDEX_NAME} already exists (${index?.dimension} dimensions, ${index?.distanceMetric})`,
  );
}

/**
 * Dimension, distance metric and metadata configuration cannot be changed after
 * creation, so a pre-existing index with the wrong settings has to be deleted and
 * rebuilt. Saying so here beats a dimension-mismatch error during seeding.
 */
function assertUsable(
  index: {
    dimension?: number;
    distanceMetric?: string;
    metadataConfiguration?: { nonFilterableMetadataKeys?: string[] };
  },
  dimension: number,
  distanceMetric: string,
  nonFilterableMetadataKeys: string[],
  indexName: string,
) {
  const problems: string[] = [];
  if (index.dimension !== dimension) {
    problems.push(`dimension is ${index.dimension}, expected ${dimension}`);
  }
  if (index.distanceMetric !== distanceMetric) {
    problems.push(
      `distance metric is ${index.distanceMetric}, expected ${distanceMetric}`,
    );
  }
  const nonFilterable =
    index.metadataConfiguration?.nonFilterableMetadataKeys ?? [];
  const missing = nonFilterableMetadataKeys.filter(
    (key) => !nonFilterable.includes(key),
  );
  if (missing.length > 0) {
    problems.push(
      `metadata key(s) ${missing.join(", ")} are filterable, which risks the ` +
        `2 KB per-vector filterable metadata limit`,
    );
  }
  if (problems.length > 0) {
    throw new Error(
      `Index ${indexName} exists but cannot be used: ${problems.join("; ")}. ` +
        `These settings are immutable — delete the index and re-run, or set ` +
        `S3_VECTOR_INDEX_NAME to a different name.`,
    );
  }
}

main().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
