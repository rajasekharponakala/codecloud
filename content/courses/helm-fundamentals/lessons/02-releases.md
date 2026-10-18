# Releases, upgrades and rollbacks

Installing a chart creates a **release** — a named, versioned instance in a namespace. Helm stores
each revision as a Secret in that namespace.

```bash
helm install shop ./webapp -n apps --create-namespace
helm list -n apps
helm status shop -n apps
helm get values shop -n apps          # values you supplied
helm get manifest shop -n apps        # what was applied
```

## Upgrading

```bash
helm upgrade shop ./webapp -n apps --set replicaCount=3 --set service.type=NodePort
helm upgrade --install shop ./webapp -n apps -f prod-values.yaml   # idempotent, CI-friendly
helm history shop -n apps
```

`--reuse-values` keeps previously supplied values; without it, each upgrade starts from the chart
defaults plus what you pass now — which is usually what you want in CI.

## Rolling back

```bash
helm rollback shop 1 -n apps   # creates a new revision with revision 1's manifests and values
helm uninstall shop -n apps
```

Use `--atomic` (roll back automatically if the upgrade fails) and `--wait` in pipelines.
