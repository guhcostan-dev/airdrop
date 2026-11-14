#!/usr/bin/env bash
# Idempotent AWS + Cloudflare deployment for Airdrop:
#   1. S3 bucket (airdrop-web-177683310249) + CloudFront distribution (with clean-URL rewrite)
#   2. S3 bucket (airdrop-assets-177683310249) + AWS Lambda Function URL (airdrop-api, nodejs22.x arm64)
#   3. Cloudflare Edge custom domains (airdrop.guhcostan.dev & airdrop-api.guhcostan.dev)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${AWS_REGION:-us-east-2}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
WEB_BUCKET="airdrop-web-${ACCOUNT_ID}"
ASSETS_BUCKET="airdrop-assets-${ACCOUNT_ID}"
LAMBDA_NAME="airdrop-api"
ROLE_NAME="airdrop-lambda-role"
CF_FUNC_NAME="airdrop-url-rewrite"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

log "1. Ensuring S3 buckets (${WEB_BUCKET}, ${ASSETS_BUCKET}) in ${REGION}"
for B in "$WEB_BUCKET" "$ASSETS_BUCKET"; do
  if ! aws s3api head-bucket --bucket "$B" 2>/dev/null; then
    aws s3api create-bucket \
      --bucket "$B" \
      --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
    echo "Created bucket s3://$B"
  else
    echo "Bucket s3://$B already exists"
  fi
done

log "2. Building apps/web and syncing to s3://${WEB_BUCKET}"
(cd "$ROOT" && pnpm web:build)
aws s3 sync "$ROOT/apps/web/dist/" "s3://${WEB_BUCKET}/" --delete --region "$REGION" >/dev/null

log "3. Ensuring CloudFront Function (${CF_FUNC_NAME}) and Distribution for ${WEB_BUCKET}"
CF_CODE='function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith("/")) {
    request.uri += "index.html";
  } else if (!uri.includes(".")) {
    request.uri += "/index.html";
  }
  return request;
}'

if ! aws cloudfront describe-function --name "$CF_FUNC_NAME" >/dev/null 2>&1; then
  ETAG=$(aws cloudfront create-function \
    --name "$CF_FUNC_NAME" \
    --function-config '{"Comment":"Rewrite clean URLs to index.html","Runtime":"cloudfront-js-2.0"}' \
    --function-code "$(printf '%s' "$CF_CODE" | base64)" \
    --query 'ETag' --output text)
  aws cloudfront publish-function --name "$CF_FUNC_NAME" --if-match "$ETAG" >/dev/null
fi
CF_FUNC_ARN=$(aws cloudfront describe-function --name "$CF_FUNC_NAME" --stage LIVE --query 'FunctionSummary.FunctionMetadata.FunctionARN' --output text)

OAC_ID=$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='airdrop-web-oac'].Id | [0]" --output text)
if [[ -z "$OAC_ID" || "$OAC_ID" == "None" ]]; then
  OAC_ID=$(aws cloudfront create-origin-access-control --origin-access-control-config "{
    \"Name\": \"airdrop-web-oac\",
    \"Description\": \"OAC for ${WEB_BUCKET}\",
    \"SigningProtocol\": \"sigv4\",
    \"SigningBehavior\": \"always\",
    \"OriginAccessControlOriginType\": \"s3\"
  }" --query 'OriginAccessControl.Id' --output text)
fi

DIST_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='Airdrop Web (Landing + Docs + Dashboard)'].Id | [0]" --output text)
if [[ -z "$DIST_ID" || "$DIST_ID" == "None" ]]; then
  DIST_CONFIG=$(cat <<JSON
{
  "CallerReference": "airdrop-web-$(date +%s)",
  "Comment": "Airdrop Web (Landing + Docs + Dashboard)",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "s3-airdrop-web",
        "DomainName": "${WEB_BUCKET}.s3.${REGION}.amazonaws.com",
        "OriginAccessControlId": "${OAC_ID}",
        "S3OriginConfig": { "OriginAccessIdentity": "" }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-airdrop-web",
    "ViewerProtocolPolicy": "redirect-to-https",
    "Compress": true,
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
    },
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "FunctionAssociations": {
      "Quantity": 1,
      "Items": [
        {
          "FunctionARN": "${CF_FUNC_ARN}",
          "EventType": "viewer-request"
        }
      ]
    }
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [
      {
        "ErrorCode": 403,
        "ResponsePagePath": "/404.html",
        "ResponseCode": "404",
        "ErrorCachingMinTTL": 60
      }
    ]
  },
  "PriceClass": "PriceClass_100"
}
JSON
)
  DIST_ID=$(aws cloudfront create-distribution --distribution-config "$DIST_CONFIG" --query 'Distribution.Id' --output text)
  echo "Created CloudFront distribution: $DIST_ID"
