# Builtin Reference — Overview

Jetro ships 181 builtin methods. They fall into 18 categories. Every method
has the same shape:

```
.method(arg1, arg2, …)
```

…or, when the parser routes through inline path filters and sugar:

```
$.path.method(...)
```

This part documents every method. Each entry follows the format:

> **`name`** *(aliases: …)*
>
> - **Signature:** what it takes and returns
> - **Behavior:** one-paragraph description
> - **Example:** at least one minimal runnable example
> - **Demand law / Notes:** when relevant

## Index

| Category | What goes here | Page |
|---|---|---|
| Value introspection | `type`, `len`, `schema`, JSON round-trip | [Introspection](./introspection.md) |
| Numeric scalars | `ceil`, `floor`, `round`, `abs` | [Numeric](./numeric.md) |
| String transforms | `upper`, `trim`, `pad_*`, `slice`, `replace` … | [String](./string.md) |
| String search / regex | `starts_with`, `match_*`, `captures`, `split_re` | [String Search](./string-search.md) |
| Conversion | `to_number`, `parse_int`, `parse_bool` | [Conversion](./conversion.md) |
| Streaming one-to-one | `map`, `enumerate`, `pairwise`, `lag`, `zscore` | [Streaming](./streaming.md) |
| Filtering | `filter`, `find`, `compact`, `takewhile` | [Filtering](./filtering.md) |
| Expanding | `flat_map`, `flatten`, `lines`, `chars` | [Expanding](./expanding.md) |
| Reducers | `sum`, `count`, `any`, `max_by` | [Reducers](./reducers.md) |
| Positional | `first`, `last`, `nth`, `collect` | [Positional](./positional.md) |
| Barriers | `sort`, `unique`, `group_by`, `window` | [Barrier](./barrier.md) |
| Arrays / sets | `append`, `diff`, `union`, `zip` | [Arrays](./arrays.md) |
| Objects | `keys`, `pick`, `merge`, `transform_values` | [Objects](./objects.md) |
| Path mutation | `get_path`, `set_path`, `set`, `update` | [Path Mutation](./path-mutation.md) |
| Deep traversal | `deep_find`, `walk`, `rec` | [Deep](./deep.md) |
| Predicates | `has`, `missing`, `includes`, `index` | [Predicates](./predicates.md) |
| Tabular | `to_csv`, `to_tsv` | [Tabular](./tabular.md) |
| Relational | `equi_join` | [Relational](./relational.md) |

## Notation in this part

- *aliases* — alternative names accepted by the parser. They lower to the
  same builtin and behave identically.
- "demand law" — what kind of `Demand` this builtin propagates upstream. See
  [Demand Propagation](../concepts/demand.md) for the model.
- "barrier" / "stream" / "scalar" — execution shape (does it buffer, stream,
  or run once on a single value).

When a method appears under multiple categories (e.g. `.find` is both a
filter and positional), it lives in the most specific chapter and is
cross-linked.

## Not yet supported

A handful of builtins are catalogued in the dispatch enum but not yet wired
through the runtime in v0.5: **`accumulate`**, **`partition`** (in chained
form), **`zip_shape`**, **`group_shape`**, **`approx_count_distinct`**.
Plus **`rec`**, **`update`**, **`missing`**, and `get_path` with nested
paths have known behavioral bugs. See
[Known Limitations](../reference/limitations.md) for workarounds and the
full list of v0.5 surprises (path-call wrapping, regex escape semantics,
pattern-match shorthand, list-comp over `$.path`, etc.).

## Aliases at a glance

| Canonical | Aliases |
|---|---|
| `any` | `exists` |
| `chunk` | `batch` |
| `drop_while` | `dropwhile` |
| `take_while` | `takewhile` |
| `includes` | `contains` |
| `skip` | `drop` |
| `sort` | `sort_by` |
| `unique` | `distinct` |
| `deep_find` | `..find` (deep-method form) |
| `deep_shape` | `..shape` |
| `deep_like` | `..like` |

These pairs are interchangeable. Pick whichever reads better.
