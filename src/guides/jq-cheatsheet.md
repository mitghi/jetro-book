# jq vs jetro Cheatsheet

## Fixture

Examples below run against:

```jetro
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}]}
```

For users coming from `jq`. Same shape: query JSON in a terminal. Different
philosophy in places — call this out where it matters.

In the CLI, use `-e` for direct expression execution:

```bash
jetrocli -e '$.users.filter($.active).map($.email)' < users.json
jetrocli --ndjson -i events.ndjson -e '$.id'
```

## Big differences at a glance

| Topic | jq | jetro |
|---|---|---|
| Calling methods | Pipe-of-filters: `. \| length` | Dot syntax: `.len()` |
| Pipe `\|` | Sole composition operator | Value-flow only — passes `@` to RHS |
| Iteration | Implicit on `.[]` | Explicit on chained methods |
| Lambdas | None — uses `.` rebinding | Three forms: `@`, `r =>`, `lambda r:` |
| Pattern matching | None | First-class with guards and ranges |
| Writes | `\|=`, `=`, `del()` | `.set()`, `patch $ {}`, chain-writes |
| Backend | Single interpreter | Six backends, planner-selected |
| Caching | None | Plan + path caches in `JetroEngine` |

Jetro favors functional method chains over jq's pipe-of-filters style:

```jetro
$.users
  .filter($.active)
  .map({id: $.id, email: $.email})
  .take(100)
```

## One-liner translations

### Identity / projection

```jetro
jq:     .
jetro:  $

jq:     .x
jetro:  $.x

jq:     .x.y[0]
jetro:  $.x.y[0]
```

### Iteration

```jetro
jq:     .users[]
jetro:  $.users[*]                  # explicit; or just .users for chained methods

jq:     .users[].name
jetro:  $.users.map(@.name)
```

### Field selection / projection

```jetro
jq:     {id, name}
jetro:  .pick(id, name)            # method form, maps over arrays

jq:     .users | map({id, name})
jetro:  $.users.map(u => u.pick(id, name))
        # or
        $.users.pick(id, name)

jq:     del(.password)
jetro:  $.omit(password)            # or $.password.delete()
```

### Filter

```jetro
jq:     .users | map(select(.active))
jetro:  $.users.filter(@.active)

jq:     .users[] | select(.age > 18)
jetro:  $.users.filter(@.age > 18)
```

### Aggregates

```jetro
jq:     length
jetro:  .len()                      # for arrays, objects, strings
        .count()                    # explicit array-count reducer

jq:     [.[] | .price] | add
jetro:  $.map(@.price).sum()

jq:     [.[] | .age] | min
jetro:  $.map(@.age).min()
        # or
        $.min_by(@.age).age           # one-pass, returns whole element
```

### Sort / unique / group

```jetro
jq:     sort
jetro:  .sort()

jq:     sort_by(.year)
jetro:  .sort(@.year)

jq:     unique
jetro:  .unique()

jq:     group_by(.author)
jetro:  .group_by(@.author)
        # jq returns array-of-arrays; jetro returns object indexed by key

jq:     [group_by(.k)[] | {k: .[0].k, n: length}]
jetro:  .count_by(@.k).entries().map(([k,n]) => {k, n})
```

### Slice and take

```jetro
jq:     .[0:3]
jetro:  $[0:3]

jq:     .[0]
jetro:  $[0]
        # or
        $.first()                    # demand-aware sink

jq:     .[-1]
jetro:  $[-1]
        # or
        $.last()
```

### Has / index / membership

```jetro
jq:     has("foo")
jetro:  .has("foo")

jq:     .tags | index("admin")
jetro:  $.tags.index("admin")

jq:     .tags | contains(["admin"])
jetro:  $.tags.includes("admin")
```

### Strings

```jetro
jq:     ascii_upcase
jetro:  .upper()

jq:     ltrimstr("foo")
jetro:  .strip_prefix("foo")

jq:     split(",")
jetro:  .split(",")

jq:     test("regex")
jetro:  @ ~= "regex"
        # or
        .re_match("regex")

jq:     match("(\\d+)").captures
jetro:  .captures("(\d+)")
```

### Recursive descent

```jetro
jq:     ..
jetro:  ..                           # same notation

jq:     .. | strings
jetro:  $..find(@ is string)

jq:     .. | objects | select(.id?)
jetro:  $..find(@.id?)
        # or
        $..shape({id})
```

### String formatting

```jetro
jq:     "Hello, \(.name)!"
jetro:  f"Hello, {$.name}!"
```

### Conditional

