import { S3VectorsClient } from "@aws-sdk/client-s3vectors";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { AWS_REGION, AWS_ROLE_ARN, assertRegionMatchesBucket } from "./config";

assertRegionMatchesBucket();

/**
 * S3 Vectors is a stateless HTTP API, so a single module-scoped client is reused
 * across warm invocations. There is no connection pool to attach or drain.
 *
 * No access keys are involved: Vercel mints an OIDC token for the deployment and
 * the provider exchanges it for short-lived credentials via
 * sts:AssumeRoleWithWebIdentity. This works locally too, using the
 * VERCEL_OIDC_TOKEN that `vercel env pull` writes. That token is short-lived —
 * if calls start failing with 403 after a few hours of local work, pull again
 * before debugging anything else.
 */
const client = new S3VectorsClient({
  region: AWS_REGION,
  credentials: awsCredentialsProvider({
    roleArn: AWS_ROLE_ARN,
    clientConfig: { region: AWS_REGION },
  }),
});

export function getClient() {
  return client;
}
