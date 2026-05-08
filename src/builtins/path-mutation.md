# Path and Structural Mutation

## Fixture

Examples below run against:

```text
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}], "user": {"id": 42, "name": "Ada", "email": "ada@x.com", "tags": ["math", "code"], "profile": {"name": "Ada", "email": "ada@x.com"}, "active": true, "verified": true}}
```

Methods that read, set, delete, or rewrite values at specific paths within
a document. These work on whole documents or sub-trees.

For chain-write terminals (`$.path.set(v)`) see [Patch](../grammar/patch.md).
This chapter documents the **method-call** versions.

## `get_path(path)`

> ⚠ **v0.5 quirk:** only resolves a single key — `get_path("a/b/c")` returns
> null even when `$.a.b.c` exists. Use direct path navigation
> (`$.a.b.c`) when the path is statically known. For dynamic paths, walk
> manually with `let` + chained `[expr]`.

- **Signature (intended):** `Any, String -> Any | null`
- **Behavior (intended):** Read a value at a slash-separated path.

```text
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

```text
QUERY:  $.set_path("user/profile/email", "ada@example.com")
```

## `del_path(path)`

- **Signature:** `Any, String -> Any`
- **Behavior:** Return a copy with the leaf at `path` removed.

```text
QUERY:  $.del_path("user/secret")
```

## `del_paths(paths)`

- **Signature:** `Any, Array<String> -> Any`
- **Behavior:** Remove all listed paths in one pass. Cheaper than chained
  `del_path` for many removals.

```text
QUERY:  $.del_paths(["user/secret", "user/temp", "session/csrf"])
```

## `has_path(path)`

- **Signature:** `Any, String -> Bool`
- **Behavior:** True if a value exists at `path`. Distinguishes "missing" from
  "explicit null":

```text
DOC:    {"a": null}
QUERY:  $.has_path("a")     OUT: false
QUERY:  $.has_path("b")     OUT: false
```

## `flatten_keys(sep="/")`

- **Signature:** `Object -> Object`
- **Behavior:** Flatten a nested object into a single-level object with
  joined keys.

```text
DOC:    {"a": {"b": 1, "c": 2}, "d": 3}
QUERY:  $.flatten_keys()
OUT:    {"a.b":1,"a.c":2,"d":3}

QUERY:  $.flatten_keys(".")
OUT:    {"a.b":1,"a.c":2,"d":3}
```

## `unflatten_keys(sep="/")`

- **Signature:** `Object -> Object`
- **Behavior:** Inverse of `flatten_keys`.

```text
QUERY:  {"a/b": 1, "a/c": 2}.unflatten_keys()
OUT:    {"a/b":1,"a/c":2}
```

## `set(path, value)` *(method-call form)*

- **Signature:** `Any, String, Any -> Any`
- **Behavior:** Same as `set_path`. Kept for ergonomic chains.

The chain-write terminal `$.path.set(v)` is **different** — it's parsed as
a `patch` and operates on the rooted document path.

## `update(path, fn)`

> ⚠ **Broken in v0.5** — empirically returns the path string instead of the
> patched document. Avoid until fixed. Use `$.path.modify(fn)` chain-write
> form (see [Patch](../grammar/patch.md)) for equivalent semantics.

- **Signature (intended):** `Any, String, (Any -> Any) -> Any`
- **Behavior (intended):** Apply `fn` to the value at `path`, write the
  result back.

```text
QUERY:  $.update("counters/visits", @ + 1)
```

## Worked example

```text
DOC:    {"users": [
  {"id": 1, "secret": "a", "name": "Ada"},
  {"id": 2, "secret": "b", "name": "Bob"}
]}

QUERY:  $.users.map(u => u.del_paths(["secret"]).set_path("display", u.name))
OUT:    [{"display":null}]
```

## Demand notes

Path-mutation methods produce a full result and can't tell the source what
fields they need (the path is data, not statically analysable). When the
path is a literal, prefer `pick`/`omit`/`set` over `get_path`/`set_path` —
the planner can use literal field names.

## Practical examples

```text
# Single-key write (preferred over set_path for v0.5)
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
```
