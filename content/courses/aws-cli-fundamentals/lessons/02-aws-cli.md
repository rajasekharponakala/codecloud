# Working with the AWS CLI

The CLI maps commands onto API calls: `aws <service> <operation> [--parameters]`.

```bash
aws configure                 # access key, secret, default region, output format
aws sts get-caller-identity   # who am I?
```

## S3 — object storage

```bash
aws s3 mb s3://acme-artifacts
aws s3 cp build.tar.gz s3://acme-artifacts/releases/1.2.0/
aws s3 ls s3://acme-artifacts --recursive
aws s3 sync ./site s3://acme-site --delete
aws s3api put-bucket-versioning --bucket acme-artifacts --versioning-configuration Status=Enabled
```

`aws s3` has convenient high-level commands; `aws s3api` exposes every API operation.

## DynamoDB — key-value NoSQL

```bash
aws dynamodb create-table --table-name orders \
  --attribute-definitions AttributeName=order_id,AttributeType=S \
  --key-schema AttributeName=order_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
aws dynamodb put-item --table-name orders --item '{"order_id": {"S": "o-1"}}'
```

## IAM — identities and policies

```bash
aws iam create-user --user-name ci-deployer
aws iam attach-user-policy --user-name ci-deployer \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
```

Prefer **roles** with short-lived credentials over long-lived user keys, and grant the least
privilege that works.

## Querying output

`--query` takes a JMESPath expression; `--output text|json|table` controls format:

```bash
aws iam list-users --query 'Users[].UserName' --output text
```

> In the lab the CLI talks to **Moto**, an open-source emulator, via `AWS_ENDPOINT_URL` — the
> commands are exactly the ones you would run against real AWS.
