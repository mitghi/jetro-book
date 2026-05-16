# Path and Structural Mutation

## Fixture

Examples below run against:

```jetro
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}], "user": {"id": 42, "name": "Ada", "email": "ada@x.com", "tags": ["math", "code"], "profile": {"name": "Ada", "email": "ada@x.com"}, "active": true, "verified": true}}
```

Methods that read, set, delete, or rewrite values at specific paths within
a document. These work on whole documents or sub-trees.

For chain-write terminals (`$.path.set(v)`) see [Patch](../grammar/patch.md).
This chapter documents the **method-call** versions.

## `get_path(path)`

- **Signature:** `Any, String -> Any | null`
- **Behavior:** Read a value at a slash- or dot-separated path.

```jetro
DOC:    {"user": {"profile": {"name": "Ada"}}}
QUERY:  $.get_path("user")
OUT:    {"profile":{"name":"Ada"}}
QUERY:  $.get_path("user/profile")
OUT:    {"name":"Ada"}
```

## `set_path(path, value)`

- **Signature:** `Any, String, Any -> Any`
- **Behavior:** Return a copy with `value` written at `path`. Creates
  intermediate objects as needed.

```jetro
QUERY:  $.set_path("user/profile/email", "ada@example.com")
```

## `del_path(path)`

- **Signature:** `Any, String -> Any`
- **Behavior:** Return a copy with the leaf at `path` removed.

```jetro
QUERY:  $.del_path("user/secret")
```

## `del_paths(paths)`

- **Signature:** `Any, Array<String> -> Any`
- **Behavior:** Remove all listed paths in one pass. Cheaper than chained
  `del_path` for many removals.

```jetro
QUERY:  $.del_paths(["user/secret", "user/temp", "session/csrf"])
```

## `has_path(path)`

- **Signature:** `Any, String -> Bool`
- **Behavior:** True if a path exists and resolves to a non-null value.
  Current 0.5.10 behavior treats a present `null` like a missing path:

```jetro
DOC:    {"a": null}
QUERY:  $.has_path("a")     OUT: false
QUERY:  $.has_path("b")     OUT: false
```

## `flatten_keys(sep="/")`

- **Signature:** `Object -> Object`
- **Behavior:** Flatten a nested object into a single-level object with
  joined keys.

```jetro
DOC:    {"a": {"b": 1, "c": 2}, "d": 3}
QUERY:  $.flatten_keys()
OUT:    {"a.b":1,"a.c":2,"d":3}

QUERY:  $.flatten_keys(".")
OUT:    {"a.b":1,"a.c":2,"d":3}
```

## `unflatten_keys(sep="/")`

- **Signature:** `Object -> Object`
- **Behavior:** Inverse of `flatten_keys`.

```jetro
QUERY:  {"a/b": 1, "a/c": 2}.unflatten_keys()
OUT:    {"a/b":1,"a/c":2}
```

## `set(path, value)` *(method-call form)*

- **Signature:** `Any, String, Any -> Any`
- **Behavior:** Same as `set_path`. Kept for ergonomic chains.

The chain-write terminal `$.path.set(v)` is **different** — it's parsed as
a `patch` and operates on the rooted document path.

## `update`

`update` is jetro's **functional batched update**. Two surfaces:

### Object body — `update({k: expr, ...})`

Apply a set of field updates to one or more selected subtrees. Plain keys
update fields *below* the receiver; quoted keys carry full paths.

```jetro
DOC:    {"books": [
  {"title": "Dune", "year": 1965, "tags": ["sf"]},
  {"title": "Hyperion", "year": 1989, "tags": ["sf", "hugo"]}
]}

QUERY:  $.books[*].update({tags: tags.append("test"), reviewed: true})
OUT:    {"books":[{"reviewed":true,"tags":["sf","test"],"title":"Dune","year":1965},{"reviewed":true,"tags":["sf","hugo","test"],"title":"Hyperion","year":1989}]}
```

Each selected book gets both fields written. Plain identifiers (`tags`,
`reviewed`) are read against the **selected snapshot** — not the
mid-batch document — so two ops on the same target both see the original
field values.

**Body forms:**

| Form | Meaning |
|---|---|
| `field: expr` | Write `expr` into `field` of each selected target |
| `"a.b.c": expr` | Write into a nested path inside each selected target |
| `"books[*].tags": expr` | Quoted **path key** — full root-relative path with wildcards/filters |
| `field: expr when cond` | Skip when `cond` is falsy |
| `field: DELETE` | Remove the field (with optional `when`) |

