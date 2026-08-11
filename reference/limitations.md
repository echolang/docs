# What is missing

Echo is a personal project and it is far from production ready. This page is the honest list of what does not
exist, what is broken, and what will bite you.

I would much rather you read this and decide Echo is not for you today than discover the same thing six hours
into a project. Everything here is known. Most of it is being worked on. None of it is hidden.

Two things this page is not: it is not a roadmap with dates, and it is not exhaustive at the level of
individual compiler bugs. It is the set of holes big enough to change what you would build.

## Language features that do not exist

**Named arguments.** Arguments are positional, full stop. `describe(value: 1)` does not parse. Old design
notes describe this feature as if it exists; they are aspirational.

**Default parameter values.** `function f(int32 $a, int32 $b = 2)` parses and then discards the default. The
signature stays `f(int32, int32)` and calling `f(1)` is a "no matching overload" error. Do not use it. It
looking like it works is worse than it not parsing, and that is a bug in its own right.

**Variadic functions.** There is no `...`. This is the one that blocks the most: no `printf`, no string
formatting, and no way to declare C variadics in an `extern` block.

**Multiple return values.** Documented in old notes, not implemented. Return a struct.

**Enums.** `enum` is a lexer keyword with nothing behind it. There is no implementation and no test coverage.

**Fixed-size arrays.** `FixedArray<T, N>` is a design rather than a feature. Type parameters are types, and
`N` is a value, so there is currently no way to spell it.

**Map literals.** `["LHR" => "Heathrow"]` does not parse. Construct the map and fill it.

**A `use` / import statement.** Names from other namespaces are reached by qualifying them in full:
`std::math::sqrt`, `geometry::Point`. There is no way to shorten that.

**Exceptions.** No `throw`, no `try`, no `catch`, and no richer error type either. You get `T?` for
recoverable failure, `assert` for "this should never happen", and `die` for "no recovering from this".

**`private` on methods.** `private` landed for properties only. On a method it does not parse. There is also
no visibility control across namespaces.

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

**Narrowing between variables is silent.** The literal check does not apply once a value is in a variable:

```echo
int64 $big = 5000000000;
int32 $small = $big;
echo $small;            // 705032704
```

**A narrow unsigned value beside a literal is treated as signed.** This one is nasty:

```echo
uint32 $u = 4294967280;
echo $u / 2;            // -8
echo $u > 2;            // 0
```

**An untyped literal argument can bind a type parameter and truncate.** Passing `0` alongside a `usize`
binds `T = int32`. That is why a `foreach (0 .. $arr->count() as $i)` gives you an `int32` index rather than
a `usize` one.

**An integer literal at a `bool` destination is silently false.** `bool $b = 1;` gives you `false`.

**`++` and `--` evaluate their target twice.** `$arr[0]++` runs the element operator twice, and on a
call-rooted target the increment is silently lost.

**An array literal in a field-wise constructor loses its elements.** `Bag([7, 9])` and then reading it back
is a use-after-destruction at every optimization level, with no diagnostic.

**Element append skips the literal precision check.** `$ints[] = 2.5;` stores `2` and says nothing.

**An uninitialised class declaration escapes the null rule.** `Node $n;` compiles and hands you a null handle
through a non-nullable type.

**`string?` does not work.** Declaring a nullable string is rejected with a message about `->` not reaching
through it. Other nullable types (`int32?`, `Point?`, class handles, `string::view?`) are fine.

## Things that crash the compiler

A crash is at least loud. These are the ones I know about:

- `echo nothing();` where the function returns `void` segfaults.
- `return;` at file scope, including from inside a `guard ... else`.
- `$r = &f();`, taking the address of a call result.
- A typo'd namespaced generic call in a constructor argument.
- `foreach ($arr->iterate() as $x)`, passing an explicit cursor.
- Binary literals (`0b1010`) fall off the end of the parser.

## Correct code that is rejected

**A method call on a `&` or `const &` loop binding.** This is the one most likely to catch you, because a
read-only borrow loop is the obvious thing to write:

```echo
foreach ($items as const &$item) {
    $item->trace();     // does not compile
}
```

Binding by value works, and direct field access on the borrow works. Only the method call fails.

**An optional chain cannot start a statement.** `$maybe?->save();` does not parse. `?->` only works inside a
larger expression, so `echo $maybe?->name ?? "";` is fine.

**A const array from a literal.** `const $c = [1, 2];` is refused. Other routes to a const array work.

**A struct with a private owning property.** If a `struct` has a `private` property that needs destruction,
it cannot be constructed at all. Classes are unaffected.

**`size_of` and `align_of` in a `const if`.** Layout queries cannot decide a compile-time branch, which is
what blocks small-buffer optimisation.

**`mv` on a field or element.** `$x = mv $doc->body;` is refused. `mv` moves a whole variable only.

**`#[implicit]` on a method of a generic type.** Refused at the declaration.

## Standard library

**No string formatting, at all.** No `printf`, no `sprintf`, no interpolation, no `str::fmt`. Building a
string means `append`. This needs variadics.

**No `print`.** `echo` is the only output mechanism, it takes exactly one value, and it appends a newline.

**`echo` cannot print a struct or class.** That is a located error, not a fallback. Use `dprint($value)` for
debugging, which prints the type and every property.

**No file I/O.** There is no `std::io`. You can reach `fopen` and friends through an `extern` block.

**`map<K, V>` uses linear probing.** It is correct and it is not fast. A better table is planned.

**`std::math::abs<T>`'s generic body is dead for floats**, and `clamp` exists only for `float32` and
`float64`, with no integer widths.

## Tooling

**No language server.** No autocomplete, no inline diagnostics, no go-to-definition. `echoc build
--diagnostics=json` emits JSON Lines on stderr and is stable, so the hook for building one exists. Nothing
consumes it yet.

**No syntax highlighting package.** Set your editor to treat `.eco` as PHP; it gets most of it.

**No package manager.** A dependency is a path on disk:

```echo
#[depends: "../lib_geometry"]
```

A git dependency parses, validates, and is then refused, because nothing fetches a repository yet.

**No formatter, no test runner, no `echoc new`.** The CLI is three subcommands: `run`, `build`, `clean`.

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
