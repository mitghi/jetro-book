# Array and Set Operations

## Fixture

Examples below run against:

```text
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}], "user": {"id": 42, "name": "Ada", "email": "ada@x.com", "tags": ["math", "code"], "profile": {"name": "Ada", "email": "ada@x.com"}, "active": true, "verified": true}, "events": [{"sev": 1, "msg": "ok", "kind": "start"}, {"sev": 2, "msg": "warn", "kind": "end"}, {"sev": 3, "msg": "err", "kind": "start"}], "metric": {"pct": 0.5, "value": 7, "x": 10}, "tags_today": ["a", "b", "c"], "tags_yesterday": ["b", "c", "d"], "left_tags": ["a", "b", "c"], "right_tags": ["b", "c", "d"]}
```

Operations that take an array and produce a derivative array (or join two
arrays).

## `append(v)` and `prepend(v)`

- **Signature:** `Array<A> -> Array<A>`
- **Behavior:** Add `v` to the end / front.

```text
QUERY:  [1,2,3].append(4)     OUT: [1,2,3,4]
QUERY:  [1,2,3].prepend(0)     OUT: [0,1,2,3]
```

When used as chain-write terminals (`$.path.append(v)`), they patch the
document — see [Patch](../grammar/patch.md).

## `reverse`

- **Signature:** `Array<A> -> Array<A>`
- **Behavior:** Reverse element order. Also works on strings (calls
  `reverse_str`).

```text
QUERY:  [1,2,3].reverse()     OUT: [3,2,1]
QUERY:  "abc".reverse()     OUT: ["abc"]
```

## Set-like operations

| Method | Behavior |
|---|---|
| `diff(other)` | Elements in self not in other |
| `intersect(other)` | Elements in both |
| `union(other)` | Elements in either, deduped |

```text
QUERY:  [1,2,3,4].diff([3,4,5])     OUT: [1,2]
QUERY:  [1,2,3,4].intersect([3,4,5])     OUT: [3,4]
QUERY:  [1,2,3].union([3,4,5])     OUT: [1,2,3,4,5]
```

Equality is structural. Order: result preserves first-occurrence order from
the left operand.

## `join(sep)`

- **Signature:** `Array<String> -> String`
- **Behavior:** Concatenate strings with separator.

```text
QUERY:  ["a","b","c"].join(", ")
OUT:    "a, b, c"

QUERY:  $.users.map(@.name).join(" / ")
```

For non-string elements, lift with `.map(@.to_string())` first.

## `zip(other)` and `zip_longest(other, fill?)`

- **Signature:** `Array<A>, Array<B> -> Array<[A, B]>`
- **Behavior:** Pair element-wise.

```text
QUERY:  [1,2,3].zip(["a","b","c"])
OUT:    [[1,"a"],[2,"b"],[3,"c"]]

QUERY:  [1,2,3].zip(["a","b"])     OUT: [[1,"a"],[2,"b"]]
QUERY:  [1,2,3].zip_longest(["a","b"]) OUT: [[1,"a"],[2,"b"],[3,null]]
QUERY:  [1,2,3].zip_longest(["a"], "x") OUT: [[1,"a"],[2,"x"],[3,"x"]]
```

## `fanout(...lambdas)`

- **Signature:** `A -> Array<...>`
- **Behavior:** Apply each lambda to the same input; collect results.

```text
DOC:    {"x": 10}
QUERY:  $.x.fanout(@ * 2, @ + 1, @.to_string())
OUT:    [20,11,"10"]
```

Useful for building multi-shape projections without repeating subexpressions.

## `zip_shape(arrays)`

> ⚠ **Not yet supported in v0.5** — runtime returns `"ZipShape: builtin
> unsupported"`. Spec exists; runtime hookup pending.

- **Signature (planned):** `Object<KeyString, Array<A>> -> Array<Object>`
- **Behavior (planned):** Combine parallel arrays under shared keys into an
  array of objects.

The inverse is `pivot` — see [Objects](./objects.md).

## Demand notes

Set operations and `join` are barriers (they consume both inputs fully).
`reverse` is a barrier too — but it's cheap and well-supported by demand:
`reverse().take(n)` is rewritten so the source seeks to the end.

## Practical examples

```text
# Add an item to a tag list
$.user.tags.append("admin")             # patches the doc

# Build a "label = value" string
$.user.pick(name, email).values().join(" = ")

# CSV row from selected fields
[$.user.id, $.user.name, $.user.email].join(",")

# Set difference — find items missing from a baseline
[1,2,3,4,5].diff([2,4])                 # → [1, 3, 5]

# Set intersection — common items
$.left_tags.intersect($.right_tags)

# Merge unique values, preserving first-occurrence order
$.tags_today.union($.tags_yesterday)

# Reverse and take last 5 (demand-aware: seeks end)
$.events.reverse().take(5)

# Pair two arrays positionally
[1,2,3].zip(["a","b","c"])              # → [[1,"a"],[2,"b"],[3,"c"]]

# Pad shorter array with default
[1,2,3].zip_longest(["a","b"], "?")     # → [[1,"a"],[2,"b"],[3,"?"]]

# Run several projections at once
$.metric.value.fanout(@ * 2, @ + 1, @ - 1)    # → [v*2, v+1, v-1]
```
