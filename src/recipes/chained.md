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
DOC:    {"daily":[{"value":10},{"value":15},{"value":12},{"value":20}]}

QUERY:  $.daily
          .pairwise()
          .map(([a, b]) => b.value - a.value)

OUT:    [5,-3,8]
```

For a running total, use `accumulate`:

```jetro
DOC:    {"amounts":[10,12,9]}

QUERY:  $.amounts.accumulate(0, (total, x) => total + x)

OUT:    [10,22,31]
```

## 15. Classify rows with `match`

```jetro
DOC:    {"books": [
  {"title":"Dune","year":1965,"tags":["sf"]},
  {"title":"Snow Crash","year":1992,"tags":["sf","cyberpunk"]},
  {"title":"Foundation","year":1951,"tags":["sf","hugo"]}
]}

QUERY:  $.books
          .map(book => {
            title: book.title,
            era: match book with {
              {year: y when y < 1970} -> f"classic {y}",
              {year: y} -> f"modern {y}",
              _ -> "unknown"
            },
            tag_count: book.tags.count()
          })

OUT:    [
  {"title":"Dune","era":"classic 1965","tag_count":1},
  {"title":"Snow Crash","era":"modern 1992","tag_count":2},
  {"title":"Foundation","era":"classic 1951","tag_count":2}
]
```

## 16. Latest active rows from NDJSON

```bash
jetrocli --ndjson -i users.topic --payload-after '|' -e '
  $.rows()
    .reverse()
    .distinct_by(@.id)
    .filter(@.active)
    .take(100)
    .map({
      id: $.id,
      name: $.profile.name,
      city: $.profile.address.city
    })
'
```

On a compacted Kafka-style file, reverse rows make the newest record for each
key appear first. `distinct_by(@.id)` keeps that first row and discards older
duplicates as soon as the key has been seen.

## 17. Patch several paths in one pass

```jetro
DOC:    {"books":[
  {"title":"Dune","year":1965,"tags":["sf"],"tmp":true},
  {"title":"Snow Crash","year":1992,"tags":["sf"],"tmp":true}
]}

QUERY:  $.update({
          books[*].tags: @ + ["catalog"],
          books[*].reviewed: true,
          books[*].tmp: DELETE
        })

OUT:    {"books":[
  {"title":"Dune","year":1965,"tags":["sf","catalog"],"reviewed":true},
  {"title":"Snow Crash","year":1992,"tags":["sf","catalog"],"reviewed":true}
]}
```

The planner can batch compatible rooted writes so shared ancestors are cloned
once and all writes under that prefix are applied together.

## 18. Migrate a document shape

Use `walk` when every nested object with a matching shape must be rewritten:

```jetro
QUERY:
  $.walk(node =>
    node.merge({type: "v2"})
        .rename({old_field: "new_field"})
        .omit("legacy_blob")
    if node is object and node.type == "v1" else node)
```

For query-local rewrites on known paths, prefer `update(...)`; for broad shape
migration, `walk` makes the traversal explicit.
