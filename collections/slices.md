# Slices

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- A `slice<T>` is a pointer and a length: a window onto somebody else's storage
- Taking one from an array with `sub()`, whole or partial
- `slice<const T>` versus `slice<T>`, and why the `const` sits inside the angle brackets
- Indexing, `count`, `at`, `get`
- Iterating a slice
- The lifetime rule: a slice does not keep its storage alive
- Passing a slice instead of a `const array<T>&`, and when that is the better signature
