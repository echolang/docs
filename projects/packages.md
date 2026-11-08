# Packages

Sometimes a library is already on disk next to your project. That's `#[depends:]`, and
[Modules](/projects/modules) covers it.

Sometimes it isn't. You want libcurl, it lives in a git repo, and you'd rather not clone it by
hand. That's `#[requires:]`. **epm** is the tool that puts the sources in `vendor/`. After
`epm install` you run `echoc` the way you always did. epm never wraps the compiler, and it never compiles
anything: when it runs a dependency's tool, echoc does the building. A released
`epm` arrives next to `echoc` from the [install one-liner](/guide/installation).

<!-- verify: skip -->
```echo
#[module: "myapp"]
#[version: "0.3.1"]
#[epm::echoc: ">=0.14.0"]
#[epm::license: "MIT"]
#[epm::description: "a thing that does a thing"]

#[depends: "../scratch-lib"]
#[requires: "echolang/libcurl" { version: "^1", source: git "https://github.com/echolang/libcurl" }]

#[sources: "src/*.eco"]
```

The compiler reads the **name** and nothing else. It looks in `vendor/<name>/`, and a slash in the
name is a directory. Version, source and rev are recorded for epm and for the build fingerprint,
then ignored by the compiler itself. epm reads both halves. One line, two readers, no fact declared
twice. The source is a tagged locator (`git "..."`) so a later host is another tag, not a new field.

## Three files, three jobs

The split is on purpose. You write what you want. epm writes what that resolved to. The compiler only
ever sees a directory.

| file | says | owner | committed |
|---|---|---|---|
| `module.eco` | what I require: `libcurl`, `^1` | you, by hand | yes |
| `epm.lock.json` | what that resolved to: 1.0.0, a git rev, a sha256 | epm | yes |
| `vendor/` | the fetched sources, flat siblings | epm | no |

`vendor/` is a fixed relative location, so there is no resolution table to write or keep in sync.
`echoc build` works after `epm install`.

The sha256 covers the files exactly as they were committed. epm checks a package out with every git
conversion switched off, so line-ending settings like Windows' `core.autocrlf`, a package's own
`.gitattributes` and git-lfs never change a byte, and a lock written on one machine installs on all of them.

Drop a directory into `vendor/` yourself and the compiler is happy. That's the whole of manual
vendoring, and it works before epm exists.

## The name becomes a path

`#[requires: "libcurl"]` resolves to `<package dir>/libcurl`. A vendor prefix is the same rule with
a slash in the name: `#[requires: "echolang/libcurl"]` is `<package dir>/echolang/libcurl`. The
package directory is `vendor/` next to the project, found from the entry manifest.

`cd vendor/echolang/libcurl && echoc test` still works, because that walk treats a directory named
`vendor` as the answer. `--package-dir` overrides.

A requirement in a *vendored* module uses the **root** package directory, not its own. So
`vendor/echolang/libcurl/module.eco` writing `#[requires: "echolang/libjson"]` finds
`<root>/vendor/echolang/libjson`.

A `#[requires:]` on a path module is the same lookup. The compiler never reads a `vendor/` next to
the library. `epm install` at the program walks those path modules, treats their **library** git
requires (file-scope and `lib` scopes, plus a public exe of a module you named) as extra solve
roots, and vendors into the program's `vendor/`. A test-only `#[requires:]` of that path module
stays that module's. The path module itself stays where it is. You do not re-declare the library's
requires, and you do not run epm inside the library.

`../escape`, `foo/../bar` and `foo//bar` are refused, because those would leave `vendor/` or name a
directory that is not a package. A slash that only nests under `vendor/` is the prefix.

A missing package is a located error that names the command:

```
module.eco:7: the package "libcurl" is not in 'vendor/'.
       note: run `epm install`
```

## Only this target

A package your tests need, and your program does not, goes in the test target's `{ }`. Same
`#[requires:]`, same grammar. The braces are what make it this project's:

<!-- verify: skip -->
```echo
#[module: "libjson"]
#[sources: "src/*.eco"]

#[target: test] {
    #[sources: "tests/*.eco"]
    #[requires: "echolang/ecotest" { version: "^0.2", source: git "https://github.com/echolang/ecotest" }]
}
```

