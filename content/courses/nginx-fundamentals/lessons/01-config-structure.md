# How NGINX configuration works

NGINX configuration is a tree of **contexts** containing **directives**:

```nginx
# /etc/nginx/nginx.conf (excerpt)
events { worker_connections 1024; }
http {
    include /etc/nginx/mime.types;
    include /etc/nginx/conf.d/*.conf;   # your sites go here
}
```

```nginx
# /etc/nginx/conf.d/site.conf
server {
    listen 8081;
    server_name shop.example.org;
    root /srv/site;
    index index.html;

    location /assets/ {
        expires 7d;
    }
}
```

* A request is matched to a `server` by `listen` and the `Host` header (`server_name`).
* Then to the most specific `location`: exact `=`, then longest prefix, with regex `~` locations
  checked in order.

## Change safely

```bash
nginx -t          # test the configuration — always first
nginx -s reload   # graceful: new workers start, old ones finish their requests
```

Logs: `/var/log/nginx/access.log` and `error.log` (in containers they usually go to stdout/stderr).
