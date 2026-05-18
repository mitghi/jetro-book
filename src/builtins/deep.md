# Deep Traversal and Recursion

Walk every descendant value in DFS pre-order. The deep methods are also
available as `..method(...)` syntax sugar in path position.

## `deep_find(pred)` *(or `..find(pred)`)*

- **Signature:** `Any -> Array<Any>`
- **Behavior:** Every descendant satisfying `pred`. Order: DFS pre-order.

```jetro
DOC:    {"a": {"x": 1}, "b": [{"x": 2}, {"y": 3}]}
QUERY:  $..find(@.x?)
OUT:    [{"x":1},{"x":2}]

QUERY:  $.deep_find(@ is number)
OUT:    [1,2,3]
```

When the structural index is available, `deep_find` runs over a bitmap
representation in `jetro-experimental` rather than walking `Val` nodes —
significantly faster for shallow predicates.

## `deep_shape({k1, k2, ...})` *(or `..shape({...})`)*

- **Signature:** `Any -> Array<Object>`
- **Behavior:** Every object that has *all* listed keys (regardless of
  value).

```jetro
DOC:    [{"id":1,"name":"a"},{"id":2},{"name":"c","id":3}]
QUERY:  $..shape({id, name})
OUT:    [{"id":1,"name":"a"},{"id":3,"name":"c"}]
```

## `deep_like({k1: v1, ...})` *(or `..like({...})`)*

- **Signature:** `Any -> Array<Object>`
- **Behavior:** Every object whose listed keys equal the listed literal
  values.

```jetro
DOC:    [{"author":"Asimov","year":1951},{"author":"Asimov","year":1942},{"author":"Herbert","year":1965}]
QUERY:  $..like({author: "Asimov"})
OUT:    [{"author":"Asimov","year":1951},{"author":"Asimov","year":1942}]
```

## `walk(fn)`

- **Signature:** `Any, (Any -> Any) -> Any`
- **Behavior:** Apply `fn` to every node bottom-up; rebuild the tree.

```jetro
QUERY:  $.walk(node => node.upper() if node is string else node)
# Returns the document with every string node uppercased.
```

## `walk_pre(fn)`

- **Signature:** `Any, (Any -> Any) -> Any`
- **Behavior:** Like `walk`, but pre-order — `fn` sees parent before
  children.

Use `walk_pre` when the transform decides whether to recurse based on the
node's identity (e.g. "stop at leaves of kind X").

## `rec(pattern, fn)`

> ⚠ **Limited in 0.5.11** — recursive rewrites are guarded with a 10 000
> iteration cap. Prefer `walk` or `walk_pre` for one-pass document traversal,
> and keep `rec` for bounded fixpoint-style rewrites.

- **Signature (planned):** `Any, Pattern, (Any -> Any) -> Any`
- **Behavior (planned):** Match-and-rewrite. Recursively walks; replaces
  every match with `fn(match)`.

This is the recursive sibling of [Pattern Match](../recipes/pattern-match.md);
useful for AST rewrites and document migrations.

## `trace_path(pred)`

- **Signature:** `Any, (Any -> Bool) -> Array<Array<Step>>`
- **Behavior:** For every node matching `pred`, return the path from root to
  the node as an array of steps.

```jetro
DOC:    {"a": {"x": 1}, "b": [{"x": 2}]}
QUERY:  $.trace_path(@.x?)
OUT:    [{"path":"$.a","value":{"x":1}},{"path":"$.b[0]","value":{"x":2}}]
```

The steps are the keys/indices to walk to reach the match. Pair with
`set_path` for find-and-replace operations.

## Deep `match`

The pattern-match construct has deep variants `..match` and `..match!` —
see [Control Flow](../grammar/control-flow.md) and the [pattern-match
cookbook](../recipes/pattern-match.md).

## When the bitmap kicks in

Deep search uses the structural index when:

- The query is rooted at `$..` or `.deep_*`
- The predicate is a shape/key check (not a complex lambda)
- The document was loaded with the simd-json tape (default)

You don't enable this — it's selected by the planner.

## Demand notes

Deep traversals declare `All` upstream by nature. The optimisation surface
is the *predicate*: shape and like checks bypass the per-node lambda
evaluation entirely.

## Practical examples

```jetro
# Find every node with an "id" key (anywhere in the tree)
$..find(@.id?)

# Find all numbers
$..find(@ is number)

# Every object that has both id + name keys
$..shape({id, name})

# Every object where a field equals a specific value
$..like({status: "error"})

# Locate an event by ID inside a deeply nested tree
$..match! { {id: 42} -> @, _ -> null }

# Walk every node, transforming strings to upper
$.walk(node => node.upper() if node is string else node)

# Trace paths from root to nodes matching a predicate
$.trace_path(@.is_admin?)
# → [["users",0],["users",2]]

# Bulk audit: find every "secret"-named field
$..find(@.secret?)
```
