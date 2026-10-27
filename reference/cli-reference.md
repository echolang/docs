# CLI reference

`echoc` has seven subcommands and the options `--help` prints. That's the whole surface, and it's one list: what you
type, what `--help` prints, and what a refusal names all come from the same place. There is no second table
that can drift.

```bash
echoc run app.eco
echoc build -o app src/*.eco
echoc install
echoc test --filter group:parsing
echoc clean -n
echoc lsp
echoc profile app.ecoprof
```

[The echoc CLI](/projects/cli) is the chapter with the reasoning. This page is the table.

## Usage

```bash
echoc run     [options] <sources...> [-- <program arguments>]
echoc build   [options] -o <file> <sources...>
echoc install [options]
echoc test    [options] <sources...>
echoc clean   [options]
echoc lsp     [options]
echoc profile [options] <file>
```

| Command | Does | Defaults to |
|---|---|---|
| `run` | compile and run through the JIT. Nothing is written beside your sources | `--debug` |
| `build` | compile and link a native executable. Needs `clang`: bundled on Windows, otherwise the one on your PATH | `--release` |
| `install` | `build` every exe target a manifest declares, then copy each binary into `~/.echo/bin`. See [Putting one on your PATH](/projects/modules#putting-one-on-your-path) | `--release` |
| `test` | compile and run the `test` blocks, one process each, through the JIT | `--debug` |
| `clean` | remove what a build produced. Parses no source and runs no pass | n/a |
| `lsp` | speak the Language Server Protocol over stdin and stdout | `--debug` |
| `profile` | read an `.ecoprof` file and print the same summary `run --profile` printed | n/a |

`run` is the only one that takes `--`. `clean` and `lsp` take no source files: the workspace arrives from
the client's `initialize` request, or from `--module`. `install` takes none either, because an installed
program needs the name a manifest gives it. `test` is the only one that compiles a `test` block
at all: every other invocation drops one before it is parsed, `lsp` included. See
[Testing](/projects/testing).

`lsp` publishes diagnostics, hover, go-to-definition, document symbols, find-references, workspace
symbols, signature help, completion, rename, document highlight and inlay hints. Stdout is the protocol
stream and nothing else; logging goes to stderr.

Name no sources at all and your program is whatever manifest the invocation points at: the one `--module`
names, or the `module.eco` in your working directory. A `*` in a source path is expanded by echoc itself,
through the same expander a manifest's `#[sources:]` uses.

If that manifest declares `#[target:]`s, it produces one program per target and `--target` picks between
them. `exe` is a command with an entry file. `lib` is a program with no entry: a shared library on
the host, a reactor on wasi. `run` refuses a lib. See [Libraries and plugins](/projects/libraries)
and [WebAssembly](/projects/webassembly).

## Every option

`compiling` in the third column means `run`, `build`, `install` and `test`. `install` refuses `-o`,
`--target-os` and `--target-arch`: it names its own binaries, and what it installs runs on this machine. `lsp` takes `--module`, `--no-stdlib`,
`--package-dir`, `--target-os`, `--target-arch` and `--define`; everything else a compile would take is refused by name, because the server renders
nothing and builds nothing.

### What is built

| Option | Short | Commands | Value | Default | Does |
|---|---|---|---|---|---|
| `--output <file>` | `-o` | build | path | the target's name, or required | where the executable is written. A manifest declaring targets names its own, so this overrides for one of them and is refused for several |
| `--module <manifest>` | `-m` | all | path, repeatable | | build a module from its manifest. A file or a directory holding one |
| `--target <name>` | | compiling | name, repeatable | every program declared | which of the programs a manifest declares to build. `run` takes exactly one. On `test` it names a `#[target: test]` instead, and an unnamed one narrows nothing |
| `--filter <spec>` | | test | tagged word, repeatable | every test | which tests to run. A bare word is a name; `group:`, `file:` and `module:` are the tags. One matching nothing is refused |
| `--build-dir <dir>` | | compiling, clean | path | `ecobuild` beside the manifest | where build artifacts are written. Outranks `#[build_dir:]` |
| `--package-dir <dir>` | | compiling, lsp | path | the nearest `vendor/` | directory that holds vendored packages. `#[requires: "libcurl"]` resolves to `<dir>/libcurl` |
| `--link <requirement>` | | compiling | `<scheme>:<value>`, repeatable | | add a link requirement. Merged after the manifest's, so a declaration wins |

### How it is built

| Option | Short | Commands | Value | Default | Does |
|---|---|---|---|---|---|
| `--debug` | | compiling | flag | on for `run` | keep `assert` and the runtime checks |
| `--release` | | compiling | flag | on for `build` and `install` | drop `assert` and the runtime checks |
| `--optimize <mode>` | | compiling | `none\|module\|whole` | `module` | how hard, and over how much at once |
| `--debug-symbols` | `-g` | compiling | flag | off | emit DWARF. Implies `--optimize none` unless you stated one |
| `--no-tbaa` | | compiling | flag | off | emit no type-based alias metadata |
| `--fixed-hash-seed` | | compiling | flag | off | hash map keys with a constant 0 seed. See [Hashing](/stdlib/hash) |
| `--track-allocations` | | compiling | flag | off | count outstanding allocations. What `mem::live_allocations()` needs |
| `--alloc-cache` | | compiling | flag | off | per-thread page heap for allocations that fit in one 16 KiB page. Native only |
| `--profile` | | `run`, `build` | flag | off | sample time and count allocations. Writes an `.ecoprof` and prints a short summary. See [Profiling](/projects/profiling) |
| `--profile-calls` | | `run`, `build` | flag | off | instrument every call for exact counts. Implies `--profile` |
| `--profile-stdlib` | | `run`, `build` | flag | off | with `--profile-calls`, instrument the standard library too. Implies `--profile` |
| `--check-refcounts` | | compiling | flag | off | trap on releasing an already-dead object. Keeps every class box, poisoned |
| `--no-stdlib` | | compiling, lsp | flag | off | compile without the standard library |
| `--emit-stdlib-header` | | compiling | flag | off | regenerate the embedded stdlib header |
| `--no-hooks` | | compiling | flag | off | run none of the root manifest's `#[hook:]`s. See [Tools and hooks](/projects/tools) |

`--debug` and `--release` are one question and so are `--no-stdlib` and `--emit-stdlib-header`. Writing both
halves of either pair is a refusal, not a last-one-wins.

### What it is built for

| Option | Short | Commands | Value | Default | Does |
|---|---|---|---|---|---|
| `--target-os <name>` | | all but install | name | the host | evaluate `#[if:]` as if targeting this OS. `echoc build --target-os wasi` is a real cross to `wasm32-unknown-wasip1`; Darwin `build --target-os ios` is the other. `wasi` is refused on `run` and `test` |
| `--target-arch <name>` | | all but install | name | the host | the same for the architecture |
| `--ios-device` | | build | flag | off | with `--target-os ios`, emit for a physical iPhone |
| `--define <name>` | | all | bare name, repeatable | | declare a flag `#[if: NAME]` can test |
| `--target-cpu <name>` | | compiling | name | a per-platform baseline | which CPU to select instructions for |
| `--target-features <list>` | | compiling | comma list of `+f` / `-f` | empty | features to enable or disable |

`--define` takes a bare name only. There is no `NAME=value` form, because a condition tests presence rather
than equality.

`--target-cpu` is **never the host by default**. `native` has to be asked for by name, since a binary built
for the host CPU is an illegal instruction on the machine next door rather than a diagnostic.

`--target-os` and `--target-arch` change what a `#[if:]` sees. On every subcommand except one, that
is all they do: the code is still compiled for this machine.

The exceptions are Darwin `echoc build --target-os ios` and `echoc build --target-os wasi`. iOS is a
real cross-compile to the simulator SDK; `--ios-device` switches it to a physical iPhone. WASI is
`wasm32-unknown-wasip1` on every host and needs a WASI SDK (`WASI_SDK_PATH`, `/opt/wasi-sdk`, or
Homebrew wasi-libc). `echoc run --target-os wasi` and `echoc test --target-os wasi` are refused:
those would pick wasi constants and execute them on the host. `echoc run --target-os ios` still
only picks `#[if:]` arms and JITs for this machine. Other names (`linux`, `windows`, `android`)
stay facts-only on every subcommand: there is no Linux sysroot on a Mac.

`--target-os ios` also selects `family == darwin`. There is no `--target-family`.

### What echoc tells you

| Option | Short | Commands | Value | Default | Does |
|---|---|---|---|---|---|
| `--print <what>` | `-p` | compiling | see below, repeatable | | dump what the compiler built, by layer |
| `--decls-all` | | compiling | flag | off | with `--print decls`, include dependency and stdlib declarations |
| `--explain <what>` | | compiling | see below, repeatable | | explain a decision the compiler made |
| `--diagnostics <mode>` | | compiling, clean | `auto\|pretty\|ascii\|json` | `auto` | how a diagnostic is drawn |
| `--color <when>` | | compiling, clean | `auto\|always\|never` | `auto` | colourise diagnostics. Also spelled `--colour` |
| `--silent` | | compiling, clean | flag | off | do not draw the progress checklist. Silences that and nothing else |
| `--verbose` | | test | flag | off | list every test, with how long each one took |
| `--timeout <ms>` | | test | milliseconds | none | kill a test that is still running after this many milliseconds |

`--verbose` replaces the per-test lines with a listing: every test under the file it is written in, its group
and its duration, a count and a total per file, and whatever a test printed. That last part includes a
passing test's output, which is the one thing no other rendering keeps. What a terminal shows is then what a
pipe records.

### What clean removes

| Option | Short | Commands | Value | Default | Does |
|---|---|---|---|---|---|
| `--with-stdlib` | | clean | flag | off | also remove the standard library's store |
| `--dry-run` | `-n` | clean | flag | off | print what would be removed, remove nothing |

### Where install puts it

| Option | Short | Commands | Value | Default | Does |
|---|---|---|---|---|---|
| `--dir <dir>` | | install | path | `$ECHO_BIN_DIR`, else `~/.echo/bin` | the directory programs are installed into, created if it is missing |

### General

| Option | Short | Commands | Does |
|---|---|---|---|
| `--stdio` | | lsp | name the stdio transport. It is the only one, so this flag and omitting it are the same thing |
| `--help` | `-h` | all | the page, or one option in full |
| `--version` | `-v` | all | print the version |
| `--text` | | `profile` | print the fuller human-readable dump of the file |
| `--folded <what>` | | `profile` | write collapsed stacks: `time\|self\|allocs\|alloc-bytes\|live-bytes\|copies\|copy-bytes\|calls` |

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
| | `manifest` | the named manifests as JSON, then stop. Does not resolve the graph. Cannot be combined with another `--print` |
| | `decls` | resolved declarations as JSON, after the semantic passes. User modules only unless `--decls-all` |
| | `tools` | the tools the project's direct dependencies offer, as JSON, then stop. What `epm run` reads. Cannot be combined with another `--print` |
| `--explain` | `cache` | each module's key, whether its artifact is present, and on a miss which input changed. `up to date` when the whole program was |
| | `prune` | what the JIT prune dropped. `run` and `test` only |
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
option today, because only the JIT prunes, and it is narrower to the *two* commands that do:

```
error: 'build --explain prune' is not something 'build' can answer. It accepts: cache|memory|time.
```

A flag a subcommand accepts and silently ignores is worse than one it rejects, and a value is no different.

`-g` is the near miss. `run` does accept it, and then tells you it can't honour it rather than refusing the
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
| `echoc frobnicate` | `'frobnicate' is not an echoc command. Write 'run', 'build', 'install', 'test', 'clean', 'lsp' or 'profile'.` |
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
| `HOME` | the fallback root, `$HOME/.cache/echo`. Neither set means no user cache. Also where `install` goes: `$HOME/.echo/bin` |
| `LOCALAPPDATA` | Windows: the cache root `%LOCALAPPDATA%\echo`, and `install`'s `%LOCALAPPDATA%\echo\bin` |
| `ECHO_BIN_DIR` | where `install` puts programs when `--dir` is not given |
| `SDKROOT` | the SDK path handed to the link step |
| `ECO_TRACE_MONO` | present, at any value, traces the monomorphizer per round. A debugging hatch, not a feature |

Colour and box drawing are two separate answers on purpose. A Windows console draws colour and mangles
`-`-style box characters; a UTF-8 terminal behind a pipe is the other way around.

## Exit status

`0` when the compile succeeded, and for `run`, when your program also returned `0`. `1` when anything was
refused. `run` passes your program's exit code straight through, so `std::env::exit(2)` gives you `2`.

`test` is `0` only when every test it ran passed. A test that failed, was killed by a signal, or a `--filter`
matching nothing all give you `1`.

## Next

- [The echoc CLI](/projects/cli) for what these flags are for, rather than what they are.
- [Modules](/projects/modules) for what `-m` and `--build-dir` are pointing at.
- [Attributes](/reference/attributes) for the manifest side of `--link` and `--define`.
