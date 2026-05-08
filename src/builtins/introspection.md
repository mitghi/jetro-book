# Value Introspection

Methods that report on the *kind* and *shape* of a value, plus JSON round-trip.

## `type`

- **Signature:** `Any -> String`
- **Behavior:** Returns the kind of value as a string: `"null"`, `"bool"`,
  `"number"`, `"string"`, `"array"`, `"object"`.

```jetro
QUERY:  $.x.type()
DOC:    {"x": [1,2,3]}
OUT:    "array"
```

## `len`

- **Signature:** `(String|Array|Object) -> Number`
- **Behavior:** Length: chars for strings, elements for arrays, key count for
  objects. Errors on `null`/`bool`/`number`.

```jetro
DOC:    {"s": "hello", "xs": [1,2,3], "o": {"a":1,"b":2}}

QUERY:  $.s.len()     OUT: 1
QUERY:  $.xs.len()     OUT: 3
QUERY:  $.o.len()     OUT: 1
```

## `to_string`

- **Signature:** `Any -> String`
- **Behavior:** Stringifies a scalar (`42` → `"42"`, `true` → `"true"`,
  `null` → `"null"`). For arrays/objects, returns the JSON serialisation.

```jetro
QUERY:  42.to_string()     OUT: "42"
QUERY:  ([1, 2]).to_string()     OUT: "[1,2]"
```

## `to_json`

- **Signature:** `Any -> String`
- **Behavior:** Compact JSON serialisation of any value.

```jetro
QUERY:  $.user.to_json()
```

Distinguish from `to_string`: for compound values, the two are equivalent;
for scalars, `to_json` always quotes strings (`"foo"` → `"\"foo\""`),
`to_string` does not.

## `from_json`

- **Signature:** `String -> Any`
- **Behavior:** Parse a JSON string into a value.

```jetro
QUERY:  '{"x":1}'.from_json()
OUT:    {"x":1}

QUERY:  $.encoded.from_json().x
```

Errors on malformed input. Wrap in `try` if the source is untrusted:

```jetro
try $.s.from_json() else null
```

## `schema`

- **Signature:** `Any -> Object`
- **Behavior:** Infers a schema sketch — keys, kinds, nullable flags. Useful
  for "what does this document look like?" probes.

```jetro
DOC:    [{"id": 1, "name": "a"}, {"id": 2, "name": null}]
QUERY:  $.schema()
OUT:    {"items":{"fields":{"id":{"type":"Int"},"name":{"nullable":true,"type":"String"}},"required":["id"],"type":"Object"},"len":2,"type":"Array"}
```

The exact output format is documented in
[`builtins/ops/schema.rs`](https://github.com/mitghi/jetro/blob/main/jetro-core/src/builtins/ops/schema.rs);
treat it as advisory rather than a stable contract.

## Demand notes

- `len` over an array is `ValueNeed::None` upstream — it doesn't decode rows.
- `type` is `Identity` demand-wise.
- `from_json`/`to_json` are scalar transforms with no demand interaction.

## Practical examples

```jetro
# Quick shape check
$.payload.type()                        # → "object"
$.payload.len()                         # for object: number of keys

# Distinguish array length vs string length
$.items.len()                           # array element count
$.title.len()                           # number of characters

# Safe deserialization of a payload field
try $.body.from_json() else null

# Compact serialization
$.event.to_json()

# Stringify any value
$.x.to_string()

# Probe an unknown payload's schema
$.events[0].schema()
```
