# Pipelines

A jetro query is a **pipeline** of stages. The shape is always:

```
Source → Stage* → Sink
```

`Source` produces values one at a time. Each `Stage` consumes one value and
produces zero, one, or many. The `Sink` collects results.

## What counts as a stage

| Stage | Examples | Output |
|---|---|---|
| **One-to-one** | `.map`, `.enumerate`, `.lag`, `.zscore` | One out per in |
| **Filter** | `.filter`, `.find`, `.compact`, `.takewhile` | Zero or one out per in |
| **Expander** | `.flat_map`, `.flatten`, `.split`, `.lines`, `.chars` | Many out per in |
| **Reducer** | `.sum`, `.count`, `.min`, `.any`, `.find_index` | One total |
| **Positional** | `.first`, `.last`, `.nth(i)`, `.collect` | One or N |
| **Barrier** | `.sort`, `.unique`, `.group_by`, `.window`, `.chunk` | Buffers, then emits |

A reducer or positional terminator ends the pipeline; further methods chain
on the *result* (a scalar or array) rather than streaming.

## Streaming vs. barrier

Most stages stream — they process one value, emit, repeat. The pull-based
backend means each value travels end-to-end before the next is fetched. This
is what makes early termination work (`.first`, `.find`).

Barriers cannot stream: `.sort` must see every element before it can emit
*any*. The pipeline buffers up to the barrier, runs the barrier as a unit,
then resumes streaming if more stages follow.

```text
$.xs.map(f).filter(p).sort(@.x).take(10).map(g)
        \________________/   \____________/
            streaming         streaming again
                          ↑
                    barrier point
```

Barriers carry an `apply_barrier` method on the builtin.

## Sources

The most common source is a path: `$.users` is a source. Other shapes:

- An array literal (`[1,2,3].map(f)`)
- A range (`(0..10).map(f)`)
- A method that returns a sequence (`$.text.lines().map(...)`)

## Sinks

If your final stage is a reducer, the sink is the reducer's accumulator.
If it's a streaming stage, the sink collects into an array.

`.collect()` is the explicit sink: scalar in → `[scalar]`, array in → identity,
null in → `[]`. Use it when you need a deterministic array shape.

## Composed stages

Adjacent stages get **composed** when possible: two `Stage`s fold into one
virtual call per element. This is `Composed<A, B>` under the hood; the
optimizer fuses chains of `.map`s, `.filter`s, and `.pick`s aggressively.

User-visible effect: writing many short stages costs roughly the same as one
big lambda — write for clarity.

## Backend selection

Each pipeline node carries a *list of preferred backends*. The router tries
them in order; the first to declare it can run the node wins.

| Source | Preferred backends |
|---|---|
| `FieldChain` (e.g. `$.a.b.c`) | tape-view → tape-rows → materialised → val-view → interpreted |
| Generic expression | fast-children → interpreted |
| Deep search | structural index → interpreted |
| Single root path | tape-path → interpreted |

You don't pick the backend — the planner does. But knowing they exist
explains why simple queries are fast: they often run zero-copy over the
simd-json tape.

## When to think about pipeline shape

In practice, almost never. Two cases:

1. **Don't sort until you have to.** A pre-sort barrier defeats early
   termination. Push `.filter`, `.take`, `.first` *before* `.sort` if the
   semantics allow.
2. **Avoid full materialisation in the middle.** Chains of streaming stages
   stay zero-copy. A `.collect()` mid-chain forces a full pass.

The next chapter, [Demand Propagation](./demand.md), explains *why* these
heuristics work.
