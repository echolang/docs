# Nullability

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- A type is non-nullable until you write `?`
- What `T?` costs: free over an address, a flag plus the value otherwise
- `??` to supply a replacement
- `?->` to reach through, and why it cannot start a statement today
- `guard` to bind once and read plainly afterwards, and why the `else` arm has to leave
- Comparing against `null` directly, and `!` as a presence test
- `weak<T>`, and `strong()` to upgrade one
- Where a `null` may be written, and where the compiler has to be told the type
