# AWS CLI pointed at Moto, an open-source local emulator of AWS APIs. No AWS account needed.
FROM python:3.14-slim
RUN pip install --no-cache-dir "awscli>=1.40" "moto[server]>=5.1" \
 && apt-get update && apt-get install -y --no-install-recommends curl jq less nano vim \
 && rm -rf /var/lib/apt/lists/*
ENV AWS_ENDPOINT_URL=http://127.0.0.1:5000 \
    AWS_ACCESS_KEY_ID=codecloud \
    AWS_SECRET_ACCESS_KEY=codecloud \
    AWS_DEFAULT_REGION=us-east-1 \
    AWS_PAGER=""
WORKDIR /root
CMD ["sleep", "infinity"]
