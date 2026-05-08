# Demand Propagation

Demand propagation is the planner pass that makes "obvious" queries fast.
It walks the pipeline **backward** — from sink to source — asking each
operator: *given what comes after you, what do you actually need from your
source?*

The answer is encoded in three lanes per stage and then used at execution
time to skip work.

## The three lanes

### 1. `PullDemand` — how many inputs?

| Variant | Meaning |
|---|---|
| `All` | Read everything |
| `FirstInput(n)` | Stop after `n` inputs |
| `LastInput(n)` | Seek to the end, take last `n` |
| `NthInput(i)` | Jump to a single index |
| `UntilOutput(n)` | Keep reading until `n` outputs are produced |

### 2. `ValueNeed` — what payload from each input?

| Variant | Meaning |
|---|---|
| `None` | Don't decode the row at all |
| `Predicate` | Only what the predicate touches |
| `Projection` | Only the fields used in a projection |
| `Numeric` | Only numeric content |
| `Whole` | The full row (default pessimistic) |

### 3. `order: bool` — does input order matter?

Some sinks (e.g. `.sum()`) don't care about order. The planner can use this
to enable parallel-friendly access patterns when supported.

## Backward walk

For a pipeline `s1 → s2 → … → sN → sink`, the planner does:

```
demand = sink_demand
for op in [sN, …, s2, s1]:        # reverse order
    upstream = op.propagate_demand(demand)
    record (op, downstream=demand, upstream)
    demand = upstream
```

The final `demand` is what the **source** must satisfy. The source backend
chooses an access strategy that matches.

## Operator laws

Every builtin declares one of these laws (in `defs.rs`):

| Law | Effect on demand |
|---|---|
| `Identity` | Pass through unchanged (e.g. `.upper`, `.lower`) |
| `MapLike` | Preserve pull, force `ValueNeed::Whole` |
| `FilterLike` | `FirstInput(n)` becomes `UntilOutput(n)` |
| `TakeWhile` | Same as filter, but bounded |
| `UniqueLike` | Must scan until N distinct outputs |
| `Take(n)` | Cap pull at `FirstInput(n)` |
| `First` | Always `FirstInput(1)` |
| `Last` | Always `LastInput(1)` |
| `Count` | All inputs, `ValueNeed::None` |
| `NumericReducer` | All inputs, `ValueNeed::Numeric` |

## Six worked examples

### A. Early termination on `.first`

```text
$.items.map(name).first()
```

- `first()` declares `FirstInput(1)` to its source
- `.map(name)` is `MapLike`: preserves pull, demands `Whole` from items
- Source receives: read 1 item, decode fully

Without demand: read all items, decode all, take first.

### B. Bounded filter

```text
$.items.filter(active).take(3)
```

- `take(3)` ← `FirstInput(3)`
- `filter(active)` ← `UntilOutput(3)` (read until 3 pass)
- Source: read until 3 active items found

Without demand: filter the entire array, then slice.

### C. Field-level projection

```text
$.users.map(u => {id, name})
```

- The map projection touches `id` and `name`
- Source: decode only `id`, `name` from each user

Other fields are not allocated. Over a wide-record document, this is the
biggest win.

### D. Last-element scan

```text
$.logs.filter(severity >= 3).last()
```

- `last()` ← `LastInput(1)`
- `filter(...)` ← `UntilOutput(1)` from the **end**
- Source: scan backward, stop after first match

Without demand: scan forward, materialise all matches, take last.

### E. Count without payloads

```text
$.items.filter(status == "done").count()
```

- `count()` declares `ValueNeed::None`
- `filter(...)` declares `Predicate` on `status`
- Source: decode only `status`, no other fields

### F. Reverse + take

```text
$.items.reverse().take(2)
```

- `take(2)` ← `FirstInput(2)`
- `reverse()` flips: source receives `LastInput(2)`
- Source: seek to end, read 2 backward, then reverse

## What demand does *not* do

- It does not change result semantics. Two pipelines with identical text
  produce identical output regardless of demand state.
- It does not optimise across barriers (`.sort`, `.group_by`). A barrier
  forces `All` upstream — it must see every input.
- It does not move work between stages. Operators don't fuse; demand only
  *gates* what they read.

## When you'll feel demand kick in

Three rough rules of thumb:

1. **Put `take`/`first`/`find` near the end.** That's how their pull demand
   reaches back to the source.
2. **Project early when possible.** `map(@.field)` upstream of a barrier
   reduces the buffered set.
3. **Avoid unnecessary `collect()`.** It forces full materialisation and
   resets the demand walk.

Demand is invisible most of the time — your queries get faster than they
"should" be, and that's exactly the goal.
