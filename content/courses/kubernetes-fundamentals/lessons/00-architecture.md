# Kubernetes architecture

Kubernetes is a **control loop**: you declare desired state, and controllers continuously work to
make the actual state match.

## Control plane

| Component | Job |
|-----------|-----|
| **kube-apiserver** | The front door. Every client and component talks to it; it validates and stores objects |
| **etcd** | Consistent key-value store holding all cluster state |
| **kube-scheduler** | Picks a node for each new pod |
| **kube-controller-manager** | Runs controllers (Deployments, ReplicaSets, Nodes, …) |

## Nodes

| Component | Job |
|-----------|-----|
| **kubelet** | Starts and watches the pods assigned to its node |
| **container runtime** | containerd or CRI-O actually run containers |
| **kube-proxy** / CNI | Service routing and pod networking |

The labs use **k3s**, a CNCF-certified distribution that packages all of this into a single
binary — the API is identical to any other Kubernetes.

## Talking to the cluster

```bash
kubectl get nodes -o wide
kubectl api-resources          # every object type the cluster knows
kubectl explain deployment.spec.replicas
kubectl get pods -A            # all namespaces
```

Objects are usually written as YAML manifests and applied with `kubectl apply -f`, so the
desired state lives in Git.
