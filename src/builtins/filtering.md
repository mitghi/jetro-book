# Filtering

## Fixture

Examples below run against:

```jetro
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}], "events": [{"sev": 1, "msg": "ok", "kind": "start"}, {"sev": 2, "msg": "warn", "kind": "end"}, {"sev": 3, "msg": "err", "kind": "start"}], "xs": [1, 2, 3, 4, 5]}
```

Methods that drop elements based on a predicate.

## `filter`

- **Signature:** `Array<A> -> Array<A>` (with `pred: A -> Bool`)
- **Demand law:** `FilterLike` — `FirstInput(n)` from downstream becomes
  `UntilOutput(n)` upstream.

```jetro
$.users.filter(u => u.active)
$.users.filter(@.age >= 18)
$.users.filter(@.email ~= "@admin\.")
```

`filter` is the universal predicate stage. Combine with `.take(n)` for
bounded scans:

```jetro
$.events.filter(@.severity >= 3).take(10)
```

The planner stops reading from the source as soon as 10 events pass — no
full scan.

## `find`

- **Signature:** `Array<A> -> A | null` *(first match only on this branch)*
- **Demand law:** `FilterLike` with `FirstInput(1)` → source.

```jetro
DOC:    {"users": [{"id":1,"role":"user"},{"id":2,"role":"admin"}]}
QUERY:  $.users.find(@.role == "admin")
OUT:    {"id":2,"role":"admin"}
```

`find` returns the **first** match (or null if none), not an array. Use
`find_all` for the array form.

## `find_all`

- **Signature:** `Array<A> -> Array<A>`
- **Behavior:** Like `filter`. Alias kept for readability.

```jetro
$.users.find_all(@.role == "admin")
```

Equivalent to `.filter(@.role == "admin")`. The two are interchangeable.

## `compact`

- **Signature:** `Array<Any> -> Array<Any>`
- **Behavior:** Drop nulls.

```jetro
QUERY:  [1, null, 2, null, 3].compact()
OUT:    [1,2,3]
```

Equivalent to `.filter(@ != null)`, but reads better and avoids a lambda.

## `take_while` *(alias `takewhile`)*

- **Signature:** `Array<A> -> Array<A>`
- **Behavior:** Take elements while `pred` is true; stop at the first false
  (don't keep checking).

```jetro
QUERY:  [1, 2, 3, 4, 1, 2].take_while(@ < 3)
OUT:    [1,2]
```

Demand law: bounded — terminates the source as soon as `pred` flips.

## `drop_while` *(alias `dropwhile`)*

- **Signature:** `Array<A> -> Array<A>`
- **Behavior:** Drop the leading run where `pred` holds; emit the rest.

```jetro
QUERY:  [1, 2, 3, 4, 1, 2].drop_while(@ < 3)
OUT:    [3,4,1,2]
```

## `remove`

- **Signature:** `Array<A> -> Array<A>`
- **Behavior:** Inverse of `filter`. Drop elements where `pred` is true.

```jetro
QUERY:  $.xs.remove(@ < 0)
```

Useful when the negated predicate reads worse than the affirmative.

## Filtering objects

For object filtering, see `filter_keys` and `filter_values` in
[Objects](./objects.md). They take a predicate over keys / values and return
a filtered object.

## Practical examples

```jetro
DOC:    {"users":[
  {"id":1,"name":"Ada","active":true,"age":30},
  {"id":2,"name":"Bob","active":false,"age":24},
  {"id":3,"name":"Cy", "active":true,"age":42}
]}

# Active users only
QUERY:  $.users.filter(@.active)
OUT:    []

# Active users over 30, just names
QUERY:  $.users.filter(@.active and @.age >= 30).map(@.name)
OUT:    []

# First admin (early-exit)
QUERY:  $.users.find(@.active).name
OUT:    "Ada"

# Take while a streak holds
QUERY:  [1,2,3,4,1,2].take_while(@ < 3)
OUT:    [1,2]

# Negate a predicate
QUERY:  $.users.remove(@.active).count()
OUT:    1

# Drop nulls
QUERY:  [1, null, 2, null, 3].compact()
OUT:    [1,2,3]
```

## Worked demand example

```jetro
DOC:    {"events": [
  {"sev": 1, "msg": "ok"},
  {"sev": 2, "msg": "warn"},
  {"sev": 3, "msg": "err"},
  {"sev": 1, "msg": "ok2"}
]}

QUERY:  $.events.filter(@.sev >= 2).map(@.msg).take(2)
OUT:    []
```

Demand walks back: take(2) → FirstInput(2), map → preserves, filter →
UntilOutput(2). Source reads events one-by-one, stops after the second
match.
