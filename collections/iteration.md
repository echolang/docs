# Iteration

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- `foreach ($items as $item)` and `foreach ($items as $key => $item)`
- The copy you do not pay for
- Binding by value, by borrow, and by const borrow, plus the current hole in method calls on a borrow
- Iterating a `const` collection, and the second contract that makes it work
- Why you may not mutate a collection while iterating it
- Writing your own iterable: the cursor protocol, `advance()` and `current()`
- Adding keys with `contract::keyed<K>`
- Looping over a cursor directly, and over a type-erased iterator
- What iteration costs, and what it lowers to
