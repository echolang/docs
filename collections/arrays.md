# Arrays

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- `array<T>` holds one type, contiguously, and grows
- Creating one: the constructor, an array literal, `arr::with_capacity`
- The two bracket forms: reading an element, and `$a[] = $v` to append
- The full surface: `count`, `capacity`, `push`, `pop`, `remove`, `swap_remove`, `at`, `get`, `clear`, `truncate`, `extend`
- Reserving, growth, and the pointers that growth invalidates
- `push_slot()` for appending without a copy
- Ownership: what an array does with an element that owns something
- Taking a `slice<T>` of one with `sub()`
- Iterating, mutably and read-only
- What it costs
