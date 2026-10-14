# Amazon S3 Vectors Movies Demo

Search 4,799 movies by describing them, using [Amazon S3 Vectors](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html) with Next.js. Type a plot, a mood or a premise; the app embeds it and asks the index for its nearest neighbours.

Try `dinosaurs escape and hunt people`. That phrase appears nowhere in the 4,799 titles or plot summaries, so a `LIKE` or `contains()` query over the same data returns nothing — vector search returns Jurassic Park first, then Jurassic Park III and The Lost World.

It connects to AWS without hardcoded access keys, using Vercel's [OIDC Federation](https://vercel.com/docs/security/secure-backend-access/oidc).

[![This is an alt text.](/public/Vercel-AWS-GitHub-s3-vector.png)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Faws-s3-vectors-demo&project-name=aws-s3-vectors-demo&repository-name=aws-s3-vectors-demo&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22aws%22%2C%22productSlug%22%3A%22aws-s3-vectors%22%2C%22protocol%22%3A%22storage%22%7D%5D)

**Demo:** [View Demo](https://aws-s3-vectors-demo.labs.vercel.dev/)

**Getting Started:**
Click the "Deploy" button to clone this repo, create a new Vercel project, set up the AWS integration, and provision a new S3 vector bucket:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Faws-s3-vectors-demo&project-name=aws-s3-vectors-demo&repository-name=aws-s3-vectors-demo&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22aws%22%2C%22productSlug%22%3A%22aws-s3-vectors%22%2C%22protocol%22%3A%22storage%22%7D%5D)

Once the process is complete, you can clone the newly created GitHub repository and start making changes locally.


## Requirements

