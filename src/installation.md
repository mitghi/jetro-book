# Installation

Jetro ships as three artifacts:

| Artifact | What it is | Audience |
|---|---|---|
| `jetro` (crate) | Rust library — query/transform JSON in-process | Rust developers |
| `jetro-py` | Python bindings (PyPI) | Python users |
| `jetrocli` | Standalone CLI `jetrocli` for shell use | Anyone with JSON in a terminal |

## Rust library

Add to `Cargo.toml`:

```toml
[dependencies]
jetro = "0.5.10"
```

The `simd-json` feature is on by default and gives a ~4× cold-start win by
parsing bytes directly into `Val` (no `serde_json::Value` intermediate). To
fall back to the legacy serde-only path:

```toml
[dependencies]
jetro = { version = "0.5.10", default-features = false }
```

Quick sanity check:

```rust
use jetro::Jetro;

fn main() -> anyhow::Result<()> {
    let bytes = br#"{"books":[{"title":"Dune","year":1965}]}"#;
    let j = Jetro::from_bytes(bytes)?;
    let titles: serde_json::Value = j.collect("$.books.map(@.title)")?;
    println!("{}", titles);  // ["Dune"]
    Ok(())
}
```

## Long-lived engine

If you process many documents with overlapping queries, keep a `JetroEngine`
around. It holds shared plan and VM caches:

```rust
use jetro::JetroEngine;

let eng = JetroEngine::default();
for doc in docs {
    let v = eng.collect(&doc, "$.users.filter(active).count()")?;
    println!("{}", v);
}
```

Plan-cache default capacity is 256 entries; it evicts wholesale when full.

## Python bindings

```bash
pip install jetro-py
```

```python
import jetro

doc = {"books": [{"title": "Dune", "year": 1965}]}
print(jetro.collect(doc, "$.books.map(@.title)"))   # ['Dune']
```

The Python wheel embeds the same Rust core, so query syntax is identical.

## CLI (jetrocli)

Install via Homebrew:

```bash
brew install mitghi/jetrocli/jetrocli
```

Or build from source:

```bash
git clone https://github.com/mitghi/jetrocli
cd jetrocli && cargo install --path .
```

Use it like `jq`:

```bash
echo '{"x":[1,2,3]}' | jetrocli -e '$.x.sum()'
# 6

cat data.json | jetrocli -e '$.users.filter(@.active).map(@.email)'
```

For file-backed NDJSON, add `--ndjson`, `-i`, and `-e`:

```bash
jetrocli --ndjson -i events.ndjson -e '$.id'
jetrocli --ndjson -i events.ndjson \
  -e '$.rows().reverse().distinct_by($.id).take(100)'
```

## Building from source

```bash
git clone https://github.com/mitghi/jetro
cd jetro
cargo build --release         # build everything
cargo test                    # full suite
cargo bench -p jetro-core     # micro-benchmarks
```

Workspace layout:

```
jetro/             facade crate (re-exports + public API)
jetro-core/        engine: parser, planner, executor, builtins, runtime
jetro-core/fuzz/   cargo-fuzz harness (feature-gated)
```

## Verifying your install

Run the tour from the next chapter against your install. If every query
produces the printed output, you're ready.
