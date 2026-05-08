# Precedence Table

Lowest precedence at the top. Operators on the same row associate left unless
noted.

| Level | Operators | Associativity | Notes |
|---|---|---|---|
| 1 | `if … else …`, `try … else …` | right | Ternary, try-else |
| 2 | `\|`, `\|>` | left | Pipe (value-flow) |
| 3 | `??`, `?\|` | right | Coalesce |
| 4 | `or` | left | Logical OR (short-circuit) |
| 5 | `and` | left | Logical AND (short-circuit) |
| 6 | `not` | n/a | Logical NOT (prefix) |
| 7 | `is`, `kind`, `is not` | n/a | Kind test |
| 8 | `has` | left | Membership operator (no `in` — use `.includes(v)`) |
| 9 | `==`, `!=`, `<`, `<=`, `>`, `>=`, `~=` | left | Comparison |
| 10 | `+`, `-` | left | Additive (and string/array concat) |
| 11 | `*`, `/`, `%` | left | Multiplicative |
| 12 | `as` | left | Cast |
| 13 | `-` (unary) | n/a | Negation |
| 14 | `.field`, `.method()`, `[idx]`, `{cond}`, `?`, `!` | left | Postfix steps |
| 15 | `$`, `@`, literal, `(...)`, `lambda`, `let`, `match`, `patch`, comp | n/a | Primary |

## Common pitfalls

**Pipe vs method call.**

```text
$.x | upper           # ✗ — interprets `upper` as a name to pipe into
$.x.upper()           # ✓ — method call
```

**Comparison chains.**

```text
1 < x < 10            # ✗ — parses as `(1 < x) < 10`
1 < x and x < 10      # ✓
```

**Ternary mid-chain.**

```text
$.x.upper() if cond else $.x   # parses fine — the ternary wraps the whole
                                # left expression
```

**Negation tightness.**

```text
not a == b            # parses as `(not a) == b` — surprising!
not (a == b)          # parens are clearer
a != b                # cleanest
```

**Coalesce + comparison.**

```text
$.x ?? 0 > 5          # parses as `($.x ?? 0) > 5` (low-precedence coalesce)
```

**Try captures errors only.**

```text
try $.x.parse_int() else 0
```

`try` does not catch falsy-as-error — only actual evaluation errors (missing
field, bad cast, regex failure, etc.).
