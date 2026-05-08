# Literals

## Scalars

```jetro
null
true     false
42       3.14     -7    1.5e3
"double-quoted"   'single-quoted'
```

Strings allow standard escapes (`\n`, `\t`, `\\`, `\"`, `\uXXXX`).

## F-strings

`f"…"` interpolates `{expression}`:

```jetro
DOC:    {"name": "Ada", "age": 36}
QUERY:  f"hi {$.name}, you are {$.age + 1} next year"
OUT:    "hi Ada, you are 37 next year"
```

Inside a lambda:

```jetro
$.users.map(u => f"{u.name} <{u.email}>")
```

Escape literal braces with `{{` and `}}`:

```jetro
f"{{not interpolated}}"      # "{not interpolated}"
```

## Arrays

```jetro
[1, 2, 3]
["a", "b"]
[$.x, $.y, 99]              # values can be expressions

[...$.xs, 4, 5]             # spread
[1, ...mid, 9]              # spread anywhere
```

Heterogeneous arrays are fine: `[1, "a", null, [2,3]]`.

## Objects

```jetro
{name: "Ada", age: 36}            # bare-key (identifier-like)
{"name": "Ada"}                   # quoted-key (any string)

{x, y}                            # shorthand: same as {x: x, y: y}

{[dyn_key]: 1}                    # computed key
{...obj, extra: 1}                # spread
{...**deep}                       # deep recursive spread

{name: "Ada", role: "admin" when $.is_admin}
                                  # conditional value (omit if cond falsy)
```

## Regex literals

Regex appear as the right operand of `~=` or as arguments to regex builtins:

```jetro
$.s ~= "^[A-Z]+$"
$.text.scan("\d+")
```

Patterns use Rust's `regex` crate syntax.

## Numeric notes

Jetro distinguishes integers from floats internally where possible. `42` and
`42.0` compare equal but a downstream sink that requires "integer" (e.g.
indexing) will only accept the former.

Negative literals: `-7` is a unary-negated literal — the parser handles this
correctly without ambiguity in arithmetic positions (`a - 7` is subtraction,
`a + -7` is addition with `-7`).
