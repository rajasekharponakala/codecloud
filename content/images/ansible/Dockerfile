# Ubuntu with ansible-core from the distribution archive.
FROM ubuntu:24.04
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ansible-core python3 sudo vim nano less tree ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /root
CMD ["sleep", "infinity"]
