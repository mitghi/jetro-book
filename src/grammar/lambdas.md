# Lambdas and Method Calls

## Fixture

Examples below run against:

```text
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}], "books": [{"title": "Dune", "year": 1965, "author": "Herbert", "tags": ["sf"], "price": 15, "genre": "sci-fi"}, {"title": "Foundation", "year": 1951, "author": "Asimov", "tags": ["sf", "hugo"], "price": 10, "genre": "sci-fi"}, {"title": "Hyperion", "year": 1989, "author": "Simmons", "tags": ["sf", "hugo"], "price": 18, "genre": "cyberpunk"}, {"title": "Snow Crash", "year": 1992, "author": "Stephenson", "tags": ["sf", "cyberpunk"], "price": 12, "genre": "cyberpunk"}], "xs": [1, 2, 3, 4, 5], "pairs": [["a", 1], ["b", 2], ["c", 3]]}
```

Methods take arguments. Most arguments are values; one common one is a
*lambda* — a small function evaluated per element. Jetro accepts three lambda
syntaxes; pick whichever reads best.

## The `@`-form

`@` is the current item. Inside method args, prefix paths with `@` to walk
into it:

```text
$.users.filter(@.age >= 18)
$.users.map(@.name)
$.xs{@.active}                  # inline filter must also use @
```

Leading-dot shorthand `.age` inside method args desugars to `@.age` — the
two forms are equivalent and the planner sees identical opcodes.

```text
$.users.filter(.age >= 18)
$.users.map(.name)
$.xs{.active}                    # works inside inline filters too
```

## Arrow-form named lambda

```text
$.users.filter(u => u.age >= 18)
$.users.map((u) => u.name)
```

The parens around the parameter are optional for one parameter.

For multiple parameters:

```text
$.pairs.map(([k, v]) => k + ":" + v)
```

## Python-style `lambda` keyword

```text
$.users.filter(lambda u: u.age >= 18)
$.users.map(lambda u: u.name)
```

Functionally identical to the arrow form. Useful when porting from Python.

## Performance

Named lambdas (`u => u.x`, `lambda u: u.x`) and the `@`-form compile to the
same bytecode. Benchmarks confirm parity (3.42 ms vs 3.44 ms / 100K rows in
the lambda regression suite). Pick what reads best — there is no perf reason
to prefer `@`.

## Method call basics

```text
.method()                       # no args
.method(arg)                    # one positional
.method(arg1, arg2)             # multiple
.method(name=value)             # named (a few methods support these)
.method(arg1, name=value)       # mixed
```

Examples:

```text
$.xs.take(3)
$.xs.replace("foo", "bar")
$.xs.join(",")
$.xs.sort(@.year)                # sort by key projection
```

## Methods inside method args

Lambdas can chain methods just like top-level queries:

```text
$.posts.map(p => p.tags.unique().count())
$.users.filter(u => u.email.starts_with("admin"))
```

## Multi-arg lambdas with destructuring

Some barriers (e.g. `pairwise`) yield 2-tuples. Destructure them:

```text
$.xs.pairwise().map(([a, b]) => b - a)
```

## Captured `$`

Inside a lambda, `$` still means "the document root" — it does not get
shadowed by the lambda parameter:

```text
DOC:    {"realnames": {"abc": "Ada"}, "posts": [{"author": "abc"}]}
QUERY:  $.posts.map(p => $.realnames[p.author])
OUT:    ["Ada"]
```

## First-class lambdas via `let`

Bind a lambda once, use it many times:

```text
let by_year = (b => b.year < 1970) in
  $.books.filter(by_year)
```

The let-bound lambda is **inlined at every method-arg use** before
compilation, so it has zero closure overhead — exactly the same code as if
you'd written the body directly in `.filter(...)`.

Outside method-arg position, the binding is a normal name reference.
