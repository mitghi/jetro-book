# A 20-Minute Tour

This tour shows jetro as it is meant to be used: functional JSON querying,
shape-aware projection, pattern matching, whole-document updates, and fast
NDJSON workflows. Every example with an `OUT:` block has been checked against
the current `jetrocli`.

Run a query against a JSON file:

```bash
jetrocli -e '$.books.count()' < tour.json
```

Run a query against NDJSON:

```bash
jetrocli --ndjson -i events.ndjson -e '$.id'
```

## The document for this tour

Save this as `tour.json` if you want to run the examples:

```json
{
  "books": [
    {"title": "Dune", "year": 1965, "author": {"name": "Herbert"}, "isbn": "9780441172719", "score": 98, "price": 15, "tags": ["sf"]},
    {"title": "Foundation", "year": 1951, "author": {"name": "Asimov"}, "isbn": "9780553293357", "score": 94, "price": 10, "tags": ["sf", "hugo"]},
    {"title": "Hyperion", "year": 1989, "author": {"name": "Simmons"}, "isbn": "9780553283686", "score": 96, "price": 18, "tags": ["sf", "hugo"]},
    {"title": "Snow Crash", "year": 1992, "author": {"name": "Stephenson"}, "isbn": "9780553380958", "score": 91, "price": 12, "tags": ["sf", "cyberpunk"]}
  ],
  "users": [
    {"id": 1, "name": "Ada", "active": true, "role": "admin", "email": "ada@example.com"},
    {"id": 2, "name": "Bob", "active": false, "role": "user"},
    {"id": 3, "name": "Cy", "active": true, "role": "user", "email": "cy@example.com"}
  ],
  "orders": [
    {"id": 100, "user_id": 1, "total": 120, "status": "paid"},
    {"id": 101, "user_id": 1, "total": 40, "status": "open"},
    {"id": 102, "user_id": 3, "total": 80, "status": "paid"}
  ],
  "meta": {"active": true, "version": 1}
}
```

## 1. Path navigation

```jetro
QUERY:  $.books[0].title
OUT:    "Dune"

QUERY:  $.books[-1].title
OUT:    "Snow Crash"
```

`$` is the root, `.books` is field access, `[0]` is an array index, and
negative indexes count from the end.

## 2. Wildcards

```jetro
QUERY:  $.books[*].title
OUT:    ["Dune","Foundation","Hyperion","Snow Crash"]
```

`[*]` selects every array element. It is useful for direct path projection;
for richer transforms, use `map`.

## 3. Functional filters

```jetro
QUERY:  $.books.filter(@.year > 1980).map(@.title)
OUT:    ["Hyperion","Snow Crash"]
```

Inside `filter`, `map`, `sort`, and similar methods, `@` is the current item.

## 4. Lambda forms

The lambda forms below are equivalent for this query:

```jetro
QUERY:  $.books.filter(b => b.year > 1980).map(b => b.title)
OUT:    ["Hyperion","Snow Crash"]
```

You can also write:

```jetro
$.books.filter(@.year > 1980)
$.books.filter(.year > 1980)
$.books.filter(lambda b: b.year > 1980)
```

Use the form that reads best. Single-argument lambdas lower to the same
effective query shape where legal.

## 5. Reducers

```jetro
QUERY:  $.books.count()
OUT:    4

QUERY:  $.books.map(@.year).min()
OUT:    1951

QUERY:  $.books.map(@.price).avg()
OUT:    13.75
```

Reducers consume a stream and return one value.

## 6. Sort, take, and top-N

```jetro
QUERY:  $.books.sort(b => -b.score).take(2).map(@.title)
OUT:    ["Dune","Hyperion"]
```

This reads as “highest score first, keep two, return titles.” The planner can
use downstream demand such as `take(2)` when a bounded strategy is safe.

## 7. Count by key

```jetro
QUERY:  $.users.count_by(@.role)
OUT:    {"admin":1,"user":2}
```

`count_by`, `group_by`, and `index_by` are barrier-style operators: they need
to see the input group before producing the aggregate structure.

## 8. Object projection

```jetro
QUERY:
  $.books.map(b => {
    title: b.title,
    author: b.author.name,
    classic: b.year < 1970,
    tag_count: b.tags.count()
  })
OUT:
  [
    {"author":"Herbert","classic":true,"tag_count":1,"title":"Dune"},
    {"author":"Asimov","classic":true,"tag_count":2,"title":"Foundation"},
    {"author":"Simmons","classic":false,"tag_count":2,"title":"Hyperion"},
    {"author":"Stephenson","classic":false,"tag_count":2,"title":"Snow Crash"}
  ]
```

Projection is ordinary expression syntax, so fields can be renamed, nested,
computed, and mixed freely.

## 9. Predicates and missing fields

```jetro
QUERY:  $.users.map(u => {name: u.name, has_email: u.has_key("email")})
OUT:    [{"has_email":true,"name":"Ada"},{"has_email":false,"name":"Bob"},{"has_email":true,"name":"Cy"}]

QUERY:  $.users.map(u => {name: u.name, missing: u.missing("email", "role")})
OUT:    [{"missing":[],"name":"Ada"},{"missing":["email"],"name":"Bob"},{"missing":[],"name":"Cy"}]
```

