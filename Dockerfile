FROM node:26-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
COPY content ./content
ENV NODE_ENV=production CODECLOUD_DATA_DIR=/data PORT=8080
VOLUME /data
EXPOSE 8080
CMD ["node", "src/server.js"]
