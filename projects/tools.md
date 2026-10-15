---
description: 'A dependency can ship a program you run. epm run invokes it. A hook runs it before every build.'
---

# Tools and hooks

A library is usually code you call. Sometimes it's also a program you run: a generator that turns an OpenAPI
spec into Echo, a formatter, a migration tool. npm calls those `bin`s. In Echo they're **tools**, and a
dependency's tool can be run two ways:

- by hand, with `epm run <tool>`
- before every build, with a `#[hook:]` in your manifest

Both rest on one rule, the same one [targets](/projects/modules#more-than-one-program) already follow:
**a dependency's programs are its own.** Your `echoc run` never compiles a dependency's targets. A tool is
the exception you ask for by name, and only if the dependency offered it.

## Offering a tool

A tool is an ordinary `exe` target with `public: true`:

<!-- verify: skip -->
```echo
#[module: "resttransformer"]
#[sources: "src/runtime/*.eco"]

#[target: exe { name: "restgen", entry: "cli/main.eco", public: true }] {
    #[sources: "cli/*.eco"]
    #[requires: "echolang/libcommand" { version: "^0.2", source: git "https://github.com/echolang/libcommand" }]
}

#[target: test] {
    #[sources: "tests/*.eco"]
}
```

`public` is an `exe` field. A `lib` has nothing to run and a `test` produces nothing, so they stay private:
that's why every library's `tests` target can't collide with every other library's.

Put the CLI inside the target's scope. Consumers compile `src/runtime/*.eco` and nothing else. The argument
parsing, the extra `#[requires:]`, the `main`: none of that is compiled or linked into their program.

## Running one by hand

From a project that depends on `resttransformer`:

```bash
epm run restgen api/petstore.yaml src/api
```

epm asks echoc which tool that name means, builds it if it has to, and runs it in your working directory.
Everything after the name goes to the tool, flags included, so `epm run restgen --help` is restgen's help.
epm's own flags, like `-m`, go before the name. `epm run` with no name lists what's on offer.

A bare name works when exactly one of your **direct** dependencies offers a tool by that name. When two do,
write `<module>:<tool>`:

```bash
epm run resttransformer:restgen
```

A tool two levels down is that dependency's business.

An unchanged tool isn't rebuilt. `epm run` is `echoc build -m vendor/resttransformer --target restgen`, and
that build [skips when nothing moved](#it-isnt-rebuilt-every-time). `epm update` then the next `epm run`
rebuilds, because the sources changed.

## Running one before every build

Generated code goes stale the moment somebody edits the spec. A hook is `echoc run` running the
generator first:

<!-- verify: skip -->
```echo
#[module: "petshop"]
#[sources: "src/**/*.eco"]

#[hook: before_build { run: "restgen", args: ["api/petstore.yaml", "src/api"] }] {
    #[requires: "resttransformer" { version: "^0.3", source: git "https://github.com/me/resttransformer" }]
}
```

`echoc run`, `build`, `test` and `install` all run that command **before** they expand `#[sources:]`, so a
fresh clone with an empty `src/api/` still matches the pattern. `before_build` is the only moment today.

### A dependency only the tool needs

The `{ ... }` after a hook holds `#[requires:]` and `#[depends:]` and nothing else. Those are vendored and
built with the tool, and compiled into nothing you ship.

If the program also uses the library at runtime, a top-level `#[requires:]` is enough. The hook finds the
tool through that one too.

### The tool decides what is stale

echoc does not know what a generator is. It runs the tool on every build, and the tool decides whether to
write. Compare before writing, and keep state in the directory echoc gives you:

| | |
|---|---|
| working directory | the module's directory, so relative `args` mean what they say |
| `ECHO_MODULE_DIR` | the same, absolute |
| `ECHO_HOOK_STATE` | a directory that is the hook's own, under `ecobuild/hooks/<name>/`. `echoc clean` empties it |
| `ECHO_TARGET_OS`, `ECHO_TARGET_ARCH` | what the *program* is being built for |
| `ECHO_MODE` | `debug` or `release` |
| `ECHO_COMMAND` | `run`, `build`, `test` or `install` |
| `ECHOC` | the echoc doing the build, if your tool wants to call back into it |

A hook is named after its tool. Two hooks running the same tool need a `name:` each, since the name is
their directory:

<!-- verify: skip -->
```echo
#[hook: before_build { run: "restgen", name: "public_api", args: ["api/public.yaml", "src/public"] }]
#[hook: before_build { run: "restgen", name: "admin_api", args: ["api/admin.yaml", "src/admin"] }]
```

Hooks run in written order. The first non-zero exit stops the build, at its own line:

```
[error] HookFailed  module.eco:4:1

  hook 'restgen' failed: 'restgen' exited with 2.
```

### Commit what it generates

Generated code lives in your source tree and goes into git. You see it in review, the editor can navigate
it, and `--no-hooks` still compiles a program.

### Only the root runs hooks

When `petshop` is the project you're building, its hooks run. When it is a library somebody else depends
on, they don't. A library that generates its own code commits the result; consumers compile what was
published.

```bash
echoc build --no-hooks
```

Builds whatever is on disk. echoc also passes `--no-hooks` when it builds the tool itself, so the
tool's own hooks don't run.

## It isn't rebuilt every time

A hook runs before every `echoc run`, so it had better be cheap when there's nothing to do. The tool can
no-op, as above. Building the tool itself is free when nothing changed: echoc stamps each binary, and an
unchanged `echoc build` does no front end, no codegen, no link.

```bash
echoc build --explain cache
```

```
[cache]
  app  up to date  (nothing it is built from changed)
```

Delete the binary, edit a source, or ask for a `-p` dump, and it does the work. Same skip for every
`echoc build` and `echoc install`, not only hooks. [The cache](/projects/modules#the-cache-keys-on-your-sources-never-on-your-consumers)
is the rest.

## The catches

**A hook's output goes to stderr.** All of it, including the tool's stdout. `echoc run > out.txt` is your
program's output. Under `--diagnostics=json` the tool's output is captured, and shows up inside the
diagnostic if the hook fails.

**A tool is built for the machine you're on.** `echoc build --target-os wasi` builds your program for WASI
and the hook's tool for your laptop.

**The editor doesn't run hooks.** The language server compiles what's on disk. Build once, and it sees what
the hook wrote.

**`clean`, `-p manifest` and `-p tools` run nothing.** Asking what a project is never builds or runs a
tool.

## Next

- [Modules](/projects/modules), for targets and their scopes.
- [Packages](/projects/packages), for `#[requires:]` and `epm`.
- [The echoc CLI](/projects/cli), for `--no-hooks`, `-p tools` and `--explain cache`.
