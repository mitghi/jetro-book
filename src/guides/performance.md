# Performance Guide

## Fixture

Examples below run against:

```jetro
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}], "user": {"id": 42, "name": "Ada", "email": "ada@x.com", "tags": ["math", "code"], "profile": {"name": "Ada", "email": "ada@x.com"}, "active": true, "verified": true}, "orders": [{"id": 1, "customer": 1, "customer_id": 1, "cid": 1, "amount": 100, "status": "paid", "total": 100, "date": "2024-01-01"}, {"id": 2, "customer": 1, "customer_id": 1, "cid": 1, "amount": 50, "status": "open", "total": 50, "date": "2024-02-01"}, {"id": 3, "customer": 2, "customer_id": 2, "cid": 2, "amount": 75, "status": "paid", "total": 75, "date": "2024-03-01"}], "events": [{"sev": 1, "msg": "ok", "kind": "start"}, {"sev": 2, "msg": "warn", "kind": "end"}, {"sev": 3, "msg": "err", "kind": "start"}], "rows": [{"age": "30", "price": "3.14"}]}
```

How to write jetro queries that the planner can run fast, and how to read
the benchmarks.

## Mental model

Jetro picks one of six backends per pipeline node. Fast paths share three
properties:

1. **The source is a path of pure field accesses.** `$.a.b.c` triggers tape
   backends (zero-copy over simd-json output).
2. **The pipeline ends in a sink that bounds demand.** `.first()`,
   `.take(n)`, `.find(p)`, `.count()` propagate backward and gate source
   reads.
3. **No mid-pipeline materialization.** `.collect()`, `.sort()`,
   `.group_by()` flush the tape access pattern back to a `Val` walk.

If you write to those three rules, queries land on the fast path
automatically.

## Backend selection (cheat-sheet)

| Source / shape | Primary backend |
|---|---|
| `$.a.b.c` (field-chain) | tape-view (zero-copy) |
| `$..find(...)`, `$..shape({...})` | bitmap structural index |
| Single `$.a.b` (path only) | tape-path |
| Generic expr / lambda body | fast-children |
| Any backend declines | interpreted (universal fallback) |

You don't pick — the planner does. Knowing the table tells you *why* a
query is fast.

## Demand: the killer feature

Every `Demand`-aware sink lets the source skip work. Concrete impact:

| Pattern | Speedup vs. naive |
|---|---|
| `xs.first()` | ~N× (reads 1 element) |
| `xs.find(p)` | up to ~N× (stops at first match) |
| `xs.filter(p).take(k)` | up to N/k× |
| `xs.count()` | 2-5× (no payload decoded) |
| `xs.sum()`, `xs.avg()` | 2-3× (only numeric leaves) |
| `xs.last()` (random-access source) | ~N× (seek to end) |
| `xs.reverse().take(k)` | rewritten to `LastInput(k)` |

For wide objects, **field projection** is the other big win:

```jetro
$.users.map(u => u.pick(id, name))
```

The source decodes only `id` and `name` per row. Other fields stay as raw
tape tokens.

## What kills performance

### Mid-chain materialization

```jetro
$.users
  .filter(@.active)
  .collect()                # unnecessary
  .map(@.email)
```

The `.collect()` forces a full pass before `.map`. Drop it.

### Pre-sort barriers blocking demand

```jetro
$.events.sort(@.ts).first()
```

`.sort` is a barrier — must see every element. The `.first()` doesn't help.
Rewrite with `min_by`:

```jetro
$.events.min_by(@.ts)
```

One pass, no allocation of the sorted array.

### Per-element joins (O(n×m))

```jetro
$.orders.map(o => o.merge({name: $.users.find(@.id == o.user_id).name}))
```

Each `find` rescans `$.users`. For large data, build a lookup once:

```jetro
let by_id = $.users.index_by(@.id) in
  $.orders.map(o => o.merge({name: by_id[o.user_id].name}))
```

Or use `equi_join`.

### Repeated sub-expressions

```jetro
$.user.profile.name + " <" + $.user.profile.email + ">"
```

Three tape walks. Bind once:

```jetro
let p = $.user.profile in
  f"{p.name} <{p.email}>"
```

### Heavy lambdas in barriers

```jetro
$.rows.unique_by(@.to_string())
```

`unique_by` calls the lambda once per row. If the projection is
non-trivial (regex, deep traversal), pre-project once:

```jetro
$.rows.map(r => r.merge({_k: r.to_string()}))
     .unique_by(@._k)
     .map(@.omit(_k))
```

## Engine tuning

### Plan cache

`JetroEngine` caches `(query, context) → compiled pipeline`. Default 256
entries, wholesale eviction.

For a small fixed query set with high doc volume — the typical web-server
shape — every call after the first is a cache hit. Don't fight it.

For unique-per-call queries (CLI ad-hoc), the cache is a no-op; just use
`Jetro` directly.

### Path cache

The VM caches resolved pointer paths per document. The hash key includes
both structure *and* primitive values bounded at depth 8 — so two docs with
the same shape but different leaves stay distinct. You don't manage this.

### simd-json (default)

The `simd-json` feature gives ~4× cold-start. Disable only if you need to
round-trip `serde_json::Value` and the conversion cost dominates.

## Benchmarks

```bash
cargo bench -p jetro-core
```

The harness covers:

- Field access (`$.a.b.c`) — tape-view zero-copy
- Filter / map / take pipelines — demand propagation
- Deep search (`..find`, `..shape`) — bitmap structural index
- Pattern match — Maranget tree
- Lambda forms — `@` vs. `=>` vs. `lambda` parity
- Write fusion — single vs. fused multi-writes

To compare your changes against `main`:

```bash
git checkout main
cargo bench -p jetro-core -- --save-baseline main
git checkout your-branch
cargo bench -p jetro-core -- --baseline main
```

Reading the output: criterion reports geometric mean ratios. >5% regression
should have a clear cause.

## Profiling

For Rust workloads:

```bash
cargo bench -p jetro-core --bench <name> -- --profile-time 10
```

Then attach with `samply` or `cargo flamegraph`. Hot paths usually live in:

- `exec/pipeline/exec.rs` — pipeline driver
- `exec/view/*.rs` — borrowed view stages
- `exec/router.rs` — backend selection
- `vm/exec.rs` — bytecode VM (interpreted fallback)

If the interpreter (`vm::execute`) shows up hot, the planner is falling
through to the universal fallback. Check the query — usually a non-`$`
source or a generic expr inside a method arg.

## Quick checklist

Before benchmarking a query, ask:

- [ ] Can `.first()` / `.take()` / `.find()` replace a full materialization?
- [ ] Is there a barrier (`sort`, `unique`, `group_by`) before the bound?
  Push the bound earlier or use a one-pass equivalent (`min_by`,
  `count_by`).
- [ ] Does a lookup repeat per row? Pre-build with `index_by`.
- [ ] Are wide rows projected early with `pick`?
- [ ] Are sub-expressions duplicated? Bind with `let`.
- [ ] Is `simd-json` enabled (default)?
- [ ] Is the same query run many times? Use `JetroEngine`.

If all yes, the query is on the fast path.