- Installed Amazon S3 Vectors. You can do that via [Vercel Marketplace](https://vercel.com/marketplace/aws)

When you connect the resource to your project, **leave the environment variable prefix empty** — this app reads `AWS_REGION` and `S3_VECTOR_BUCKET_NAME` unprefixed — and **include the Development environment** so the values can be pulled locally.

## Local Setup

Needs Node 20 or newer, [pnpm](https://pnpm.io/installation), and the [Vercel CLI](https://vercel.com/docs/cli) (`pnpm add -g vercel`).

1. Link the clone to the Vercel project the resource is connected to, then pull its
   environment variables:

```bash
vercel link
vercel env pull
```

`vercel env pull` on an unlinked directory fails with `not_linked`, so the `vercel link` is not optional. It writes `.env.local`, which is gitignored.

2. Install dependencies:

```bash
pnpm install
```

3. Create the vector index:

```bash
pnpm db:setup
```

4. Upload the movie vectors:

```bash
pnpm db:seed
```

5. Start the development server:

```bash
pnpm dev
```

6. View local development: http://localhost:3000

Steps 3 and 4 also run automatically on every deployment, via the `buildCommand` in `vercel.json`, so if you deployed first they have already run against the same index. Both are safe to repeat: `db:setup` treats an existing index as success, and `db:seed` upserts by vector key.

## How it works

Each movie's plot summary and genres are embedded with Amazon Titan Text Embeddings V2 and stored in an S3 Vectors index. A search embeds your query the same way and asks the index for its nearest neighbours by cosine distance. Titles are deliberately left out of the embedding — see below.

The catalogue is 4,799 films from the [TMDB 5000 Movie Dataset](https://www.kaggle.com/datasets/tmdb/tmdb-movie-metadata). This product uses data from TMDB but is not endorsed or certified by TMDB.

| File                   | Role                                                 |
| ---------------------- | ---------------------------------------------------- |
| `lib/aws/config.ts`    | every environment variable, in one place             |
| `lib/aws/client.ts`    | the S3 Vectors client, with OIDC credentials         |
| `lib/ai/embeddings.ts` | the only code that turns text into a vector          |
| `lib/db/setup.ts`      | creates the index — runs at build time               |
| `lib/db/precompute.ts` | embeds the catalogue once, by hand                   |
| `lib/db/seed.ts`       | uploads the precomputed vectors — runs at build time |
| `lib/db/search.ts`     | the query path: embed, then nearest neighbours       |

A few decisions worth knowing about if you are adapting this:

**The integration provisions a bucket, not an index.** Unlike the DynamoDB and DSQL demos, which are handed a ready-to-use table or database, this app has to create its own index. Its dimension, distance metric and metadata configuration are fixed at creation and cannot be changed afterwards.

**The index must be tagged.** The provisioned role only authorises `CreateIndex` when the request tags the new index with the install's `VercelInstallId`, and that tag is then required on every read and write. Tags are not inherited from the bucket, so `setup.ts` reads the bucket's tags and copies the value across. Without it you get an `AccessDenied` that mentions a permissions boundary and never mentions tags.

**Embeddings are precomputed and committed.** `embeddings.bin` is generated by `pnpm db:precompute` and checked in — 19 MB. Embedding the catalogue during the build would make every preview deployment slower and more expensive, and builds non-deterministic, for a dataset that never changes. Only the live search box embeds anything at request time.

**Titles are not embedded.** The text that becomes a vector is the plot summary and genres — not the title, and not the tagline. Including them is the intuitive choice and it measurably hurts: they are short, so they carry disproportionate weight in the embedding and drag results toward films whose _titles_ share words with the query. On a 12-query relevance set, embedding the title too meant `dinosaurs escape and hunt people` missed Jurassic Park altogether, and `a lonely astronaut who can't get home` ranked The Astronaut's Wife and Baggage Claim above Gravity. Dropping it took top-8 recall from 9/12 to 11/12. Titles are still stored as metadata and shown with each result — they are just not part of what gets compared.

**1024 dimensions, not 256.** Titan V2's shorter outputs are prefixes of the longest, so the three sizes can be compared by truncating one set of embeddings. Doing that here: 1024 dimensions got 11 of 12 queries right with an MRR of 0.68, 512 got 10 at 0.47, and 256 only 7 at 0.37. Truncating to 256 would cut the committed file to 4.7 MB and shrink storage and per-query data processed to a quarter — but at this corpus size that is a fraction of a cent either way, and the ranking difference is obvious in a list of eight.

**Overview text is non-filterable metadata.** Filterable metadata is capped at 2 KB per vector and every filterable key is indexed whether you filter on it or not. Plot summaries are only ever displayed, so they are declared non-filterable at index creation.

**Query embeddings go through Vercel AI Gateway.** The role provisioned by the integration grants S3 Vectors actions only — it has no `bedrock:InvokeModel` — so this app reaches Titan through [AI Gateway](https://vercel.com/docs/ai-gateway) instead, authenticated by the same OIDC token. Everything is behind one function in `lib/ai/embeddings.ts`, so switching to a direct Bedrock call is a one-file change.

## Before you run this publicly

Two things are fine for a demo and are not fine for a production deployment.

**Every search costs money and nothing authenticates it.** The `q` parameter comes straight from the URL, and each distinct value pays for one embedding and one vector query with no cache in front. `lib/db/search.ts` caps the query at 200 characters so a single request cannot be made arbitrarily expensive, but it does not cap the _number_ of requests — put rate limiting or [Vercel Firewall](https://vercel.com/docs/vercel-firewall) in front of anything public, and consider caching repeated queries.

**Every deployment re-seeds the same index.** `vercel.json` runs `db:setup && db:seed` in the build, and the index name is the same in every environment, so a preview deployment writes to the index that production reads. `PutVectors` is an upsert keyed on the vector key, so a branch that changes `movies.csv` or `seed.ts` changes what production returns. If that matters, give each environment its own index by setting `S3_VECTOR_INDEX_NAME` per environment, or seed only on production builds.

## Troubleshooting

**`AccessDenied` on every call, or "Unexpected value for ARN region component".** You probably have `AWS_REGION` exported in your shell. Most dotenv loaders, and `node --env-file`, will not override a variable that is already set, so the app talks to the wrong region and AWS reports the resulting ARN as forbidden rather than absent. `lib/aws/config.ts` checks for this and says so, but unset the variable if you hit it.

**`AccessDenied` after a few hours of local work.** The OIDC token that `vercel env pull` writes is short-lived. Pull again.

**Environment variables come down as `[SENSITIVE]`.** The resource connection does not include the Development environment. Edit the connection to add it — sensitive variables cannot exist in Development, so the Development copies are readable.
