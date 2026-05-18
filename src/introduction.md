# Introduction

**Jetro** is a JSON processor which provides query, transform, and patching,
written in Rust. It parses a small dot-syntax DSL, plans the query through a
multi-tier optimizer,
and routes each subtree to whichever execution backend will run it fastest:
zero-copy borrowed views over a simd-json tape, a bitmap structural index, a
streaming pull pipeline, or the universal interpreted fallback.

Jetro's shape is deliberately different from a small `jq` clone. Method chains
compose with lambdas, pattern matching, f-strings, reducers, and document
updates inside one expression language. It also has distinctive features such
as demand propagation, more often associated with lazy languages such as
Haskell, so sinks like `first`, `last`, and `take(n)` can change how much
upstream work is performed. For mutation-heavy workflows,
`update` can batch compatible path rewrites into one document patch instead of
forcing callers to round-trip through host-language object editing.

```bash
jetrocli -e '$.services.filter(@.enabled).map({name: @.name, p95: @.latency_ms})' < services.json
```

```json
[
  {"name":"api","p95":42},
  {"name":"worker","p95":85}
]
```

If you have used `jq`, Jetro will feel familiar but takes a different shape: it
is method-chain oriented, closer to the collection APIs most application
developers already use.

```jetro
$.services
  .filter(@.enabled)
  .sort_by(-latency_ms)
  .take(1)
  .map({service: name, alert: errors > 5})
```

That query reads like the code you would otherwise write by hand: keep enabled
services, sort by latency, keep the slowest one, return only the fields the next
system needs.

## Why Developers Reach For Jetro

Use Jetro when the shape of the data matters more than the ceremony around it:

- **Inspect production JSON without writing a script.** Pull out the one field,
  row, group, or summary you need from a real payload.
- **Embed dynamic transformations.** Let users, pipelines, or config files
  define data-shaping rules without recompiling your service.
- **Normalize API and event payloads.** Filter, project, rename, aggregate, and
  label JSON before it crosses a boundary.
- **Patch documents deliberately.** Use update expressions for migrations,
  fixture generation, and config rewrites.
- **Process NDJSON files from the terminal.** Run row-local expressions over
  logs and event streams with `jetrocli --ndjson`.

## What Makes Jetro Different

Jetro is small at the surface, but it is not a toy interpreter.

- **The syntax is expression-first.** Objects, arrays, lambdas, filters,
  reducers, string formatting, pattern matching, and updates compose inside one
  expression language.
- **The planner tries to do less work.** Queries like `first`, `take`, and
  bounded projections can tell earlier stages how much data is actually needed.
- **Writes are part of the language.** Updating JSON is not bolted on as a
  separate API; document rewrites are planned alongside reads.
- **There is a real Rust API.** `Jetro` is the byte-oriented document handle.
  `JetroEngine` is the long-lived engine for reusable plans, VM state, and
  streaming workflows.

## A Small Taste

Here is a document shaped like the kind of service inventory developers often
meet in scripts, dashboards, and deploy tooling:

```json
{
  "services": [
    {"name":"api","lang":"rust","latency_ms":42,"owner":"platform","enabled":true,"errors":2},
    {"name":"worker","lang":"go","latency_ms":85,"owner":"data","enabled":true,"errors":9},
    {"name":"admin","lang":"ts","latency_ms":130,"owner":"platform","enabled":false,"errors":0}
  ],
  "deploys": [
    {"service":"api","sha":"a1","status":"ok"},
    {"service":"worker","sha":"b2","status":"fail"}
  ],
  "meta": {"env":"prod","version":7}
}
```

Project the active services:

```jetro
$.services.filter(@.enabled).map({name: @.name, p95: @.latency_ms, owner: @.owner})
```

Count ownership:

```jetro
$.services.count_by(@.owner)
```

Turn deploy states into operator messages:

```jetro
$.deploys.map(d => match d with {
  {status:"fail",service:s} -> f"rollback {s}",
  {status:"ok",service:s} -> f"ship {s}",
  _ -> "inspect"
})
```

Patch the document:

```jetro
$.update({"meta.version": @ + 1, "services[*].checked": true})
```

The rest of this book teaches the language from that practical angle: how to
read JSON, reshape it, aggregate it, update it, and embed the same behavior in
Rust.

## Example Conventions

Examples use this layout:

```jetro
DOC:    {"services": [{"name": "api", "enabled": true}, {"name": "admin", "enabled": false}]}
QUERY:  $.services.filter(@.enabled).map(@.name)
OUT:    ["api"]
```

Where the input document matters, examples include `DOC:`. Where the source is
already clear from the section, examples usually show only `QUERY:` and `OUT:`.
Method aliases are listed inline, for example `unique` *(alias `distinct`)*.

Start with the [Quick Tour](./quick-tour.md), then use the
[Builtin Reference](./builtins/overview.md) when you need exact method behavior.
