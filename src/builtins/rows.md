# Row Stream Source

`rows()` is a source builtin. It changes what the receiver means: instead of
querying one document value, it exposes a stream of rows.

## `rows()`

- **Signature:** `Source -> Stream<Row>`
- **Arity:** zero
- **Demand behavior:** forwards retained-row demand to the source
- **Supported stream stages:** `reverse`, `filter`, `find`, `distinct_by`,
  `take`, `first`, `map`

## Normal JSON

On a normal JSON document, `$.rows()` streams the top-level value:

```jetro
DOC:    [{"id":1,"name":"Ada"},{"id":2,"name":"Bob"},{"id":1,"name":"Ada v2"}]
QUERY:  $.rows().distinct_by($.id).map({id: $.id, name: $.name})
OUT:    [{"id":1,"name":"Ada"},{"id":2,"name":"Bob"}]
```

Top-level objects and scalars are treated as a single row.

## NDJSON

In NDJSON mode, root `$.rows()` means all rows in the file or reader:

```bash
jetrocli --ndjson -i events.ndjson \
  -e '$.rows().filter($.active).take(10).map({id: $.id, name: $.name})'
```

Without `$.rows()`, the same CLI mode is row-local:

```bash
jetrocli --ndjson -i events.ndjson -e '$.id'
```

## Reverse

For file-backed NDJSON, `reverse()` scans from the end:

```bash
jetrocli --ndjson -i app.log \
  -e '$.rows().reverse().find($.level == "error").first()'
```

Reader-backed reverse streams are unsupported because readers cannot seek.

## Latest Per Key

For Kafka compacted-topic dumps, scan newest-to-oldest and keep the first row
seen for each key:

```bash
jetrocli --ndjson -i users.ndjson --payload-after '|' \
  -e '$.rows().reverse().distinct_by($.id).take(100).map({id: $.id, name: $.name})'
```

`distinct_by` in this stream order keeps the newest row for each key and drops
older duplicates immediately.

## Notes

- `rows()` is currently root-level: use `$.rows()`, not `$.books.rows()`.
- `map` is delayed or direct-written only when it is semantically safe.
- Unsupported stream methods fail before scanning input.
- For more examples, see [NDJSON and Whole-Stream Queries](../guides/ndjson.md).
