# Control Flow

## Ternary

Python-style:

```jetro
expr if condition else fallback
```

```jetro
DOC:    {"x": 10}
QUERY:  "big" if $.x > 5 else "small"
OUT:    "big"
```

Right-associative; chain via parens for clarity.

## Try / else

Catch evaluation errors:

```jetro
try expr else fallback
```

```jetro
QUERY:  try $.maybe.deep.path else "missing"
OUT:    "missing"

QUERY:  try $.xs[0].name.upper() else "n/a"
```

`?` quantifier handles the "missing field" subset more concisely:
`$.maybe?` returns null instead of erroring.

## `let … in …`

Local bindings:

```jetro
let x = $.users.count() in
  f"there are {x} users"
```

Multi-binding:

```jetro
let a = 1, b = 2 in a + b   # equiv: let a=1 in let b=2 in a+b
```

`let` shines for first-class lambdas — see [Lambdas](./lambdas.md).

## Pattern match

```jetro
match value with {
  pattern1 -> expr1,
  pattern2 when guard -> expr2,
  _ -> default
}
```

### Patterns

| Pattern | Matches |
|---|---|
| `42`, `"x"`, `true`, `null` | Equal literal |
| `_` | Any value |
| `name` | Any value, bound to `name` |
| `1..10` | Number ≥ 1 and < 10 |
| `1..=10` | Number ≥ 1 and ≤ 10 |
| `{k1: p1, k2: p2}` | Object with these keys, each matching (no shorthand `{k1, k2}` in v0.5) |
| `[p1, p2]` | Array of length 2, each matching |
| `[h, ...t]` | Head + tail |
| `p1 \| p2` | Either pattern (or-pattern) |
| `x: number` | Kind-bound: matches if `x` is a number |

### Guards

```jetro
match $.x with {
  v when v > 100 -> "big",
  v when v > 10 -> "medium",
  _ -> "small"
}
```

### Worked example

```jetro
DOC:    {"event": {"kind": "click", "x": 100, "y": 200}}
QUERY:
  match $.event with {
    {kind: "click", x: cx, y: cy} -> f"click@{cx},{cy}",
    {kind: "key",   code: c}       -> f"key:{c}",
    _ -> "unknown"
  }
OUT:    "click@100,200"
```

### Deep match

```jetro
$..match { pattern -> expr, _ -> null }
```

Walks every descendant; returns matched results as an array.

```jetro
$..match! { pattern -> expr }      # first match only, early-stops
```

The bang variant terminates as soon as one match succeeds (uses the bitmap
structural index when available).

## Comprehensions

Jetro supports list, dict, set, and generator comprehensions over both
literal and path-rooted sources. Pair destructure works in two
interchangeable forms (`for k, v in ...` and `for [k, v] in ...`), and
multiple `if` clauses are folded with `and`.

### List

```jetro
[expr for x in source if cond1 if cond2 ...]
```

```jetro
DOC:    {"xs": [1, 2, 3, 4, 5]}

QUERY:  [n*n for n in $.xs if n > 2]
OUT:    [9,16,25]

QUERY:  [n for n in $.xs if n > 1 if n < 5]
OUT:    [2,3,4]
```

### Object

```jetro
{key: value for x in source if cond}
{k: v for [k, v] in pairs}
{k: v for k, v in pairs}
```

```jetro
DOC:    {"pairs": [["a", 1], ["b", 2]]}

QUERY:  {k: v for [k, v] in $.pairs}
OUT:    {"a":1,"b":2}

QUERY:  {n: n*n for n in [1,2,3]}
OUT:    {"1":1,"2":4,"3":9}
```

Iterating an object yields `{key, value}` records:

```jetro
DOC:    {"o": {"a": 1, "b": 2}}
QUERY:  {e.key: e.value*10 for e in $.o}
OUT:    {"a":10,"b":20}
```

### Set

Deduplicating comprehension. Returns an array of unique values.

```jetro
QUERY:  {n*n for n in [-2, -1, 0, 1, 2]}
OUT:    [4,1,0]
```

### Generator

```jetro
(x for x in items)
```

Same semantics as the list form; useful as a lazy source for a downstream
reducer or barrier.

## `if`-on-patch

Inside a `patch $ {…}` body, `key: expr when cond` skips the assignment when
`cond` is falsy:

```jetro
patch $ {
  status: "active" when $.verified
}
```

See [Patch](./patch.md).
