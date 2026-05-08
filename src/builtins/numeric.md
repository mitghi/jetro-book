# Numeric Scalars

## Fixture

Examples below run against:

```text
DOC:    {"products": [{"id": 1, "price": 3.7}, {"id": 2, "price": 4.2}], "metric": {"pct": 0.5, "value": 7, "x": 10}, "deltas": [-1, 2, -3, 4], "xs": [1, 2, 3, 4, 5]}
```

Pure scalar transforms over numbers.

## `ceil`

- **Signature:** `Number -> Number`
- **Behavior:** Smallest integer ≥ x.

```text
QUERY:  3.2.ceil()     OUT: 4
QUERY:  (-3.2).ceil() OUT: -3
```

## `floor`

- **Signature:** `Number -> Number`
- **Behavior:** Largest integer ≤ x.

```text
QUERY:  3.7.floor()     OUT: 3
QUERY:  (-3.7).floor() OUT: -4
```

## `round`

- **Signature:** `Number -> Number`
- **Behavior:** Round to nearest; ties round half-away-from-zero.

```text
QUERY:  3.5.round()     OUT: 4
QUERY:  3.4.round()     OUT: 3
QUERY:  (-3.5).round() OUT: -4
```

## `abs`

- **Signature:** `Number -> Number`
- **Behavior:** Absolute value.

```text
QUERY:  (-7).abs()     OUT: 7
QUERY:  3.5.abs()     OUT: 3.5
```

## Mapping over arrays

These are scalar; lift them with `.map`:

```text
DOC:    {"xs": [1.4, 2.6, -3.5]}

QUERY:  $.xs.map(@.round())
OUT:    [1,3,-4]

QUERY:  $.xs.map(@.abs()).sum()
OUT:    7.5
```

## See also

Numeric reducers (`sum`, `avg`, `min`, `max`) live in
[Reducers](./reducers.md). Streaming numeric transforms (`zscore`,
`pct_change`, `cummax`, `cummin`) live in [Streaming](./streaming.md).

## Practical examples

```text
# Round every price up to the nearest dollar
$.products.map(p => p.merge({price_ceil: p.price.ceil()}))

# Percent → integer percent
$.metric.pct.map(@ * 100).map(@.round())

# Magnitudes (drop sign)
$.deltas.map(@.abs())

# Banker-style splits
$.amount.floor()                   # cents component, etc.

# Build a histogram with binned values
$.measurements.map(m => (m / 10).floor() * 10).count_by(@)
# → {0: 12, 10: 5, 20: 3, ...}
```
