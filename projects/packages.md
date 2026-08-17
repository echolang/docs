# Packages

Sometimes a library is already on disk next to your project. That's `#[depends:]`, and
[Modules](/projects/modules) covers it.

Sometimes it isn't. You want libcurl, it lives in a git repo, and you'd rather not clone it by
hand. That's `#[requires:]`. **epm** is the tool that puts the sources in `vendor/`. After
`epm install` you run `echoc` the way you always did. epm never wraps the compiler.

<!-- verify: skip -->
```echo
#[module: "myapp"]
#[version: "0.3.1"]
#[epm::license: "MIT"]
#[epm::description: "a thing that does a thing"]

#[depends: "../scratch-lib"]
#[requires: "echolang/libcurl" { git: "https://github.com/echolang/libcurl", version: "^0.1" }]

#[sources: "src/*.eco"]
```

The compiler reads the **name** and nothing else. It looks in `vendor/<name>/`, and a slash in the
name is a directory. Version, git URL and rev are recorded for epm and for the build fingerprint,
then ignored by the compiler itself. epm reads both halves. One line, two readers, no fact declared
twice.

## Three files, three jobs

The split is on purpose. You write what you want. epm writes what that resolved to. The compiler only
ever sees a directory.

| file | says | owner | committed |
|---|---|---|---|
| `module.eco` | what I require: `libcurl`, `^0.1` | you, by hand | yes |
| `epm.lock.json` | what that resolved to: 0.1.3, a git rev, a sha256 | epm | yes |
| `vendor/` | the fetched sources, flat siblings | epm | no |

`vendor/` is a fixed relative location, so there is no resolution table to write or keep in sync.
`echoc build` works after `epm install`.

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

`../escape`, `foo/../bar` and `foo//bar` are refused, because those would leave `vendor/` or name a
directory that is not a package. A slash that only nests under `vendor/` is the prefix.

A missing package is a located error that names the command:

```
module.eco:7: the package "libcurl" is not in 'vendor/'.
       note: run `epm install`
```

## What epm writes, and what it does not

epm reads a manifest through `echoc -p manifest`, so the grammar has one implementation. The lock is
JSON. epm never writes Echo attribute syntax, except for the one line `epm add` inserts and `epm
remove` deletes.

```bash
echoc build -p manifest -m module.eco
```

That's an answer, not a dump. It does not resolve the graph, so it works before anything is
vendored. Combined with another `-p` value it is refused.

License, description, repository, a private registry, anything a future tool invents: those are
`#[epm::...]`. The compiler does not own those names and does not grow a keyword when epm grows a
field.

<!-- verify: skip -->
```echo
#[epm::license: "MIT"]
#[epm::repository: "github.com/me/myapp"]
#[epm::registry: "https://github.com/echolang/epm-index"]
```

`#[license: "MIT"]` with no namespace is an unknown manifest attribute. That's the point.

## A path dependency is unchanged

Splitting a large app into local `#[depends:]` modules still works exactly as it did. A vendored
package is just another local module, ordered before the app, so its object caches like the
stdlib's. Editing your own code does not rebuild libcurl.

`#[depends: git { url:, rev: }]` is the spelling that was refused before `#[requires:]` existed. It's
still refused, and the message now points here.

## Two versions of one package

Module names are unique in a build. Two manifests declaring `libjson` is already an error, so two
versions of one package cannot sit side by side. There is no mangling escape hatch.

Semver ranges that cannot agree on one version are therefore a routine outcome. Who asked for what,
and what would unblock it, is epm's job, not the compiler's.

See [the list](/reference/limitations) for what is still missing: a registry in v1, workspaces, two
versions living side by side.
