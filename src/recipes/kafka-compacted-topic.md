# Kafka Compacted Topic Dumps

Kafka compacted topics keep the latest value for each key logically. A file
dump can still contain older values earlier in the file:

```text
user-a|{"id":"a","version":1,"name":"Ada"}
user-b|{"id":"b","version":1,"name":"Bob"}
user-a|{"id":"a","version":2,"name":"Ada Lovelace"}
user-c|null
```

Here `user-c|null` is a tombstone. With `jetrocli`, query only the JSON
payload after the separator and skip tombstones:

```bash
jetrocli --ndjson -i users.topic --payload-after '|' -e '$.id'
```

## Latest N Unique Keys

Scan from the tail, keep the first row seen for each logical id, then project
only the retained rows:

```bash
jetrocli --ndjson -i users.topic --payload-after '|' \
  -e '$.rows()
    .reverse()
    .distinct_by($.id)
    .take(100)
    .map({id: $.id, version: $.version, name: $.name})'
```

Why this works:

1. `$.rows()` switches from row-local mode to one stream over the file.
2. `reverse()` starts at the newest records.
3. `distinct_by($.id)` keeps the first row per key in that reverse order.
4. `take(100)` stops after 100 retained unique keys.
5. `map(...)` shapes only the rows that survived selection.

## Find One Recent Record

```bash
jetrocli --ndjson -i users.topic --payload-after '|' \
  -e '$.rows().reverse().find($.id == "user-42").first()'
```

This can stop as soon as the newest matching record is found.

## Keep Only Active Latest Records

Filter before de-duplication when the key should be unique among active rows:

```bash
jetrocli --ndjson -i users.topic --payload-after '|' \
  -e '$.rows()
    .reverse()
    .filter($.active)
    .distinct_by($.id)
    .take(500)
    .map({id: $.id, email: $.email})'
```

If tombstones carry important delete semantics for your workload, use
`--null-payload keep` and handle `null` explicitly. The default skip policy is
best when you only want live JSON payloads.
