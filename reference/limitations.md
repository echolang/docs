# What is missing

Echo is a personal project and it is far from production ready. This page is the honest list of what does not
exist, what is broken, and what will bite you.

I'd much rather you read this and decide Echo is not for you today than discover the same thing six hours
into a project. Everything here is known. Most of it is being worked on. None of it is hidden.

Two things this page is not: it is not a roadmap with dates, and it is not exhaustive at the level of
individual compiler bugs. It is the set of holes big enough to change what you would build.

## Language features that do not exist

**Named arguments.** Arguments are positional, full stop. `describe(value: 1)` does not parse. Some older
writing describes this feature as if it exists. It does not.

**Default parameter values.** `function f(int32 $a, int32 $b = 2)` parses and then discards the default. The
signature stays `f(int32, int32)` and calling `f(1)` is a "no matching overload" error. Do not use it. It
looking like it works is worse than it not parsing, and that is a bug in its own right.

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

**Fixed-size arrays.** `FixedArray<T, N>` is a design rather than a feature. Type parameters are types, and
`N` is a value, so there is currently no way to spell it.

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

- `echo nothing();` where the function returns `void` segfaults.
- `return;` at file scope, including from inside a `guard ... else`.
- `$r = &f();`, taking the address of a call result.
- A typo'd namespaced generic call in a constructor argument.
- `foreach ($arr->iterate() as $x)`, passing an explicit cursor.
- `void $x;` hangs the compiler. Nothing refuses a `void` variable, and laying one out never finishes.

## Correct code that is rejected

**A method call on a `&` or `const &` loop binding.** This is the one most likely to catch you, because a
read-only borrow loop is the obvious thing to write:

```echo
struct Item
{
    int32 $id;

    const function trace() : void
    {
        echo $this->id;
    }
}

array<Item> $items = [Item(1), Item(2)];

foreach ($items as const &$item) {
    $item->trace();     // error: cannot implicitly convert 'const Item&&' to 'const Item&'
}
```

Binding by value works, and direct field access on the borrow works. Only the method call fails.

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

**No path type, and no directory listing.** [Files](/stdlib/io/files) opens, reads and writes files. Paths
are `string`s. There is no `mkdir`, no `stat`, and nothing that lists a directory.

**`std::io::readline()` on stdin is still unbuffered.** One `read` per byte, so it cannot steal input from
anything else on fd 0. Wrap stdin in a [`reader`](/stdlib/io/buffering) when you want the window, stdout in a
`writer` when you want the write window. A [`std::io::file`](/stdlib/io/files) is buffered already.

**`map<K, V>` uses linear probing.** It is correct and it is not fast. A better table is planned.

**`std::math::abs<T>`'s generic body is dead for floats**, and `clamp` exists only for `float32` and
`float64`, with no integer widths.

## Tooling

**No language server.** No autocomplete, no inline diagnostics, no go-to-definition. `echoc build
--diagnostics=json` emits JSON Lines on stderr and is stable, so the hook for building one exists. Nothing
consumes it yet.

**No language support beyond highlighting.** There is an official VS Code extension in
[echolang-vscode](https://github.com/echolang/echolang-vscode), and its grammar is derived from the
compiler's own token list, so `mv`, `guard`, `:$`, the attributes and the `#[if:]` directives all colour as
themselves. That is where it stops. No completion, no diagnostics, no go-to-definition, and nothing for any
other editor.

**No registry yet, and two versions of one package cannot coexist.** `#[requires:]` resolves a name
against `vendor/`. epm is what fetches. There is no published index in v1, so every requirement
still writes a `git:` URL. Module names are unique in a build, so two versions of `libjson` in one
program is an error rather than a feature. [Packages](/projects/packages) is the chapter.

**No formatter and no `echoc new`.** The CLI is four subcommands: `run`, `build`, `test`, `clean`.

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

Prebuilt binaries exist for exactly two platforms:

- macOS on Apple Silicon
- Linux on x86_64

**No Windows, no Intel Mac, no Linux on ARM.** Building from source works on more than that, but Windows in
particular has never been run: the linker flags render and nothing has ever executed them.

Related, on linking: there is no pkg-config integration and no way to choose static versus dynamic linkage
for a dependency.

## Concurrency

There is none. No threads, no async, no channels.

Reference counts are not atomic, which is correct today precisely because there is no way to make a second
thread. Any concurrency story has to deal with that first.

## Found something not on this list?

Open an issue at [github.com/echolang/echo](https://github.com/echolang/echo). Compiler crashes and silently
wrong output are the most useful things to report, in that order.
