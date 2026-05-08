# Known Limitations and Behavior Surprises (v0.5)

Empirically validated against jetro 0.5.5. This page is the canonical
fix-list — every entry is a known gap between intended and actual behavior.
Use it as a backlog: items here should drop as the runtime catches up.

## v0.5.5 — fixed in this release

The 14 audit-surfaced bugs were all addressed:

- ✅ `[*]` wildcard parses (mid-chain expands to `.map(@ + rest)`).
- ✅ `[a:b:c]` and `[::n]` (incl. `[::-1]` reverse) — Python-style step slicing.
- ✅ Lambda array-pattern destructure `([k, v]) => body` (sugar via synthetic param + let).
- ✅ Object patterns in `match` accept reserved words as keys (`{kind: "click"}`).
- ✅ `Val::StrSlice + Val::Str` → string concat. Path-rooted concat works.
- ✅ `entries()`/`keys()`/`values()` no longer triple-wrap their array result.
- ✅ `parse_int(radix)` — base-aware integer parsing with prefix stripping.
- ✅ `to_csv(headers)` / `to_tsv(headers)` — explicit header column ordering.
- ✅ `accumulate(init, fn)` — explicit-init fold variant (single-arg form preserved).
- ✅ `rec` fixpoint uses deep structural equality (was scalar-only, looped on Obj inputs).

Tests: 92 new in `tests/grammar_extensions`, `tests/strslice_arith`,
`tests/entries_wrap`, `tests/builtin_migrations`. 1245 lib tests pass.
Bench vs `pre-fix14`: no regression > 2%; `match_range_scan` -3.6%
improved.

Items below are still outstanding.

Organized into:

