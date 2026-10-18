# OpenTofu CLI on Alpine with bash and an editor.
FROM ghcr.io/opentofu/opentofu:1.11.2-minimal AS tofu
FROM alpine:3.22
RUN apk add --no-cache bash bash-completion ca-certificates git jq nano vim
COPY --from=tofu /usr/local/bin/tofu /usr/local/bin/tofu
WORKDIR /root
CMD ["sleep", "infinity"]