else
  echo "Using existing CloudFront distribution: $DIST_ID"
  aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null
fi

CF_DOMAIN=$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.DomainName' --output text)

# Allow CloudFront OAC to read from WEB_BUCKET
BUCKET_POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${WEB_BUCKET}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"
        }
      }
    }
  ]
}
JSON
)
aws s3api put-bucket-policy --bucket "$WEB_BUCKET" --policy "$BUCKET_POLICY"

log "4. Packaging and deploying AWS Lambda (${LAMBDA_NAME}) in ${REGION}"
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }' >/dev/null
  aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name airdrop-s3-access --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Action\": [\"s3:GetObject\", \"s3:PutObject\", \"s3:DeleteObject\", \"s3:ListBucket\"],
      \"Resource\": [\"arn:aws:s3:::${ASSETS_BUCKET}\", \"arn:aws:s3:::${ASSETS_BUCKET}/*\"]
    }]
  }"
  sleep 8
fi
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)

BUILD_DIR="$ROOT/apps/server/dist-aws"
rm -rf "$BUILD_DIR" && mkdir -p "$BUILD_DIR"
node -e '
  const { createRequire } = require("node:module");
  const reqServer = createRequire(process.cwd() + "/apps/server/package.json");
  const esbuild = createRequire(reqServer.resolve("wrangler/package.json"))("esbuild");
  esbuild.buildSync({
    entryPoints: ["apps/server/src/aws-lambda.ts"],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    outfile: "apps/server/dist-aws/index.mjs",
    external: ["node:*", "@aws-sdk/*"],
  });
'
(cd "$BUILD_DIR" && zip -q function.zip index.mjs)

ADMIN_TOK="${AIRDROP_ADMIN_TOKEN:-}"
if [[ -z "$ADMIN_TOK" && -f "$ROOT/apps/server/.dev.vars" ]]; then
  ADMIN_TOK=$(grep -E '^ADMIN_TOKEN=' "$ROOT/apps/server/.dev.vars" | cut -d= -f2- || true)
fi
[[ -z "$ADMIN_TOK" ]] && ADMIN_TOK="ad_admin_prod_token"

if ! aws lambda get-function --function-name "$LAMBDA_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws lambda create-function \
    --region "$REGION" \
    --function-name "$LAMBDA_NAME" \
    --runtime nodejs22.x \
    --architectures arm64 \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --timeout 30 \
    --memory-size 512 \
    --zip-file "fileb://${BUILD_DIR}/function.zip" \
    --environment "Variables={S3_BUCKET=${ASSETS_BUCKET},ADMIN_TOKEN=${ADMIN_TOK},WEB_ORIGINS=https://airdrop.guhcostan.dev}" >/dev/null
else
  aws lambda update-function-code \
    --region "$REGION" \
    --function-name "$LAMBDA_NAME" \
    --zip-file "fileb://${BUILD_DIR}/function.zip" >/dev/null
  aws lambda wait function-updated --region "$REGION" --function-name "$LAMBDA_NAME"
  aws lambda update-function-configuration \
    --region "$REGION" \
    --function-name "$LAMBDA_NAME" \
    --timeout 30 \
    --memory-size 512 \
    --environment "Variables={S3_BUCKET=${ASSETS_BUCKET},ADMIN_TOKEN=${ADMIN_TOK},WEB_ORIGINS=https://airdrop.guhcostan.dev}" >/dev/null
fi

aws lambda wait function-active-v2 --region "$REGION" --function-name "$LAMBDA_NAME" || true

LAMBDA_URL=$(aws lambda get-function-url-config --region "$REGION" --function-name "$LAMBDA_NAME" --query 'FunctionUrl' --output text 2>/dev/null || true)
if [[ -z "$LAMBDA_URL" || "$LAMBDA_URL" == "None" ]]; then
  LAMBDA_URL=$(aws lambda create-function-url-config \
    --region "$REGION" \
    --function-name "$LAMBDA_NAME" \
    --auth-type NONE \
    --query 'FunctionUrl' --output text)
fi
aws lambda add-permission \
  --region "$REGION" \
  --function-name "$LAMBDA_NAME" \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE >/dev/null 2>&1 || true
aws lambda add-permission \
  --region "$REGION" \
  --function-name "$LAMBDA_NAME" \
  --statement-id FunctionURLAllowInvokeAction \
  --action lambda:InvokeFunction \
  --principal "*" \
  --invoked-via-function-url >/dev/null 2>&1 || true

rm -rf "$BUILD_DIR"

printf '\n========================================================\n'
printf 'AWS CloudFront Web URL : https://%s\n' "$CF_DOMAIN"
printf 'AWS Lambda API URL     : %s\n' "$LAMBDA_URL"
printf '========================================================\n'