```jetro
jq:     if .x > 5 then "big" else "small" end
jetro:  "big" if $.x > 5 else "small"

jq:     .x // "default"
jetro:  $.x ?? "default"
```

### Variables

```jetro
jq:     . as $doc | $doc.x + $doc.y
jetro:  let doc = $ in doc.x + doc.y
```

### Reduce / fold

```jetro
jq:     reduce .[] as $x (0; . + $x)
jetro:  $.sum()                      # for sum specifically
        # or general fold:
        $.accumulate(0, (a, x) => a + x).last()
```

### Object construction

```jetro
jq:     {users: [.[] | {id, name}]}
jetro:  {users: $.map(u => u.pick(id, name))}
```

### Modification

```jetro
jq:     .x = 1
jetro:  $.x.set(1)
        # or
        patch $ {x: 1}

jq:     .x |= . + 1
jetro:  $.x.modify(@ + 1)

jq:     del(.x)
jetro:  $.x.delete()

jq:     .users[].active = true
jetro:  $.users[*].active.set(true)
        # or
        patch $ {users[*].active: true}
```

### Multiple writes

```jetro
jq:     .x = 1 | .y = 2 | del(.z)
jetro:  patch $ {x: 1, y: 2, z: DELETE}
```

jetro fuses these into one document walk. jq evaluates each pipe stage
independently.

### NDJSON

```bash
jq:     jaq -c '.id' events.ndjson
jetro:  jetrocli --ndjson -i events.ndjson -e '$.id'
```

For whole-file stream operations, use `$.rows()`:

```bash
jq:     tac events.ndjson | jaq -c 'select(.level == "error"), halt'
jetro:  jetrocli --ndjson -i events.ndjson \
          -e '$.rows().reverse().find($.level == "error").first()'
```

For Kafka compacted-topic dumps:

```bash
jetrocli --ndjson -i users.topic --payload-after '|' \
  -e '$.rows().reverse().distinct_by($.id).take(100)'
```

## Complex pipeline translations

