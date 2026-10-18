# Databases, tables and SQL essentials

A PostgreSQL **cluster** (one server process) holds many **databases**; each has **schemas**
(default `public`) containing tables.

```bash
psql -U postgres            # connect as the superuser
```

| psql command | Does |
|--------------|------|
| `\l` | list databases |
| `\c shop` | connect to database shop |
| `\dt` | list tables |
| `\d orders` | describe a table |
| `\du` | list roles |
| `\q` | quit |

```sql
CREATE DATABASE shop;
\c shop
CREATE TABLE orders (
  id         bigserial PRIMARY KEY,
  customer   text NOT NULL,
  total      numeric(10,2) CHECK (total >= 0),
  created_at timestamptz DEFAULT now()
);
INSERT INTO orders (customer, total) VALUES ('ada', 25.00), ('linus', 30.50);
SELECT customer, sum(total) FROM orders GROUP BY customer ORDER BY 2 DESC;
UPDATE orders SET total = 26.00 WHERE id = 1;
DELETE FROM orders WHERE total = 0;
CREATE INDEX ON orders (customer);
```

Wrap related changes in a transaction: `BEGIN; … COMMIT;` (or `ROLLBACK;`). Use `EXPLAIN ANALYZE`
to see how a query is executed.
