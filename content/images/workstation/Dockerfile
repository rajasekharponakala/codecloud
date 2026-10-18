# General-purpose Ubuntu workstation used by the Linux, Git, networking and CI/CD labs.
FROM rhysd/actionlint:1.7.12 AS actionlint
FROM mikefarah/yq:4.54.1 AS yq

FROM ubuntu:24.04
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      bash-completion ca-certificates cron curl dnsutils git iproute2 iputils-ping jq less lsof make \
      man-db nano netcat-openbsd procps python3 python3-pip shellcheck sudo tree unzip vim wget \
 && rm -rf /var/lib/apt/lists/*
COPY --from=actionlint /usr/local/bin/actionlint /usr/local/bin/actionlint
COPY --from=yq /usr/bin/yq /usr/local/bin/yq
WORKDIR /root
CMD ["sleep", "infinity"]
