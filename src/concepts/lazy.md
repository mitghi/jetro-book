# Lazy Evaluation and Caches

Jetro is lazy in three places that matter to users.

## 1. Document parsing

`Jetro::from_bytes` does **not** fully parse the document up front when the
default `simd-json` feature is enabled. Instead it builds a *tape* — a flat
array of tokens — and lazily decodes parts as queries demand them.

What this means:

- Cold-start is ~4× faster than the legacy `serde_json::Value` path.
- A query that touches only `$.x.y` decodes the rest of the doc only when
  asked.
- Borrowed string slices (`Val::StrSlice`) avoid a copy when the value is
  read-only.

If you want eager full parsing (e.g. for `serde_json::Value` round-trips):

```rust
let doc: serde_json::Value = serde_json::from_slice(bytes)?;
let v = engine.collect_value(doc, "$.x")?;
```

## 2. Streaming pipelines

The pull-based pipeline backend processes one element at a time. A stage
doesn't run until its downstream consumer pulls. This is what enables
`.first()` and `.find()` to terminate early.

A consequence: side effects in lambdas are **not guaranteed to fire for every
element**. (Lambdas in jetro have no I/O, so this is mostly an academic
concern, but worth knowing if you write a custom builtin.)

## 3. Plan caches

Two caches matter:

### Plan cache (per `JetroEngine`)

When you call `engine.collect(&doc, query)` repeatedly with the same query,
the parsed AST → IR → bytecode pipeline is computed once and reused. Default
capacity: 256 entries, evicted wholesale when full.

For workloads with a small fixed set of queries and many documents, this is
a big speedup. For ad-hoc one-shot queries, it's a no-op.

### Path cache (per VM)

The bytecode VM caches resolved pointer paths per document. The cache key
hashes both *structure* and *primitive leaf values* bounded at depth 8 — two
documents with identical shape but different leaves produce different
hashes, so the cache stays correct across calls.

You don't manage this directly. It's amortised over many queries on the same
document.

## When laziness backfires

It rarely does, but two pitfalls:

**Forcing materialisation.** Methods like `.collect()`, `.sort()`,
`.unique()`, `.group_by()` are barriers — they materialise. Putting them
mid-chain when they aren't needed defeats laziness.

**Holding onto Vals.** A `Val` is `Arc`-wrapped, so cloning is O(1), but the
Arc keeps the underlying data alive. If you query a giant doc, hold onto a
small projection, and let the doc go, you may be surprised that the original
data is still resident — the projection's `Val::StrSlice`s borrow into the
tape.

Use `.to_json()` (or `serde_json::Value` round-trip) to disconnect a
projection from the source tape when you really need to release memory.

## Practical recipe

For long-lived servers:

```rust
// At startup
let engine = JetroEngine::default();

// Per request
let result = engine.collect_bytes(req_body, "$.users.filter(@.active).count()")?;
```

Plans get cached, parsing is lazy, the pipeline early-terminates. There's
typically nothing else to tune.
