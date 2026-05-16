# NDJSON and Whole-Stream Queries

`jetrocli --ndjson` reads newline-delimited JSON from a file: one JSON
document per physical line, one compact JSON result per output line.

Use `-e` to run an expression directly and stay out of the interactive TUI:

```bash
jetrocli --ndjson -i events.ndjson -e '$.id'
jetrocli --ndjson -i events.ndjson -e '$.user.name.upper()'
jetrocli --ndjson -i events.ndjson -e '$.attributes.first().value'
```

This row-local mode evaluates the expression independently for each line. It
is the fastest path for projections, scalar transforms, small array
operations, and filters that do not need to coordinate across rows.

## Payload Framing

Many log and Kafka dump formats store metadata before the JSON payload:

```text
customer-42|{"id":42,"name":"Ada","active":true}
customer-17|null
```

Use `--payload-after` to query only the JSON payload after a one-byte
separator:

```bash
jetrocli --ndjson -i topic.ndjson --payload-after '|' -e '$.id'
```

Literal `null` payloads are tombstones in many Kafka compacted topics. They
are skipped by default:

```bash
jetrocli --ndjson -i topic.ndjson \
  --payload-after '|' \
  -e '$.name'
```

The null policy is configurable:

```bash
jetrocli --ndjson -i topic.ndjson \
  --payload-after '|' \
  --null-payload keep \
  -e '$'
```

## `$.rows()` Whole-Stream Mode

Use `$.rows()` when the expression should operate on the whole file as one
stream instead of running independently per line:

```bash
jetrocli --ndjson -i events.ndjson \
  -e '$.rows().filter($.active).take(10).map({id: $.id, name: $.name})'
```

The expression is now a stream program:

1. read rows from the NDJSON source
2. filter active rows
3. keep the first ten retained rows
4. project only those rows

No extra CLI flags are needed for filtering, limiting, mapping, or
de-duplication.

## Reverse Streams

For file inputs, `$.rows().reverse()` scans from the end of the file:

```bash
jetrocli --ndjson -i app.log \
  -e '$.rows().reverse().find($.level == "error").first()'
```

This is useful for append-only logs and Kafka compacted-topic dumps where the
newest record for a key is physically last.

## Latest Record Per Key

Kafka compacted topics keep the newest value for each key logically, but a
dump file can still contain older values earlier in the file. Scan backward
and keep the first row seen per key:

```bash
jetrocli --ndjson -i users.ndjson --payload-after '|' \
  -e '$.rows()
    .reverse()
    .distinct_by($.id)
    .take(100)
    .map({id: $.id, name: $.name, updated_at: $.updated_at})'
```

For rows:

```json
{"id":"a","version":1}
{"id":"b","version":1}
{"id":"a","version":2}
```

the reverse distinct stream sees `a@2` first, then `b@1`, and discards
`a@1`.

## Performance Expectations

On the 1 GB benchmark used by `jetrocli`, simple row-local projections are
usually tens of times faster than `jaq`; the best direct byte paths are near
100x faster. Whole-stream `$.rows()` queries keep the same mmap and direct
byte/tape foundation, but total time depends on how much of the file must be
inspected.

Fastest shapes:

```bash
jetrocli --ndjson -i big.ndjson -e '$.name'
jetrocli --ndjson -i big.ndjson -e '$.attributes.first().value'
jetrocli --ndjson -i big.ndjson \
  -e '$.rows().reverse().find($.name == "user_355617").first()'
```

Naturally heavier shapes:

```bash
jetrocli --ndjson -i big.ndjson \
  -e '$.rows().filter($.active).distinct_by($.id).map({id: $.id, name: $.name})'
```

Those must inspect many rows and maintain stream state. They should still
avoid unnecessary materialization, but they cannot be as cheap as a direct
single-field projection.

## Normal JSON Documents

`$.rows()` is not NDJSON-only. On a normal JSON array it streams the array
elements:

```jetro
DOC:    [{"id":1},{"id":2},{"id":1}]
QUERY:  $.rows().distinct_by($.id).map($.id)
OUT:    [1,2]
```

On an object or scalar document, `$.rows()` treats the document as one row.
