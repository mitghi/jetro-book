// Custom highlight.js language definition for jetro DSL.
// Loaded as `additional-js` after mdbook's bundled highlight.min.js,
// which exposes `hljs` as a global. Code blocks tagged ```jetro pick
// this grammar up automatically; ```text falls back to the built-in
// generic mode.
(function () {
    if (typeof hljs === "undefined") return;

    var BUILTINS = (
        "abs|accumulate|all|any|append|approx_count_distinct|avg|batch|" +
        "byte_len|bytes|camel_case|capitalize|captures|captures_all|ceil|" +
        "center|chars|chars_of|chunk|collect|compact|contains|contains_all|" +
        "contains_any|count|count_by|cummax|cummin|dedent|deep_find|" +
        "deep_like|deep_merge|deep_shape|defaults|del_path|del_paths|diff|" +
        "diff_window|distinct|drop|drop_while|dropwhile|ends_with|entries|" +
        "enumerate|equi_join|exists|explode|fanout|filter|filter_keys|" +
        "filter_values|find|find_all|find_first|find_index|find_one|first|" +
        "flat_map|flatten|flatten_keys|floor|from_json|from_pairs|get_path|" +
        "group_by|group_shape|has_key|has_path|html_escape|html_unescape|" +
        "implode|includes|indent|index_by|index_of|indices_of|indices_where|" +
        "intersect|invert|is_alpha|is_ascii|is_blank|is_numeric|join|" +
        "kebab_case|keys|lag|last|last_index_of|lead|len|lines|lower|lstrip|" +
        "map|match_all|match_first|matches|max|max_by|merge|min|min_by|" +
        "missing|modify|nth|omit|pad_left|pad_right|pairwise|parse_bool|" +
        "parse_float|parse_int|partition|pascal_case|pct_change|pick|pivot|" +
        "prepend|re_match|rec|remove|rename|repeat|repeat_str|replace|" +
        "replace_all|replace_all_re|replace_re|reverse|reverse_str|" +
        "rolling_avg|rolling_max|rolling_min|rolling_sum|round|rstrip|scan|" +
        "schema|set|set_path|skip|slice|snake_case|sort|sort_by|split|" +
        "split_re|starts_with|strip_prefix|strip_suffix|sum|take|take_while|" +
        "takewhile|title_case|to_bool|to_csv|to_json|to_number|to_pairs|" +
        "to_string|to_tsv|trace_path|transform_keys|transform_values|trim|" +
        "trim_left|trim_right|type|unflatten_keys|union|unique|unique_by|" +
        "unset|update|upper|url_decode|url_encode|values|walk|walk_pre|" +
        "window|words|zip|zip_longest|zip_shape|zscore"
    );

    hljs.registerLanguage("jetro", function (hljs) {
        var KEYWORDS = {
            keyword:
                "let in lambda match with when if else for and or not has is as " +
                "patch DELETE try catch",
            literal: "true false null",
            built_in:
                "deep_find deep_shape deep_like deep_merge walk walk_pre rec",
        };

        // String literal — supports backslash escapes inside double and
        // single quotes, plus the f-string template prefix.
        var STRING = {
            className: "string",
            variants: [
                { begin: 'f"', end: '"', contains: [hljs.BACKSLASH_ESCAPE] },
                { begin: '"', end: '"', contains: [hljs.BACKSLASH_ESCAPE] },
                { begin: "'", end: "'", contains: [hljs.BACKSLASH_ESCAPE] },
            ],
        };

        var NUMBER = {
            className: "number",
            begin: "-?\\b\\d+(?:\\.\\d+)?\\b",
            relevance: 0,
        };

        // Path roots `$` and `@` — display as accent variables.
        var ROOT = {
            className: "variable.constant",
            begin: /[\$@]/,
        };

        // Field access `.name` — picks up after `.` but before `(` so
        // method calls don't get mis-tagged. The negative lookahead
        // `(?!\\()` peels methods off; the next rule handles those.
        var FIELD = {
            className: "property",
            begin: /\.[A-Za-z_][A-Za-z0-9_]*(?!\s*\()/,
            relevance: 0,
        };

        // Builtin method call `.name(` — the trailing paren plus the
        // builtin allowlist anchors this to the runtime catalogue.
        var BUILTIN_CALL = {
            className: "built_in",
            begin: "\\.(?:" + BUILTINS + ")(?=\\s*\\()",
            relevance: 0,
        };

        // Generic method call (anything ending in `(` we did not match
        // as a builtin) — `.method(` falls back to title.function so
        // user-defined or unknown methods still get a distinct color.
        var METHOD_CALL = {
            className: "title.function",
            begin: /\.[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/,
            relevance: 0,
        };

        // Lambda parameter heads. Three forms covered:
        //   `name => …`            (single arrow)
        //   `(a, b) => …`          (multi-arrow)
        //   `lambda a, b: …`       (Python-style)
        //   `([a, b]) => …`        (array destructure)
        // Names inside the head are tagged `params`; the rest of the
        // body re-enters the language scope.
        var ARROW_PARAMS = {
            className: "params",
            variants: [
                { begin: /\(\s*[A-Za-z_][\w,\s\[\]\.]*\s*\)\s*=>/ },
                { begin: /[A-Za-z_]\w*\s*=>/ },
            ],
            relevance: 0,
        };

        var LAMBDA_KW = {
            className: "params",
            begin: /\blambda\s+[A-Za-z_][\w,\s\[\]\.]*\s*:/,
            relevance: 0,
        };

        // `name:` shorthand (used as an alias inside `pick(uid: id)` and
        // similar bare-ident-with-rename arg lists). Tag as parameter so
        // the renamed key visually differs from the source field on the
        // right-hand side.
        var NAMED_ARG = {
            className: "params",
            begin: /\b[A-Za-z_]\w*(?=\s*:)/,
            relevance: 0,
        };

        // Operators — keep distinct from punctuation.
        var OPERATOR = {
            className: "operator",
            begin: /==|!=|<=|>=|=>|->|\?\?|\?\||\|>|\.\.=|\.\.|[+\-*/%<>!=|]/,
            relevance: 0,
        };

        var COMMENT = hljs.COMMENT(/#/, /$/, { relevance: 0 });

        return {
            name: "Jetro",
            aliases: ["jet"],
            keywords: KEYWORDS,
            contains: [
                COMMENT,
                STRING,
                NUMBER,
                LAMBDA_KW,
                ARROW_PARAMS,
                BUILTIN_CALL,
                METHOD_CALL,
                FIELD,
                NAMED_ARG,
                ROOT,
                OPERATOR,
            ],
        };
    });

    // Re-highlight any blocks the original mdbook pass already touched
    // before our language was registered. `hljs.highlightAll()` is
    // idempotent: it skips already-highlighted blocks unless the
    // `data-highlighted` attr is cleared.
    document.querySelectorAll('pre code.language-jetro').forEach(function (el) {
        el.removeAttribute('data-highlighted');
        hljs.highlightElement(el);
    });
})();
