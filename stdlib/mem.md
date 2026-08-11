# mem

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- What `mem::` is for, and why most programs never touch it
- Allocation: `alloc<T>`, `realloc<T>`, `free<T>`
- Copying and moving raw storage: `copy<T>`, `move<T>`, `zero<T>`
- Asking about a type: `size_of<T>`, `align_of<T>`, `is_trivially_copyable<T>`, `needs_destruction<T>`
- Why those four fold to constants and can drive a `const if`
- `take<T>` and `init<T>`, the two unsafe seams, and which one a container needs when
- `bit_cast<To, From>`
- Looking at a class handle: `ref_count`, `weak_count`
- `live_allocations()` and the `--track-allocations` flag it needs
- `mem::buffer<T>`, and why it is `#[unique]`
