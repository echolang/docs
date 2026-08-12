# Modules

Once a program outgrows a handful of loose files you give it a `module.eco`, and from then on `echoc` knows
what your project is made of. The part worth knowing up front: **a manifest is Echo**, read by the same lexer
and the same parser your own code goes through.

<!-- verify: skip -->
```echo
#[module: "plotter"]
#[version: "0.1.0"]

#[sources: "src/*.eco"]
```

That is a complete project. Run `echoc run` in that directory and it finds the manifest, expands the pattern
and compiles what it matched. The rest of this page is what happens when one module is not enough.

## Eight attributes, and most days you write three

A manifest has exactly eight attributes. Misspell one and you get the list back:

```
module.eco:2: unknown manifest attribute 'source', expected one of: module, version, depends, sources, target, link, cc, build_dir
```

| | |
|---|---|
| `#[module: "name"]` | the module's name. The only required one |
| `#[version: "0.1.0"]` | recorded, and part of the build fingerprint |
| `#[sources: "src/*.eco"]` | the files this module is made of |
| `#[depends: "../geometry"]` | another module, by path |
| `#[target: exe { ... }]` | a program this module produces. See [More than one program](#more-than-one-program) |
| `#[link: lib "m"]` | a native library this module needs. See [Linking](/projects/linking) |
| `#[cc: sources "c/*.c"]` | C sources that ship beside the Echo. See [C interop](/projects/c-interop) |
| `#[build_dir: "target"]` | where artifacts go instead of `ecobuild` |

`#[version:]` is optional and the standard library's own manifest omits it. It is also worth being honest
about what it does, which is nothing: nothing resolves against it, nothing compares two of them. It is part of
what a build is fingerprinted on and that is the whole job. See [the list](/reference/limitations).

## The manifest is Echo, which is why `#[if:]` works in it

There is no separate manifest grammar. That is not a design flourish, it is what lets a manifest gate its own
source list with no new syntax at all:

<!-- verify: skip -->
```echo
#[module: "renderer"]

#[if: os == darwin]
#[sources: "src/metal/*.eco"]
#[elif: os == linux]
#[sources: "src/vulkan/*.eco"]
#[end]
```

Conditions here see what `--target-os` said, not what the machine underneath you is.
[Conditional compilation](/projects/conditional-compilation) is the whole story.

## A source pattern is relative to the manifest, and has to match something

Patterns resolve against the directory the `module.eco` is in, never against your working directory. That is
what lets a library be depended on from anywhere.

Anywhere one value is accepted, a list of them is:

<!-- verify: skip -->
```echo
#[sources: ["src/*.eco", "extra/*.eco"]]
```

Repeating the attribute means the same thing, and reads better once the list gets long:

<!-- verify: skip -->
```echo
#[sources: "src/*.eco"]
#[sources: "extra/*.eco"]
```

A pattern that matches nothing is an error rather than a module with no files:

```
module.eco: the sources pattern 'lib/*.eco' matched no files.
```

The point of a pattern is that adding `src/circle.eco` needs no edit here. Adding a *directory* does, which is
the right way round: a new directory is a decision and a new file usually is not.

## More than one program

A module is one program by default: run `echoc run` in it and the top level of every file it is made of runs,
in filename order. That is fine right up until you want two of them, and then it is not fine at all. The tool
and the server that share its guts. The app and the benchmark that measures it. Splitting those into two
modules to get two binaries means inventing a third one to hold what they share, which is a lot of manifest
for a problem you did not have.

`#[target:]` is how a manifest says so. It names one of the module's own files as the entry point:

<!-- verify: skip -->
```echo
#[module: "clock"]

#[sources: "src/*.eco"]

#[target: exe { name: "clock", entry: "src/clock_main.eco" }]
#[target: exe { name: "serve", entry: "src/serve_main.eco" }]
```

```bash
echoc build                  # both of them
echoc build --target clock   # just the one
echoc run --target serve
```

**The entry file is the program, and everything else in the module is shared.** Building `clock` runs the
top level of `clock_main.eco` and nothing of `serve_main.eco`; building `serve` is the other way round. Every
other file (`canvas.eco`, `face.eco`, whatever else `src/*.eco` matched) contributes its functions, its types
and its constants to both.

That is the same rule a library module follows: only the program's own file root becomes `main`. A target is
just a manifest saying which file that is.

Note the entry has to be a file the module is already made of. It is shared code's neighbour, not a stranger
beside it:

```
module.eco:6: 'elsewhere.eco' is target 'tool's entry but is not one of this module's sources - a target's entry has to be a file the module is made of.
```

### Shared files hold declarations, not code

Once a module declares targets, top-level code in a file that is *no* target's entry has nowhere to run. So
it is refused rather than quietly dropped:

```
[error] Top Level Code Outside An Entry

  'clock' declares targets, so 'canvas.eco' is shared by all of them and the code at its top level would never run. Only a target's entry file becomes a program.

  14 |  $shared = canvas(80, 24);
     |  ^^^^^^^

  help: move it into the entry file of the target it belongs to, or into a function this one calls. Declarations are what a shared file is for, and every target already sees all of them
```

The other target's entry file is not this mistake. Its code belongs to that program, and not running when
you build this one is the whole point.

### Where the binaries go

Each target writes a binary named after itself, into the module's build directory:

```
clock/
  module.eco
  src/...
  ecobuild/
    CACHEDIR.TAG
    clock          <- one per target
    serve
```

So `.gitignore` still needs the one `ecobuild/` line however many programs you grow, and `echoc clean`
reaches them. `-o` overrides for a single target and is refused when several are being built, because one
path cannot name two files:

```bash
echoc build --target clock -o /usr/local/bin/clock
```

One trade worth knowing: each target is compiled on its own, so the code they share is compiled once per
target. Their `#[depends:]` libraries are cached and shared between them, the module's own sources are not.
For two programs over one `src/` that is a rounding error. If it ever stops being one, the shared half wants to
be its own module, which is the thing `#[depends:]` was for all along.

## A dependency is a directory on disk

<!-- verify: skip -->
```echo
#[module: "plotter"]
#[version: "0.1.0"]

#[depends: "../geometry"]

#[sources: "src/*.eco"]
```

The path names a **directory**, and the `module.eco` inside it is what gets read. You may name the file
directly if you prefer; both spellings reach the same manifest.

You can also say out loud what a bare string already means:

<!-- verify: skip -->
```echo
#[depends: path "../geometry"]
```

Identical behaviour. The tagged form exists so that a second kind of dependency can be added later without the
common case growing a word.

That "later" is the thing to know before you plan a project around this. **There is no package manager.** A
dependency is a path, and that is all it is. A git dependency parses, validates, and is then refused:

```
module.eco:3: git dependencies are not resolved yet - a dependency is a path to a manifest that is already on disk. Vendor the module and name it with a path.
```

So today you vendor, or you use a submodule, or you keep your libraries in sibling directories. See
[the list](/reference/limitations).

## A consumer writes one line and inherits the rest

`plotter` depends on `geometry`. If `geometry` in turn depends on `mathkit`, `plotter` gets that too, in the
order that works, without naming it. The same is true of link requirements: a module that declares
`#[link: lib "m"]` carries it to everything downstream, however many modules sit in between.

That is the property the whole design is built around. A consumer writes `#[depends:]` and nothing else.

## Order is decided for you, and a cycle cannot be satisfied

Modules are parsed one at a time, each one completely before the next starts. So a module may name symbols
from any module parsed before it, and none from the ones after.

Two consequences.

The first is that **declaration order inside a module does not matter.** Three parse passes run over every
file before the next pass starts, so a function may call one declared further down, or in a file that sorts
later. What *does* run in order is top-level statements in the entry module, by filename.

The second is that a cycle is not merely unsupported:

```
the module dependencies form a cycle: c1 -> c2 -> c1. A module is parsed completely before the next one starts, so it can only name symbols from modules parsed before it - which makes a cycle unsatisfiable rather than merely unsupported.
```

There is no clever ordering that makes that work. If two modules need each other, they are one module, or the
shared part is a third one below both.

## The standard library is already a dependency

`echoc` adds `stdlib` as the first root of every build, so it is always parsed before anything of yours. This
means writing `#[depends: "stdlib"]` is wrong rather than redundant: it would name a path that is not there.

`--no-stdlib` takes it away, which is legitimate and occasionally useful, and leaves you a language with no
`string` and no `array<T>`.

## Artifacts go in `ecobuild`, beside the manifest

Build once and each module grows a directory next to its own `module.eco`:

```bash
echoc build -o plot
```

```
geometry/
  module.eco
  src/point.eco
  ecobuild/
    CACHEDIR.TAG
    geometry-9fdb0fe299babc6b.o
plotter/
  module.eco
  src/main.eco
  ecobuild/
  plot
```

One directory per module, holding its object, the record of what went into it, and the scratch a build cannot
keep. The only thing left beside your binary is the binary, which is why `ecobuild/` is the one line an
`.gitignore` needs.

Move it with `#[build_dir: "target"]` in the manifest, or override every module at once from the command line:

```bash
echoc build -o plot --build-dir /tmp/echo-artifacts
```

`--build-dir` outranks the manifest, and takes the module's name as a subdirectory under the root you give it.
A manifest describes the project's layout, an invocation describes this machine, and when they disagree the
machine wins.

## `echoc` will not write where you keep your sources

`echoc clean` empties build directories, so "which directory is a build directory" has to be a question with a
trustworthy answer. Two rules give it one.

A directory **you** named has to be one echoc created. It writes a `CACHEDIR.TAG` marker on first use and
refuses anything that already holds something without one:

```
[error] Build Directory In Use

  '../mine/a' already holds something, and echoc did not put it there - it carries no 'CACHEDIR.TAG' marker. A build directory is emptied by 'echoc clean', so nothing was written into it.

  Module 'a' takes its name as a subdirectory of '--build-dir', so give one that has nothing of yours under that name.
```

And a `#[build_dir:]` that names its own manifest's directory, or an ancestor of one, is refused where the
line number still is:

```
module.eco:3: 'build_dir' names '/home/you/plotter', which holds this module's own sources - a build directory has to be somewhere the compiler may empty.
```

Caught at the manifest, rather than when a later `echoc clean` would have emptied your `src/`.

## The cache keys on your sources, never on your consumers

`echoc build` stores each module's object and serves it back for as long as nothing it depends on changed.
`--explain cache` says which:

```bash
echoc build -o plot --explain cache
```

```
[cache]
  stdlib  d21d393519efdfb4  hit
  geometry  9fdb0fe299babc6b  hit
  plotter  fa441a8c55ba7596  miss  (the program itself is never cached)
```

Touch a file in `geometry` and it tells you which one:

```
[cache]
  stdlib  d21d393519efdfb4  hit
  geometry  90fe1c1acc72bfa6  miss  ('point.eco' changed)
  plotter  496a3a541ce2d7aa  miss  (the program itself is never cached)
```

The program itself is never stored, because its unit is where the C `main` is created. Everything below it is.

The invariant that makes this sound is worth stating plainly: **a module's object is a function of its own
sources and its dependencies' keys, and never of who is using it.** A library built beside two different
applications produces the same bytes both times. If that were not true the cache would be unsound rather than
merely unhelpful, and a stale object would be a wrong program instead of a slow build.

Two things it does not do. `echoc run` has no object cache at all, so every run recompiles everything:

```
[cache]
  bypassed: an optimized or dumped build is whole-program, so no module object is reusable
```

And `--optimize whole` bypasses it for the same reason, because after the merge there are no per-module
objects left to store. That is the trade in [the CLI page](/projects/cli): cross-module inlining, or a fast
rebuild.

## `echoc clean`, and `-n` first

```bash
echoc clean -n
```

```
[clean]
  stdlib    /Users/you/.cache/echo/stdlib          kept (pass --with-stdlib to remove it)
  geometry  /home/you/demo/geometry/ecobuild       would remove
  plotter   /home/you/demo/plotter/ecobuild        would remove
```

`-n` prints and removes nothing. Drop it and the rows read `removed`, followed by a count.

`clean` parses no source and runs no pass, which is deliberate: which build directories exist follows from the
manifests and from the flags that say where artifacts go, and reading a single `.eco` to work that out would
make `clean` fail on exactly the program you most want to clean, the one that does not compile. So it takes
the flags that *locate* a build (`-m`, `--build-dir`, `--target-os`) and refuses every flag that *describes*
one.

The standard library's store is shared by every project on the machine, so it is listed and kept unless you
ask for it by name with `--with-stdlib`.

## Next

- [The echoc CLI](/projects/cli) for `-m`, `--build-dir`, and the rest of what a build takes.
- [Linking](/projects/linking) for `#[link:]`, and how a requirement travels to a consumer.
- [C interop](/projects/c-interop) for `#[cc:]`, and shipping C sources inside a module.
