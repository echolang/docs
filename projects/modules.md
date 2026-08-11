# Modules

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- A project is a directory with a `module.eco` manifest
- The manifest is Echo, read by the real parser, so `#[if:]` works in it
- The attributes: `module`, `version`, `sources`, `depends`, `link`, `cc`, `build_dir`
- `#[sources:]` patterns, and adding a file without editing the manifest
- Depending on another module by path, and what a consumer inherits automatically
- Why declaration order does not matter and top-level statement order does
- Where artifacts go: `ecobuild` beside the manifest, and how to move it
- The build cache: what it keys on, what it buys, and what it does not do
- `echoc clean`
- What is missing: a package manager, and git dependencies
