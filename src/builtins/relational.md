# Relational

## Fixture

Examples below run against:

```text
DOC:    {"orders": [{"id": 1, "customer": 1, "customer_id": 1, "cid": 1, "amount": 100, "status": "paid", "total": 100, "date": "2024-01-01"}, {"id": 2, "customer": 1, "customer_id": 1, "cid": 1, "amount": 50, "status": "open", "total": 50, "date": "2024-02-01"}, {"id": 3, "customer": 2, "customer_id": 2, "cid": 2, "amount": 75, "status": "paid", "total": 75, "date": "2024-03-01"}], "customers": [{"id": 1, "name": "Ada", "email": "ada@x.com"}, {"id": 2, "name": "Bob", "email": "bob@y.org"}], "left": [{"id": 1, "name": "Ada"}, {"id": 2, "name": "Bob"}], "right": [{"uid": 1, "role": "admin"}, {"uid": 2, "role": "user"}], "events": [{"sev": 1, "msg": "ok", "kind": "start"}, {"sev": 2, "msg": "warn", "kind": "end"}, {"sev": 3, "msg": "err", "kind": "start"}]}
```

Operations that combine two arrays of objects on a key.

## `equi_join(other, leftKey, rightKey, fn?)`

- **Signature:** `Array<L>, Array<R>, KeyL, KeyR, ((L, R) -> Any)? -> Array<Any>`
- **Behavior:** Inner equi-join: for every pair `(l, r)` where
  `l[leftKey] == r[rightKey]`, emit a result. If `fn` is omitted, the result
  is the merged object `l.merge(r)`.

```text
LEFT:   [{"id":1,"name":"Ada"},{"id":2,"name":"Bob"}]
RIGHT:  [{"uid":1,"role":"admin"},{"uid":2,"role":"user"}]

QUERY:  $.left.equi_join($.right, "id", "uid")
OUT:    [{"id":1,"name":"Ada","uid":1,"role":"admin"},
         {"id":2,"name":"Bob","uid":2,"role":"user"}]

QUERY:  $.left.equi_join($.right, "id", "uid", (l, r) => {
          name: l.name,
          role: r.role
        })
OUT:    [{"name":"Ada","role":"admin"},{"name":"Bob","role":"user"}]
```

## Worked example: orders + customers

```text
DOC:
{
  "customers": [
    {"id": 1, "name": "Ada"},
    {"id": 2, "name": "Bob"}
  ],
  "orders": [
    {"customer": 1, "amount": 100},
    {"customer": 1, "amount": 50},
    {"customer": 2, "amount": 75}
  ]
}

QUERY:
  $.orders.equi_join($.customers, "customer", "id", (o, c) => {
    customer: c.name,
    amount: o.amount
  })

OUT:
  [
    {"customer":"Ada","amount":100},
    {"customer":"Ada","amount":50},
    {"customer":"Bob","amount":75}
  ]
```

## Notes and limitations

- **Inner only.** No outer joins. For "all left, fill missing right with
  null" you can hand-roll:
  ```text
  $.left.map(l =>
    l.merge($.right.find(@.uid == l.id).or({role: null}))
  )
  ```
- **Equality only.** No range, prefix, or function joins.
- **One key on each side.** For multi-key joins, project a tuple key first:
  ```text
  $.left.map(l => l.merge({_k: [l.a, l.b]}))
       .equi_join($.right.map(r => r.merge({_k: [r.x, r.y]})), "_k", "_k")
  ```
- The implementation builds a hash on the right side; left is streamed.
  Pre-sort or pre-filter before joining if either side is large and only a
  subset matters.

## When to choose join vs. lookup

For "many left rows, lookup one field on each":

```text
$.orders.map(o => o.merge({customer_name: $.customers.find(@.id == o.customer).name}))
```

This nested `find` is O(n×m) — fine for small data. For large data, use
`equi_join` (O(n+m)) or build a lookup table first:

```text
let by_id = $.customers.index_by(@.id) in
  $.orders.map(o => o.merge({customer_name: by_id[o.customer].name}))
```

## Practical examples

```text
# Enrich orders with customer info
$.orders.equi_join($.customers, "customer_id", "id")

# Custom result shape
$.orders.equi_join($.customers, "customer_id", "id", (o, c) => {
  order_id: o.id,
  total: o.amount,
  buyer: c.name,
  email: c.email
})

# Self-join: pair adjacent records via shared key
$.events.equi_join($.events, "session_id", "session_id", (a, b) => {a, b})

# Multi-key join via tuple projection
let lk = $.left.map(l => l.merge({_k: f"{l.a}-{l.b}"})) in
  let rk = $.right.map(r => r.merge({_k: f"{r.x}-{r.y}"})) in
    lk.equi_join(rk, "_k", "_k")

# Filter-then-join (drop rows before paying join cost)
$.orders.filter(@.status == "paid").equi_join($.customers, "cid", "id")
```
