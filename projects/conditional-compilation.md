# Conditional compilation

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- The four directives: `#[if:]`, `#[elif:]`, `#[else]`, `#[end]`
- What a condition may test: `os`, `arch`, and your own `--define` flags
- Why the vocabulary is closed, and an unknown value is an error rather than a silent false
- Excluded code is never parsed, which is what lets it name symbols this platform does not have
- Where a condition may appear: file scope, a struct body, a function body, an `extern` block, a manifest
- Checking the other platform without owning a machine, with `--target-os`
- `const if`, the in-body branch, and how it differs from a runtime `if`
- What a condition deliberately cannot do
