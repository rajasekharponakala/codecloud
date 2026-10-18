# Name resolution and HTTP troubleshooting

## How a name becomes an address

1. `/etc/hosts` is consulted first (per `/etc/nsswitch.conf`);
2. then the DNS servers in `/etc/resolv.conf`.

```bash
getent hosts app.internal   # resolve exactly as applications do
dig +short example.org A    # ask DNS directly
dig example.org MX          # other record types: AAAA, CNAME, TXT, NS
```

Adding `127.0.0.1 app.internal` to `/etc/hosts` is a quick way to test a virtual host before
DNS exists.

## HTTP from the command line

```bash
curl -i http://localhost:8080/          # include response headers
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost/health
curl -H 'Host: shop.local' http://127.0.0.1/   # test name-based virtual hosts
curl -v https://example.org 2>&1 | grep -i 'subject\|expire'   # TLS details
```

## A troubleshooting checklist

1. **Name** — does it resolve to the address you expect? (`getent hosts`)
2. **Route** — is that address reachable? (`ip route get ADDR`)
3. **Port** — is something listening, on the right interface? (`ss -tlnp`)
4. **Protocol** — what does the service answer? (`curl -v`)
5. **Logs** — what did the server see?

Quick throwaway web server for tests: `python3 -m http.server 8080 --directory /srv/www`.
