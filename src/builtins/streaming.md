# Streaming One-to-One

Each input produces exactly one output. These compose freely; the planner
fuses adjacent stages into a single composed stage when possible.

## Fixture

Examples in this chapter run against:

```json
{
  "users": [{"id":1,"name":"Ada"},{"id":2,"name":"Bob"}],
  "xs":    [1, 2, 3, 4, 5],
  "prices":[100, 105, 102, 110, 108, 115]
}
```

## `map`

- **Signature:** `Array<A> -> Array<B>` (with `f: A -> B`)
- **Demand law:** `MapLike` — preserves pull, forces `Whole`.

```text
QUERY:  $.users.map(u => u.name)
OUT:    ["Ada","Bob"]

QUERY:  $.xs.map(@ * 2)
OUT:    [2, 4, 6, 8, 10]

QUERY:  $.users.map(@.name.upper())
OUT:    ["ADA","BOB"]
```

`map` is the workhorse. The lambda may use any of the three forms.

## `enumerate`

- **Signature:** `Array<A> -> Array<{index: Number, value: A}>`
- **Behavior:** Pair each element with its zero-based index. Output is a
  record `{index, value}` per element.

```text
QUERY:  $.xs.enumerate()
OUT:    [{"index":0,"value":1},{"index":1,"value":2},{"index":2,"value":3},{"index":3,"value":4},{"index":4,"value":5}]

QUERY:  $.users.map(@.name).enumerate()
OUT:    [{"index":0,"value":"Ada"},{"index":1,"value":"Bob"}]
```

## `pairwise`

- **Signature:** `Array<A> -> Array<[A, A]>`
- **Behavior:** Yield consecutive pairs `[xs[0], xs[1]]`, `[xs[1], xs[2]]`, …

```text
QUERY:  [1,2,3,4].pairwise()
OUT:    [[1,2],[2,3],[3,4]]

QUERY:  $.xs.pairwise().map(p => p[1] - p[0])
OUT:    [1, 1, 1, 1]
```

## `lag(n=1)` and `lead(n=1)`

- **Signature:** `Array<Number> -> Array<Number | null>`
- **Behavior:** Shift by `n` positions; out-of-range positions become `null`.
- **Numeric:** Output values are returned as floats regardless of input
  numeric type.

```text
QUERY:  $.xs.lag()
OUT:    [null, 1.0, 2.0, 3.0, 4.0]

QUERY:  $.xs.lead()
OUT:    [2.0, 3.0, 4.0, 5.0, null]

QUERY:  $.xs.lag(2)
OUT:    [null, null, 1.0, 2.0, 3.0]
```

## `diff_window(n=1)`

- **Signature:** `Array<Number> -> Array<Number | null>`
- **Behavior:** `xs[i] - xs[i - n]`, with `null` until lag is satisfied.

```text
QUERY:  $.prices.diff_window()
OUT:    [null, 5.0, -3.0, 8.0, -2.0, 7.0]
```

## `pct_change(n=1)`

- **Signature:** `Array<Number> -> Array<Number | null>`
- **Behavior:** `(xs[i] - xs[i-n]) / xs[i-n]` — relative change.

```text
QUERY:  [100.0, 110.0, 121.0].pct_change()
OUT:    [null, 0.1, 0.09999999999999998]
```

## `cummax` and `cummin`

- **Signature:** `Array<Number> -> Array<Number>`
- **Behavior:** Running max / min up to and including the current position.

```text
QUERY:  $.prices.cummax()
OUT:    [100.0, 105.0, 105.0, 110.0, 110.0, 115.0]

QUERY:  $.prices.cummin()
OUT:    [100.0, 100.0, 100.0, 100.0, 100.0, 100.0]
```

## `zscore`

- **Signature:** `Array<Number> -> Array<Number>`
- **Behavior:** Standardise: `(x - mean) / stddev`. Two passes (one for
  stats, one for transform); not strictly streaming, but presented as a
  one-to-one stage at the user surface.

```text
QUERY:  [1.0, 2.0, 3.0, 4.0, 5.0].zscore()
OUT:    [-1.414213562373095, -0.7071067811865475, 0.0, 0.7071067811865475, 1.414213562373095]
```

## `accumulate`

See [Barriers](./barrier.md) — `accumulate` is a barrier because it requires
a custom reducer over the full input.

## Practical examples

```text
DOC:    {"prices":[100, 105, 102, 110, 108, 115]}

# Apply tax to every price
QUERY:  $.prices.map(@ * 1.08)
OUT:    [108.0, 113.4, 110.16000000000001, 118.80000000000001, 116.64000000000001, 124.2]

# Day-over-day deltas
QUERY:  [100,105,102,110,108].pairwise().map(p => p[1] - p[0])
OUT:    [5, -3, 8, -2]

# Running max ("high-water mark")
QUERY:  $.prices.cummax()
OUT:    [100.0, 105.0, 105.0, 110.0, 110.0, 115.0]

# Lag-1 to compare current vs previous
QUERY:  $.prices.lag()
OUT:    [null, 100.0, 105.0, 102.0, 110.0, 108.0]
```
