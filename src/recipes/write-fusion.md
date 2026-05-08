# Write Fusion

## Fixture

Examples below run against:

```text
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}], "user": {"id": 42, "name": "Ada", "email": "ada@x.com", "tags": ["math", "code"], "profile": {"name": "Ada", "email": "ada@x.com"}, "active": true, "verified": true}}
```

When a query contains **multiple chain-writes**, jetro fuses them into a
single pass over the document. This is the patch-fusion optimizer.

## What gets fused

Any sequence of chain-write terminals on the same document:

```text
$.user.name.set("Ada")
   .user.email.set("ada@x.com")
   .user.tags.append("admin")
```

Or the equivalent block form (preferred for many writes):

```text
patch $ {
  user.name: "Ada",
  user.email: "ada@x.com",
  user.tags[*]: "admin"
}
```

## Without fusion

Naively, three writes mean three traversals from `$`:

```
$ → user → name      (write)
$ → user → email     (write)
$ → user → tags[*]   (write)
```

Each rebuilds the path from the root. For deeply-nested documents, the cost
adds up.

## With fusion

The optimizer collects effects, walks the document **once**, and applies all
relevant rewrites at each visited node:

```
$ → user → {set name, set email, append tags}
```

Three writes, one walk.

## Phases

The patch-fusion pass has internal phases (Phase C, Phase E in the source);
the user-visible properties are:

1. **Same-base writes group together.** Writes under `$.user.*` batch.
2. **Disjoint paths don't interfere.** Writes to `$.user.name` and
   `$.config.theme` execute in one walk but at different nodes.
3. **Conflicts are resolved last-wins.** Two writes to the same path: the
   later one wins.
4. **Conditional writes (`when`) are evaluated per-write.** They short-circuit
   per clause; the walk doesn't redo work.

## Worked example

```text
DOC:
{
  "users": [
    {"id": 1, "name": "Ada", "active": false},
    {"id": 2, "name": "Bob", "active": true}
  ]
}

QUERY:
patch $ {
  users[*].active: true,                        # broadcast write
  users[0].name: "Ada Lovelace",                # specific write
  users[*].last_seen: "2026-05-08" when .active # conditional broadcast
}
```

What happens:

- One walk visits every user.
- For each, three potential writes evaluate. Per element:
  - `active: true` always applies.
  - `name` only at index 0.
  - `last_seen` only when post-`active` write is true (so all of them).

Output:

```json
{
  "users": [
    {"id": 1, "name": "Ada Lovelace", "active": true, "last_seen": "2026-05-08"},
    {"id": 2, "name": "Bob",          "active": true, "last_seen": "2026-05-08"}
  ]
}
```

## When fusion *doesn't* fire

- The chain isn't rooted at `$` (parser doesn't classify it as a write).
- The writes are gated by data-dependent conditions that change document
  shape mid-pipeline.
- Mixed read/write — `$.users[0].name.set("A").upper()` keeps standard
  method semantics.

## Tips

- Prefer the block form (`patch $ { … }`) when you have ≥ 3 writes — easier
  to read, and the optimizer treats it identically.
- Use broadcast (`xs[*].field: v`) instead of a `.map` that calls `.set`
  per element.
- Conditionals (`when`) are fine — they don't break fusion.
