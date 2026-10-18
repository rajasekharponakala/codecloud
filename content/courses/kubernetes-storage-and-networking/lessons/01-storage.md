# Volumes, PersistentVolumeClaims and StorageClasses

A container's filesystem disappears with it. **Volumes** outlive containers; **persistent**
volumes outlive pods.

| Object | Who creates it | What it is |
|--------|----------------|------------|
| **StorageClass** | cluster admin | a kind of storage and the provisioner that creates it |
| **PersistentVolumeClaim** | developer | "I need 1Gi, ReadWriteOnce, of class X" |
| **PersistentVolume** | provisioner (dynamically) | the actual disk, bound to one claim |

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: data }
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: local-path
  resources: { requests: { storage: 1Gi } }
```

```yaml
# in the pod spec
volumes:
  - name: data
    persistentVolumeClaim: { claimName: data }
containers:
  - name: app
    volumeMounts: [{ name: data, mountPath: /data }]
```

## Binding and reclaim

* `volumeBindingMode: WaitForFirstConsumer` (k3s's `local-path`) delays provisioning until a pod
  uses the claim, so the volume is created on the right node.
* `reclaimPolicy: Delete` removes the disk with the claim; `Retain` keeps it for manual recovery.

Access modes: `ReadWriteOnce` (one node), `ReadOnlyMany`, `ReadWriteMany` (needs shared storage
such as NFS or CephFS), `ReadWriteOncePod`.

For databases, use a **StatefulSet** with `volumeClaimTemplates` so each replica gets its own claim.
