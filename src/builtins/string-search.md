# String Search and Regex

## Predicates (return boolean)

| Method | Behavior |
|---|---|
| `is_blank` | True if empty or only whitespace |
| `is_numeric` | True if all chars are digits |
| `is_alpha` | True if all chars are letters |
| `is_ascii` | True if all bytes < 128 |
| `starts_with(prefix)` | Prefix check |
| `ends_with(suffix)` | Suffix check |

```jetro
QUERY:  "  ".is_blank()     OUT: true
QUERY:  "abc123".is_numeric()     OUT: false
QUERY:  "hello".starts_with("he")     OUT: true
```

## Position

| Method | Returns |
|---|---|
| `index_of(needle)` | First index of `needle`, or `-1` |
| `last_index_of(needle)` | Last index of `needle`, or `-1` |

```jetro
QUERY:  "hello world".index_of("o")     OUT: 4
QUERY:  "hello world".last_index_of("o")     OUT: 7
```

## Substring search

```jetro
"foo bar foo".matches("foo")    # 2 (count of literal occurrences)
"abc 12 cd 34".scan("\d+")     # ["12", "34"] (regex matches as strings)
```

## Regex match

| Method | Returns |
|---|---|
| `re_match(pattern)` | Boolean |
| `match_first(pattern)` | First match string, or null |
| `match_all(pattern)` | Array of all match strings |
| `captures(pattern)` | First match with groups: `[full, g1, g2, …]` |
| `captures_all(pattern)` | Array of `captures` results |

```jetro
QUERY:  "a1b2".re_match("\d")     OUT: true
QUERY:  "a1b2".match_first("\d+")     OUT: "1"
QUERY:  "a1b2".match_all("\d+")     OUT: ["1","2"]

QUERY:  "key=val".captures("(\\w+)=(\\w+)")
OUT:    ["key=val","key","val"]
```

The `~=` operator is sugar for `re_match` and returns the same boolean.

## Splitting

| Method | Behavior |
|---|---|
| `split(sep)` | Split on literal separator |
| `split_re(pattern)` | Split on regex |

```jetro
QUERY:  "a,b,c".split(",")     OUT: ["a","b","c"]
QUERY:  "a,,b".split_re(",+")     OUT: ["a","b"]
```

## Multi-needle membership

```jetro
"abc def".contains_any(["abc", "xyz"])    # true (matches first)
"abc def".contains_all(["abc", "def"])    # true (all match)
```

## Demand notes

Regex builtins are scalar. Lift across an array with `.map(...)`. The
underlying regex is compiled once per query and reused — no per-element
re-compilation cost.
