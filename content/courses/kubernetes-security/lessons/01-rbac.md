# Authentication, authorization and RBAC

Every API request is **authenticated** (who are you? — certificates, OIDC tokens, service
account tokens) then **authorized** (may you do this?) — usually by RBAC.

| Object | Scope | Purpose |
|--------|-------|---------|
| **Role** | namespace | a set of allowed verbs on resources |
| **ClusterRole** | cluster | same, cluster-wide or reusable in many namespaces |
| **RoleBinding** | namespace | grants a Role or ClusterRole to subjects in one namespace |
| **ClusterRoleBinding** | cluster | grants a ClusterRole everywhere |

Subjects are users, groups or **ServiceAccounts** (identities for pods and automation).

```bash
kubectl -n dev create serviceaccount ci-bot
kubectl -n dev create role pod-reader --verb=get,list,watch --resource=pods
kubectl -n dev create rolebinding ci-bot-pods --role=pod-reader --serviceaccount=dev:ci-bot
kubectl auth can-i list pods -n dev --as=system:serviceaccount:dev:ci-bot   # yes
kubectl auth can-i delete pods -n dev --as=system:serviceaccount:dev:ci-bot # no
```

Rules name API groups: core resources (`pods`, `secrets`) have group `""`, Deployments are in
`apps`, Ingresses in `networking.k8s.io`.

## Least privilege checklist

* no wildcards (`*`) in verbs or resources for applications;
* `get`/`list` on Secrets is effectively read access to every credential in the namespace;
* set `automountServiceAccountToken: false` for pods that never call the API.
