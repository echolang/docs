# The echoc CLI

`echoc` has three subcommands and no others. There is no `echoc new`, no `echoc test`, no `echoc fmt`. What
there is instead: **`run` and `build` are not the same build**, and most of this page is about the ways they
differ.

```bash
echoc run app.eco               # compile in memory, execute now
echoc build -o app app.eco      # compile and link a native binary
echoc clean                     # remove what a build produced
```

That is the whole surface. Everything below is flags.

## `run` is the loop, `build` is the artifact

`run` compiles into memory and executes through the JIT. Nothing is written beside your sources, nothing is
linked, and the program starts almost immediately. It defaults to `--debug`, so `assert` and the runtime
checks stay in.

`build` produces a real executable, which needs `clang` on your `PATH` for the link step. It defaults to
`--release`, so `assert` is compiled out.

[Your first program](/guide/first-program) has the side-by-side table for what each default actually changes.
The one thing worth repeating here, because it surprises people: the defaults go opposite ways on purpose, and
either can be overridden.

```bash
echoc run --release app.eco     # the release semantics, without linking
echoc build --debug -o app app.eco
```

## Choosing what to compile

Three ways, and you will use all of them.

Name files, and they become the `main` module:

```bash
echoc run app.eco
echoc build -o app "src/*.eco"
```

The `*` is expanded by echoc itself, through the same expander a manifest's `#[sources:]` uses, so a pattern
means the same thing in both places. Quote it if your shell would rather expand it first. A file you name and
echoc cannot find fails the build rather than being quietly left out.

Name a manifest with `-m`:

```bash
echoc build -o plot -m ../geometry app.eco
```

Or name nothing at all, and your program is the `module.eco` in your working directory:

```bash
cd plotter
echoc run
```

That last one is how you will run a real project most of the time. [Modules](/projects/modules) is what a
manifest can say.

## Everything after `--` belongs to your program

```bash
echoc run app.eco -- --verbose report.txt
```

`--` is not POSIX end-of-options here. It means "the rest is the program's", and everything past it is handed
to your code untouched, flags included. `--silent` after the split is your program's argument and not echoc's.

Two consequences. `argv[0]` under `run` is the source file rather than `echoc`, because that is the honest
answer to what the program is called. And `build` refuses the separator outright rather than ignoring it:

```
error: Only 'run' passes arguments to the program, so '--' means nothing to 'build'.
```

A native binary takes its own arguments directly, so there is nothing for echoc to forward.

## `--debug` and `--release` decide what your program carries

This pair is about the *program*. `--debug` keeps `assert` calls and the compiler's runtime checks, including
the bounds check on an array index and the null check on a narrowing. `--release` drops both.

That is all it decides. It is not an optimization level, and it does not change what a debugger can read.
[Errors and panics](/language/errors-and-panics) has what each check does when it fires.

## `--optimize` decides how much the optimizer may see at once

```bash
echoc build --optimize whole -o app app.eco
```

Three values, and the middle one is the default:

| | |
|---|---|
| `none` | emit the IR as codegen wrote it. For reading raw IR, or for finding out whether the optimizer is the one miscompiling you |
| `module` | optimize each unit on its own. **The default** |
| `whole` | merge every unit into one module, then optimize the lot |

`whole` is what gets you inlining across module boundaries, because the optimizer can only inline a body it
can see. The catch is real and worth stating: after the merge there are no per-module objects left, so it
bypasses the build cache and every build starts over.

That is why `module` is the default rather than `whole`. If you only need one function to stay inlinable
across a module boundary, mark it `#[inline]` and keep your fast rebuilds.

Note: this used to be two flags, `-O` and `--no-optimize`. They read like opposites and were not, so writing
both was legal and meant almost nothing. Both are refused now, by name, with the replacement in the message.

## `-g` is a third axis, not a level

```bash
echoc build -g -o app app.eco
```

`--debug` decides what checks your *program* carries. `-g` decides what your *object* tells a debugger. They
are orthogonal, and a release build with no assertions that you can still step through is exactly the build
you tend to want a debugger for.

`-g` does turn `--optimize` down to `none`, unless you asked for a level yourself, because a line table over
optimized output describes a program nobody wrote. And `run` takes the flag and then tells you it cannot
honour it: the JIT emits no object for a debugger to open. [Debugging](/projects/debugging) is the rest.

## `--define` and `--link`

`--define` switches on a region guarded by `#[if: NAME]`:

```bash
echoc run --define TRACE app.eco
```

