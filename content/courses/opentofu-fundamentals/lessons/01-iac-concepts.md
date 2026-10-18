# Infrastructure as Code and the OpenTofu workflow

Clicking through a cloud console does not scale: nobody can review it, repeat it or know exactly
what exists. **Infrastructure as Code** keeps infrastructure in version-controlled files that are
reviewed and applied like any other code.

**OpenTofu** is a community-driven, MPL-licensed fork of Terraform governed by the Linux
Foundation. Configuration, providers and workflow are compatible with Terraform's.

## Declarative

You describe the *end state*; the tool works out the steps:

```hcl
resource "aws_s3_bucket" "logs" {
  bucket = "acme-logs"
}
```

## The core workflow

```bash
tofu init      # download providers and modules, configure the backend
tofu fmt       # canonical formatting
tofu validate  # static checks
tofu plan      # diff: desired configuration vs. real infrastructure (via state)
tofu apply     # make it so (shows the plan and asks for confirmation)
tofu destroy   # remove everything this configuration manages
```

Always read the plan: `+` create, `~` update in place, `-/+` replace, `-` destroy.