1. [Unsupported builtins](#1-unsupported-builtins) — return runtime error
2. [Broken builtins](#2-broken-builtins) — execute but wrong result
3. [Parser / grammar gaps](#3-parser--grammar-gaps) — syntax that doesn't parse
4. [Pipeline / runtime semantics](#4-pipeline--runtime-semantics) — wrong shape or scope
5. [Argument / receiver shape rules](#5-argument--receiver-shape-rules) — what each method actually accepts

---

## 1. Unsupported builtins

Return runtime errors like `"X: builtin unsupported"` or `"X: builtin not
migrated to builtins.rs AST adapter"`. Spec exists in `defs.rs`; runtime
hookup pending.

| Method | Error | Workaround |
|---|---|---|
| `accumulate` | `"not migrated to builtins.rs AST adapter"` | `cummax` / `cummin` for running min/max; otherwise drive fold from host |
| `partition` (chained) | Pipeline-unsupported in chained position; output shape unstable | Two filters: `[xs.filter(p), xs.filter(not p)]` |
| `zip_shape` | `"unsupported"` | `pivot` for some shapes; otherwise hand-zip |
| `group_shape` | `"unsupported"` | Group manually by `.keys().sort().join(",")` projection |
| `approx_count_distinct` | `"unsupported"` | `.unique().count()` (exact) |
| `parse_int(radix)` | `"parse_int: builtin not migrated to builtins.rs AST adapter"` | No-arg form (`"42".parse_int()`) works for base-10 only |
| `to_csv([headers])` | `"to_csv: builtin not migrated to builtins.rs AST adapter"` | No-arg `to_csv()` works; for custom header order, project keys with `.pick(...)` first |

### Fix-list (engine)

- [ ] Wire `Accumulate::apply_*` through `builtins.rs` AST adapter.
- [ ] Wire `Partition` for pipeline planner; decide canonical output shape (tuple vs object).
- [ ] Implement `ZipShape`, `GroupShape` runtime.
- [ ] Implement HyperLogLog backend for `approx_count_distinct`.
- [ ] Add radix-aware overload of `parse_int`.
- [ ] Add header-array overload of `to_csv`.

---

## 2. Broken builtins

Execute without erroring but produce wrong results.

| Method | Symptom | Workaround |
|---|---|---|
| `rec` | `"rec: exceeded 10000 iterations without reaching fixpoint"` even on simple inputs | `walk` / `walk_pre` with manual shape check |
| `missing(...keys)` | Always returns `false` instead of the missing-keys array | `["k1","k2"].filter(k => not $.has_path(k))` |
| `get_path("a/b/c")` | Resolves only single-key paths; nested slash/dot returns null | Direct path navigation `$.a.b.c` (literal); for dynamic, walk manually with chained `[expr]` |
| `dedent()` | Strips first line's prefix from matching subsequent lines, **not** common-leading-whitespace | Hand-process if true dedent needed |
| `remove(pred)` | Returns input unchanged (predicate not applied) | `.filter(not pred)` — semantically equivalent |
| `enumerate()` after a streaming stage | Loses pairing — emits values without indices when chained behind `.map(...)` | Apply `enumerate()` directly on the source, before `.map`/`.filter` |
| `pairwise()` on path source | Returns input array unchanged instead of consecutive pairs | Works on literal sources (`[1,2,3].pairwise()`); for path, materialize with `let xs = $.prices in [...].pairwise()` workaround |
| `.has(v)` method on array | Returns the array itself, not boolean | Use `.includes(v)` for boolean membership |

### Fix-list (engine)

- [ ] Fix `Rec` fixpoint detection — compare structurally, bound iteration safely.
- [ ] Fix `Missing` to compute and return the actual missing-keys list.
- [ ] Implement multi-segment slash/dot paths in `get_path` / `del_path`.
- [ ] Make `dedent()` strip common leading whitespace per Python `textwrap.dedent` semantics.
- [ ] Wire `.remove(pred)` predicate evaluation; currently lambda body is ignored.
- [ ] Make `.enumerate()` survive composition with downstream stages (`map`, `filter`).
- [ ] Make `.pairwise()` work on path sources (currently bypassed by some pipeline path).
- [ ] Make `.has(v)` method return boolean (currently returns the receiver).

---

## 3. Parser / grammar gaps

Syntactic forms that look correct but parse-error or behave unexpectedly.

### 3.1 No `in` operator

```text
"x" in xs              # ✗ parse error
1 in [1,2,3]           # ✗ parse error
```

Use `.includes(v)` (arrays/strings) or postfix `xs has v`:

```text
xs.includes("x")       # ✓ method
xs has "x"             # ✓ operator
```

### 3.2 Bare-path inside method args doesn't parse

```text
$.users.filter(.active)        # ✗ parse error
$.users.map(.name)             # ✗
$.xs{.k > 1}                   # ✗
$.users.sort(.year)            # ✗
```

Use `@.field` or named lambda:

```text
$.users.filter(@.active)
$.users.filter(u => u.active)
$.users.map(@.name)
$.xs{@.k > 1}
$.users.sort(@.year)
```

### 3.3 Object literal as method receiver

`{a: 1, b: 2}.keys()` parses leading `{...}` as inline filter, not literal
object. Even `({a:1}).keys()` returns array-wrapped due to path-call
wrapping. Workaround:

```text
let o = {a: 1, b: 2} in o.keys()
```

### 3.4 Pattern match shorthand `{id, name}` not supported

```text
match obj with { {id, name} -> [id, name] }     # ✗ parse error
match obj with { {id: i, name: n} -> [i, n] }   # ✓
```

### 3.5 Rest pattern `..rest` not supported

```text
match obj with { {host, port, ..rest} -> rest }     # ✗ parse error
```

Bind explicitly + compute rest outside the match.

### 3.6 Array-pattern destructure in lambda body

```text
$.entries.map(([k, v]) => {k, v})              # ✗ parse error
$.entries.map(e => {k: e[0], v: e[1]})         # ✓
```

### 3.7 Comments

There are no comments inside a query. Strip client-side.

### 3.8 `[expr]` vs `{expr}`

Inline filter is `{predicate}`. `[expr]` is index/slice.

```text
$.xs{@.active}        # ✓ inline filter
$.xs[@.active]        # ✗ index expression
```

### Fix-list (parser)

- [ ] Optional: add `in` operator as sugar for `.includes(v)` for jq parity.
- [ ] Allow bare-path `.field` inside method args (sugar for `@.field`).
- [ ] Allow `{a: 1, b: 2}.method()` to parse as literal-object call.
- [ ] Add object-pattern shorthand `{id, name}` (binds to identifiers of same name).
- [ ] Add rest pattern `{..rest}` and `[head, ...tail]` in lambda destructure.
- [ ] Add array-pattern destructure in lambda parameter position.

---

## 4. Pipeline / runtime semantics

### 4.1 Path-call wrapping

Calling a scalar method on a path returns an **array-wrapped** result:

```text
DOC:    {"x": 10, "s": "hello"}
QUERY:  $.x.type()             →  ["number"]    (not "number")
QUERY:  $.s.upper()             →  ["HELLO"]    (not "HELLO")
QUERY:  $.x.to_json()           →  ["10"]
QUERY:  $.s.slice(0, 3)         →  ["hel"]
```

Calling on a literal scalar does not wrap:

```text
QUERY:  10.type()               →  "number"
QUERY:  "hello".upper()         →  "HELLO"
```

To unwrap a path-call result:

```text
QUERY:  $.s.upper().first()     →  "HELLO"
QUERY:  $.x | @.type()          →  "number"
```

This affects most book examples that show bare-scalar `OUT:` for a query
rooted at `$`.

### 4.2 Regex escapes — single backslash

Inside jetro string literals, regex specials use a **single** backslash:

```text
"a1b2".re_match("\d")          # ✓ true
"a1b2".re_match("\\d")         # ✗ false (sends literal \\d to regex)
```

Opposite of host languages like Python or JavaScript.

### 4.3 `.replace(needle, with)` is single-occurrence

```text
"hello hello".replace("hello", "hi")          # → "hi hello"  (only first)
"hello hello".replace_all("hello", "hi")      # → "hi hi"
```

### 4.4 `indent(n)` takes an integer count, not a prefix string

```text
"a\nb".indent(2)            # ✓ → "  a\n  b"
"a\nb".indent("  ")         # ✗ runtime error "expected number argument"
```

### 4.5 `from_json` needs a path or `let`-bound receiver

```text
"{\"a\":1}".from_json()             # ✗ parse error
$.s.from_json()                     # ✓
let s = "{\"a\":1}" in s.from_json() # ✓
```

### 4.6 `.to_json()` over an array of objects emits per-element JSON

```text
$.users.to_json()
# → ["{\"id\":1,...}", "{\"id\":2,...}"]    (array of JSON strings)
```

For a single JSON serialisation of the whole array, use the host's encoder
or `to_json` on the literal array.

### 4.7 Comprehensions over `$.path` and pair destructure (FIXED)

List, dict, set, and generator comprehensions now iterate path sources
correctly (including `Val::IntVec` / `FloatVec` / `StrVec` / `StrSliceVec`
/ `ObjVec` columnar fast paths) and accept pair-destructure binding forms.

Multiple `if` clauses are folded with `and` at parse time. Both
`for k, v in pairs` and `for [k, v] in pairs` work as 2-var destructure.

```text
[n*n for n in $.xs if n > 1 if n < 5]    # ✓
{k: v for [k, v] in pairs}                # ✓
{n: n*n for n in $.xs}                    # ✓
```

See `tests::comprehensions` (63 tests) for full coverage.

### Fix-list (runtime)

- [ ] Decide canonical scalar-on-path output shape: bare scalar or array. Currently mixed; book assumes bare.
- [ ] Document or change regex escape policy. Make jetro string literals process `\d`, `\n`, `\t` etc consistently.
- [ ] Either alias `replace = replace_all` or document the asymmetry prominently in the parser/runtime.
- [ ] Allow `indent` to accept a string prefix (for non-space indents) or rename to `indent_n`.
- [ ] Allow `from_json` on parenthesized string literal expressions.
- [ ] Make `to_json` on array context emit single document, not array of docs. Add `to_json_each` if per-element is desired.
- [x] Fix list-comp source iteration to walk `$.path` per-element. ✅ (jetro 0.5.5)
- [x] Fix dict-comp destructure form `{k: v for [k, v] in pairs}`. ✅ (jetro 0.5.5)

---

## 5. Argument / receiver shape rules

### 5.1 Methods that need `@`-form or named lambda (not bare-path)

| Method | Working forms |
|---|---|
| `filter`, `find`, `find_all`, `find_first`, `find_one`, `find_index`, `indices_where`, `any`, `all`, `take_while`, `drop_while`, `remove` | `(@.x op v)`, `(b => b.x op v)`, `(lambda b: ...)` |
| `map`, `flat_map`, `transform_keys`, `transform_values`, `filter_keys`, `filter_values` | Same |
| `sort`, `unique_by`, `group_by`, `count_by`, `index_by`, `max_by`, `min_by` | `(b => b.x)` named lambda is most reliable; `@.x` works |

```text
$.books.sort(b => b.year)             # ✓
$.books.sort(@.year)                  # ✓
$.books.sort(.year)                   # ✗ parse error
```

### 5.2 Methods that take bare identifiers

| Method | Form |
|---|---|
| `pick(field, alias: src, ...)` | Bare identifiers. **Not** `@.field`. |
| `omit(field, ...)` | Same |
| `rename({old: new, ...})` | Object map |
| `missing("k1", "k2", ...)` | String literals |

```text
$.user.pick(id, name)                 # ✓
$.user.pick(@.id, @.name)             # ✗ parse error
$.user.pick(uid: id)                  # ✓ alias
```

### 5.3 Multi-arg lambdas

Two-arg lambdas in `accumulate`, `equi_join` custom-shape, `reduce`-style
calls work with parens:

```text
$.orders.equi_join($.customers, "cid", "id", (o, c) => {buyer: c.name})
```

Array-pattern destructure of the args (`([a, b]) => …`) does **not** parse
— see [3.6](#36-array-pattern-destructure-in-lambda-body).

---

## Versions

This page reflects v0.5.4 behavior empirically tested. The verification
harness lives in `/tmp/jetro-coverage` (or wherever you want to keep it):
133 / 133 practical examples in the book pass against the runtime as of
the audit. As the engine catches up, entries here drop.
