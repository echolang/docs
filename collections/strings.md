# Strings

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- `string` owns its bytes and is copy-on-write behind the scenes
- `string::view` is a window with no ownership, and converts implicitly from a `string`
- Building a string: `append`, `push_byte`, `concat`
- Reading: `size`, `byte_at`, `sub`, `index_of`, `contains`, `starts_with`, `ends_with`
- Bytes versus characters: `size()` and `char_count()` are different questions
- Comparison, and why `==` is a declared operator rather than syntax
- `c_str()` and crossing into C
- What is missing: formatting, interpolation, and a working `string?`
