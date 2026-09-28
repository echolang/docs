---
description: 'The honest list. Holes in the type system, a tiny stdlib, bugs. Echo is a hobby.'
---

# What is missing

Echo is a personal project and it is far from production ready. This page is the honest list of what does not
exist, what is broken, and what will bite you.

I'd much rather you read this and decide Echo is not for you today than discover the same thing six hours
into a project. Everything here is known. Most of it is being worked on. None of it is hidden.

Two things this page is not: it is not a roadmap with dates, and it is not exhaustive at the level of
individual compiler bugs. It is the set of holes big enough to change what you would build.

## Language features that do not exist

**Variadic functions.** There is no `...`, and there is deliberately not going to be one: overload
resolution matches arity exactly, and that is what lets a call with one surviving candidate resolve without
consulting types at all.

The two things you would reach for it are covered elsewhere. String formatting is
[interpolation](/collections/strings#interpolation), where every hole is a *one-argument* call. A C variadic
function is reachable through [`variadic_args`](/projects/c-interop#calling-a-c-variadic-function), which
spells the tail as the last parameter's type and takes a written list at the call site, so the call still
has exactly the declared arity.

**Multiple return values.** Documented in old notes, not implemented. Return a struct.

**A `match` over a call result cannot hand back a place.** `match` yields a borrow when every arm does, which
is what lets [`result<T, E>::unwrap()`](/stdlib/result) return a `T&`. It only works when the subject is
something the program already stores: `match ($this)` yes, `match (compute())` no, because the borrow would
point into a value the `match` itself owns and drops. Bind the call to a variable first.

**A call is not an assignment destination.** `$r->unwrap() = 99;` does not parse, even though `unwrap()`
returns a `T&`. Reading through the borrow and calling a method through it both work.

**Map literals.** `["LHR" => "Heathrow"]` does not parse. Construct the map and fill it.

**Exceptions.** No `throw`, no `try`, no `catch`. Recoverable failure is a `T?`, or a
[`result<T, E>`](/stdlib/result) when you need a reason. `assert` for "this should never happen", `die`
for "no recovering from this".

**Visibility has two holes.** Assigning a whole struct copies a `const` property, because the target's own
type is not const, so the field is write-once only through its own name. And a generic body is exempt from
the module rung (it has to be, or `map<K, V>` could not call your `hash::of`), so a call routed through a
generic can reach another module's internals. See [Visibility](/language/visibility).

## Things that compile and are wrong

These are the dangerous ones, because there is no diagnostic. Read this section even if you skip the rest.

**A function can fall off the end without returning.** No error, no warning. It returns whatever was in the
register.

```echo
function bad() : int32
{
    echo 1;
}   // compiles, returns garbage
```

**Narrowing between variables is silent.** `$x as T` exists for the sites that have no destination, but
an assignment still converts without it. The literal check does not apply once a value is in a variable:

```echo
int64 $big = 5000000000;
int32 $small = $big;
echo $small;            // 705032704
```

**`++` and `--` evaluate their target twice.** `$arr[0]++` runs the element operator twice, and on a
call-rooted target the increment is silently lost.

**An array literal in a field-wise constructor loses its elements.** `Bag([7, 9])` and then reading it back
is a use-after-destruction at every optimization level, with no diagnostic.

**An uninitialised class declaration escapes the null rule.** `Node $n;` compiles and hands you a null handle
through a non-nullable type.

## Things that crash the compiler

A crash is at least loud. These are the ones I know about:

- `$r = &f();`, taking the address of a call result.
- A typo'd namespaced generic call in a constructor argument.
- `foreach ($arr->iterate() as $x)`, passing an explicit cursor.
- `==` between two nullable [C function pointers](/projects/c-interop), which is what you reach for on the
  value `crash::set_hook` hands back. `guard` it instead. See [Crash reports](/stdlib/crash).

## Correct code that is rejected

**`mem::size` and `mem::align` in a `const if`.** Layout queries cannot decide a compile-time branch, which is
what blocks small-buffer optimisation.

**`mv` on a field or element.** `$x = mv $doc->body;` is refused. `mv` moves a whole variable only. Writing
one *into* a field is fine. It is only moving one out that has no spelling.

**A borrow-returning call kept past its statement.** `$r->header('a: 1')->header('b: 2');` chains fine:
the statement throws its value away, so nothing can dangle. But `Request& $held = $r->header('a: 1');` is
refused whenever an argument needed a temporary slot, because Echo has no way to say whether the returned
borrow points into the receiver or into that argument. Bind the argument to a variable first.

**`#[implicit]` on a method of a generic type.** Refused at the declaration. Reaching a conversion *through*
a `const T&` works.

**A binary `-` written without spaces.** `-` glues to a following digit, so `1-2` is two integer literals in
a row and you get `unexpected '-2' - two expressions with no operator between them.` `1 - 2` is fine. Same
lexer rule that makes `-3` a literal rather than a negation, so it is a trade rather than an oversight, but
the diagnostic gives you no hint that spacing is the answer.

## Standard library

**`echo` takes exactly one value and appends a newline**, and it is staying that way. It is the only
output a program has with `--no-stdlib`, where there is no `string` type at all. Use
[interpolation](/collections/strings#interpolation) to put several values in one, and
[Input and Output](/stdlib/io/) when you need a destination, no newline, or a function you can pass.

**`echo` cannot print a struct or class.** That is a located error, not a fallback. Use `dprint($value)` for
debugging, which prints the type and every property, or declare `str::from` for your type, after which
`"{$value}"` works.

**Formatting is `str::from` and interpolation, not `printf`.** The spec grammar is deliberately small:
alignment, width, precision and a type letter. No thousands separators, no locale, no `%n$` positional
arguments, and no runtime format string, since a spec is written inside a literal and read at compile time.

**Building one string out of many is O(n^2).** Interpolation lowers to a fold of `str::concat`, so every hole
is another allocation. Fine for a sentence, wrong for a loop, and nothing warns you which one you wrote.
`string::append` into one buffer is the tool until there is a proper builder.

**No path type, no recursive walk, no `mkdir_p`.** [Files](/stdlib/io/files) opens, reads and writes
files. [Directories](/stdlib/io/directories) lists one directory, and `mkdir` / `rmdir` make and
remove one. Paths are `string`s. `std::env::DS` is the separator; `std::env::join` puts two
components together with it; `std::env::file_url` turns a native path into a `file://` URL. There is
no `stat`, no `mkdir_p`, and nothing that walks a tree.

**`std::io::readline()` on stdin is still unbuffered.** One `read` per byte, so it cannot steal input from
anything else on fd 0. Wrap stdin in a [`reader`](/stdlib/io/buffering) when you want the window, stdout in a
`writer` when you want the write window. A [`std::io::file`](/stdlib/io/files) is buffered already.

**`map<K, V>` uses linear probing.** It is correct and it is not fast. A better table is planned.

**`std::math::abs<T>`'s generic body is dead for floats**, and `clamp` exists only for `float32` and
`float64`, with no integer widths.

## Tooling

**No completion, and hover in a generic body is the template's types.** `echoc lsp` speaks LSP over stdio:
diagnostics, hover, go-to-definition, document symbols, find-references, workspace symbols and signature
help. Completion is out of v1. Instantiated generic bodies are not indexed, so a hover inside `id<T>`
shows `T` rather than the binding a particular call used. `test` blocks are dropped before they are
parsed, the same as every command that is not `echoc test`.

**The VS Code extension is the first client.** [echolang-vscode](https://github.com/echolang/echolang-vscode)
still owns the TextMate grammar, and now starts `echoc lsp` when it can find the binary. Other editors
that speak LSP over stdio can point at the same command. There is no completion, and nothing packaged for
an editor that is not an LSP client.

**No registry yet, and two versions of one package cannot coexist.** `#[requires:]` resolves a name
against `vendor/`. epm is what fetches. There is no published index in v1, so every requirement
still writes `source: git "..."`. The tag is the host; a registry is another tag, not a new field.
Module names are unique in a build, so two versions of `libjson` in one program is an error rather
than a feature. [Packages](/projects/packages) is the chapter.

**No formatter and no `echoc new`.** The CLI is five subcommands: `run`, `build`, `test`, `clean`, `lsp`.

**The test runner has three gaps.** There is no timeout, so a test that hangs hangs the
run. There is no standalone test binary, so running a suite needs `echoc` rather than an artifact you can
ship to CI on its own. And a test is not run under `--track-allocations` by default, so a leak inside one
does not fail it. [Testing](/projects/testing) is the chapter.

**`#[version:]` is recorded and resolves against nothing.** It is part of the build fingerprint and that is
all it does.

**`echoc run` has no object cache.** Every `run` recompiles everything from scratch. `build` does cache
module objects. If a project feels slow to iterate on, that is why, and `build` is the workaround.

**Debugger support is partial.** `echoc build -g` produces DWARF, and `tools/echo_lldb.py` renders the
standard library's containers. A `mem::buffer<T>` shows a capacity and no elements, a `weak<T>` shows the
block rather than the object, and an interface value shows two raw pointers. Those three have no formatter.
`-g` is also build-only; `run` accepts the flag and tells you it cannot honour it.

## Platforms

A release is three hosts, and the install scripts only know those three:

- macOS on Apple Silicon, `echo-macos-arm64`
- Linux on x86_64, `echo-linux-x86_64`
- Windows on x86_64, `echo-windows-x86_64` (a zip, and `echo-windows-x86_64-setup.exe`)

The test suite runs on Linux and on Windows. The Mac archive is built and smoke-tested on Apple Silicon.
[Installation](/guide/installation) is the command for each.

**No Intel Mac, no Linux on ARM, no Windows on ARM.** The script stops and tells you to build from
source. It does not pick a neighbour and hope.

iOS is not a fourth download. A Mac cross-compiles to it with `echoc build --target-os ios`. Android
is a `#[if:]` fact, and there is no Android sysroot.

The Windows archive is a toolchain. clang, lld-link and a sysroot sit next to `echoc`, and
`echoc build` links with them. CI runs the suite there.

Related, on linking: there is still no pkg-config. A library whose flags come out of
`pkg-config --libs` is written by hand. Static versus dynamic is
`#[link: lib { name: "foo", linkage: static }]`. [Linking](/projects/linking) has the record.

## Concurrency

[Threads](/stdlib/thread) exist. `std::thread::spawn` starts an OS thread, a `handle` joins it, a
`mutex<T>` sleeps, a `task<T>` brings a value back. That is the whole of it, and this is what it is
not:

**No async, no `future`, no `select`.** A value comes back through a `mutex`, a `task<T>`, or a
[`channel`](/stdlib/thread#a-stream-of-values-is-a-channel). There is no type named `future` and no
function named `async`. Waiting on several channels at once is not a type.

**No `rwlock`.** `once` re-entry on the same object still waits for itself.

**No `thread_local`.** A static's initializer is thread-safe (the first caller runs it, everyone
else waits), but there is no per-thread global.

**No memory-ordering parameter.** [`atomic<T>`](/memory/atomics) is sequentially consistent. An
ordering is a claim about two accesses and nothing in the language can check it.

**Unmarked class counts are still a load, an add and a store.** Sharing one of those handles
across threads is a data race. [`#[atomic]`](/memory/atomics) is the opt-in, and it covers the
count, not the fields. There is no race detector. Echo will not stop you.

## Found something not on this list?

Open an issue at [github.com/echolang/echo](https://github.com/echolang/echo). Compiler crashes and silently
wrong output are the most useful things to report, in that order.
