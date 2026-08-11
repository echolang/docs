# The echoc CLI

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- The three subcommands: `run`, `build`, `clean`
- `run` compiles in memory and executes, and defaults to `--debug`
- `build` links a native executable, needs `clang`, and defaults to `--release`
- Passing arguments to your program with `--`
- Choosing sources: loose files, `-m`, or the manifest in the working directory
- `--debug` and `--release`, and what actually changes
- `--optimize none|module|whole`
- `-g` for debug symbols, and why it is a third axis rather than a level
- `--define` for conditional compilation flags
- `--link` for a native library the manifest does not mention
- Looking inside: `-p` to dump a layer, `--explain` to measure one
- `--diagnostics` and `--color`, and what the JSON format is for
- `echoc --help`, and `echoc build --help <option>` for one option in full
