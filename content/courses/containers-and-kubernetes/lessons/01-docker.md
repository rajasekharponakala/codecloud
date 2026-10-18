# Docker fundamentals

An **image** is a read-only, layered filesystem plus metadata (the command to run, environment, ports).
A **container** is a process started from an image, with its own isolated view of the filesystem, network and process tree.

```bash
docker pull nginx:alpine                     # download an image
docker run -d --name web -p 8080:80 nginx:alpine
docker ps                                    # running containers
docker logs web
docker exec -it web sh                       # a shell inside the container
docker rm -f web
```

## Building images

```dockerfile
FROM alpine:3.20
CMD ["echo", "hello"]
```

```bash
docker build -t hello:v1 .
docker run --rm hello:v1
```

In the lab you get a private Docker engine of your own — break it as much as you like.
