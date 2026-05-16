# Pattern Match Cookbook

## Fixture

Examples below run against:

```jetro
DOC:    {"xs": [1, 2, 3, 4, 5], "row": {"k": "foo", "data": {"a": 1, "b": 2}}, "doc": {"a": 1, "b": 2, "type": "v1"}, "tree": {"x": 1, "children": [{"x": 2}]}, "value": 3.14}
```

Pattern matching is one of jetro's most expressive features. It compiles to
a Maranget decision tree at lower-time and runs over all three execution
domains (`Val`, borrowed `View`, tape).

## Anatomy

```jetro
match scrutinee with {
  pattern1 -> expr1,
  pattern2 when guard -> expr2,
  _ -> default
}
```

- Arms checked top-down.
- First match wins.
- `_` is the universal fallback.
- `when` guards run after the structural match succeeds.

## Pattern reference

| Pattern | Matches |
|---|---|
| `42`, `"x"`, `true`, `null` | Equal literal |
| `_` | Anything |
| `name` | Anything, binds to `name` |
| `1..10` | Number ≥ 1 and < 10 |
| `1..=10` | Number ≥ 1 and ≤ 10 |
| `{k: p, ...}` | Object with key `k`, value matches `p` |
| `[p1, p2]` | Array of length 2 |
| `[h, ...t]` | Head + tail |
| `p1 \| p2` | Either |
| `x: number` | Kind-bind |

Object shorthand `{id, name}` binds each key to a same-name local. Rest
captures are spelled `...*rest` for objects and `...tail` for arrays:
`{id, name, ...*rest}`, `[h, ...tail]`.

## 1. Discriminated union

```jetro
match $.event with {
  {kind: "click", x: cx, y: cy} -> f"click@{cx},{cy}",
  {kind: "key",   code: c}       -> f"key:{c}",
  {kind: "scroll", dy: d}        -> f"scroll:{d}",
  _ -> "unknown"
}
```

Literal discriminants and shorthand captures can be mixed, so the click arm
could also be written as `{kind: "click", x, y}`.

## 2. Numeric ranges

```jetro
match $.score with {
  s when s < 0 -> "invalid",
  0..50 -> "low",
  50..80 -> "medium",
  80..=100 -> "high",
  _ -> "out of range"
}
```

## 3. Or-patterns

```jetro
match $.day with {
  "sat" | "sun" -> "weekend",
  _ -> "weekday"
}
```

## 4. Object rest capture

```jetro
match $.config with {
  {host, port, ...*extra} -> {host, port, extra},
  _ -> null
}
```

## 5. Array shape

```jetro
match $.coords with {
  [x, y] -> {x, y},
  [x, y, z] -> {x, y, z},
  _ -> null
}
```

## 6. Head + tail

```jetro
match $.xs with {
  [] -> "empty",
  [first, ...rest] -> f"head={first}, count={rest.count()}",
}
```

## 7. Kind-bound + guard

```jetro
match $.value with {
  s: string when s.len() > 100 -> "long string",
  s: string -> "short string",
  n: number when n > 0 -> "positive",
  n: number -> "non-positive",
  _: array -> "array",
  _ -> "other"
}
```

## 8. Deep match (`..match`)

Walk every descendant; collect results.

```jetro
$.tree..match {
  {kind: "leaf", value} -> value,
  _ -> null
} | .compact()
```

The trailing `.compact()` drops the `null`s from non-leaf descendants.

## 9. First-match deep (`..match!`)

Stops at the first match — the bang variant uses early termination via the
structural index where possible.

```jetro
$.tree..match! {
  {role: "admin", id} -> id,
  _ -> null
}
```

## 10. Migration / rewrite (`rec`)

```jetro
$.doc.rec({type: "v1"}, node => node.merge({type: "v2"}))
```

`rec` is the recursive sibling of `match` — it descends and rewrites every
matching node.

## 11. Cross-arm sharing

When multiple arms test the same prefix (`{kind: "x", ...}`,
`{kind: "y", ...}`), the lowering shares the discriminant test. You don't
write anything special — the planner does it for you. Practically: write
many narrow arms; they cost about as much as one big switch.

## 12. Guards over deep patterns

```jetro
match $.row with {
  {user: {age, role: "admin"}} when age >= 18 -> "adult admin",
  {user: {age}} when age < 18 -> "minor",
  _ -> "other"
}
```

## Bench tips

- Patterns with literal-only discriminants (no guards) compile to switch-like
  decision trees and run as fast as a hand-written `if`/`else if`.
- Guards add a per-arm conditional; cheap, but don't put expensive
  computation in them.
- Deep `..match` over a large doc benefits a lot from the structural index;
  deep `..match!` (first-match) is even better.
