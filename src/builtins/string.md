# String Transforms

Scalar string operations. Lift with `.map` to apply to an array of strings.

## Case

| Method | What | Example |
|---|---|---|
| `upper` | ASCII uppercase | `"foo".upper()` → `"FOO"` |
| `lower` | ASCII lowercase | `"FOO".lower()` → `"foo"` |
| `capitalize` | First char upper, rest lower | `"foo bar".capitalize()` → `"Foo bar"` |
| `title_case` | Each word capitalised | `"foo bar".title_case()` → `"Foo Bar"` |
| `snake_case` | `lowerSnake_case` to `lower_snake_case` | `"FooBar".snake_case()` → `"foo_bar"` |
| `kebab_case` | Words joined with `-` | `"FooBar".kebab_case()` → `"foo-bar"` |
| `camel_case` | `fooBar` style | `"foo_bar".camel_case()` → `"fooBar"` |
| `pascal_case` | `FooBar` style | `"foo_bar".pascal_case()` → `"FooBar"` |
| `reverse_str` | Reverse char order | `"abc".reverse_str()` → `"cba"` |

## Trim

| Method | What |
|---|---|
| `trim` | Strip whitespace from both ends |
| `trim_left` | Strip leading whitespace |
| `trim_right` | Strip trailing whitespace |

```jetro
QUERY:  "  hi  ".trim()     OUT: "hi"
QUERY:  "  hi  ".trim_left()     OUT: "hi  "
```

## Padding and centering

| Method | Signature | Example |
|---|---|---|
| `pad_left(width, char?)` | Right-align by padding left | `"7".pad_left(3, "0")` → `"007"` |
| `pad_right(width, char?)` | Left-align by padding right | `"hi".pad_right(5)` → `"hi   "` |
| `center(width, char?)` | Center within width | `"hi".center(6)` → `"  hi  "` |

If `char` is omitted, space is used.

## Indent / dedent

`indent(n)` takes an **integer** (number of spaces); the prefix is fixed
spaces.

```jetro
QUERY:  "line1\nline2".indent(2)
OUT:    "  line1\n  line2"
```

`dedent()` strips the **first line's** leading whitespace from every
subsequent line that begins with the same prefix. It is **not** a
common-prefix dedent across all lines:

```jetro
QUERY:  "  a\n  b".dedent()
OUT:    "a\nb"
```

## Slice

```jetro
"hello world".slice(0, 5)      # "hello"
"hello world".slice(6)         # "world"
"hello".slice(-3)              # "llo"
```

`slice(start, end?)` mirrors Python; `end` is exclusive.

## Repeat

```jetro
"ab".repeat(3)        # "ababab"
```

## Replace

| Method | Behavior |
|---|---|
| `replace(needle, with)` | Replace **first** literal occurrence |
| `replace_all(needle, with)` | Replace **all** literal occurrences |
| `replace_re(pattern, with)` | Regex-aware single replacement |
| `replace_all_re(pattern, with)` | Regex-aware all replacements |

```jetro
QUERY:  "hello hello".replace("hello", "hi")
OUT:    ["hi hello"]

QUERY:  "hello hello".replace_all("hello", "hi")
OUT:    ["hi hi"]

QUERY:  "abc123def".replace_all_re("\d+", "#")
OUT:    "abc#def"
```

> **Regex escapes inside jetro string literals.** Use a **single** backslash:
> `"\d"`, `"\w+"`, `"\s"`. Jetro string literals don't eat backslashes
> separately; doubling (`"\\d"`) sends the regex engine the *literal*
> two-char sequence `\\d`, which is **not** the digit class and silently
> fails to match. This differs from host languages like Python or JavaScript
> where you must double-escape.

## Strip

```jetro
"prefix-foo".strip_prefix("prefix-")  # "foo"
"foo.txt".strip_suffix(".txt")        # "foo"
```

If the prefix/suffix isn't present, returns the input unchanged.

## Encoding

| Method | What |
|---|---|
| `to_base64` | Standard base64 encode |
| `from_base64` | Standard base64 decode |
| `url_encode` | Percent-encode |
| `url_decode` | Percent-decode |
| `html_escape` | `&` → `&amp;`, `<` → `&lt;`, etc. |
| `html_unescape` | Reverse of `html_escape` |

```jetro
QUERY:  "hello world".to_base64()     OUT: "aGVsbG8gd29ybGQ="
QUERY:  "a b".url_encode()     OUT: "a%20b"
QUERY:  "<b>".html_escape()     OUT: "&lt;b&gt;"
```

## Demand notes

All string transforms are `Identity` demand-wise: they don't change what the
upstream needs to produce.

## Practical examples

```jetro
# Normalise display names
$.users.map(u => u.name.trim().title_case().first())

# Build an URL-safe slug
"My Article Title".lower().replace_all(" ", "-")
# → "my-article-title"

# CamelCase to snake_case migration
"FooBarBaz".snake_case()                # → "foo_bar_baz"

# Truncate with ellipsis
$.posts.map(p => p.body.slice(0, 100) + "..." if p.body.len() > 100 else p.body)

# Parse a comma-separated tag list
$.tags_csv.split(",").map(@.trim())

# Encode for URL
$.query.url_encode()

# Encode binary as base64
$.bytes.to_base64()

# HTML-escape user input
$.comments.map(c => c.text.html_escape())

# Pad a numeric ID for fixed-width keys
($.id as string).pad_left(8, "0")
# → "00000042" for id=42

# Strip a known prefix
"https://example.com/path".strip_prefix("https://")
# → "example.com/path"

# Build a banner
"=".repeat(40)                          # → "========================================"

# Indent a nested message
$.message.indent(4)
```
