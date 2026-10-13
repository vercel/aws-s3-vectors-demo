import { embed, embedMany } from "ai";
import { DIMENSION, EMBEDDING_MODEL } from "@/lib/aws/config";

/**
 * The only place in this app that turns text into a vector.
 *
 * Embeddings are requested through Vercel AI Gateway rather than by calling
 * Amazon Bedrock directly. The IAM role that the Marketplace integration
 * provisions grants s3vectors actions only — it has no bedrock:InvokeModel — so
 * a direct Bedrock call from this app is denied. Gateway reaches the same model
 * (amazon/titan-embed-text-v2) and authenticates with the deployment's OIDC
 * token, so there is still no API key to manage. If the role later gains Bedrock
 * access, swapping this file for @aws-sdk/client-bedrock-runtime is the only
 * change required.
 */

/**
 * Titan defaults to 1024 dimensions through Gateway. The option key must be
 * `bedrock`: with `amazon` or `gateway` the request silently succeeds and
 * returns 1024 values instead, so the assertion below is doing real work.
 */
const providerOptions = {
  bedrock: { dimensions: DIMENSION, normalize: true },
};

function assertDimension(embedding: number[]): number[] {
  if (embedding.length !== DIMENSION) {
    throw new Error(
      `Expected ${DIMENSION}-dimension embeddings but the model returned ` +
        `${embedding.length}. The index cannot accept these. Check that ` +
        `providerOptions uses the \`bedrock\` key.`,
    );
  }
  return embedding;
}

/** Embed a single search query. */
export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: text,
    providerOptions,
  });
  return assertDimension(embedding);
}

/** Embed a batch of documents. Used only by lib/db/precompute.ts. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: EMBEDDING_MODEL,
    values: texts,
    providerOptions,
  });
  return embeddings.map(assertDimension);
}
