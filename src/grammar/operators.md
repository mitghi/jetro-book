# Operators

Jetro has the operators you'd expect plus a small number of extras that come
up in JSON work.

## Arithmetic

```jetro
1 + 2          # 3
3 - 1          # 2
2 * 3          # 6
6 / 2          # 3
7 % 3          # 1
-x             # unary negation
```

`+` on strings concatenates: `"foo" + "bar"` → `"foobar"`.

`+` on arrays concatenates: `[1,2] + [3]` → `[1,2,3]`.

## Comparison

```jetro
a == b         # equality
a != b         # inequality
a < b          # less than
a <= b
a > b
a >= b
```

`==` and `!=` work across types (strings to strings, numbers to numbers, etc).
Cross-type comparison returns `false` for `==` and `true` for `!=`.

## Logical

```jetro
a and b        # short-circuit AND
a or b         # short-circuit OR
not a          # negation
```

Truthiness: `null`, `false`, `0`, `""`, `[]`, `{}` are falsy. Everything else
is truthy.

## Pipe

```jetro
value | expr
```

Evaluates `expr` with `@` bound to `value`. It is **not** a method-call
shorthand.

```jetro
DOC:    {"x": 10}
QUERY:  $.x | @ * 2
OUT:    20

QUERY:  $.x | f"got {@}"
OUT:    "got 10"
```

To call a method, use dot syntax: `$.x.upper()`, not `$.x | upper`.

## Coalesce

```jetro
a ?? b
```

Return `a` unless it is null, in which case `b`.

```jetro
DOC:    {"name": null}
QUERY:  $.name ?? "anon"
OUT:    "anon"
```

## Ternary

Python-style — postfix condition:

```jetro
"hot" if temp > 30 else "cool"
```

```jetro
DOC:    {"temp": 35}
QUERY:  "hot" if $.temp > 30 else "cool"
OUT:    "hot"
```

## Kind tests

```jetro
v is number
v is string
v is array
v is object
v is null
v is bool
```

Returns boolean.

```jetro
QUERY:  $.x is number
```

## Cast

```jetro
x as int
x as float
x as string
x as bool
x as array
x as object
```

Coerces the value (or returns null if the cast is impossible — depends on the
specific cast).

```jetro
"42" as int        # 42
42 as string       # "42"
```

## Membership

```jetro
xs has v           # array membership: true if v is in xs
o  has "k"         # object membership: true if key "k" exists
```

There is **no `v in xs` operator** — that form is a parse error. Use the
postfix `has` operator above, or call `.includes(v)` (arrays/strings)
explicitly:

```jetro
$.tags.includes("hugo")    # ✓
"hugo" in $.tags           # ✗ parse error
```

## Regex match

```jetro
s ~= "pattern"
```

Returns boolean. Uses Rust regex syntax. Bind captures with `.captures` or
`.match_first` for richer info — see [String Search](../builtins/string-search.md).

## Boolean shortcut on patches

In a `patch $ { … }` body, a `key when condition` clause skips the assignment
when `condition` is falsy. See [Patch](./patch.md).

## Examples

```jetro
DOC:    {"books": [{"year": 1965, "tags": ["sf"]}, {"year": 1989, "tags": ["sf","hugo"]}], "year_floor": 2000}

QUERY:  $.books.filter((@.year > 1970 and @.tags.includes("hugo")) or @.year >= $.year_floor)
OUT:    []

QUERY:  $.books[0].year ?? 9999
OUT:    1965

QUERY:  $.books.map(b => "old" if b.year < 1970 else "new")
OUT:    ["old","new"]
```

> **No `in` operator.** Membership in jetro is `xs.includes(v)` (or `xs.has(v)`
> for objects/arrays). There is no `v in xs` operator — that form is a parse
> error. Wrap `and`/`or` mixes in parens to make precedence unambiguous; jetro
> follows standard binding (`and` tighter than `or`), but parens read clearer.
