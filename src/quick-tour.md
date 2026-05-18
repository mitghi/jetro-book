# A Practical Tour

This tour teaches Jetro the way you will probably use it: grab a real JSON
payload, ask a precise question, reshape the answer, and move on. Every query in
this chapter was checked with the release build of `jetrocli 0.2.9`.

Run a query against a JSON file:

```bash
jetrocli -e '$.services.filter(@.enabled).count()' < services.json
```

Run a row-local query against NDJSON:

```bash
jetrocli --ndjson -i events.ndjson -e '$.service + ":" + $.level'
```

## The Working Document

Save this as `services.json`:

```json
{
  "services": [
    {"name":"api","lang":"rust","latency_ms":42,"owner":"platform","enabled":true,"errors":2,"tags":["edge","json"]},
    {"name":"worker","lang":"go","latency_ms":85,"owner":"data","enabled":true,"errors":9,"tags":["queue"]},
    {"name":"admin","lang":"ts","latency_ms":130,"owner":"platform","enabled":false,"errors":0,"tags":["internal"]}
  ],
  "deploys": [
    {"service":"api","sha":"a1","status":"ok"},
    {"service":"worker","sha":"b2","status":"fail"}
  ],
  "meta": {"env":"prod","version":7}
}
```

## 1. Start With Paths

Use `$` for the root document, then walk fields and indexes.

```jetro
QUERY:  $.services[0].name
OUT:    "api"
```

Wildcards collect the same field from many array items:

```jetro
QUERY:  $.services[*].name
OUT:    ["api","worker","admin"]
```

## 2. Filter Like You Would In Code

Inside `filter`, `map`, and similar methods, `@` is the current item.

```jetro
QUERY:  $.services.filter(@.enabled).count()
OUT:    2
```

That is the basic Jetro shape: start from a path, chain operations, return the
value you actually need.

## 3. Return A Useful Shape

Projection objects let you rename fields, drop noise, and compute small derived
values in one pass.

```jetro
QUERY:
  $.services
    .filter(@.enabled)
    .map({name: @.name, p95: @.latency_ms, owner: @.owner})
OUT:
  [
    {"name":"api","owner":"platform","p95":42},
    {"name":"worker","owner":"data","p95":85}
  ]
```

This is where Jetro starts paying rent in developer workflows: the output is
already shaped for the next command, dashboard, test assertion, or API boundary.

## 4. Sort, Bound, Then Project

Use `sort_by`, `take`, and `map` for top-N questions.

```jetro
QUERY:
  $.services
    .filter(@.enabled)
    .sort_by(-latency_ms)
    .take(1)
    .map({service: name, alert: errors > 5})
OUT:
  [
    {"alert":true,"service":"worker"}
  ]
```

The minus sign sorts descending by latency. `take(1)` makes the intended demand
explicit: you only want the worst enabled service.

## 5. Aggregate When A List Is Too Much

Reducers consume a sequence and return a single value.

```jetro
QUERY:  $.services.map(@.latency_ms).avg()
OUT:    85.66666666666667
```

Group-style reducers return summaries that are easy to scan:

```jetro
QUERY:  $.services.count_by(@.owner)
OUT:    {"data":1,"platform":2}
```

## 6. Build Operator-Friendly Strings

F-strings are useful for logs, labels, report fields, and shell output.

```jetro
QUERY:
  $.services
    .filter(@.errors > 0)
    .map(f"{@.name}: {@.errors} errors")
OUT:
  ["api: 2 errors","worker: 9 errors"]
```

## 7. Classify Data With Pattern Matching

Pattern matching is a good fit for status payloads, event kinds, and tagged
objects.

```jetro
QUERY:
  $.deploys.map(d => match d with {
    {status:"fail",service:s} -> f"rollback {s}",
    {status:"ok",service:s} -> f"ship {s}",
    _ -> "inspect"
  })
OUT:
  ["ship api","rollback worker"]
```

Arms are checked top-down. Put specific cases before the fallback arm.

## 8. Search Deeply When The Path Is Not Stable

When you know the condition but not the exact location, use recursive descent.

```jetro
QUERY:  $..find(@.status == "fail")
OUT:
  [
    {"service":"worker","sha":"b2","status":"fail"}
  ]
```

For known schemas, prefer direct paths. For exploratory work over unfamiliar
payloads, deep search is often the fastest way to ask the first question.

## 9. Patch Documents

`update` returns the full document with the selected changes applied.

```jetro
QUERY:  $.update({"meta.version": @ + 1, "services[*].checked": true})
OUT:
  {
    "deploys":[
      {"service":"api","sha":"a1","status":"ok"},
      {"service":"worker","sha":"b2","status":"fail"}
    ],
    "meta":{"env":"prod","version":8},
    "services":[
      {"checked":true,"enabled":true,"errors":2,"lang":"rust","latency_ms":42,"name":"api","owner":"platform","tags":["edge","json"]},
      {"checked":true,"enabled":true,"errors":9,"lang":"go","latency_ms":85,"name":"worker","owner":"data","tags":["queue"]},
      {"checked":true,"enabled":false,"errors":0,"lang":"ts","latency_ms":130,"name":"admin","owner":"platform","tags":["internal"]}
    ]
  }
```

