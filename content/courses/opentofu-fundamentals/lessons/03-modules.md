# Providers, modules and remote state

## Providers

Providers are plugins that talk to an API (AWS, Kubernetes, GitHub, …). Pin them:

```hcl
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.35"
    }
  }
}
```

`tofu init` records exact versions and checksums in `.terraform.lock.hcl` — commit that file.

## Modules

A module is a directory of `.tf` files with inputs (variables) and outputs. Reuse it:

```hcl
module "network" {
  source   = "./modules/network"
  cidr     = "10.10.0.0/16"
}

output "subnet_ids" {
  value = module.network.subnet_ids
}
```

Keep modules small and focused; compose them in a root module per environment.

## Remote state and teams

```hcl
terraform {
  backend "s3" {
    bucket = "acme-tofu-state"
    key    = "prod/network.tfstate"
    region = "eu-west-1"
  }
}
```

A remote backend shares state across the team and **locks** it during operations. In CI, run
`tofu plan` on pull requests and `tofu apply` on merge, reviewing the saved plan.
