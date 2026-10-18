# Multi-container apps with Docker Compose

Real applications are several containers: a web tier, a cache, a database. **Compose** describes
them in one YAML file and manages them as a project.

```yaml
# compose.yaml
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - ./html:/usr/share/nginx/html:ro
    depends_on:
      - cache
  cache:
    image: redis:7-alpine
    volumes:
      - cache-data:/data
volumes:
  cache-data:
```

```bash
docker compose config        # validate and print the effective configuration
docker compose up -d         # create network, volumes and containers
docker compose ps
docker compose logs -f web
docker compose exec cache redis-cli PING
docker compose down          # stop and remove (add -v to delete volumes)
```

## Networking

Compose creates a network per project. Services reach each other **by service name**: the web
container can connect to `cache:6379`. Only ports listed under `ports:` are published to the host.

## Configuration

* `environment:` or `env_file:` for settings — keep secrets out of the file in Git;
* `build: ./app` to build an image from a Dockerfile instead of pulling one;
* `profiles:` to enable optional services, e.g. debugging tools.
