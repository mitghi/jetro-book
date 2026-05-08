# Grammar Overview

The jetro DSL is a small, expression-oriented language. There are no
statements at the top level — every program *is* an expression that produces
a value (or, in the case of patches, a rewritten document).

The grammar lives in
[`grammar.pest`](https://github.com/mitghi/jetro/blob/main/jetro-core/src/grammar.pest)
and is parsed by [pest](https://pest.rs).

## Five things that make jetro different

1. **Method calls use dot syntax.** `xs.map(f)`, not `xs | map(f)`.
2. **Pipe `|` is value-flow.** `x | expr` evaluates `expr` with `@` bound to `x`.
3. **`@` is the current value.** Inside `.filter(...)` it's the row; at the top
   level it's the input.
4. **Bare paths inside method args.** `.filter(@.age > 18)` is sugar for
   `.filter(@.age > 18)`.
5. **Writes are queries.** `$.x.set(v)` is parsed as a query that produces a
   patched document, not a mutation.

## Categories of syntax

| Category | Forms | Chapter |
|---|---|---|
| **Paths** | `$`, `@`, `.field`, `[idx]`, `[*]`, `[start:end:step]`, `..desc`, `{pred}` | [Paths](./paths.md) |
| **Operators** | arithmetic, comparison, logical, pipe, coalesce, ternary, kind, cast | [Operators](./operators.md) |
| **Methods** | `.name(args)`, lambdas (`@`, `=>`, `lambda`) | [Lambdas](./lambdas.md) |
| **Literals** | numbers, strings, f-strings, arrays, objects, regex | [Literals](./literals.md) |
| **Control flow** | `match`, ternary, `try`, comprehensions | [Control Flow](./control-flow.md) |
| **Writes** | `patch $ {…}`, chain-write terminals | [Patch](./patch.md) |

A handy [precedence table](./precedence.md) sits at the end of this part.

## A worked sample

```jetro
$.users
  .filter(u => u.active and u.age >= 18)
  .map(u => { id: u.id, name: u.name, email: u.email })
  .sort(@.name)
  .take(10)
```

That's: root, field `users`, predicate filter (named lambda), object-mapping,
sort by name, take first 10.

## Comments

There are **no comments** inside a query. Strip them client-side before
calling jetro, or factor commentary into the surrounding host program.

## Whitespace

Whitespace and newlines are insignificant between tokens. Keep queries on one
line in CLIs; break across multiple lines in source.
