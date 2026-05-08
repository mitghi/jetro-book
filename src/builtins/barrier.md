# Barrier Operators

## Fixture

Examples below run against:

```text
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}], "books": [{"title": "Dune", "year": 1965, "author": "Herbert", "tags": ["sf"], "price": 15, "genre": "sci-fi"}, {"title": "Foundation", "year": 1951, "author": "Asimov", "tags": ["sf", "hugo"], "price": 10, "genre": "sci-fi"}, {"title": "Hyperion", "year": 1989, "author": "Simmons", "tags": ["sf", "hugo"], "price": 18, "genre": "cyberpunk"}, {"title": "Snow Crash", "year": 1992, "author": "Stephenson", "tags": ["sf", "cyberpunk"], "price": 12, "genre": "cyberpunk"}], "records": [{"id": 1, "name": "a", "email": "x@y.com"}, {"id": 2, "name": "b", "email": "u@v.com"}], "daily": [{"day": 1, "value": 10}, {"day": 2, "value": 12}]}
```

Barriers must see the full input before emitting *any* output. They
materialise. Place them late in pipelines when possible.

## Sort

### `sort` *(alias `sort_by`)*

- **Signature:** `Array<A> -> Array<A>`
- **Behavior:** Stable ascending sort. With a projection, sorts by the
  projected key.

```text
QUERY:  [3,1,4,1,5].sort()
OUT:    [1,1,3,4,5]

QUERY:  $.books.sort(@.year)
QUERY:  $.books.sort(b => -b.year)
QUERY:  $.users.sort(@.last_name, @.first_name)
```

Multi-arg form sorts by a tuple of keys.

## Distinct

### `unique` *(alias `distinct`)*

- **Signature:** `Array<A> -> Array<A>`
- **Behavior:** Remove duplicates by structural equality, preserving first
  occurrence order.

```text
QUERY:  [3,1,4,1,5,9,2,6,5].unique()
OUT:    [3,1,4,5,9,2,6]
```

### `unique_by(f)`

- **Signature:** `Array<A> -> Array<A>`
- **Behavior:** Dedup by projected key.

```text
QUERY:  $.books.unique_by(@.author)
```

## Group / count / index

### `group_by(key)`

- **Signature:** `Array<A> -> Object<KeyString, Array<A>>`
- **Behavior:** Bucket by projected key.

```text
QUERY:  $.books.group_by(@.author)
OUT:    {"null":[null]}
```

### `count_by(key)`

- **Signature:** `Array<A> -> Object<KeyString, Number>`
- **Behavior:** Bucket counts.

```text
QUERY:  $.books.count_by(@.author)
OUT:    [null]
```

### `index_by(key)`

- **Signature:** `Array<A> -> Object<KeyString, A>`
- **Behavior:** Index by key. Last wins on collision.

```text
QUERY:  $.users.index_by(@.id)
OUT:    [null]
```

### `group_shape`

> ⚠ **Not yet supported in v0.5** — runtime returns `"GroupShape: builtin
> unsupported"`. Tracked for a future release.

- **Signature:** `Array<Object> -> Array<Object>`
- **Behavior (planned):** Group by structural shape (key set).

## Partition

### `partition(pred)`

> ⚠ **Not yet supported in v0.5** for chained / pipeline use. The `apply_*`
> trait dispatch isn't wired through the streaming planner; calling it inside
> a chain like `$.store.books.partition(@.x)` is unreliable. Spec exists but
> output shape and execution path are subject to change.

- **Signature (planned):** `Array<A> -> [Array<A>, Array<A>]`
- **Behavior (planned):** `[matching, non-matching]`.

## Window / chunk

### `window(size)`

- **Signature:** `Array<A> -> Array<Array<A>>`
- **Behavior:** Sliding window of `size`.

```text
QUERY:  [1,2,3,4,5].window(3)
OUT:    [[1,2,3],[2,3,4],[3,4,5]]
```

### `chunk(size)` *(alias `batch`)*

- **Signature:** `Array<A> -> Array<Array<A>>`
- **Behavior:** Non-overlapping chunks. Last chunk may be shorter.

```text
QUERY:  [1,2,3,4,5,6,7].chunk(3)
OUT:    [[1,2,3],[4,5,6],[7]]
```

## Rolling aggregates

| Method | Behavior |
|---|---|
| `rolling_sum(n)` | Sum over a window of size `n` |
| `rolling_avg(n)` | Average over a window |
| `rolling_min(n)` | Min over a window |
| `rolling_max(n)` | Max over a window |

```text
QUERY:  [1,2,3,4,5].rolling_sum(3)
OUT:    [null,null,6.0,9.0,12.0]
```

The leading `n-1` positions emit `null` until the window fills.

## `accumulate(init, fn)`

> ⚠ **Not yet supported in v0.5** — runtime returns `"accumulate: builtin
> not migrated to builtins.rs AST adapter"`. Spec exists; runtime hookup
> pending.

- **Signature (planned):** `Array<A> -> Array<B>` (with `fn: (B, A) -> B`, `init: B`)
- **Behavior (planned):** Streaming fold producing intermediate states.

For now, use `cummax` / `cummin` for running min/max, or build the fold
with a `let` + recursive helper if absolutely needed.

## When to barrier

You have to barrier when:

- Order needs computation (`sort`, `unique`)
- Output is grouped / indexed (`group_by`, `index_by`)
- A window crosses element boundaries (`window`, `rolling_*`)

You don't need a barrier for:

- Per-element transforms (`map`)
- Predicates (`filter`)
- Numeric reducers (`sum`, `count`) — they're streaming reducers, not
  barriers

## Practical examples

```text
DOC:    {"books":[
  {"title":"Dune","year":1965,"author":"Herbert","price":15},
  {"title":"Foundation","year":1951,"author":"Asimov","price":10},
  {"title":"Hyperion","year":1989,"author":"Simmons","price":18},
  {"title":"Snow Crash","year":1992,"author":"Stephenson","price":12}
]}

# Sort by year ascending
QUERY:  $.books.sort(b => b.year).map(@.title)
OUT:    [null]

# Sort by price descending (negate the key)
QUERY:  $.books.sort(b => -b.price).map(@.title)
OUT:    [null]

# Distinct tags across books
QUERY:  $.books.flat_map(@.tags).unique()

# How many distinct authors
QUERY:  $.books.unique_by(b => b.author).count()
OUT:    1

# Group by author
QUERY:  $.books.group_by(b => b.author)
OUT:    {"null":[null]}

# Histogram of authors (prefer count_by — no buffering of bucket payloads)
QUERY:  $.books.count_by(b => b.author)
OUT:    [null]

# Build a quick lookup table
QUERY:  $.users.index_by(u => u.id)

# Sliding-3 windows for moving stats
QUERY:  $.measurements.window(3).map(w => w.sum() / 3)

# 50/50 split into batches of 10 for paginated processing
QUERY:  $.records.chunk(10)

# 7-day moving average over a numeric series
QUERY:  $.daily.rolling_avg(7)
```
