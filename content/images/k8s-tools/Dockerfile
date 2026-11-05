# k3s (single-node Kubernetes) plus the Helm CLI.
FROM alpine/helm:3.22.1 AS helm
FROM rancher/k3s:v1.37.1-k3s1
COPY --from=helm /usr/bin/helm /bin/helm
