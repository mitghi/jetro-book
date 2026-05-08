# Known Limitations and Behavior Surprises (v0.5)

Empirically validated against jetro 0.5.5. This page is the canonical
fix-list — every entry is a known gap between intended and actual behavior.
Use it as a backlog: items here should drop as the runtime catches up.

## v0.5.5 — fixed in this release

The 14 audit-surfaced bugs were addressed plus a follow-up sweep:

- ✅ `[*]` wildcard parses (mid-chain expands to `.map(@ + rest)`).
- ✅ `[a:b:c]` and `[::n]` (incl. `[::-1]` reverse) — Python-style step slicing.
- ✅ Lambda array-pattern destructure `([k, v]) => body` (sugar via synthetic param + let).
- ✅ Object patterns in `match` accept reserved words as keys (`{kind: "click"}`).
- ✅ `Val::StrSlice + Val::Str` → string concat. Path-rooted concat works.
- ✅ `entries()`/`keys()`/`values()` no longer triple-wrap their array result.
- ✅ `parse_int(radix)` — base-aware integer parsing with prefix stripping.
- ✅ `to_csv(headers)` / `to_tsv(headers)` — explicit header column ordering.
- ✅ `accumulate(init, fn)` and `accumulate(fn)` — both forms.
- ✅ `partition(pred)` — chained and standalone.
- ✅ `approx_count_distinct()` — HyperLogLog.
- ✅ `missing("k1", "k2", ...)` — returns missing-keys array.
- ✅ `get_path("a/b/c")` and `get_path("a.b.c")` — multi-segment paths.
- ✅ `dedent()` — common-prefix removal.
- ✅ `remove(pred)` — predicate evaluated.
- ✅ `enumerate()` — survives composition with `map` / `filter`.
- ✅ `pairwise()` — works on path sources.
- ✅ `.has(v)` returns boolean.
- ✅ `rec(fn)` fixpoint via deep structural equality.
- ✅ `update(path, fn)` and functional `.update({...})` — see [Path Mutation](../builtins/path-mutation.md#update).
- ✅ Filtered wildcard `[* if pred]`.
- ✅ Wildcard chain modify `$.xs[*].field.modify(@)`.
- ✅ Object literal as method receiver `{a: 1}.keys()` and `({a: 1}).keys()`.
- ✅ Regex escape: `"\d"` and `"\\d"` both parse as digit class.
- ✅ Path-call scalar unwrap: `$.s.upper()` → `"HELLO"` (was `["HELLO"]`). Scalar `OneToOne` builtins on path receivers dispatch directly via `apply_one`; opt out per-builtin with `BuiltinSpec::never_unwrap()`.
- ✅ `to_json` on array path: `$.users.to_json()` → single JSON document of the array (was per-element JSON strings).

Items below are still outstanding.

Organized into:

1. [Unsupported builtins](#1-unsupported-builtins) — return runtime error
2. [Broken builtins](#2-broken-builtins) — execute but wrong result
3. [Parser / grammar gaps](#3-parser--grammar-gaps) — syntax that doesn't parse
4. [Pipeline / runtime semantics](#4-pipeline--runtime-semantics) — wrong shape or scope
5. [Argument / receiver shape rules](#5-argument--receiver-shape-rules) — what each method actually accepts

---

## 1. Unsupported builtins

Return runtime errors. Spec exists in `defs.rs`; runtime hookup pending.

| Method | Error | Workaround |
|---|---|---|
| `zip_shape({a, b})` arg form | `"args must be 'name = expr' or bare identifier"` | No-arg `zip_shape()` works on uniform-key arrays |
| `group_shape(shape)` arg form | `"requires shape"` | No-arg `group_shape()` keys by sorted-key projection |
| `rec()` no-arg | `"Rec: builtin unsupported"` | `rec(fn)` 1-arg form is supported (see §2) |

### Fix-list (engine)

- [ ] Wire `ZipShape` shape-arg form (named `name = expr` mappings).
- [ ] Wire `GroupShape` shape-arg form (object shape or lambda projection).
- [ ] Implement `rec()` no-arg form (intended: walk-to-fixpoint default).

---

## 2. Broken builtins

Execute without erroring but produce wrong results.

| Method | Symptom | Workaround |
|---|---|---|
| `rec(fn, cond)` 2-arg | `"rec: exceeded 10000 iterations"` — conditional-bound form not implemented | Pass an idempotent `fn` so `rec(fn)` 1-arg detects fixpoint; or drive iteration from host |
| `rec(fn)` on non-idempotent | Iteration cap fires when `fn(x) != x` for some `x` | Make `fn` idempotent, or use `walk` / `walk_pre` for traversal-style transforms |

### Fix-list (engine)

- [ ] Implement `rec(fn, cond)` — iterate while `cond(@)` holds.
- [ ] Document or guard against runaway iteration when fixpoint never converges.

---

## 3. Parser / grammar gaps

Syntactic forms that look correct but parse-error.

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

### 3.3 Pattern match shorthand `{id, name}` not supported

```text
match obj with { {id, name} -> [id, name] }     # ✗ parse error
match obj with { {id: i, name: n} -> [i, n] }   # ✓
```

### 3.4 Rest pattern `..rest` not supported

```text
match obj with { {host, port, ..rest} -> rest }     # ✗ parse error
```

Bind explicitly + compute rest outside the match.

### 3.5 Comments

There are no comments inside a query. Strip client-side.

### 3.6 `[expr]` vs `{expr}`

Inline filter is `{predicate}`. `[expr]` is index/slice.

```text
$.xs{@.active}        # ✓ inline filter
$.xs[@.active]        # ✗ index expression
```

### Fix-list (parser)

- [ ] Optional: add `in` operator as sugar for `.includes(v)` for jq parity.
- [ ] Allow bare-path `.field` inside method args (sugar for `@.field`).
- [ ] Add object-pattern shorthand `{id, name}` (binds to identifiers of same name).
- [ ] Add rest pattern `{..rest}` and `[head, ...tail]` in lambda destructure.

---

## 4. Pipeline / runtime semantics

### 4.1 `.replace(needle, with)` is single-occurrence

```text
"hello hello".replace("hello", "hi")          # → "hi hello"  (only first)
"hello hello".replace_all("hello", "hi")      # → "hi hi"
```

### 4.2 `indent(n)` takes an integer count, not a prefix string

```text
"a\nb".indent(2)            # ✓ → "  a\n  b"
"a\nb".indent("  ")         # ✗ runtime error "expected number argument"
```

### 4.3 `from_json` needs a path or `let`-bound receiver

```text
"{\"a\":1}".from_json()             # ✗ parse error
$.s.from_json()                     # ✓
let s = "{\"a\":1}" in s.from_json() # ✓
```

### Fix-list (runtime)

- [ ] Either alias `replace = replace_all` or document the asymmetry prominently.
- [ ] Allow `indent` to accept a string prefix (for non-space indents) or rename to `indent_n`.
- [ ] Allow `from_json` on parenthesized string literal expressions.

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
$.xs.accumulate(0, (a, b) => a + b)
```

Array-pattern destructure of a single arg is supported:

```text
$.entries.map(([k, v]) => {k, v})    # ✓
```

---

## Versions

This page reflects v0.5.5 behavior empirically tested. As the engine
catches up, entries here drop.

**Open count:** 12 engine/parser fix-list items + 5 design points to
resolve.
