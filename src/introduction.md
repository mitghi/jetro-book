# Introduction

**Jetro** is a query, transform, and patch engine for JSON, written in Rust. It
parses a small dot-syntax DSL, plans the query through a multi-tier optimizer,
and routes each subtree to whichever execution backend will run it fastest —
zero-copy borrowed views over a simd-json tape, a bitmap structural index, a
streaming pull pipeline, or the universal interpreted fallback.

If you have used `jq`, jetro will feel familiar but takes a different shape:

- **Dot syntax, not pipe-of-filters.** `$.users.filter(active).map(name)` reads
  left-to-right and chains methods. The `|` operator exists, but it is for
  passing a value into an arbitrary expression — not for calling methods with
  arguments.
- **One source of truth per builtin.** Every method is one `impl Builtin for X`
  block: identity, demand law, optimizer hints, and runtime layers all
  co-located. There are 181 of them.
- **Demand-driven planning.** `.first()` doesn't materialise the whole array.
  `.filter(p).take(3)` doesn't filter the whole array. The planner walks
  *backward* from the sink, telling each operator what its source actually
  needs to produce.
- **Writes are first-class.** `$.users[0].name.set("Ada")` rewrites to a fused
  patch over the document. Multiple chain-writes batch through a single fused
  pass.
- **Pattern match with guards.** `match x with { {kind: "err"} -> .msg, _ -> "" }`
  compiles to a Maranget decision tree and runs over `Val`, borrowed `View`,
  and tape domains; deep `..match` is bitmap-accelerated.

## What this book covers

| Part | What you get |
|---|---|
| **Language Reference** | Every grammar form with at least one runnable example. |
| **Concepts** | Pipelines, demand propagation, the cache hierarchy. |
| **Builtin Reference** | One section per builtin — input, output, behavior, examples, demand law, common pitfalls. |
| **Recipes** | Real chained queries, pattern-match cookbook, write-fusion. |
| **Appendix** | The public Rust API (`Jetro`, `JetroEngine`), and a glossary. |

## What this book doesn't cover

Implementation internals — the IR layer, the bytecode VM, plan caching, peephole
passes — are documented in the source. This book stops at user-facing surface,
with one exception: the **demand-propagation chapter**, because demand is what
makes "obvious" queries fast and *not* understanding it leads to surprised
benchmarks.

## Conventions

Examples use this layout:

```
DOC:    {"books": [{"title": "Dune", "year": 1965}, {"title": "Foundation", "year": 1951}]}
QUERY:  $.books.filter(@.year < 1960).map(@.title)
OUT:    ["Foundation"]
```

Where the document matters, you'll see `DOC:`. Where it's obvious from the
query, only `QUERY:` and `OUT:` appear. Method aliases are listed inline:
`unique` *(alias `distinct`)*.

Ready? Start with the [Quick Tour](./quick-tour.md), or jump to the
[Builtin Reference](./builtins/overview.md) if you already know jetro and need a
specific method.

> **One caveat before you read further.** This book documents jetro's
> **intended** semantics. v0.5 has a number of behavior surprises and a few
> unsupported builtins; check
> [Known Limitations](./reference/limitations.md) for the empirically
> validated reality of the current release before copying queries directly
> into production. Major ones: scalar method on a path returns an
> array-wrapped result (`$.x.upper()` → `["FOO"]`); there is no `in`
> operator (`"x" in xs` is a parse error); regex escapes are *single*
> backslash (`"\d"`, not `"\\d"`); `replace` replaces only the first
> occurrence; bare-path inside method args (`.field`) doesn't parse — use
> `@.field` or a named lambda. The limitations page lists every confirmed
> issue.