`@` inside the body is the current value at the *target field* (handy
inside path keys); `$` is the original root.

```jetro
QUERY:  $.books[*].update({tags: tags.append("modern") when year > 1980})
OUT:    {"books":[{"tags":["sf"],"title":"Dune","year":1965},{"tags":["sf","hugo","modern"],"title":"Hyperion","year":1989}]}
```

### Root-level batch with quoted paths

When the receiver is `$`, quoted keys carry full paths, including
wildcards and `DELETE`:

```jetro
QUERY:  $.update({"books[*].tags": @.append("test"), active: false})
DOC:    {"books": [{"tags": ["sf"]}], "active": true}
OUT:    {"active":false,"books":[{"tags":["sf","test"]}]}
```

```jetro
DOC:    {"users": [{"id":1,"secret":"a"}, {"id":2,"secret":"b"}]}
QUERY:  $.update({"users[*].secret": DELETE})
OUT:    {"users":[{"id":1},{"id":2}]}
```

### Filtered wildcard `[* if pred]`

Both selectors and quoted path keys support a filtered wildcard:

```jetro
DOC:    {"books": [
  {"title": "Dune", "year": 1965, "tags": ["sf"]},
  {"title": "Hyperion", "year": 1989, "tags": ["sf"]}
]}

QUERY:  $.books[* if year > 1980].update({tags: tags.append("modern")})
OUT:    {"books":[{"tags":["sf"],"title":"Dune","year":1965},{"tags":["sf","modern"],"title":"Hyperion","year":1989}]}

QUERY:  $.update({"books[* if year > 1980].tags": @.append("modern")})
OUT:    {"books":[{"tags":["sf"],"title":"Dune","year":1965},{"tags":["sf","modern"],"title":"Hyperion","year":1989}]}
```

### Two-argument path form — `update(path, expr)`

The classic shape: a slash- or dot-separated path plus an expression.
`@` inside the expression is the current value at `path`.

```jetro
DOC:    {"counters": {"visits": 10, "clicks": 3}}
QUERY:  $.update("counters.visits", @ + 1)
OUT:    {"counters":{"clicks":3,"visits":11}}

QUERY:  $.update("counters/visits", @ + 1)
OUT:    {"counters":{"clicks":3,"visits":11}}
```

### Semantics

| Property | Behavior |
|---|---|
| **Snapshot reads** | Each body expression sees the pre-batch values, not partial mid-batch state |
| **Order** | Ops apply in source order — last write wins on overlap |
| **Selectors** | Index, wildcard `[*]`, filtered wildcard `[* if pred]`, nested chains all OK |
| **Scalar targets** | An update with object body promotes scalar elements to objects (`{seen: true}` over `[1,2]` → `[{seen:true},{seen:true}]`) |
| **Untouched subtrees** | Preserved by `Arc` sharing — no deep copy of unrelated fields |
| **Empty body** | `.update({})` is a no-op — returns the doc unchanged |

## Worked example

```jetro
DOC:    {"users": [
  {"id": 1, "secret": "a", "name": "Ada"},
  {"id": 2, "secret": "b", "name": "Bob"}
]}

QUERY:  $.users.map(u => u.omit("secret").set_path("display", u.name))
OUT:    [{"display":"Ada","id":1,"name":"Ada"},{"display":"Bob","id":2,"name":"Bob"}]
```

## Demand notes

Path-mutation methods produce a full result and can't tell the source what
fields they need (the path is data, not statically analysable). When the
path is a literal, prefer `pick`/`omit`/`set` over `get_path`/`set_path` —
the planner can use literal field names.

## Practical examples

```jetro
# Single-key write
$.user.name.set("Ada Lovelace")                  # chain-write

# Set a field deep
patch $ { user.profile.email: "ada@x.com" }

# Bulk delete
$.del_paths(["secret","temp","csrf"])

# Flatten a nested config for environment-variable export
$.config.flatten_keys(".")                       # {"db.host":..., "db.port":..., ...}

# Round-trip via flatten/unflatten
$.config.flatten_keys().unflatten_keys()         # ≈ $.config

# Existence test before write
patch $ {
  email: $.user.email when $.has_path("user.email")
}

# Flat-key patches
$.patch_set.flatten_keys().entries().map(([k,v]) => $.set_path(k, v))

# Batched functional update
$.books[*].update({
  reviewed: true,
  tags: tags.append("classic") when year < 1970,
  tmp: DELETE
})
```
