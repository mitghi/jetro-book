# Tabular Output

## Fixture

Examples below run against:

```jetro
DOC:    {"users": [{"id": 1, "name": "Ada", "email": "ada@x.com", "active": true, "age": 30, "role": "admin", "secret": "a", "is_admin": true, "profile": {"name": "Ada", "email": "ada@x.com"}, "score": 85, "first_name": "Ada", "last_name": "Lovelace", "tags": ["math", "code"]}, {"id": 2, "name": "Bob", "email": "bob@y.org", "active": false, "age": 24, "role": "user", "secret": "b", "is_admin": false, "profile": {"name": "Bob", "email": "bob@y.org"}, "score": 40, "first_name": "Bob", "last_name": "Smith"}, {"id": 3, "name": "Cy", "email": "cy@x.com", "active": true, "age": 42, "role": "user", "secret": "c", "is_admin": false, "score": 90, "first_name": "Cy", "last_name": "Young"}], "logs": [{"ts": "10:00", "sev": 1, "msg": "start"}, {"ts": "10:05", "sev": 3, "msg": "fail"}, {"ts": "10:10", "sev": 2, "msg": "warn"}], "tweets": [{"id": 1, "text": "#foo", "entities": {"hashtags": [{"text": "foo"}]}}, {"id": 2, "text": "#bar #foo", "entities": {"hashtags": [{"text": "bar"}, {"text": "foo"}]}}], "records": [{"id": 1, "name": "a", "email": "x@y.com"}, {"id": 2, "name": "b", "email": "u@v.com"}]}
```

Serialise sequences of objects to row-oriented text formats.

## `to_csv(headers?)`

- **Signature:** `Array<Object> -> String`
- **Behavior:** RFC-4180-ish CSV. Without arguments, the union of object keys
  is the header set, sorted by first-appearance.

```jetro
DOC:    [{"name":"Ada","age":36},{"name":"Bob","age":42}]
QUERY:  $.to_csv()
OUT:
"name,age
Ada,36
Bob,42"
```

With explicit headers:

```jetro
QUERY:  $.to_csv(["age","name"])
OUT:
"age,name
36,Ada
42,Bob"
```

Strings containing commas, quotes, or newlines are quoted and escaped per
RFC 4180.

## `to_tsv(headers?)`

- **Signature:** `Array<Object> -> String`
- **Behavior:** Same as `to_csv` but tab-separated. No quoting (tab-in-value
  is replaced with a space).

```jetro
QUERY:  $.users.to_tsv(["id","email"])
```

## Composing with the rest of the pipeline

Build a report:

```jetro
$.users
  .filter(@.active)
  .map(u => u.pick(id, name, email))
  .sort(@.id)
  .to_csv()
```

Pipe to a file from the CLI:

```bash
jetrocli '$.users.filter(@.active).pick(id,name).to_csv()' < users.json > out.csv
```

## Limitations

- Nested values are JSON-encoded into the cell. For deeply-nested structures,
  flatten first with `flatten_keys`:
  ```text
  $.records.map(r => r.flatten_keys()).to_csv()
  ```
- The format is row-major. For wide-narrow long-format reshape, use `pivot`
  / `zip_shape` first.
- For Excel-flavored CSV (BOM, CRLF), post-process the result.

## Practical examples

```jetro
# Active-user export
$.users.filter(@.active).map(u => u.pick(id, name, email)).sort(u => u.id).to_csv()

# Daily sales report (use e[0]/e[1] indexing — array-pattern destructure
# inside a lambda doesn't parse in v0.5)
$.sales.group_by(s => s.day).entries().map(e => {
  day:   e[0],
  total: e[1].map(@.amount).sum(),
  count: e[1].count()
}).to_csv()

# Hashtag frequency CSV
$.tweets.flat_map(t => t.entities.hashtags.map(@.text))
  .count_by(@)
  .entries()
  .map(e => {tag: e[0], count: e[1]})
  .to_csv()

# TSV for log shipping
$.logs.map(l => l.pick(ts, level, message)).to_tsv()
```
