# Variables, outputs and state

```hcl
variable "environment" {
  type        = string
  default     = "dev"
  description = "Deployment environment"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging or prod."
  }
}

locals {
  name = "web-${var.environment}"
}

resource "terraform_data" "app" {
  input = local.name
}

output "app_name" {
  value = terraform_data.app.output
}
```

Set variables with `-var environment=prod`, a `*.tfvars` file (`-var-file=prod.tfvars`), or
`TF_VAR_environment`. Read outputs with `tofu output` / `tofu output -raw app_name`.

`terraform_data` is a built-in resource that just stores a value — perfect for learning the
lifecycle without a cloud account. Changing its `input` forces a **replacement**.

## State

OpenTofu records what it created in **state** (`terraform.tfstate`). It maps configuration to
real objects and caches their attributes.

```bash
tofu state list
tofu state show terraform_data.app
```

State can contain secrets. Never commit it; store it in a remote backend with locking, and
consider OpenTofu's built-in **state encryption**.