The object keys are paths to update. The expression on the right is evaluated
against the value at that path, so `"meta.version": @ + 1` increments the
current version.

## 10. Row-Local NDJSON

Save this as `events.ndjson`:

```ndjson
{"ts":"10:00","service":"api","level":"info","ms":38}
{"ts":"10:01","service":"worker","level":"error","ms":220}
{"ts":"10:02","service":"api","level":"error","ms":91}
```

Run:

```bash
jetrocli --ndjson -i events.ndjson -e '$.service + ":" + $.level'
```

Output:

```ndjson
"api:info"
"worker:error"
"api:error"
```

Without `$.rows()`, NDJSON mode evaluates the expression once per line.

## 11. Whole-Stream NDJSON

Use `$.rows()` when the expression should see the NDJSON file as one stream.

```bash
jetrocli --ndjson -i events.ndjson \
  -e '$.rows().filter($.level == "error").map({service: $.service, ms: $.ms})'
```

Output:

```ndjson
{"service":"worker","ms":220}
{"service":"api","ms":91}
```

This is the mode for file-level filtering, slicing, grouping, latest-record
queries, and compacted-topic inspection.

## 12. Latest Record Per Key

For Kafka-style records where the payload starts after `|`:

```text
1|{"id":1,"name":"api old","active":false}
2|{"id":2,"name":"worker","active":true}
1|{"id":1,"name":"api","active":true}
```

Run:

```bash
jetrocli --ndjson -i topic.ndjson --payload-after '|' \
  -e '$.rows().reverse().distinct_by($.id).filter($.active).map({id: $.id, name: $.name})'
```

Output:

```ndjson
{"id":1,"name":"api"}
{"id":2,"name":"worker"}
```

Read from the end, keep the first row for each id, then filter and project.
That is a compacted-topic audit query in one expression.

## A Few Power Moves

The tour above keeps to the common path. These examples are worth knowing once
you start writing longer queries.

### Lambda Forms

The shorthand `@` form is usually enough, but named lambdas are useful when an
expression gets dense:

```jetro
QUERY:  $.services.filter(s => s.latency_ms > 80).map(s => s.name)
OUT:    ["worker","admin"]
```

These forms are equivalent where a single current item is in scope:

```jetro
$.services.filter(@.enabled)
$.services.filter(.enabled)
$.services.filter(lambda s: s.enabled)
```

### Schema Checks

Use `has_key` for object-key existence, `includes` for value membership, and
`missing` for compact schema checks:

```jetro
QUERY:
  $.services.map(s => {
    name: s.name,
    has_json_tag: s.tags.includes("json"),
    missing: s.missing("owner", "tags", "runtime")
  })
OUT:
  [
    {"has_json_tag":true,"missing":["runtime"],"name":"api"},
    {"has_json_tag":false,"missing":["runtime"],"name":"worker"},
    {"has_json_tag":false,"missing":["runtime"],"name":"admin"}
  ]
```

### Guards In Pattern Matching

Patterns can bind fields, and guards can refine the match:

```jetro
QUERY:
  $.services.map(s => match s with {
    {enabled:false,name:n} -> f"disabled {n}",
    {latency_ms:ms,name:n} when ms > 100 -> f"slow {n}",
    {name:n} -> f"ok {n}"
  })
OUT:
  ["ok api","ok worker","disabled admin"]
```

### Pipe Value Flow

`|` passes the value on the left into the right expression as `@`. It is value
flow, not method dispatch:

```jetro
QUERY:  $.services.count() | "found " + (@ as string) + " services"
OUT:    "found 3 services"
```

### Conditional Updates

Filtered wildcards let updates target many items without writing a host loop:

```jetro
QUERY:
  $.services[* if errors > 5].update({
    tags: tags.append("hot"),
    checked: true
  })
```

The result is still the full document with untouched subtrees preserved.

### Demand-Aware Queries

These are ordinary queries:

```jetro
$.services.map(@.name).last()
$.services.filter(@.enabled).first()
$.services.sort_by(-latency_ms).take(2)
```

Jetro plans from the demanded result backward. Pure one-to-one maps can be
delayed, `first` and `take` can bound input, and tape-backed sources can avoid
materializing values until a stage actually needs them.

### Rust Embedding

Use the small facade for one document:

```rust
let j = jetro::Jetro::from_bytes(bytes)?;
let out = j.collect("$.services.filter(@.enabled).map(@.name)")?;
```

Use `JetroEngine` when you want a long-lived engine with plan and VM reuse:

```rust
use jetro::JetroEngine;
use serde_json::json;

let eng = JetroEngine::default();
let doc = json!({"services":[{"latency_ms":42},{"latency_ms":85}]});
let v = eng.collect_value(doc, "$.services.map(@.latency_ms).sum()")?;
assert_eq!(v, json!(127));
```

## What To Read Next

You now have the core mental model: path, chain, project, reduce, patch, and
stream.

- [Grammar Overview](./grammar/overview.md)
- [Builtin Reference](./builtins/overview.md)
- [NDJSON and Whole-Stream Queries](./guides/ndjson.md)
- [Demand Propagation](./concepts/demand.md)
