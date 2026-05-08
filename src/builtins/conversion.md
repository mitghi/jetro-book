# Conversion and Parsing

Coerce between value kinds.

## `to_number`

- **Signature:** `Any -> Number | null`
- **Behavior:** Coerce to number. `"42"` → `42`, `"3.14"` → `3.14`, `true` →
  `1`, `false` → `0`. Returns null for unparseable strings.

```text
QUERY:  "42".to_number()     OUT: 42
QUERY:  "3.14".to_number()     OUT: 3.14
QUERY:  "abc".to_number()      OUT: null
```

## `to_bool`

- **Signature:** `Any -> Boolean`
- **Behavior:** Truthiness: `false`/`null`/`0`/`""`/`[]`/`{}` → `false`,
  everything else → `true`.

```text
QUERY:  $.maybe.to_bool()
```

## `parse_int(radix?)`

- **Signature:** `String -> Number | null`
- **Behavior:** Parse a string as integer, optional radix (default 10).

```text
QUERY:  "42".parse_int()     OUT: 42
QUERY:  "ff".parse_int(16)     OUT: 255
QUERY:  "0b101".parse_int(2)     OUT: 5
```

## `parse_float`

- **Signature:** `String -> Number | null`
- **Behavior:** Parse a string as float (IEEE 754 double).

```text
QUERY:  "3.14".parse_float()     OUT: 3.14
QUERY:  "1e6".parse_float()     OUT: 1000000.0
```

## `parse_bool`

- **Signature:** `String -> Boolean | null`
- **Behavior:** Strict parse: only `"true"` and `"false"` (lowercase) match;
  everything else returns null.

```text
QUERY:  "true".parse_bool()     OUT: true
QUERY:  "TRUE".parse_bool()     OUT: true
```

## `as` cast (operator)

The `as` operator does the same coercions as `to_*`:

```text
"42" as int          # 42
42 as string         # "42"
true as int          # 1
```

Use `as` when the type is statically known; use `to_number`/`parse_*` when
parsing untrusted strings (since `as` errors on failure rather than returning
null).

## Round-trip JSON

For full document round-trip, see [`from_json`/`to_json`](./introspection.md).

## Practical examples

```text
# Coerce strings collected from a CSV
$.rows.map(r => r.merge({age: r.age.to_number(), price: r.price.parse_float()}))

# Defensive parse — null on garbage
$.user_input.parse_int() ?? 0

# Boolean coercion of a flag string
"true".parse_bool() ?? false

# Truthiness coercion
$.value.to_bool()               # null/0/""/empty → false; else true

# Cast operator for static conversions
($.id as string).pad_left(8, "0")

# Round-trip number → string → back
(3.14 as string).parse_float()  # → 3.14
```
