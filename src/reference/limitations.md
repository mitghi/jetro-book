# Known Limitations and Behavior Notes (0.5.11)

This page documents current boundaries and intentional language choices for
jetro 0.5.11. It is not a bug graveyard: fixed audit items have moved back
into their normal reference pages.

## Current Boundaries

### `$.rows()` is a root stream source

`$.rows()` starts a source-level stream. In NDJSON mode it means "all rows in
the file or reader"; in normal JSON mode it means "the top-level array
elements" or one row for an object/scalar.

Supported:

```jetro
$.rows().filter($.active).take(10)
$.rows().reverse().distinct_by($.id).take(100)
```

Not yet supported:

```jetro
$.books.rows().take(10)
```

Nested stream sources need a separate design because they mix document-local
arrays with source-level IO and reverse traversal.

### Reader-backed reverse NDJSON is unsupported

`$.rows().reverse()` needs a seekable file-backed source. It works with
`run_ndjson_file`, `NdjsonSource::file`, and `jetrocli --ndjson -i file`.
Reader-backed NDJSON sources return a clear error instead of materializing the
whole stream implicitly.

### Row-stream operators are deliberately small

Current `$.rows()` stream mode supports the operators needed for retained-row
workloads:

- `reverse()`
- `filter(pred)`
- `find(pred)` / `find_first(pred)` / `find_one(pred)`
- `distinct_by(key)`
- `take(n)` / `first()`
- `map(expr)`

Operators such as `sort`, `group_by`, windows, joins, and multi-source
streaming are normal array/document operators, but not yet source-level
`$.rows()` stages.

### Parallel NDJSON is selective

File-backed row-stream partitioning is automatic only for plans where it is
expected to help. For example, selective `filter(...).take(n)` can benefit
from partitioned scanning. Plain `map(...).take(n)` stays sequential because
it can stop after the first `n` rows without scanning unrelated partitions.

### Public observability is still minimal

The engine records internal rows-stream stats for tests and future explain
output, but 0.5.11 does not expose a stable public `explain()` API yet.

## Intentional Language Choices

### No `in` operator

`in` would conflict with `let x = y in z` and `for x in xs`. Use `has`,
`includes`, or `has_key`:

```jetro
$.tags.includes("urgent")
$.user.has_key("email")
$.users has {id: 1}
```

### `has`, `has_key`, `includes`, and `has_path` differ

| Form | Meaning |
|---|---|
| `obj.has_key("k")` | Object key exists |
| `obj.has("k")` | Key/index style existence helper |
| `xs.includes(v)` | Value membership |
| `doc.has_path("a.b")` | Path exists in a nested structure |
| `x has y` | Membership/containment operator sugar |

Use `has_key` when you specifically want an object-key check.

### `replace` is single-occurrence

`.replace(needle, with)` replaces only the first match. Use `replace_all`
for every occurrence:

```jetro
"hello hello".replace("hello", "hi")      # "hi hello"
"hello hello".replace_all("hello", "hi")  # "hi hi"
```

### Comments are outside the query language

Jetro expressions do not contain comments. Keep query comments in the host
language, shell script, or documentation.

## Safety Limits

### `rec(fn)` has an iteration cap

`rec(fn)` runs until a deep structural fixpoint. If the function never
converges, jetro stops at the iteration cap and reports an error. Prefer
`rec(fn, cond)` when the loop has an explicit bound.

```jetro
$.state.rec(step, done)
```

### NDJSON line size is bounded

NDJSON readers enforce a per-line byte cap to avoid unbounded memory use on
malformed input. Tune it with `NdjsonOptions` or the CLI flag when processing
legitimately huge rows.

## Version Note

This page reflects jetro 0.5.11. If a page elsewhere still carries an older
audit note, prefer this page and the current builtin reference.