Use `has_key` for object-key existence, `includes` for value membership, and
`missing` for schema checks.

## 10. Pattern matching

```jetro
QUERY:
  $.books.map(book => {
    title: book.title,
    label: match book with {
      {tags: ["sf", "cyberpunk"]} -> "cyberpunk",
      {year: y} when y < 1970 -> f"classic {y}",
      _ -> "modern"
    }
  })
OUT:
  [
    {"label":"classic 1965","title":"Dune"},
    {"label":"classic 1951","title":"Foundation"},
    {"label":"modern","title":"Hyperion"},
    {"label":"cyberpunk","title":"Snow Crash"}
  ]
```

Patterns are checked top-down. Put specific arms before broad fallback arms.

## 11. Deep search

```jetro
QUERY:  $..find(@.isbn == "9780553293357")[0].title
OUT:    "Foundation"
```

`$..find(...)` walks descendants and collects matches. Deep queries can use
structural indexing when the source was loaded from bytes.

## 12. Pipe and ternary

```jetro
QUERY:  $.books.count() | "found " + (@ as string) + " books"
OUT:    "found 4 books"
```

`|` passes the left value into the right expression as `@`. It is value flow,
not method dispatch.

## 13. F-strings

```jetro
QUERY:  $.books.map(b => f"{b.title} ({b.year})")
OUT:    ["Dune (1965)","Foundation (1951)","Hyperion (1989)","Snow Crash (1992)"]
```

F-strings are useful for labels, logs, CSV-ish output, and report fields.

## 14. Batched document update

```jetro
QUERY:
  $.update({
    "books[*].tags": @.append("tour"),
    "books[*].reviewed": true,
    "meta.version": @ + 1
  })
```

`update` returns the full document. Compatible rooted writes are planned
together, so shared ancestors can be cloned once and rewritten in one batch.

## 15. Conditional update

```jetro
QUERY:  $.books[* if year > 1980].update({tags: tags.append("modern")})
```

Filtered wildcards let updates target many items without writing a host loop.
The result is still the full document with untouched subtrees preserved.

## 16. NDJSON row-local mode

For this file:

```ndjson
{"id":1,"name":"Ada","active":true}
{"id":2,"name":"Bob","active":false}
{"id":3,"name":"Cy","active":true}
```

Run:

```bash
jetrocli --ndjson -i events.ndjson -e '$.id'
```

Output:

```ndjson
1
2
3
```

Without `$.rows()`, NDJSON mode evaluates the expression once per row.

## 17. Whole-stream NDJSON with `$.rows()`

```bash
jetrocli --ndjson -i events.ndjson \
  -e '$.rows().filter($.active).map({id: $.id, name: $.name})'
```

Output:

```ndjson
{"id":1,"name":"Ada"}
{"id":3,"name":"Cy"}
```

`$.rows()` switches from row-local evaluation to one expression over the whole
stream.

## 18. Reverse NDJSON for compacted topics

For Kafka-style records where the payload starts after `|`:

```text
1|{"id":1,"name":"Ada old","active":false}
2|{"id":2,"name":"Bob","active":true}
1|{"id":1,"name":"Ada","active":true}
```

Run:

```bash
jetrocli --ndjson -i users.topic --payload-after '|' -e '
  $.rows()
    .reverse()
    .distinct_by($.id)
    .filter($.active)
    .map({id: $.id, name: $.name})
'
```

Output:

```ndjson
{"id":1,"name":"Ada"}
{"id":2,"name":"Bob"}
```

This is built for compacted-topic inspection: scan newest-to-oldest,
keep the first row for each key, and discard older duplicates.

## 19. Demand-aware execution

These are ordinary queries:

```jetro
$.books.map(@.isbn).last()
$.books.filter(@.score > 95).first()
$.books.sort(b => -b.score).take(2)
```

Jetro plans from the demanded result backward. Pure one-to-one maps can be
delayed, `first` and `take` can bound input, and tape-backed sources can avoid
materializing values until a stage actually needs them.

## 20. Rust embedding

Use the small facade for one document:

```rust
let j = jetro::Jetro::from_bytes(bytes)?;
let out = j.collect("$.books.filter(@.year > 1980).map(@.title)")?;
```

Use `JetroEngine` when you want a long-lived engine with plan and VM reuse:

```rust
use jetro::JetroEngine;
use serde_json::json;

let eng = JetroEngine::default();
let doc = json!({"x":[1,2,3,4,5]});
let v = eng.collect_value(doc, "$.x.filter(@ > 2).sum()")?;
assert_eq!(v, json!(12));
```

## What to read next

The tour covered the surface area. For depth:

- [Grammar Overview](./grammar/overview.md)
- [Builtin Reference](./builtins/overview.md)
- [NDJSON and Whole-Stream Queries](./guides/ndjson.md)
- [Demand Propagation](./concepts/demand.md)
