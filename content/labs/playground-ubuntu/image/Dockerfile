FROM ubuntu:24.04
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      bash-completion ca-certificates curl dnsutils git iproute2 iputils-ping jq less man-db nano \
      procps python3 python3-pip tree unzip vim wget \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /root
CMD ["sleep", "infinity"]
