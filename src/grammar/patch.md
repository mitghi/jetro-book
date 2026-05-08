# Patch and Writes

## Fixture

Examples below run against:

```jetro
DOC:    {"user": {"id": 42, "name": "Ada", "email": "ada@x.com", "tags": ["math", "code"], "profile": {"name": "Ada", "email": "ada@x.com"}, "active": true, "verified": true}, "xs": [1, 2, 3, 4, 5]}
```

Jetro treats *writes* as queries: a write returns the patched document. There
are two equivalent surfaces.

## Chain-write terminals

Add a write method at the end of a rooted path:

| Method | Effect |
|---|---|
| `.set(v)` | Replace the value at this path with `v` |
| `.modify(expr)` | Replace, with `@` bound to the current value |
| `.delete()` | Remove the leaf |
| `.unset(key)` | Remove `key` from the leaf object |
| `.merge({…})` | Shallow-merge into the leaf object |
| `.deep_merge({…})` | Recursive merge |
| `.append(v)` | Push to the leaf array |
| `.prepend(v)` | Unshift onto the leaf array |

```jetro
DOC:    {"user": {"name": "Ada", "tags": ["math"]}}

QUERY:  $.user.name.set("Ada Lovelace")
OUT:    {"user":{"name":"Ada Lovelace","tags":["math"]}}

QUERY:  $.user.tags.append("code")
OUT:    ["math","code"]

QUERY:  $.user.unset(tags)
OUT:    {"user":{"name":"Ada"}}

QUERY:  $.user.modify(u => u.merge({active: true}))
OUT:    {"user":{"active":true,"name":"Ada","tags":["math"]}}
```

The classifier fires only when the **base of the chain is `$`**. Inside
lambdas (`$.xs.map(@.set(...))`) it remains a regular method call — useful
when a sub-pipeline wants the old "return the new value" semantics.

## `patch $ { … }` block

The same operation expressed as a block:

```jetro
patch $ {
  user.name: "Ada Lovelace",
  user.tags: DELETE
}
```

Block syntax is best for **multiple writes** — it batches them through a
single fused pass (see [Write Fusion](../recipes/write-fusion.md)).

| Block clause | Meaning |
|---|---|
| `path: value` | Assignment |
| `path: DELETE` | Removal |
| `path: value when cond` | Conditional |
| `path[*]: value` | Broadcast over an array |

## Conditional writes

```jetro
patch $ {
  status: "active" when $.verified,
  retired_at: now() when $.retired
}
```

If the condition is falsy, the assignment is skipped entirely — neither
written nor zeroed.

## Broadcast over arrays

```jetro
DOC:    {"items": [{"x": 1}, {"x": 2}, {"x": 3}]}

QUERY:  $.items[*].x.set(0)
OUT:    [0,0,0]
```

## Pipe form preserves "return-the-new-value"

Some users prefer the v1 behavior where a write inside a `.map` returned the
written value, not the patched root:

```jetro
$.items.map(item => item | set(item.x + 1))
```

The pipe form `value | set(new)` keeps that meaning.

## Modify with pipe

```jetro
$.user.modify(u => u.merge({last_seen: now()}))
```

`modify` evaluates its argument with `@` bound to the current value, then
writes the result back at the same path.

## Multiple writes in one query

Either chain them:

```jetro
$.user.name.set("Ada").tags.append("admin")
```

or use a block:

```jetro
patch $ {
  user.name: "Ada",
  user.tags[*]: "active"   # broadcast
}
```

The planner detects multi-write patterns and routes them through the
**patch-fusion** optimizer, which lowers repeated path traversals into a
single fused write pass.

## Functional `.update({...})`

A third surface, written as a method call:

```jetro
DOC:    {"books": [
  {"title": "Dune", "year": 1965, "tags": ["sf"]},
  {"title": "Hyperion", "year": 1989, "tags": ["sf"]}
]}

QUERY:  $.books[*].update({tags: tags.append("modern") when year > 1980, reviewed: true})
OUT:    {"books":[{"reviewed":true,"tags":["sf"],"title":"Dune","year":1965},{"reviewed":true,"tags":["sf","modern"],"title":"Hyperion","year":1989}]}
```

Use `.update` when you want all of the following at once:

- A **selector** chosen with chain syntax (`$.books[*]`,
  `$.books[* if year > 1980]`)
- An object body listing **multiple field updates** evaluated against
  each selected snapshot
- The same `when` / `DELETE` semantics as `patch $ { ... }`
- Quoted **path keys** (`"books[*].tags"`) when the receiver is `$`,
  giving root-level batched updates without an explicit selector

`.update` parses to its own AST node (`UpdateBatch`) so the planner can
keep the user-level shape — useful for selector pushdown, demand
analysis, and fusion. See
[Path Mutation → `update`](../builtins/path-mutation.md#update) for the
full argument matrix.

## Filtered wildcard `[* if pred]`

A predicated wildcard inside a path. Available wherever `[*]` is, and
particularly useful inside `.update` selectors and quoted path keys:

```jetro
DOC:    {"books": [
  {"title": "Dune", "year": 1965},
  {"title": "Hyperion", "year": 1989}
]}

QUERY:  $.books[* if year > 1980]
OUT:    [{"title":"Hyperion","year":1989}]
```

The predicate runs against `@` = the candidate element. Falsy elements
are skipped from the path traversal entirely.

## Wildcard `.modify` chains

Wildcard chain-writes are now lowered to a fused patch:

```jetro
DOC:    {"books": [{"tags": ["sf"]}, {"tags": ["hugo"]}]}
QUERY:  $.books[*].tags.modify(@.append("test"))
OUT:    {"books":[{"tags":["sf","test"]},{"tags":["hugo","test"]}]}
```

## Caveats

- `.replace(needle, with)` is **not** a write terminal — it is the
  string-replace builtin.
- The classifier only triggers on chains rooted at `$`. Use the block syntax
  when the base path is computed.
- `DELETE` is a marker, not a value — you can't store it in a binding.