Real-world jq queries from the wild. Originals are taken verbatim from the
[jq manual](https://jqlang.org/manual/) and the
[Programming Historian "Reshaping JSON with jq" lesson](https://programminghistorian.org/en/lessons/json-and-jq);
all credit to those sources. Each shows the original jq alongside an
idiomatic jetro rewrite.

### 1. Alternative-binding destructure (jq manual)

Flatten a list of resources whose `events` field may be either a single
object **or** an array of objects, into one row per `(resource, event)` pair.
jq uses its alternative-destructuring operator `?//` to try both shapes:

```jq
.resources[] as {$id, $kind, events: {$user_id, $ts}} ?// {$id, $kind, events: [{$user_id, $ts}]}
  | {$user_id, $kind, $id, $ts}
```

jetro has no `?//`. Use kind-test + `flat_map` to normalise:

```jetro
$.resources.flat_map(r =>
  let evts = (r.events if r.events is array else [r.events]) in
    evts.map(e => {
      user_id: e.user_id,
      kind:    r.kind,
      id:      r.id,
      ts:      e.ts
    })
)
```

…or with a `match` to make the two shapes explicit:

```jetro
$.resources.flat_map(r =>
  match r.events with {
    arr: array -> arr.map(e => {user_id: e.user_id, kind: r.kind, id: r.id, ts: e.ts}),
    {user_id, ts} -> [{user_id, kind: r.kind, id: r.id, ts}],
    _ -> []
  }
)
```

The `match` form is more explicit and surfaces the "single object" branch as
its own arm — easier to extend (e.g. add a third event-shape later).

### 2. Tweet hashtags as semicolon-joined CSV (Programming Historian)

Take an array of tweets, project `id` plus a semicolon-joined string of
hashtag texts, emit as CSV. Original jq, threaded through five pipe stages:

```jq
{id: .id, hashtags: .entities.hashtags}
| {id: .id, hashtags: [.hashtags[].text]}
| {id: .id, hashtags: .hashtags | join(";")}
| [.id, .hashtags]
| @csv
```

Each pipe stage rebuilds the object — jq has no nested method chaining, so
projection accumulates by reassignment.

jetro collapses it to one chain:

```jetro
$.map(t => {
  id:       t.id,
  hashtags: t.entities.hashtags.map(@.text).join(";")
}).to_csv()
```

`to_csv` already emits the row, headers and all. To match jq's headerless
output:

```jetro
$.map(t => [t.id, t.entities.hashtags.map(@.text).join(";")])
 .map(row => row.map(@.to_string()).join(","))
 .join("\n")
```

### 3. Hashtag frequency CSV (Programming Historian)

Explode each tweet into one row per hashtag, group by hashtag, count, emit
`(tag, count)` as CSV. Original jq:

```jq
[.[] | {id: .id, hashtag: .entities.hashtags} | {id: .id, hashtag: .hashtag[].text}]
| group_by(.hashtag)
| .[]
| {tag: .[0].hashtag, count: . | length}
| [.tag, .count]
| @csv
```

jq's group_by returns an array-of-arrays, so the trailing `.[]` and
`.[0].hashtag` extract the key from the first element of each group.

jetro uses `count_by`, which already produces a `{tag: count}` map:

```jetro
$.flat_map(t => t.entities.hashtags.map(@.text))
 .count_by(@)
 .entries()
 .map(([tag, count]) => {tag, count})
 .to_csv()
```

The pipeline reads top-to-bottom: explode → tally → reshape → emit.
`count_by` is one of several jetro idioms (also `index_by`, `unique_by`,
`max_by`) that fold a common jq pattern (`group_by | map(...)`) into a
single barrier.

### Why these examples are shorter in jetro

Three patterns recur:

1. **Method chaining.** jq's `... | {...} | {...}` style rebuilds the object
   at each stage; jetro's `.map(t => {...})` builds it once.
2. **Specialised barriers.** `count_by`, `index_by`, `unique_by`,
   `max_by`, `min_by` collapse `group_by | map(...)` chains into one call.
3. **First-class lambdas.** jq's `.` rebinding inside `as` / `[]` becomes
   plain `t => t.field` in jetro, with no positional gymnastics.

The trade-off: jq's pipe-of-filters is more uniform — every stage is a
filter that takes one input and produces zero-or-more outputs. jetro's
methods are typed (one-to-one, filter, expander, reducer, barrier), so the
pipeline shape is more visible but the surface is bigger.

## Things jq has that jetro doesn't

- **`@base64`, `@uri`, `@csv` formatters as suffix.** jetro spells these as
  methods: `.to_base64()`, `.url_encode()`, `.to_csv()`.
- **SQL-style modules.** No equivalent.
- **`input`, `inputs`, `nul`-separated streaming.** jetro is in-process; no
  streaming-input model.
- **`recurse(f; cond)`.** Use `walk_pre` or `rec` with a pattern.

## Things jetro has that jq doesn't

- **Pattern matching with guards, ranges, kind binding, deep `..match`.**
- **Demand propagation.** `.first()`, `.find()`, `.take(n)` cut off the
  source; no full materialization.
- **Bitmap structural index.** `..find`, `..shape`, `..like` skip non-matching
  subtrees in O(1) per node.
- **First-class lambdas** (`r => body`, `lambda r: body`) with let-binding +
  inlining.
- **Write fusion.** Many writes batch into one walk.
- **Backends.** Tape-zero-copy, structural index, columnar — selected by
  the planner.

## Pitfalls when porting

- **`.[]` doesn't exist.** Replace with `[*]` or just chain methods (most
  jetro methods auto-iterate over arrays).
- **Pipe is *not* composition.** `.x | .y` in jq means "x then y". In jetro
  it's "evaluate `.y` with `@` = `.x`". For chaining methods, use `.`:
  `.x.y()`.
- **Method calls need parens.** `length` is `.len()`, not `.len`.
- **`select(p)` becomes `filter(p)`**, and works on whole arrays — no need
  to first iterate with `.[]`.
- **Group_by returns an object**, not an array of arrays. Use `.entries()`
  for jq-shaped output.

## Quick reference card

| Need | jq | jetro |
|---|---|---|
| Project | `{a, b}` | `.pick(a, b)` |
| Drop key | `del(@.k)` | `.omit(k)` |
| Filter | `select(p)` | `.filter(p)` |
| Map | `map(f)` | `.map(f)` |
| Iterate | `.[]` | `[*]` or implicit |
| Length | `length` | `.len()` |
| Sort | `sort_by(@.k)` | `.sort(@.k)` |
| Unique | `unique` | `.unique()` |
| First | `.[0]` | `.first()` |
| Last | `.[-1]` | `.last()` |
| String concat | `"\(@.x)"` | `f"{$.x}"` |
| Default | `// d` | `?? d` |
| If | `if c then a else b end` | `a if c else b` |
| Var | `as $x` | `let x = ...` |
| Set | `.x = v` | `.x.set(v)` |
| Update | `.x \|= f` | `.x.modify(f)` |
| Delete | `del(@.x)` | `.x.delete()` |
