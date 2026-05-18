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

`Jetro` owns its per-document lazy state: raw bytes, tape/value caches, object
vector promotion cache, and an instance VM used for fallback execution. It is
cheap to construct for a document and can answer many queries over the same
bytes without reparsing.

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
| `eng.run_ndjson(...)` | Reader, query, writer | Row-local NDJSON execution |
| `eng.run_ndjson_file(...)` | File path, query, writer | File-backed NDJSON, including `$.rows()` stream mode |
| `eng.run_ndjson_source(...)` | Reader or file source | Dispatches reader/file behavior explicitly |

Returns `Result<serde_json::Value, JetroEngineError>` — a wider error type
that may also wrap JSON-parse errors.

### NDJSON options

NDJSON helpers accept `NdjsonOptions` variants for file and reader workloads:

| Option | Effect |
|---|---|
| `row_frame` | Plain JSON lines or delimited payloads such as `key|payload` |
| `null_output` | Skip or emit expression results that are JSON `null` |
| `parallelism` | Automatic or disabled partition execution for eligible file streams |
| `parallel_min_bytes` | Minimum file size before parallel partitions are considered |
| `max_line_len` | Per-line safety cap |
| `reverse_chunk_size` | Reverse file-reader chunk size |

Expression-level `$.rows()` switches NDJSON from row-local execution to a
whole-source stream plan. On files, `$.rows().reverse()` uses reverse file
traversal; reader-backed reverse streams return a clear unsupported-source
error.

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
jetro = { version = "0.5.11", default-features = false }
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
jetrocli -e '$.x.sum()' < input.json
jetrocli --ndjson -i events.ndjson -e '$.rows().take(10)'
```

The CLI is a thin wrapper around the Rust APIs, with `-e` selecting
non-interactive expression execution.

## Threading

- `Jetro` is intended as a document handle. Prefer one handle per document
  owner; use `JetroEngine` for shared multi-document workloads.
- `JetroEngine` is `Send + Sync` and intended for shared-engine workloads.
- The engine owns shared plan/VM caches so repeated queries over many
  documents avoid parse/lower/compile cost.

## Stability

- The query DSL is stable as of jetro 0.5.x.
- The Rust API surface (`Jetro`, `JetroEngine`, error types) is stable.
- `BuiltinMethod`, opcodes, IR types are **internal** and may change in any
  minor release.
- The `fuzz_internal` feature is explicitly unstable.
