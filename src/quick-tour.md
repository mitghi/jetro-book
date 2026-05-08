# A 5-Minute Tour

This page is a working tour of jetro. Every example has a document, a query,
and an output. Run them in your shell with `jetrocli`, in Rust with
`Jetro::collect`, or in Python with `jetro.collect`.

## The document for this tour

```json
{
  "books": [
    {"title": "Dune", "year": 1965, "author": "Herbert", "tags": ["sf"]},
    {"title": "Foundation", "year": 1951, "author": "Asimov", "tags": ["sf", "hugo"]},
    {"title": "Hyperion", "year": 1989, "author": "Simmons", "tags": ["sf", "hugo"]},
    {"title": "Snow Crash", "year": 1992, "author": "Stephenson", "tags": ["sf", "cyberpunk"]}
  ],
  "active": true
}
```

## 1. Path navigation

```text
QUERY:  $.books[0].title
OUT:    "Dune"
```

`$` is the root, `.books` is field access, `[0]` is index. Negative indices
work: `[-1]` is "Snow Crash".

## 2. The whole array

```text
QUERY:  $.books[*].title
OUT:    ["Dune","Foundation","Hyperion","Snow Crash"]
```

`[*]` produces every element.

## 3. Filter

```text
QUERY:  $.books.filter(@.year > 1980).map(@.title)
OUT:    ["Hyperion","Snow Crash"]
```

Inside `.filter`, `.map`, and similar method args, the current item is `@`.
Use `@.field` to walk into it; the leading-dot shorthand `.field` is also
accepted and desugars to `@.field`.

## 4. Four lambda forms

These are all equivalent:

```text
$.books.filter(@.year > 1980)
$.books.filter(.year > 1980)
$.books.filter(b => b.year > 1980)
$.books.filter(lambda b: b.year > 1980)
```

Pick whichever reads best. The named-lambda and `@`-forms compile to
identical bytecode; benchmarks confirm them perf-equal.

## 5. Reducers

```text
QUERY:  $.books.count()
OUT:    4

QUERY:  $.books.map(@.year).min()
OUT:    1951

QUERY:  $.books.map(@.year).avg()
OUT:    1724.25
```

Reducers terminate the streaming pipeline.

## 6. Group / count / sort

```text
QUERY:  $.books.count_by(@.author)
OUT:    {"Herbert":1,"Asimov":1,"Simmons":1,"Stephenson":1}

QUERY:  $.books.sort(@.year).map(@.title)
OUT:    ["Foundation","Dune","Hyperion","Snow Crash"]
```

## 7. Object projection

```text
QUERY:  $.books[0].pick(title, author)
OUT:    {"title":"Dune","author":"Herbert"}

QUERY:  $.books.map(b => b.pick(title, year))
OUT:    [{"title":"Dune","year":1965}, ...]
```

`.pick(name, alias: src)` also renames: `.pick(t: title, y: year)`.

## 8. Deep search

```text
QUERY:  $..find(@.year < 1960)
OUT:    [{"title":"Foundation","year":1951,...}]

QUERY:  $..like({author: "Asimov"})
OUT:    [{"title":"Foundation","year":1951,...}]
```

`..find`, `..shape`, and `..like` are DFS pre-order over the whole document.
Equivalent named forms: `.deep_find`, `.deep_shape`, `.deep_like`.

## 9. Pipe and ternary

```text
QUERY:  $.books.count() | "found " + (@ as string) + " books"
OUT:    "found 4 books"

QUERY:  $.books[0] | "old" if @.year < 1980 else "modern"
OUT:    "old"
```

`|` passes a value through an expression — *not* a method-call sugar. Use `.method()` for methods.

## 10. F-strings

```text
QUERY:  $.books.map(b => f"{b.title} ({b.year})")
OUT:    ["Dune (1965)","Foundation (1951)","Hyperion (1989)","Snow Crash (1992)"]
```

## 11. Pattern match

```text
QUERY:
  match $.books[0] with {
    {year: y} when y < 1970 -> f"classic {y}",
    {year: y} -> f"modern {y}",
    _ -> "unknown"
  }
OUT:    "classic 1965"
```

Patterns include literals, ranges (`1900..2000`), or-patterns, guards, object
shape, array shape, and rest captures.

## 12. Writes

```text
QUERY:  $.books[0].year.set(1900)
OUT:    full document with books[0].year now 1900

QUERY:  $.books[*].tags.append("read")
OUT:    full document with "read" added to every book's tags

QUERY:  $.books[0].unset(tags)
OUT:    full document with books[0].tags removed
```

Multiple writes in one query batch through a single fused pass.

## 13. Engine entrypoint (Rust)

```rust
use jetro::JetroEngine;
use serde_json::json;

let eng = JetroEngine::default();
let doc = json!({"x":[1,2,3,4,5]});
let v = eng.collect_value(doc, "$.x.filter(@ > 2).sum()")?;
assert_eq!(v, json!(12));
```

That's the tour. Next: the [Grammar Overview](./grammar/overview.md), or skip
straight to the [Builtin Index](./builtins/overview.md).
