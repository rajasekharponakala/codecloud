# Reverse proxying, headers and TLS

A **reverse proxy** sits in front of applications: it terminates TLS, serves static files, and
forwards dynamic requests.

```nginx
upstream api_backend {
    server 127.0.0.1:9000;
    server 127.0.0.1:9001;   # simple round-robin load balancing
}

server {
    listen 8081;
    root /srv/site;
    add_header X-Served-By codecloud always;

    location /api/ {
        proxy_pass http://api_backend/;      # trailing slash: /api/health → /health
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Without the trailing slash on `proxy_pass`, the full original path (`/api/health`) is forwarded.

## TLS

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name shop.example.org;
    ssl_certificate     /etc/ssl/shop/fullchain.pem;
    ssl_certificate_key /etc/ssl/shop/privkey.pem;
}
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

Get free certificates from Let's Encrypt with an ACME client such as Certbot or lego.

`add_header` directives are inherited only if the inner block defines none of its own — repeat
them (or use `always` and an include) when a `location` adds headers.