Bare names only. There is no `--define NAME=value`, because naming a value is what a constant declaration is
for. A flag you never define is false rather than an error, which is the opposite of how the `os` and `arch`
vocabularies behave, and it has to be: if an undefined flag were an error, `#[if: TRACE]` could never take its
else arm. [Conditional compilation](/projects/conditional-compilation) has the conditions themselves.

`--link` adds a link requirement no module declared:

```bash
echoc build --link lib:m --link search:/opt/homebrew/lib -o app app.eco
```

Most of the time you should need neither. A module says what it needs with `#[link:]` and a consumer writes
`#[depends:]`. This flag is for the half that belongs to your machine rather than to the module, like a
library installed somewhere nobody could have predicted. [Linking](/projects/linking) covers the four kinds.

## Looking inside with `-p`

Repeatable, so two layers means two dumps rather than only the last one:

```bash
echoc run -p ast-resolved -p ir app.eco
```

| | |
|---|---|
| `ast` | your code as a tree, before any semantic pass touched it |
| `ast-resolved` | after the semantic passes. Every deref, drop, retain and release is a real node here |
| `ir` | the merged whole-program LLVM IR |
| `ir-units` | each unit on its own, as the object writer receives it |
| `symbols` | the namespace tree and the overload sets |
| `instances` | generic instances, and which call sites were rewired to them |

`ast-resolved` is how you find out what echoc decided about a reference count without going near the IR. When
a generic goes wrong, start at `instances` rather than in the IR: it is almost always faster.

One trap in `ir`, and it is a real one. Printing it implies the merge, because one dump can only look at one
module, so what you are reading describes the `--optimize whole` build even when you did not ask for one.
`ir-units` is the dump that describes an ordinary build.

Each dump writes a `[section]` header, so the output greps cleanly.

## Measuring with `--explain`

```bash
echoc build --explain cache --explain time -o app app.eco
```

`cache` prints each module's key, whether a stored object was found, and on a miss which input changed.
`time` prints where the compile went, phase by phase, as a tree:

```
[timings]
  parse                      51.90 ms
    resolve manifests         2.34 ms
      sources glob            0.61 ms
    read sources              4.24 ms
    lex                      26.72 ms
    ...
  emit + link               126.09 ms
    emit objects             25.44 ms
    link                    100.63 ms
```

These are ordinary output, not debugging leftovers. The very first run of `time` turned up that expanding the
standard library's source globs cost more than lexing all 1938 lines of it, which is not a thing anybody was
going to guess.

`prune` is `run` only, because only the JIT prunes. Written on a `build` it is a refusal that names `run`
rather than a flag quietly doing nothing:

```
error: 'build --explain prune' is not something 'build' can answer. It accepts: cache|memory|time.
```

`memory` is the odd one out: it prints how many allocations your program still held when it ended, which means
it changes what echoc *emits* rather than reporting what echoc *did*. It implies `--track-allocations`, and
without that flag `mem::live_allocations()` is refused rather than answered 0.

## Diagnostics, and how they are drawn

Diagnostics go to stderr in every form, so `2>` is how you capture them.

```bash
echoc build --diagnostics json -o app app.eco
```

`auto` picks the boxes when stderr is a terminal that can draw them and plain ASCII when it is not, so a CI
log and a golden test get the same output with nothing configured. `pretty` and `ascii` pick by hand. `json`
is JSON Lines, one object per diagnostic and one summary at the end, and is what editor tooling reads. See
[Installation](/guide/installation) for what that is currently good for.

`--color=auto|always|never` is separate, and honours `NO_COLOR`, `CLICOLOR_FORCE` and `TERM=dumb`. It is a
separate flag because a CI job that renders colour out of a stored log is a real thing, and a carriage return
in one is not.

`--silent` turns off the progress checklist and nothing else. Diagnostics, warnings and every `--print` dump
were asked for by name, so they stay.

## The help page knows more than this page

Every flag is described by `echoc` itself, and one flag can be asked about in full:

```bash
echoc --help
echoc build --help
echoc build --help optimize
```

The last form is where the paragraphs live, including the trade-offs each value carries. It takes the option
name bare, without dashes, and a short spelling works too (`echoc build --help g`).

A subcommand refuses a flag it does not accept rather than ignoring it, and says so by name:

```
error: 'clean' does not take '-g, --debug-symbols'.
```

## Next

- [CLI reference](/reference/cli-reference) for every flag in one table.
- [Modules](/projects/modules) for what `-m` and `--build-dir` are pointing at.
- [Debugging](/projects/debugging) for what `-g` buys once the binary exists.
