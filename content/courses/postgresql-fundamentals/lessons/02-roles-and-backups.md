# Roles, privileges and backups

## Roles

PostgreSQL has one concept for users and groups: **roles**. A role with `LOGIN` is a user.

```sql
CREATE ROLE app LOGIN PASSWORD 'app-pass';
CREATE DATABASE shop OWNER app;           -- app owns everything it creates there
CREATE ROLE analyst LOGIN PASSWORD 'read-only';
GRANT CONNECT ON DATABASE shop TO analyst;
GRANT SELECT ON orders TO analyst;        -- read, but not write
ALTER DEFAULT PRIVILEGES FOR ROLE app IN SCHEMA public GRANT SELECT ON TABLES TO analyst;
```

Applications should connect as a dedicated, non-superuser role that owns only its database.
Client authentication rules live in `pg_hba.conf` (which users, from where, with which method —
prefer `scram-sha-256`).

## Backups

| Kind | Tool | Use |
|------|------|-----|
| Logical | `pg_dump` / `pg_restore` | one database, portable across versions |
| Physical | `pg_basebackup` + WAL archiving | whole cluster, point-in-time recovery |

```bash
pg_dump -Fc -d shop -f shop.dump          # custom format: compressed, selective restore
pg_restore -l shop.dump                   # list contents
createdb shop_restored && pg_restore -d shop_restored shop.dump
```

A backup you have never restored is not a backup — test restores on a schedule. Tools such as
pgBackRest or Barman automate physical backups and retention.
