# Ownership and moving

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- One owner, one destruction, and when destruction happens
- Destruction order inside a scope
- Moving a value with `mv`, and why the call site has to say it too
- Reading a moved-from variable is a compile error
- Moving into a function, and moving out of one
- `mv` is not "make this cheap": what it does and does not avoid
- Borrowing instead: `T&` and `const T&`
- Temporaries, and how long one lives
- What a move cannot take: a field, an element
- How a class answers the same questions differently
- Weak references, cycles, and what happens when the object dies first
