# Public API and Engine

The full public surface of the `jetro` crate is two types and a handful of
methods. Everything else is implementation detail.

## `Jetro` — single-document handle

For one document, possibly many queries:

```rust
use jetro::Jetro;

let bytes = br#"{"x":[1,2,3]}"#;
let j = Jetro::from_bytes(bytes)?;          // lazy parse via simd-json tape
let v: serde_json::Value = j.collect("$.x.sum()")?;
assert_eq!(v, serde_json::json!(6));
```

### Constructors

| Method | Input | Notes |
|---|---|---|
| `Jetro::from_bytes(&[u8])` | Raw JSON bytes | Lazy parse — fastest path |
| `Jetro::from_value(serde_json::Value)` | Parsed value | Skip simd-json |
| `Jetro::from_val(Val)` | Internal `Val` | Advanced — re-using engine state |

### Methods

| Method | Returns |
|---|---|
| `j.collect(query)` | `Result<serde_json::Value, EvalError>` |
| `j.collect_typed::<T>(query)` | `Result<T, EvalError>` (deserialize directly) |

`Jetro` uses a thread-local VM with a path cache. Cheap to construct;
prefer to drop it when you move to a new document so the cache key stays
valid.

## `JetroEngine` — long-lived multi-doc handle

For many documents and many queries with overlap, share the plan/VM caches:

```rust
use jetro::JetroEngine;

let eng = JetroEngine::default();

for doc_bytes in inputs {
    let v = eng.collect_bytes(doc_bytes, "$.users.filter(@.active).count()")?;
    println!("{}", v);
}
```

### Methods

| Method | Input | Notes |
|---|---|---|
| `eng.collect(&doc, q)` | `&Val` | Document already in `Val` form |
| `eng.collect_value(serde_value, q)` | `serde_json::Value` | Round-trips |
| `eng.collect_bytes(&[u8], q)` | Raw bytes | Lazy parse |

Returns `Result<serde_json::Value, JetroEngineError>` — a wider error type
that may also wrap JSON-parse errors.

### Configuration

| Option | Default | Effect |
|---|---|---|
| Plan-cache capacity | 256 | Wholesale-evicted when full |

The engine's plan cache amortises parse + lower + compile across calls. Hits
are O(hash); misses do full work.

## Errors

```rust
pub enum EvalError {
    /* … */
}

pub enum JetroEngineError {
    Json(serde_json::Error),
    Eval(EvalError),
}
```

Error messages include the query position when available.

## Feature flags

| Feature | Default | What it does |
|---|---|---|
| `simd-json` | on | Direct `bytes → Val` parse, skipping `serde_json::Value` |
| `fuzz_internal` | off | Re-exports parser + planner for fuzz harness — **not stable** |

To disable simd-json:

```toml
[dependencies]
jetro = { version = "0.5", default-features = false }
```

## Python binding

`jetro_py` exposes a `collect(doc, query)` function. Internals are identical
to the Rust crate.

```python
import jetro

result = jetro.collect({"x": [1,2,3]}, "$.x.sum()")
# result == 6
```

## CLI

```bash
jetrocli '$.x.sum()' < input.json
```

The CLI is a thin wrapper around `Jetro::from_bytes`.

## Threading

- `Jetro` is `Send + Sync` *for read-only queries* — multiple threads can
  share a `Jetro` and run different queries concurrently.
- `JetroEngine` is `Send + Sync` and intended for shared-engine workloads.
- The VM path-cache is thread-local; cross-thread access goes through
  separate caches.

## Stability

- The query DSL is stable as of jetro 0.5.x.
- The Rust API surface (`Jetro`, `JetroEngine`, error types) is stable.
- `BuiltinMethod`, opcodes, IR types are **internal** and may change in any
  minor release.
- The `fuzz_internal` feature is explicitly unstable.
