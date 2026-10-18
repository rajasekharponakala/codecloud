# Cloud computing concepts

Cloud providers rent computing as on-demand, API-driven services billed by usage.

## Service models

| Model | You manage | Examples |
|-------|-----------|----------|
| **IaaS** | OS and everything above | virtual machines, block storage, networks |
| **PaaS** | your application and data | managed databases, app platforms |
| **SaaS** | your data and users | email, CRM |

Serverless (functions, managed queues) pushes further: no servers to size at all.

## Building blocks every provider offers

* **Compute** — VMs, containers, functions
* **Storage** — object (S3-style buckets), block (disks), file (NFS)
* **Databases** — relational and NoSQL, managed
* **Networking** — virtual networks, subnets, load balancers, DNS
* **Identity** — users, roles and policies (IAM)

## Regions and availability zones

A **region** is a geographic area; it contains several isolated **availability zones**. Spread
production workloads across zones to survive a data-centre failure.

## Shared responsibility

The provider secures the cloud (hardware, hypervisors, facilities); **you** secure what you put in
it — identities, network rules, data encryption and patching your own instances.

Open-source alternatives exist when you need your own cloud: **OpenStack** for IaaS, **Ceph** for
storage, **Kubernetes** for application platforms.
