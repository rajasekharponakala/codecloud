# Interfaces, addresses, routes and ports

## Addresses and routes

```bash
ip -br addr            # interfaces and their addresses, briefly
ip -4 addr show eth0   # IPv4 address of eth0, e.g. 172.17.0.5/16
ip route               # routing table; "default via ..." is the gateway
```

`172.17.0.5/16` means the first 16 bits are the network, so every `172.17.x.x` address is
reachable directly; anything else goes to the default gateway.

Private ranges you will meet constantly: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, and
loopback `127.0.0.0/8`.

## Ports and sockets

A **port** identifies a service on a host. A process *listens* on an address and port:

| Listening on | Reachable from |
|--------------|----------------|
| `127.0.0.1:8080` | this machine only |
| `0.0.0.0:8080` | every interface |

```bash
ss -tlnp     # TCP (-t), listening (-l), numeric (-n), with process (-p)
ss -tnp      # established TCP connections
lsof -i :80  # which process uses port 80
```

Well-known ports: 22 SSH, 53 DNS, 80 HTTP, 443 HTTPS, 5432 PostgreSQL, 6443 Kubernetes API.

## Reachability

```bash
ping -c 3 10.0.0.1      # ICMP echo (often blocked by firewalls)
nc -zv db.internal 5432 # can I open a TCP connection?
```