In libjson's repo, `epm install` fetches ecotest and `echoc test` compiles it. In an app that
requires libjson, ecotest is not fetched, not locked, not compiled. Neither are the packages
ecotest's own public exe needs. File-scope `#[requires:]` is what every consumer gets.

A public exe of a library *you* require is the other exception: those `#[requires:]` still land in
your `vendor/`, so `epm run carbongen` can build. [Tools and hooks](/projects/tools) is that
chapter.

## A package inside another package

Some repos hold more than one package: a library and its drivers, say. Name the inner one by its
directory, from the same source:

<!-- verify: skip -->
```echo
#[requires: "echopack/carbon" { version: "^0.1.3", source: git "https://github.com/echopack/carbon" }]
#[requires: "echopack/carbon/drivers/mysql" { version: "^0.1.3", source: git "https://github.com/echopack/carbon" }]
```

A name that extends another requirement's name by whole segments, with the same source, is that
directory of the checkout. epm clones the repo once. Both ranges apply to the same tags. The path
on disk is `vendor/echopack/carbon/drivers/mysql`.

Require the outer package beside it in the same `module.eco`. The lock keeps one entry for the repo
and lists the inner directories under it.

An inner package can `#[depends: "../.."]` on its own repo. A `#[depends:]` that climbs out of
`vendor/<name>` is refused: what sits beside it in your `vendor/` is not part of its release. Use a
`#[requires:]`.

## What epm writes

epm reads a manifest through `echoc -p manifest`, so the grammar has one implementation. The lock is
JSON. epm writes Echo attribute syntax in two places, and they are different jobs. `epm init` writes
a whole new `module.eco` into a directory that did not have one. `epm add` inserts one `#[requires:]`
line and `epm remove` deletes it. An existing manifest is otherwise left alone.

```bash
echoc build -p manifest -m module.eco
```

That's an answer, not a dump. It does not resolve the graph, so it works before anything is
vendored. Combined with another `-p` value it is refused.

License, description, repository, a private registry, the compiler the package needs, anything a
future tool invents: those are `#[epm::...]`. The compiler does not own those names and does not
grow a keyword when epm grows a field.

<!-- verify: skip -->
```echo
#[epm::echoc: ">=0.14.0"]
#[epm::license: "MIT"]
#[epm::repository: "github.com/me/myapp"]
#[epm::registry: "https://github.com/echolang/epm-index"]
```

`#[license: "MIT"]` with no namespace is an unknown manifest attribute. That's the point.

### The compiler it needs

`#[version:]` is the package. The `echoc` that can build it is a different fact. Write it as a
semver range, same grammar as `#[requires:]`:

<!-- verify: skip -->
```echo
#[epm::echoc: ">=0.14.0"]
```

`>=0.14.0` is a floor. `^0.14` is 0.14.x only. `echoc -p manifest` emits it under `tools`, next to
license and description.

Here is the catch. `echo` is a keyword, so `#[epm::echo:]` is refused (`expected identifier`). The
binary is `echoc`, and that is the name.

The compiler does not compare the range to itself. It carries the attribute. A tool that cares
reads it back.

## Running a package's tool

Sometimes a package is also a program you run: a generator, a formatter. Mark the exe `public: true`
and `epm run` is how you invoke it:

```bash
epm run restgen api/petstore.yaml src/api
```

`epm install` vendors what those tools need too, for the packages you require directly. A tool that runs
before every build is a `#[hook:]`. [Tools and hooks](/projects/tools) is the chapter.

## Path modules

Splitting a large app into local `#[depends:]` modules works. A vendored package is just another
local module, ordered before the app, so its object caches like the stdlib's. Editing your own
code does not rebuild libcurl.

`#[depends: git { url:, rev: }]` is refused. Fetching is `#[requires:]`.

## Two versions of one package

Module names are unique in a build. Two manifests declaring `libjson` is already an error, so two
versions of one package cannot sit side by side. There is no mangling escape hatch.

Semver ranges that cannot agree on one version are therefore a routine outcome. Who asked for what,
and what would unblock it, is epm's job, not the compiler's.

See [the list](/reference/limitations) for what is still missing: a registry in v1, workspaces, two
versions living side by side.
