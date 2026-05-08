# Positional Access

## Fixture

Examples below run against:

```jetro
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}], "orders": [{"id": 1, "customer": 1, "customer_id": 1, "cid": 1, "amount": 100, "status": "paid", "total": 100, "date": "2024-01-01"}, {"id": 2, "customer": 1, "customer_id": 1, "cid": 1, "amount": 50, "status": "open", "total": 50, "date": "2024-02-01"}, {"id": 3, "customer": 2, "customer_id": 2, "cid": 2, "amount": 75, "status": "paid", "total": 75, "date": "2024-03-01"}], "logs": [{"ts": "10:00", "sev": 1, "msg": "start"}, {"ts": "10:05", "sev": 3, "msg": "fail"}, {"ts": "10:10", "sev": 2, "msg": "warn"}], "transactions": [{"ts": "01"}, {"ts": "02"}, {"ts": "03"}]}
```

Bounded extraction by position.

## `first`

- **Signature:** `Array<A> -> A | null`
- **Demand law:** `First` — always `FirstInput(1)`.

```jetro
QUERY:  [10,20,30].first()     OUT: 10
QUERY:  [].first()              OUT: null

QUERY:  $.users.filter(@.active).first()
# Source reads only enough to get one active user.
```

Equivalent to `.nth(0)` but reads better and is the canonical "early-exit"
sink.

## `last`

- **Signature:** `Array<A> -> A | null`
- **Demand law:** `Last` — always `LastInput(1)`.

```jetro
QUERY:  [10,20,30].last()     OUT: 30
```

When the source supports it (an in-memory array, or a tape with known
length), `last` *seeks to the end*; for streams it must drain.

## `nth(i)`

- **Signature:** `Array<A> -> A | null`
- **Demand law:** `NthInput(i)` if `i` is non-negative; `LastInput(-i)`
  otherwise.

```jetro
QUERY:  [10,20,30,40].nth(2)     OUT: 30
QUERY:  [10,20,30,40].nth(-1)     OUT: 40
```

## `find_first(pred)`

- **Signature:** `Array<A> -> A | null`
- **Behavior:** Same as `find` — kept for naming clarity. Use `find` in new
  code.

## `find_one(pred)`

- **Signature:** `Array<A> -> A | null`
- **Behavior:** Asserts at most one match; errors if more than one matches.
  Useful for "exactly one user with this id" shapes.

```jetro
QUERY:  $.users.find_one(@.id == 1)
```

## `collect`

- **Signature:** `Any -> Array<Any>`
- **Behavior:** Coerce to array. Scalar → `[scalar]`; array → identity;
  null → `[]`.

```jetro
QUERY:  42.collect()     OUT: [42]
QUERY:  [1,2].collect()     OUT: [1,2]
QUERY:  null.collect()     OUT: []
```

Use `collect` to **guarantee an array shape** at a pipeline boundary —
useful for callers that always want to iterate.

## When to use a positional vs. a reducer

`first()` is a positional sink (returns one element). `count()` is a reducer
(returns one number). Both terminate the pipeline. Use whichever matches
your output type.

## Worked example

```jetro
DOC:    {"orders": [
  {"id": 1, "total": 100},
  {"id": 2, "total": 50},
  {"id": 3, "total": 200}
]}

QUERY:  $.orders.filter(@.total > 75).first().id
OUT:    1

QUERY:  $.orders.sort_by(@.total).last().id
OUT:    3
```

The first query early-exits (one filter pass, one match). The second sorts
(barrier), then takes the last — the planner can't avoid the sort.

## Practical examples

```jetro
# First active user — early-exit, demand-aware
$.users.find(@.active).name

# Last log entry of severity 3+ (when the source supports random access)
$.logs.filter(@.sev >= 3).last().msg

# Get a user at known index
$.users.nth(2).email

# Negative-index array tail
$.transactions.nth(-1).ts

# Coerce-or-empty: scalar source becomes a 1-element array
"hello".collect()      # → ["hello"]
null.collect()         # → []

# Use collect() at a method-call boundary so callers always iterate
$.config.tags.collect().map(@.lower())
```
