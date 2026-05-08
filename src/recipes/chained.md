# Chained Pipelines

Real-world queries assembled from the building blocks. Each recipe uses one
small document and shows the query chain plus a sentence on what the planner
does.

## 1. Top-N by aggregate

```jetro
DOC:    {"sales": [
  {"region": "NA", "amount": 100},
  {"region": "EU", "amount": 200},
  {"region": "NA", "amount": 50},
  {"region": "AS", "amount": 300},
  {"region": "EU", "amount": 75}
]}

QUERY:  $.sales
          .group_by(@.region)
          .entries()
          .map(([region, rows]) => {region, total: rows.map(@.amount).sum()})
          .sort(@.total)
          .reverse()
          .take(2)

OUT:    [{"region":"AS","total":300},{"region":"EU","total":275}]
```

`group_by` and `sort` are barriers; `take(2)` after the sort doesn't help —
the sort must complete first. Push the demand earlier where possible.

## 2. Active users + role-based count

```jetro
DOC:    {"users": [
  {"id":1,"role":"admin","active":true},
  {"id":2,"role":"user","active":false},
  {"id":3,"role":"user","active":true},
  {"id":4,"role":"admin","active":true}
]}

QUERY:  $.users
          .filter(@.active)
          .count_by(@.role)

OUT:    {"admin":2,"user":1}
```

Streaming filter + barrier count_by. The filter passes only what's needed;
count_by buffers but with `ValueNeed::Predicate` (only the role key) — the
rest of the user object is never decoded.

## 3. Histogram of word frequency

```jetro
DOC:    {"text": "the quick brown fox jumps over the lazy dog the end"}

QUERY:  $.text
          .words()
          .map(@.lower())
          .count_by(@)

OUT:    {"the": 3, "quick": 1, "brown": 1, ...}
```

## 4. Customer order summary

```jetro
QUERY:  $.orders
          .group_by(@.customer_id)
          .entries()
          .map(([cid, orders]) => {
            customer_id: cid,
            total: orders.map(@.amount).sum(),
            count: orders.count(),
            recent: orders.sort(@.date).last().date
          })
          .sort_by(@.total)
          .reverse()
```

The inner `.sort(@.date).last()` is wasteful: it sorts every group to grab
the last. Rewrite with `max_by`:

```jetro
QUERY:  ...
          .map(([cid, orders]) => {
            customer_id: cid,
            total: orders.map(@.amount).sum(),
            count: orders.count(),
            recent: orders.max_by(@.date).date
          })
```

## 5. Unique recent active sessions

```jetro
QUERY:  $.events
          .filter(@.kind == "login" and .at >= "2026-01-01")
          .map(@.user_id)
          .unique()
          .count()
```

## 6. Pretty-print a CSV from objects

```jetro
QUERY:  $.users
          .filter(@.active)
          .map(u => u.pick(id: id, name: full_name, email))
          .sort(@.id)
          .to_csv()
```

## 7. Find a needle in a deep document

```jetro
QUERY:  $..find(@.id == 42)
```

If the document was loaded from bytes (default), this hits the structural
index — no full traversal.

## 8. Compute deltas with `pairwise`

```jetro
DOC:    {"prices": [100, 105, 102, 110, 108]}

QUERY:  $.prices.pairwise().map(([a, b]) => b - a)
OUT:    [5,-3,8,-2]
```

## 9. Rolling 3-point moving average

```jetro
QUERY:  $.measurements.rolling_avg(3)
```

The first two outputs are `null` until the window fills.

## 10. Build a lookup, then enrich

```jetro
QUERY:  let by_id = $.users.index_by(@.id) in
          $.events.map(e => e.merge({user: by_id[e.user_id].name}))
```

`index_by` is a barrier that runs once; the `.map` streams.

## 11. Select rows with all required fields

```jetro
QUERY:  $.records.filter(r => r.missing("id", "name", "email").count() == 0)
```

## 12. Re-shape a long-format table

```jetro
DOC:    [
  {"y":2024,"q":1,"v":10},{"y":2024,"q":2,"v":20},
  {"y":2025,"q":1,"v":15},{"y":2025,"q":2,"v":25}
]
QUERY:  $.pivot("y", "q", "v")
OUT:    {"2024":{"1":10,"2":20},"2025":{"1":15,"2":25}}
```

## 13. Mask sensitive fields

```jetro
QUERY:  $.users.map(u => u.omit("password", "ssn", "token"))
```

## 14. Delta + cumulative sum

```jetro
QUERY:  $.daily.pairwise().map(([a, b]) => b.value - a.value)
```

> Cumulative-sum form (`.accumulate(0, (a, x) => a + x)`) isn't yet wired up
> in v0.5 — see the [Limitations](../reference/limitations.md) page. Until
> then, `cummax` / `cummin` cover running min/max; full fold needs a host
> loop.

## 15. Migrate a document shape

> ⚠ `rec` is unstable in v0.5 (fixpoint loop bug). For now, prefer
> `walk` / `walk_pre` with a manual shape check, or do the rewrite host-side.

```jetro
QUERY (planned, currently broken):
  $.rec({type: "v1"}, doc =>
    doc.merge({type: "v2"})
       .rename({old_field: "new_field"})
       .omit("legacy_blob"))
```

`rec` walks the document, finds every node matching the shape, and rewrites
in place.
