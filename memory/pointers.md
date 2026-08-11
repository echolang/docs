# Pointers and references

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- `ptr<T>` and the borrow `T&`, and the single difference between them
- `&$x` takes an address, and the whitespace rule that makes `& $x` a different token
- Reading through a pointer, and the exactly-one-auto-deref rule
- Writing through a pointer
- `:$` to peel a level, and re-seating a pointer
- Pointers to pointers, and how `:$:$` and `&` relate
- Pointer arithmetic and casting
- `const` on a pointer level versus on the pointee
- Pointers into a container, and how growth invalidates them
- Lifetimes, and the ways to get hurt
