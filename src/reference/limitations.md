# Known Limitations and Behavior Surprises (v0.5)

Empirically validated against jetro 0.5.5. This page is the canonical
fix-list — every entry is a known gap between intended and actual behavior.
Use it as a backlog: items here should drop as the runtime catches up.

## v0.5.5 — fixed in this release

The 14 audit-surfaced bugs were addressed plus three follow-up sweeps:

- ✅ `[*]` wildcard parses (mid-chain expands to `.map(@ + rest)`).
- ✅ `[a:b:c]` and `[::n]` (incl. `[::-1]` reverse) — Python-style step slicing.
- ✅ Lambda array-pattern destructure `([k, v]) => body` and rest form
  `([h, ...tail]) => body`.
- ✅ Object patterns in `match` accept reserved words as keys (`{kind: "click"}`).
- ✅ Object pattern shorthand `{id, name}` ≡ `{id: id, name: name}` in `match`.
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
- ✅ `rec(fn, cond)` — iterate while `cond(@)` holds, capped at 10 000 iters.
- ✅ `update(path, fn)` and functional `.update({...})` — see [Path Mutation](../builtins/path-mutation.md#update).
- ✅ Filtered wildcard `[* if pred]`.
- ✅ Wildcard chain modify `$.xs[*].field.modify(@)`.
- ✅ Object literal as method receiver `{a: 1}.keys()` and `({a: 1}).keys()`.
- ✅ Regex escape: `"\d"` and `"\\d"` both parse as digit class.
- ✅ Path-call scalar unwrap: `$.s.upper()` → `"HELLO"` (was `["HELLO"]`).
  Scalar `OneToOne` builtins on path receivers dispatch directly via
  `apply_one`; opt out per-builtin with `BuiltinSpec::never_unwrap()`.
- ✅ `to_json` on array path: `$.users.to_json()` → single JSON document
  (was per-element JSON strings).
- ✅ `zip_shape({a, b})` object-shape arg form.
- ✅ `group_shape(key)` 1-arg key projection (lambda or bare ident).
- ✅ `indent("> ")` accepts a string prefix in addition to integer count.
- ✅ Bare-path `.field` inside method args (`$.users.filter(.active)` ≡ `(@.active)`).
- ✅ Double-quoted string escape `"{\"a\":1}".from_json()` parses.

Items below are still outstanding.

Organized into:

1. [Open engine items](#1-open-engine-items)
2. [Design choices](#2-design-choices) — intentional, won't change

---

## 1. Open engine items

### 1.1 `rec()` no-arg

`rec` requires a step expression — there is no defined no-arg semantic.
The closest match is `walk(fn)` for traversal-style transforms or
`rec(fn)` for fixpoint iteration. May be retired or aliased to a default
walker in a later release.

### 1.2 `rec(fn)` runaway iteration cap

Calls to `rec(fn)` where `fn` is non-idempotent and never reaches a
deep-structural fixed point are bounded at 10 000 iterations and then
error. The new error message names the cap and recommends `rec(fn, cond)`
for explicit bounding. No guard short of analytic decidability prevents
the worst case; document the cap and surface it loudly.

---

## 2. Design choices

### 2.1 No `in` operator

`in` would be ambiguous with `let X = Y in Z` and `for x in xs`. Use the
postfix `has` operator or `.includes(v)` method:

```jetro
xs has "x"             # ✓ operator
xs.includes("x")       # ✓ method
"x" in xs              # ✗ parse error (intentional)
```

### 2.2 `replace` is single-occurrence

`.replace(needle, with)` replaces only the first match — JavaScript-style.
Use `.replace_all` for substitute-every behaviour:

```jetro
"hello hello".replace("hello", "hi")          # → "hi hello"
"hello hello".replace_all("hello", "hi")      # → "hi hi"
```

### 2.3 Comments

There are no comments inside a query. Strip client-side.

### 2.4 `[expr]` vs `{expr}`

Inline filter is `{predicate}`. `[expr]` is index/slice.

```jetro
$.xs{@.active}        # ✓ inline filter
$.xs[@.active]        # ✗ index expression
```

---

## 3. Argument / receiver shape rules

### 3.1 Methods accepting lambda forms

| Method | Working forms |
|---|---|
| `filter`, `find`, `find_all`, `find_first`, `find_one`, `find_index`, `indices_where`, `any`, `all`, `take_while`, `drop_while`, `remove` | `(@.x op v)`, `(.x op v)`, `(b => b.x op v)`, `(lambda b: ...)` |
| `map`, `flat_map`, `transform_keys`, `transform_values`, `filter_keys`, `filter_values` | Same |
| `sort`, `unique_by`, `group_by`, `count_by`, `index_by`, `max_by`, `min_by` | Same; `(b => b.x)` named lambda preferred for readability |

```jetro
$.books.sort(b => b.year)             # named lambda
$.books.sort(@.year)                  # @-form
$.books.sort(.year)                   # bare-path sugar (≡ @-form)
```

### 3.2 Methods that take bare identifiers (no `@`)

| Method | Form |
|---|---|
| `pick(field, alias: src, ...)` | Bare identifiers. **Not** `@.field`. |
| `omit(field, ...)` | Same |
| `rename({old: new, ...})` | Object map |
| `missing("k1", "k2", ...)` | String literals |

```jetro
$.user.pick(id, name)                 # ✓
$.user.pick(@.id, @.name)             # ✗ parse error
$.user.pick(uid: id)                  # ✓ alias
```

### 3.3 Multi-arg lambdas

Two-arg lambdas use parens:

```jetro
$.orders.equi_join($.customers, "cid", "id", (o, c) => {buyer: c.name})
$.xs.accumulate(0, (a, b) => a + b)
```

Single-arg array destructure (with optional rest) is supported:

```jetro
$.entries.map(([k, v]) => {k, v})         # ✓
$.rows.map(([h, ...tail]) => tail)        # ✓ rest binding
```

---

## Versions

This page reflects v0.5.5 behavior empirically tested. As the engine
catches up, entries here drop.

**Open count:** 2 engine items + 4 design choices documented.
