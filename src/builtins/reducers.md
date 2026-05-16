# Reducers and Aggregates

Reducers consume the whole stream and emit a single value. They terminate
the streaming pipeline.

## Numeric

| Method | Signature | Notes |
|---|---|---|
| `sum` | `Array<Number> -> Number` | Empty → `0` |
| `avg` | `Array<Number> -> Number` | Empty → `null` |
| `min` | `Array<Number\|String> -> ...` | Empty → `null` |
| `max` | `Array<Number\|String> -> ...` | Empty → `null` |

```jetro
QUERY:  [1,2,3,4].sum()     OUT: 10
QUERY:  [1,2,3,4].avg()     OUT: 2.5
QUERY:  [3,1,4,1,5].min()     OUT: 1.0
QUERY:  ["b","a","c"].max()   OUT: "c"
```

Demand law: `NumericReducer` — `ValueNeed::Numeric`, `pull = All`.

## `count`

- **Signature:** `Array -> Number`
- **Behavior:** Element count.
- **Demand:** `All` inputs, `ValueNeed::None` (no payload decoded).

```jetro
QUERY:  $.users.count()
QUERY:  $.users.filter(@.active).count()
```

This is the cheapest reducer — the source skips deserialisation entirely.

## `approx_count_distinct`

> ⚠ **Not yet supported in 0.5.10** — runtime returns `"ApproxCountDistinct:
> builtin unsupported"`. Spec exists; HyperLogLog backend pending.

- **Signature (planned):** `Array<Any> -> Number`
- **Behavior (planned):** Approximate count of distinct values via HLL.

For now, use `.unique().count()` for exact distinct count.

## `any` *(alias `exists`)*

- **Signature:** `Array<A> -> Bool` (with `pred: A -> Bool`)
- **Behavior:** True if any element matches. Short-circuits.

```jetro
QUERY:  $.users.any(@.role == "admin")
OUT:    true
```

## `all`

- **Signature:** `Array<A> -> Bool`
- **Behavior:** True if every element matches. Short-circuits on first false.

```jetro
QUERY:  $.flags.all(@ == true)
```

## `find_index`

- **Signature:** `Array<A> -> Number | null`
- **Behavior:** Zero-based index of first match, or null.

```jetro
QUERY:  ["a","b","c"].find_index(@ == "b")
OUT:    1
```

## `indices_where`

- **Signature:** `Array<A> -> Array<Number>`
- **Behavior:** All indices where `pred` matches.

```jetro
QUERY:  [10, 20, 5, 30, 8].indices_where(@ < 15)
OUT:    [0,2,4]
```

## `max_by` and `min_by`

- **Signature:** `Array<A> -> A | null`
- **Behavior:** Element with the maximum / minimum projected key.

```jetro
QUERY:  $.books.max_by(@.year)
QUERY:  $.users.min_by(@.age)
```

Distinguish from `.sort(@.key).first()` — `max_by` is one pass; the sort form
allocates the sorted array first.

## When to use which

| Goal | Use |
|---|---|
| Sum/avg numbers | `sum`, `avg` |
| Count rows | `count` |
| Exact distinct count | `.unique().count()` |
| Existence check | `any` |
| Universal check | `all` |
| Find index | `find_index` |
| Pick single max/min element | `max_by`, `min_by` |

## Practical examples

```jetro
DOC:    {"books":[
  {"title":"Dune","year":1965,"price":15},
  {"title":"Foundation","year":1951,"price":10},
  {"title":"Hyperion","year":1989,"price":18},
  {"title":"Snow Crash","year":1992,"price":12}
]}

# Total revenue across all books
QUERY:  $.books.map(@.price).sum()
OUT:    55

# Mean price
QUERY:  $.books.map(@.price).avg()
OUT:    13.75

# Earliest and most expensive
QUERY:  $.books.min_by(b => b.year).title
OUT:    "Foundation"

QUERY:  $.books.max_by(b => b.price).title
OUT:    "Hyperion"

# Any cyberpunk in the catalog?
QUERY:  $.books.any(@.tags? and @.tags.includes("cyberpunk"))
# (where @.tags? guards against missing field)

# Count books published before 1970
QUERY:  $.books.filter(@.year < 1970).count()
OUT:    0

# Position of the first 1990s book
QUERY:  $.books.find_index(@.year >= 1990)
OUT:    3

# All published years where price > 12
QUERY:  $.books.indices_where(@.price > 12)
OUT:    []
```
