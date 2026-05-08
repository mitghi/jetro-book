# Object Projection and Transform

## Fixture

Examples below run against:

```jetro
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}], "user": {"id": 42, "name": "Ada", "email": "ada@x.com", "tags": ["math", "code"], "profile": {"name": "Ada", "email": "ada@x.com"}, "active": true, "verified": true}}
```

Methods that read or rewrite objects.

## Keys and values

| Method | Signature | Result |
|---|---|---|
| `keys` | `Object -> Array<String>` | Insertion-order key list |
| `values` | `Object -> Array<Any>` | Insertion-order value list |
| `entries` | `Object -> Array<[String, Any]>` | Key-value pairs |
| `to_pairs` | `Object -> Array<[String, Any]>` | Alias of `entries` |

```jetro
DOC:    {"a": 1, "b": 2}
QUERY:  $.keys()     OUT: ["a","b"]
QUERY:  $.values()     OUT: [1,2]
QUERY:  $.entries()     OUT: [["a",1],["b",2]]
```

## `from_pairs`

- **Signature:** `Array<[String, Any]> -> Object`
- **Behavior:** Inverse of `to_pairs`.

```jetro
QUERY:  [["a",1],["b",2]].from_pairs()
OUT:    {"a":1,"b":2}
```

## `invert`

- **Signature:** `Object<K, V> -> Object<V, K>`
- **Behavior:** Swap keys and values. Values must be coercible to keys
  (string-like).

```jetro
QUERY:  {"a":"x","b":"y"}.invert()
OUT:    {"x":"a","y":"b"}
```

## `pick(field, ...)`

- **Signature:** `Object -> Object`
- **Behavior:** Keep only the named keys. Supports `alias: src` rename.

```jetro
DOC:    {"id": 1, "name": "Ada", "secret": "!"}

QUERY:  $.pick(id, name)
OUT:    {"id":1,"name":"Ada"}

QUERY:  $.pick(uid: id, name)
OUT:    {"name":"Ada","uid":1}
```

Maps over arrays of objects:

```jetro
$.users.pick(id, email)
```

is equivalent to `$.users.map(u => u.pick(id, email))`.

## `omit(field, ...)`

- **Signature:** `Object -> Object`
- **Behavior:** Inverse of `pick`. Drop the named keys.

```jetro
QUERY:  $.user.omit(secret, password)
```

## Merge

| Method | Behavior |
|---|---|
| `merge(other)` | Shallow merge — `other`'s keys win on collision |
| `deep_merge(other)` | Recursive merge — sub-objects merged, arrays replaced |
| `defaults(other)` | Reverse merge — keep self's keys, fill missing from `other` |

```jetro
QUERY:  {"a":1,"b":2}.merge({"b":99,"c":3})
OUT:    {"a":1,"b":99,"c":3}

QUERY:  {"a":{"x":1}}.deep_merge({"a":{"y":2}})
OUT:    {"a":{"x":1,"y":2}}

QUERY:  {"a":1}.defaults({"a":99,"b":2})
OUT:    {"a":1,"b":2}
```

## `rename(...mapping)`

- **Signature:** `Object -> Object`
- **Behavior:** Rename keys per a `{old: new, ...}` mapping.

```jetro
QUERY:  $.user.rename({user_id: id, full_name: name})
```

## `transform_keys(fn)` and `transform_values(fn)`

- **Signature:** `Object -> Object`
- **Behavior:** Apply `fn` to every key / value.

```jetro
QUERY:  {"foo": 1, "bar": 2}.transform_keys(@.upper())
OUT:    [{"BAR":2,"FOO":1}]

QUERY:  {"a": 1, "b": 2}.transform_values(@ * 10)
OUT:    [{"a":10,"b":20}]
```

## `filter_keys(pred)` and `filter_values(pred)`

- **Signature:** `Object -> Object`
- **Behavior:** Keep entries whose key / value matches the predicate.

```jetro
QUERY:  $.config.filter_keys(k => k.starts_with("aws_"))
QUERY:  $.scores.filter_values(@ >= 50)
```

## `pivot(rows, cols, value)`

- **Signature:** `Array<Object> -> Object<KeyString, Object>`
- **Behavior:** Pivot a table-shaped array into a nested object indexed by
  `rows` then `cols`, with `value` as the leaf.

```jetro
DOC:    [{"y":2024,"q":1,"v":10},{"y":2024,"q":2,"v":20},{"y":2025,"q":1,"v":15}]
QUERY:  $.pivot("y", "q", "v")
OUT:    {"2024":{"1":10,"2":20},"2025":{"1":15}}
```

## `implode(joiner=",")`

- **Signature:** `Array<String> -> String`
- **Behavior:** Like `join`, but works on object values too:

```jetro
QUERY:  {"a":"x","b":"y"}.values().implode("/")
OUT:    ["x","y"]
```

## Demand notes

`pick` is a powerful demand signal — it tells the source which fields are
needed. Over a wide-record document, `pick(id, name)` upstream of the rest
of the pipeline avoids decoding all the other fields.

`keys` over an array stage emits one row per element, but `keys` over a
single object is a scalar.

## Practical examples

```jetro
DOC:    {"users":[
  {"id":1,"name":"Ada","email":"ada@x.com","secret":"!"},
  {"id":2,"name":"Bob","email":"bob@y.org","secret":"?"}
]}

# Project safe public fields
QUERY:  $.users.map(u => u.pick(id, name, email))

# Drop sensitive keys
QUERY:  $.users.map(u => u.omit(secret))

# Rename in flight
QUERY:  $.users.map(u => u.pick(uid: id, full_name: name, email))

# Keys / values / entries
QUERY:  $.users[0].keys()                  → ["id","name","email","secret"]
QUERY:  $.users[0].values().count()        → 4
QUERY:  $.users[0].entries().count()       → 4

# Round-trip through entries
QUERY:  $.users[0].entries().from_pairs()  → equivalent to $.users[0]

# Merge with defaults (existing keys win)
QUERY:  $.config.defaults({timeout: 30, retries: 3})

# Deep-merge config layers
QUERY:  $.base_config.deep_merge($.user_config)

# Filter object by key prefix
QUERY:  $.env.filter_keys(k => k.starts_with("AWS_"))

# Filter values
QUERY:  $.scores.filter_values(@ >= 50)

# Apply transform to every value
QUERY:  $.prices.transform_values(@ * 1.08)

# Normalise keys to snake_case
QUERY:  $.payload.transform_keys(k => k.snake_case())

# Invert a code-to-name table
QUERY:  $.country_codes.invert()           # {"US":"United States",...} → {"United States":"US",...}

# Pivot long-format records
DOC:    [{"y":2024,"q":1,"v":10},{"y":2024,"q":2,"v":20},{"y":2025,"q":1,"v":15}]
QUERY:  $.pivot("y","q","v")
OUT:    {"2024":{"1":10,"2":20},"2025":{"1":15}}
```
