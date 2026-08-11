# C interop

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- Declaring a C function in an `extern` block
- Renaming a symbol locally with `as`
- Putting extern declarations in a namespace, and wrapping them in something nicer
- Strings across the boundary: `c_str()`, `str::from_c_str`, `str::view_of_c_str`
- Structs across the boundary, and matching a C layout
- Shipping C sources beside your Echo with `#[cc:]`: `sources`, `include`, `define`, `flag`
- What `#[cc:]` does and does not contribute, which is objects and nothing else
- The C object cache, and why an object's filename does not move when a header does
- What is missing: variadics, which is why `printf` cannot be declared
