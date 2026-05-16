# Membership and Predicates

Tests and small helpers.

## `or(default)`

- **Signature:** `Any, Any -> Any`
- **Behavior:** If self is null, return `default`. Otherwise return self.

```jetro
QUERY:  null.or("default")     OUT: "default"
QUERY:  "hi".or("default")     OUT: "hi"
```

Equivalent to `?? default` but reads better in chains:

```jetro
$.user.name.or("anon")
```

## `has(key)`

- **Signature:** `Object|Array, KeyOrIndex -> Bool`
- **Behavior:** True if the key exists (objects) or index is in range
  (arrays).

```jetro
QUERY:  {"a":1,"b":2}.has("a")     OUT: true
QUERY:  {"a":1}.has("b")     OUT: false
QUERY:  [1,2,3].has(2)     OUT: true
QUERY:  [1,2,3].has(5)     OUT: false
```

The `has` *operator* (`x has y`) is sugar for `x.includes(y)` — distinct
from this method.

## `has_key(key)`

- **Signature:** `Object, String -> Bool`
- **Behavior:** True if the receiver is an object and the key exists.

```jetro
QUERY:  {"a":1,"b":null}.has_key("a")     OUT: true
QUERY:  {"a":1,"b":null}.has_key("b")     OUT: true
QUERY:  {"a":1}.has_key("z")              OUT: false
QUERY:  [1,2,3].has_key("0")              OUT: false
```

Use `has_key` when you specifically mean object-key existence. It is narrower
than `has` and easier for direct object-key checks to optimize.

## `missing(...keys)`

- **Signature:** `Object, ...String -> Array<String>`
- **Behavior:** Return the subset of provided keys that are not present.

```jetro
QUERY:  {"host":"localhost","port":5432}.missing("host", "port", "user")
OUT:    ["user"]
```

## `includes(value)` *(alias `contains`)*

- **Signature:** `Array|String, Any -> Bool`
- **Behavior:** Membership.

```jetro
QUERY:  [1,2,3].includes(2)           OUT: true
QUERY:  "hello".includes("ell")       OUT: true
```

## `index(value)`

- **Signature:** `Array|String, Any -> Number | null`
- **Behavior:** Index of first occurrence; null if not found.

```jetro
QUERY:  [10,20,30].index(20)          OUT: 1
QUERY:  [10,20,30].index(99)          OUT: null
```

For strings, see also `index_of` in [String Search](./string-search.md).

## `indices_of(value)`

- **Signature:** `Array|String, Any -> Array<Number>`
- **Behavior:** All indices of `value`.

```jetro
QUERY:  [1,2,3,2,1].indices_of(2)
OUT:    [1, 3]
```

## Quick comparison: predicates that look similar

| Pattern | Returns |
|---|---|
| `obj.has_key("foo")` | Bool — does this object key exist? |
| `xs.has("foo")` | Bool — key/index style existence helper |
| `xs.includes("foo")` | Bool — is the value present? |
| `x has y` | Bool — membership/containment operator |
| `doc.has_path("a.b")` | Bool — does this nested path exist? |
| `xs.index("foo")` | Number\|null — where? |
| `xs.indices_of("foo")` | Array — all positions |
| `xs.find(p)` | A\|null — first matching element |
| `xs.find_index(p)` | Number\|null — first matching index |

## Practical examples

```jetro
# Default for missing field
$.user.email.or("no-email@example.com")

# Existence check on key
$.config.has_key("aws_region")

# Which required config keys are absent
$.config.missing("host", "port", "user")

# Index of a value (not the predicate form)
$.tags.index("admin")

# All positions of duplicates
[1, 2, 1, 3, 1].indices_of(1)            # → [0, 2, 4]

# Membership in a set
$.tags.includes("urgent")

# Allow-list / deny-list patterns
$.role.includes("admin") and not $.banned_users.includes($.id)
```
