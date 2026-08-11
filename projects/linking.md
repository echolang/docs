# Linking

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- `#[link:]` and its four kinds: `lib`, `framework`, `search`, `object`
- A requirement travels with the module that declares it, so a consumer writes `#[depends:]` and nothing else
- `framework` is Darwin only, and is refused at the manifest elsewhere
- `--link` on the command line, and why installation paths belong there rather than in a manifest
- Why the kind is a tag in the grammar rather than a prefix inside the string
- What the JIT can and cannot open, and why `object:` is a refusal for `run`
- What is missing: pkg-config, and choosing static versus dynamic
