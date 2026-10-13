import Link from "next/link";

/**
 * TODO: confirm `productSlug` once the S3 Vectors Marketplace listing is public,
 * and add the banner image at public/Vercel-AWS-GitHub-S3V.png (linked from the
 * README the same way the sibling AWS demos do).
 *
 * The `products` parameter is what makes one click clone the repo, create the
 * project, install the AWS integration and provision a vector bucket together.
 */
const products = encodeURIComponent(
  JSON.stringify([
    {
      type: "integration",
      integrationSlug: "aws",
      productSlug: "aws-s3-vectors",
      protocol: "storage",
    },
  ]),
);

export const DEPLOY_URL =
  "https://vercel.com/new/clone" +
  "?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Faws-s3-vectors-demo" +
  "&project-name=aws-s3-vectors-demo" +
  "&repository-name=aws-s3-vectors-demo" +
  `&products=${products}`;

export default function Explanation() {
  return (
    <div className="text-gray-800 dark:text-gray-200 text-sm border border-dashed border-gray-300 dark:border-gray-600 p-4 mb-4 font-mono bg-white dark:bg-gray-900">
      <p className="mb-2">
        This app uses <b className="font-bold">Amazon S3 Vectors</b> with
        Next.js and Vercel (
        <Link
          href="https://github.com/vercel/aws-s3-vectors-demo"
          target="_blank"
          rel="noreferrer"
          className="text-gray-900 dark:text-white border-b border-gray-900 dark:border-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          view source
        </Link>
        ).
      </p>

      <details className="group mb-2">
        <summary className="cursor-pointer hover:text-gray-900 dark:hover:text-white">
          <span className="pl-1">How does this work?</span>
        </summary>
        <div className="p-5 mt-2 bg-gray-100 dark:bg-gray-800 space-y-2">
          <p>
            The top 5000 movies from{" "}
            <Link
              href="https://www.kaggle.com/datasets/tmdb/tmdb-movie-metadata"
              target="_blank"
              rel="noreferrer"
              className="text-gray-900 dark:text-white border-b border-gray-900 dark:border-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              TMDB
            </Link>{" "}
            were embedded with Amazon Titan Text Embeddings V2 and stored in an
            S3 Vectors index. Searching embeds your query the same way and asks
            the index for its nearest neighbours by cosine distance.
          </p>
          <p>
            Nothing is matched on text. A <code>LIKE</code> query only finds
            words that literally appear in the data, so describing a plot finds
            nothing; comparing vectors matches on meaning, and finds the film
            without sharing a single word with it.
          </p>
          <p>
            Credentials are never hardcoded: Vercel issues an OIDC token for the
            deployment, which is exchanged for short-lived AWS credentials via{" "}
            <Link
              href="https://vercel.com/docs/security/secure-backend-access/oidc"
              target="_blank"
              rel="noreferrer"
              className="text-gray-900 dark:text-white border-b border-gray-900 dark:border-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              OIDC Federation
            </Link>
            .
          </p>
        </div>
      </details>

      <details className="group">
        <summary className="cursor-pointer hover:text-gray-900 dark:hover:text-white">
          <span className="pl-1">
            How is S3 Vectors different from other vector stores?
          </span>
        </summary>
        <div className="p-5 mt-2 bg-gray-100 dark:bg-gray-800 space-y-2">
          <p>
            There is no cluster or instance to size, and nothing to keep warm —
            vectors live in S3 and you are billed for what you store and query.
            That suits workloads with a large corpus and modest query rates,
            where a provisioned vector database spends most of its life idle.
          </p>
          <p>
            Because an index charges for storage and per query rather than by
            the hour, the dimension count is a direct cost lever: Titan V2 can
            emit 256 or 512 dimensions instead of 1024, shrinking both. Measured
            on this corpus the shorter vectors ranked noticeably worse, and at
            4,799 movies the saving is a fraction of a cent a month, so these
            embeddings keep the full 1024.{" "}
            <Link
              href="https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html"
              target="_blank"
              rel="noreferrer"
              className="text-gray-900 dark:text-white border-b border-gray-900 dark:border-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Learn more.
            </Link>
          </p>
        </div>
      </details>
    </div>
  );
}
