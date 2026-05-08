# Paths and Navigation

## Fixture

Examples below run against:

```jetro
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}], "user": {"id": 42, "name": "Ada", "email": "ada@x.com", "tags": ["math", "code"], "profile": {"name": "Ada", "email": "ada@x.com"}, "active": true, "verified": true}, "books": [{"title": "Dune", "year": 1965, "author": "Herbert", "tags": ["sf"], "price": 15, "genre": "sci-fi"}, {"title": "Foundation", "year": 1951, "author": "Asimov", "tags": ["sf", "hugo"], "price": 10, "genre": "sci-fi"}, {"title": "Hyperion", "year": 1989, "author": "Simmons", "tags": ["sf", "hugo"], "price": 18, "genre": "cyberpunk"}, {"title": "Snow Crash", "year": 1992, "author": "Stephenson", "tags": ["sf", "cyberpunk"], "price": 12, "genre": "cyberpunk"}], "xs": [1, 2, 3, 4, 5]}
```

A **path** is the part of a query that walks into the document. Paths start at
a root marker (`$`, `@`, or an identifier inside a lambda) and chain steps
left-to-right.

## Roots

| Form | Meaning |
|---|---|
| `$` | The whole input document (top-level root) |
| `@` | The current value (set by `.filter`, `.map`, `\|`, etc.) |
| `name` | A let-bound name or lambda parameter |

```jetro
DOC:    {"x": 10}
QUERY:  $
OUT:    {"x":10}

QUERY:  $.x | @ + 1
OUT:    11
```

## Field access

```jetro
DOC:    {"user": {"name": "Ada"}}
QUERY:  $.user.name
OUT:    ["Ada"]
```

Field names may also use string keys via `["name"]`:

```jetro
QUERY:  $["user"]["name"]
```

Use the bracket form when the key contains characters disallowed in identifiers
(`-`, spaces, dots inside the key, leading digits).

## Indexing arrays

```jetro
DOC:    {"xs": [10, 20, 30, 40]}
QUERY:  $.xs[0]
OUT:    10

QUERY:  $.xs[-1]
OUT:    40
```

Negative indices count from the end.

## Slicing

```jetro
QUERY:  $.xs[1:3]
OUT:    [20,30]

QUERY:  $.xs[:2]
OUT:    [10,20]

QUERY:  $.xs[2:]
OUT:    [30,40]

QUERY:  $.xs[0:4:2]
OUT:    [10,30]
```

## Wildcards

```jetro
QUERY:  $.xs[*]
OUT:    [10,20,30,40]
```

`[*]` is "every element". Most users prefer chained methods (`.filter`,
`.map`) which already iterate.

### Filtered wildcard `[* if pred]`

A predicated wildcard — keeps only elements satisfying `pred` (with `@`
bound to the candidate).

```jetro
DOC:    {"books": [{"title": "Dune", "year": 1965}, {"title": "Hyperion", "year": 1989}]}
QUERY:  $.books[* if year > 1980]
OUT:    [{"title":"Hyperion","year":1989}]
```

Equivalent to `[*]` immediately followed by an inline-filter `{cond}`,
but stays on the path side of parsing. Particularly useful inside
`.update` selectors and quoted patch path keys (see
[Patch](./patch.md#filtered-wildcard--if-pred)).

Chaining a bare field step after a filtered wildcard collapses to
`null` — chain a method instead:

```jetro
QUERY:  $.books[* if year > 1980].map(@.title)
OUT:    ["Hyperion"]
```

## Inline filter

`{predicate}` after a path step keeps only matching elements:

```jetro
DOC:    {"books": [{"year": 1965}, {"year": 1989}]}
QUERY:  $.books{@.year > 1970}
OUT:    [{"year":1989}]
```

This is shorthand for `.filter(@.year > 1970)`. Use `.filter` when you want
named-lambda forms.

## Descendant search

`..` walks every descendant value in DFS pre-order:

```jetro
DOC:    {"a": {"b": {"x": 1}}, "c": [{"x": 2}, {"x": 3}]}
QUERY:  $..x
OUT:    [1,2,3]
```

Combine with method calls (no space):

```jetro
QUERY:  $..find(@.year < 1960)
QUERY:  $..shape({year, title})
QUERY:  $..like({author: "Asimov"})
```

The deep variants are bitmap-accelerated when a structural index is available.

## Dynamic keys

Compute a key at runtime:

```jetro
DOC:    {"realnames": {"abc": "Ada"}, "post": {"author": "abc"}}
QUERY:  $.realnames[$.post.author]
OUT:    "Ada"
```

Inside a lambda:

```jetro
DOC:    {"realnames": {"abc": "Ada"}, "posts": [{"author": "abc"}]}
QUERY:  $.posts.map(p => $.realnames[p.author])
OUT:    ["Ada"]
```

## Quantifiers (postfix)

| Form | Meaning |
|---|---|
| `step?` | Optional — return null instead of error if missing |
| `step!` | Exactly-one — error if zero or many |

```jetro
DOC:    {"xs": [42]}
QUERY:  $.xs!
OUT:    [42]

QUERY:  $.maybe?
OUT:    null      # absent, no error
```

## Path after a method

Paths and methods are interchangeable steps:

```jetro
$.users.filter(@.active).pick(name, email)[0]
```

That's: field, method, method, index. There is no special "tail position".

## Paths inside method args need a root

Inside method-call arguments, paths must start with `@` (current item),
`$` (document root), or a bound name. Bare-path forms like `.field` do **not**
parse:

```jetro
$.users.filter(@.age > 18)        # ✓ @-form
$.users.filter(u => u.age > 18)   # ✓ named lambda
$.users.filter(.age > 18)         # ✗ parse error
$.users.map(@.name)               # ✓
$.users.map(.name)                # ✗
```

The same rule applies to inline filters: `$.xs{@.k > 1}` works,
`$.xs{.k > 1}` does not.

Top-level paths still need `$`.

## Summary

| Step | Example | Notes |
|---|---|---|
| Root | `$`, `@` | One per chain (or implicit `@` in args) |
| Field | `.name` | Use `["..."]` for tricky keys |
| Index | `[3]`, `[-1]` | Negative counts from end |
| Slice | `[1:5]`, `[::2]` | Half-open like Python |
| Wildcard | `[*]` | Whole array |
| Filtered wildcard | `[* if pred]` | Wildcard restricted by predicate (`@` = element) |
| Descendant | `..name`, `..` | DFS pre-order |
| Inline filter | `{cond}` | Sugar for `.filter` |
| Dynamic key | `[expr]` | Expression resolves to key |
| Quantifier | `?`, `!` | Postfix on a step |
