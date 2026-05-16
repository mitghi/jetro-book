# Expanding Sequences

## Fixture

Examples below run against:

```jetro
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}], "books": [{"title": "Dune", "year": 1965, "author": "Herbert", "tags": ["sf"], "price": 15, "genre": "sci-fi"}, {"title": "Foundation", "year": 1951, "author": "Asimov", "tags": ["sf", "hugo"], "price": 10, "genre": "sci-fi"}, {"title": "Hyperion", "year": 1989, "author": "Simmons", "tags": ["sf", "hugo"], "price": 18, "genre": "cyberpunk"}, {"title": "Snow Crash", "year": 1992, "author": "Stephenson", "tags": ["sf", "cyberpunk"], "price": 12, "genre": "cyberpunk"}], "tweets": [{"id": 1, "text": "#foo", "entities": {"hashtags": [{"text": "foo"}]}}, {"id": 2, "text": "#bar #foo", "entities": {"hashtags": [{"text": "bar"}, {"text": "foo"}]}}]}
```

Each input produces zero or many outputs.

## `flat_map`

- **Signature:** `Array<A> -> Array<B>` (with `f: A -> Array<B>`)
- **Behavior:** Map then concatenate.

```jetro
QUERY:  [[1,2],[3,4]].flat_map(@)
OUT:    [1,2,3,4]

QUERY:  $.users.flat_map(u => u.tags)
```

If `f` returns a non-array, it's wrapped first (`flat_map(@ + 1)` works on
numbers).

## `flatten`

- **Signature:** `Array<Array<A>> -> Array<A>`
- **Behavior:** One level of flattening.

```jetro
QUERY:  [[1,2],[3],[4,5]].flatten()
OUT:    [1,2,3,4,5]
```

To flatten more levels, chain: `.flatten().flatten()`. Or use `walk` for full
recursive flatten of arbitrary structure.

## `explode`

> ⚠ **0.5.10 status:** `explode` requires an argument
> (errors with `"explode: missing argument"` on no-arg call). Spec is
> intended to mirror `chars` / `to_pairs` for the common cases; until then,
> use those builtins directly.

- **Signature (intended):** `(Array | Object | String) -> Array<...>`
- **Behavior (intended):** Convert to a flat sequence of elements / pairs /
  chars.
  - Array: identity
  - Object: array of `[key, value]` pairs (= `to_pairs`)
  - String: array of single-char strings (= `chars`)

## `split(sep)`

- **Signature:** `String -> Array<String>`
- **Behavior:** Split a string on a literal separator. (See `split_re` for
  regex.)

```jetro
QUERY:  "a,b,c".split(",")
OUT:    ["a","b","c"]
```

## `lines`

- **Signature:** `String -> Array<String>`
- **Behavior:** Split on newline (`\n` or `\r\n`).

```jetro
QUERY:  "a\nb\nc".lines()
OUT:    ["a","b","c"]
```

## `words`

- **Signature:** `String -> Array<String>`
- **Behavior:** Split on whitespace (any run).

```jetro
QUERY:  "  hello  world  ".words()
OUT:    ["hello","world"]
```

## `chars`

- **Signature:** `String -> Array<String>`
- **Behavior:** Array of single-character strings.

```jetro
QUERY:  "abc".chars()
OUT:    ["a","b","c"]
```

## `chars_of(s)`

- **Signature:** `String -> Array<String>`
- **Behavior:** Equivalent to `s.chars()`. Useful when the source is the
  argument:

```jetro
QUERY:  ($.text).chars_of()
```

## `bytes`

- **Signature:** `String -> Array<Number>`
- **Behavior:** UTF-8 byte values, 0–255.

```jetro
QUERY:  "abc".bytes()
OUT:    [97,98,99]
```

## Demand notes

Expanding stages declare an indeterminate output count. Pull demand from
downstream still flows back, but the planner can't tightly bound how many
inputs are needed — it pulls one input at a time and yields outputs lazily.

`.flat_map(...)` followed by `.first()` will read inputs until the first
flat-mapped output appears, then stop.

## Practical examples

```jetro
# Flatten one level
[[1,2],[3,4],[5]].flatten()                # → [1, 2, 3, 4, 5]

# Tags across all books
$.books.flat_map(@.tags)

# Distinct hashtags across tweets
$.tweets.flat_map(t => t.entities.hashtags.map(@.text)).unique()

# Word histogram from a paragraph
$.text.words().map(@.lower()).count_by(@)

# Parse CSV headers
"id,name,email".split(",")

# Process logs line by line
$.log_blob.lines().filter(@.contains_any(["ERROR","WARN"]))

# Char-level analysis
$.password.chars().count_by(@)             # frequency of each char

# Bytes for a binary diff
"hello".bytes()                            # → [104, 101, 108, 108, 111]
```
