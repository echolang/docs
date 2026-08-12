# CLI reference

`echoc` has three subcommands and twenty-six options, and **every one of those options is a single
declarative row inside the compiler**. Parsing reads that row, validation reads it, the usage line reads it,
the help page reads it, and a refusal spells the flag back out of it. There is no second list anywhere that
can drift out of step with this one.

```bash
echoc run app.eco
echoc build -o app src/*.eco
echoc clean -n
```

[The echoc CLI](/projects/cli) is the chapter with the reasoning. This page is the table.

## Usage

```bash
echoc run   [options] <sources...> [-- <program arguments>]
echoc build [options] -o <file> <sources...>
echoc clean [options]
```

| Command | Does | Defaults to |
|---|---|---|
| `run` | compile and run through the JIT. Nothing is written beside your sources | `--debug` |
| `build` | compile and link a native executable. Needs `clang` on your PATH | `--release` |
| `clean` | remove what a build produced. Parses no source and runs no pass | n/a |

`run` is the only one that takes `--`. `clean` is the only one that takes no sources.

Name no sources at all and your program is whatever manifest the invocation points at: the one `--module`
names, or the `module.eco` in your working directory. A `*` in a source path is expanded by echoc itself,
through the same expander a manifest's `#[sources:]` uses.

If that manifest declares `#[target:]`s, it produces one program per target and `--target` picks between
them. See [More than one program](/projects/modules#more-than-one-program).

## Every option

`run+build` in the third column means the option is refused on `clean`, by name.

### What is built

| Option | Short | Commands | Value | Default | Does |
|---|---|---|---|---|---|
| `--output <file>` | `-o` | build | path | the target's name, or required | where the executable is written. A manifest declaring targets names its own, so this overrides for one of them and is refused for several |
| `--module <manifest>` | `-m` | all | path, repeatable | | build a module from its manifest. A file or a directory holding one |
| `--target <name>` | | run+build | name, repeatable | every target declared | which of the programs a manifest declares to build. `run` takes exactly one |
| `--build-dir <dir>` | | all | path | `ecobuild` beside the manifest | where build artifacts are written. Outranks `#[build_dir:]` |
| `--link <requirement>` | | run+build | `<scheme>:<value>`, repeatable | | add a link requirement. Merged after the manifest's, so a declaration wins |

### How it is built

| Option | Short | Commands | Value | Default | Does |
|---|---|---|---|---|---|
| `--debug` | | run+build | flag | on for `run` | keep `assert` and the runtime checks |
| `--release` | | run+build | flag | on for `build` | drop `assert` and the runtime checks |
| `--optimize <mode>` | | run+build | `none\|module\|whole` | `module` | how hard, and over how much at once |
| `--debug-symbols` | `-g` | run+build | flag | off | emit DWARF. Implies `--optimize none` unless you stated one |
| `--no-tbaa` | | run+build | flag | off | emit no type-based alias metadata |
| `--track-allocations` | | run+build | flag | off | count outstanding allocations. What `mem::live_allocations()` needs |
| `--no-stdlib` | | run+build | flag | off | compile without the standard library |
| `--emit-stdlib-header` | | run+build | flag | off | regenerate the embedded stdlib header |

`--debug` and `--release` are one question and so are `--no-stdlib` and `--emit-stdlib-header`. Writing both
halves of either pair is a refusal, not a last-one-wins.

### What it is built for

| Option | Short | Commands | Value | Default | Does |
|---|---|---|---|---|---|
| `--target-os <name>` | | all | name | the host | evaluate `#[if:]` as if targeting this OS |
| `--target-arch <name>` | | all | name | the host | the same for the architecture |
| `--define <name>` | | all | bare name, repeatable | | declare a flag `#[if: NAME]` can test |
| `--target-cpu <name>` | | run+build | name | a per-platform baseline | which CPU to select instructions for |
| `--target-features <list>` | | run+build | comma list of `+f` / `-f` | empty | features to enable or disable |

`--define` takes a bare name only. There is no `NAME=value` form, because a condition tests presence rather
than equality.

`--target-cpu` is **never the host by default**. `native` has to be asked for by name, since a binary built
for the host CPU is an illegal instruction on the machine next door rather than a diagnostic.

`--target-os` and `--target-arch` change what a `#[if:]` sees and nothing else. They do not cross-compile.

### What echoc tells you

| Option | Short | Commands | Value | Default | Does |
|---|---|---|---|---|---|
| `--print <what>` | `-p` | run+build | see below, repeatable | | dump what the compiler built, by layer |
| `--explain <what>` | | run+build | see below, repeatable | | explain a decision the compiler made |
| `--diagnostics <mode>` | | all | `auto\|pretty\|ascii\|json` | `auto` | how a diagnostic is drawn |
| `--color <when>` | | all | `auto\|always\|never` | `auto` | colourise diagnostics. Also spelled `--colour` |
| `--silent` | | all | flag | off | do not draw the progress checklist. Silences that and nothing else |

### What clean removes

| Option | Short | Commands | Value | Default | Does |
|---|---|---|---|---|---|
| `--with-stdlib` | | clean | flag | off | also remove the standard library's store |
| `--dry-run` | `-n` | clean | flag | off | print what would be removed, remove nothing |

### General

| Option | Short | Commands | Does |
|---|---|---|---|
| `--help` | `-h` | all | the page, or one option in full |
| `--version` | `-v` | all | print the version |

Both short-circuit every other rule, so `echoc build --help` prints the page instead of complaining about
the missing `-o`.

`--help` also takes an option name, bare and without dashes, which is where the paragraphs live:

```bash
echoc build --help optimize
echoc build --help g
```

There are exactly seven short options: `-h`, `-v`, `-o`, `-m`, `-p`, `-g`, `-n`.

## Value vocabularies

| Option | Value | Means |
|---|---|---|
| `--optimize` | `none` | skip the per-unit pipeline |
| | `module` | optimize each unit on its own. The only mode that leaves a cacheable object, which is why it is the default |
| | `whole` | merge every unit, then optimize. Cross-module inlining, and no object stored |
| `--print` | `ast` | the AST as parsed |
| | `ast-resolved` | the AST after the semantic passes. Every deref, drop, retain and release is a node here |
| | `ir` | the merged whole-program LLVM IR. Implies the merge |
| | `ir-units` | each unit, as the object writer gets it |
| | `symbols` | the registered symbol table |
| | `instances` | generic instances and rewired call sites |
| `--explain` | `cache` | each module's key, whether its artifact is present, and on a miss which input changed |
| | `prune` | what the JIT prune dropped. `run` only |
| | `memory` | live allocations when the program ended. Implies `--track-allocations` |
| | `time` | where the compile spent its time, as a tree |
| `--diagnostics` | `auto` | `pretty` when stderr is a terminal that can draw it, `ascii` otherwise |
| | `pretty` | box drawing and colour |
| | `ascii` | the same layout in plain ASCII |
| | `json` | JSON Lines on stderr, one object per diagnostic then one summary. What editor tooling reads |
| `--color` | `auto` | on when stderr is a terminal, honouring the environment below |
| | `always` | on regardless, which is what a CI log wants |
| | `never` | off regardless |

`--explain memory` is the odd one: it changes the emitted program rather than reporting on the compile.

## The mask is per value, not just per option

A subcommand can accept an option and still refuse one of its values. Exactly one value is narrower than its
option today, because only the JIT prunes:

```
error: 'build --explain prune' is not something 'build' can answer. It accepts: cache|memory|time.
```

A flag a subcommand accepts and silently ignores is worse than one it rejects, and a value is no different.

`-g` is the near miss. `run` does accept it, and then tells you it cannot honour it rather than refusing the
invocation:

```
[warning] Debug Info Ignored

  '-g' produces no artifact a debugger can open on 'run': the JIT emits no object file. Use
  'echoc build -g' and open the resulting executable instead.
```

## Refusals

Every one of these is exact, and every one goes to stderr followed by the usage block. The help page is the
only thing that goes to stdout.

| You wrote | You get |
|---|---|
| `echoc` | `No command given.` |
| `echoc frobnicate` | `'frobnicate' is not an echoc command. Write 'run', 'build' or 'clean'.` |
| `echoc run --nonsense` | `Unknown option '--nonsense'.` |
| `echoc run --optimize hard` | `Unknown '--optimize' value 'hard'. Expected one of: none\|module\|whole.` |
| `echoc build x.eco` | `'build' needs '-o, --output <file>' - nothing here names the binary.` Reported once the manifest is known, since a project declaring targets names its own |
| `echoc build -o` | `'-o, --output <file>' needs a value.` |
| `echoc build -o --silent` | `'-o, --output' needs a value, and '--silent' is an option.` |
| `echoc run --silent=1` | `'--silent' takes no value.` |
| `echoc run --debug --release` | `'--debug' and '--release' are two answers to one question - the build mode. Write one.` |
| `echoc run --no-stdlib --emit-stdlib-header` | the same sentence, ending `- the standard library. Write one.` |
| `echoc clean --explain cache` | `'clean' does not take '--explain'.` |
| `echoc clean x.eco` | `'clean' takes no source files. It parses none and runs no pass.` |
| `echoc build -o app x.eco -- a` | `Only 'run' passes arguments to the program, so '--' means nothing to 'build'.` |
| `echoc build --help with-stdlib` | `'build' does not take '--with-stdlib'.` |
| `echoc build -oout x.eco` | `'-oout' is not an option. A short option is one character - write '-oout' - and a long one takes two dashes.` |

That last one is trying to tell you to write `-o out` and prints the word you typed instead. It is a bug in
the message, not in the rule.

## Retired spellings

An old spelling is **refused with the sentence naming its replacement**, never quietly accepted and never
warned about. A deprecation warning would be new output on stderr, and the end-to-end corpus byte-compares
that stream.

| Retired | Write instead |
|---|---|
| `-O` | `--optimize whole` |
| `--no-optimize` | `--optimize none` |
| `-a`, `--print-ast` | `--print ast` |
| `-ar`, `--print-resolved-ast` | `--print ast-resolved` |
| `--print-ir` | `--print ir` |
| `-pu`, `--print-unit-ir` | `--print ir-units` |
| `-syt`, `--print-symbol-table` | `--print symbols` |
| `-pi`, `--print-instances` | `--print instances` |
| `-ec`, `--explain-cache` | `--explain cache` |
| `-ep`, `--explain-prune` | `--explain prune` |
| `-em`, `--explain-memory` | `--explain memory` |
| `-t`, `--timings` | `--explain time` |
| `-ta` | `--track-allocations` |
| `--debug-info` | `--debug-symbols`, or `-g` |
| `--stdlib` | `--with-stdlib` |

The full sentence for `-O` carries the extra clause, because it is the one where the replacement is not
obvious:

```
error: '-O' is retired. Write '--optimize whole' for the merged whole-program build, which is what it did.
```

## Environment variables

None of these are flags, and none of them enter a module's cache key.

| Variable | Effect |
|---|---|
| `NO_COLOR` | set and non-empty turns colour off. Wins over `CLICOLOR_FORCE` |
| `CLICOLOR_FORCE` | set, non-empty and not `0` turns colour on |
| `TERM` | exactly `dumb` turns colour off |
| `WT_SESSION` | present means box-drawing characters are safe. Windows Terminal |
| `LC_ALL`, `LC_CTYPE`, `LANG` | containing `UTF-8` or `utf8` means box-drawing characters are safe. Checked in that override order |
| `COLUMNS` | a positive integer overrides the width used for wrapping |
| `XDG_CACHE_HOME` | the user cache root becomes `$XDG_CACHE_HOME/echo` |
| `HOME` | the fallback root, `$HOME/.cache/echo`. Neither set means no user cache |
| `SDKROOT` | the SDK path handed to the link step |
| `ECO_TRACE_MONO` | present, at any value, traces the monomorphizer per round. A debugging hatch, not a feature |

Colour and box drawing are two separate answers on purpose. A Windows console draws colour and mangles
`-`-style box characters; a UTF-8 terminal behind a pipe is the other way around.

## Exit status

`0` when the compile succeeded, and for `run`, when your program also returned `0`. `1` when anything was
refused. `run` passes your program's exit code straight through, so `std::env::exit(2)` gives you `2`.

## Next

- [The echoc CLI](/projects/cli) for what these flags are for, rather than what they are.
- [Modules](/projects/modules) for what `-m` and `--build-dir` are pointing at.
- [Attributes](/reference/attributes) for the manifest side of `--link` and `--define`.
