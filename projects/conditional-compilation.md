# Conditional compilation

Sooner or later one file has to say two things, one per platform. Echo's answer is four attributes, and the
thing that makes them more useful than they look: **a region that does not apply is dropped from the token
stream before anything is parsed.** Not skipped by the compiler. Never seen by it.

```echo
#[if: os == darwin]
echo 'on a mac';
#[else]
echo 'somewhere else';
#[end]
```

That's the usual case. What "never parsed" buys you turns out to be quite a lot.

## Four directives

`#[if:]`, `#[elif:]`, `#[else]` and `#[end]`. Only the first two take a condition, and every region has to be
closed:

```echo
#[if: os == darwin]
echo 'darwin';
#[elif: os == linux]
echo 'linux';
#[elif: os == windows]
echo 'windows';
#[end]
```

Forget the `#[end]` and you hear about it straight away, because the filter is counting:

```
line 1: '#[if: ...]' is never closed - add '#[end]'
```

They nest, and a nested region inside an arm that was **not** taken still has to balance. That's not a rule
you have to remember, it's just what happens: the untaken arm is read structurally even though none of it is
compiled.

## A condition is not an Echo expression

It is its own small grammar, evaluated by the filter itself: `==`, `!=`, `&&`, `||`, `!`, and parentheses,
with `&&` binding tighter than `||`.

```echo
#[if: os == darwin || os == linux]
echo 'unixish';
#[end]

#[if: !(os == windows)]
echo 'still unixish';
#[end]
```

It has to be its own grammar, because `darwin` is a name nothing in Echo declares and never will. That's also
why a condition can't name one of your constants, even though `const MAX = 100` looks like exactly the sort
of thing it should be able to test. [Constants](/language/constants) explains the timing that makes that
impossible.

## A condition sees three things

**`os`**, one of `darwin`, `linux`, `windows`.

**`arch`**, one of `arm64`, `x86_64`.

**Your own flags**, declared on the command line with `--define`, and written bare:

```bash
echoc run --define TRACE app.eco
```

```echo
#[if: TRACE]
echo 'tracing';
#[else]
echo 'quiet';
#[end]
```

Bare names only. There is no `--define NAME=value`, because naming a value is what a constant declaration is
for and one way to do that beats two.

## An unknown value is an error, an undefined flag is not

These two rules point in opposite directions, and both of them have to.

An unknown value on a closed axis is refused:

```
line 1: unknown os 'darwn', expected one of: darwin, linux, windows
```

```
line 1: unknown condition axis 'platform', expected one of: os, arch
```

The alternative is a typo that reads as false, so `#[if: os == darwn]` becomes a block that vanishes in
silence and surfaces as a missing function three files later. I'd rather have the error.

A flag you never defined is **false**, not an error. That one has to go the other way: if an undefined flag
were refused, `#[if: TRACE]` could never take its else arm, which is the arm you spend most of your time in.

```echo
#[if: NEVER_DEFINED]
echo 'no';
#[else]
echo 'this one';
#[end]
```

## It works everywhere, because it is not a rule in the parser

The filter runs on tokens. No pass knows it exists, which is why there is no list of "places a condition is
allowed". File scope, inside a struct body, inside a function body, around an `extern` block, around a
`namespace`, inside a `module.eco`. All the same thing.

```echo
struct Config
{
    int32 $threads;

#[if: os == darwin]
    bool $use_metal;
#[end]
}

Config $c = Config(4, true);
echo $c->threads;
```

A manifest is Echo too, so the same directives gate a source list:

<!-- verify: skip -->
```echo
#[module: "renderer"]

#[if: os == darwin]
#[sources: "src/metal/*.eco"]
#[elif: os == linux]
#[sources: "src/vulkan/*.eco"]
#[end]
```

## The payoff: naming a symbol this platform does not have

This is the case that a runtime `if` can't cover and a smarter parser couldn't either.

There is no portable call for "where is this executable". Each platform has exactly one, none of them exists
anywhere else, and declaring the wrong one is a *link* error rather than a compile error. So the declaration
has to be **absent** on the platforms that lack it, not merely unused:

<!-- verify: skip -->
```echo
#[if: os == darwin]
extern {
    function _NSGetExecutablePath as c_exe_path(ptr<uint8> $buf, ptr<uint32> $size) : int32;
}
#[elif: os == linux]
extern {
    function readlink as c_readlink(ptr<const uint8> $path, ptr<uint8> $buf, usize $size) : int64;
}
#[end]
```

That's straight out of `stdlib/std/env/libc.eco`, and it is the one platform-specific binding in the whole
module. Note that the arms are the entire `extern { }` block, not just its contents. An `extern` block accepts
nothing but `function` declarations inside it and has no attribute plumbing at all, so there would be nowhere
to hang a per-declaration condition. A token filter doesn't care: the block is tokens like anything else.

## Three arms may declare the same function

```echo
#[if: os == darwin]
function platform() : string { return 'darwin'; }
#[elif: os == linux]
function platform() : string { return 'linux'; }
#[elif: os == windows]
function platform() : string { return 'windows'; }
#[end]

echo platform();
```

As three ordinary declarations those would collide as a duplicate signature. Nothing collides, because the two
that do not apply never reach the pass that registers declarations. This is the difference between a filter
and an `if` the compiler evaluates later, and it is why the filter runs where it does.

## Reading your file as the other platform

You don't need the other machine to find out which arm it takes:

```bash
echoc run --target-os linux app.eco
echoc run --target-arch x86_64 app.eco
```

Both are checked against the same closed vocabularies, so a typo is caught here too:

```
unknown --target-os 'macos', expected one of: darwin, linux, windows
```

Be clear about what this does, though: **it chooses arms, it does not cross-compile.** The code that gets
selected is still compiled for the machine you are sitting at. It answers "which sources would a Linux build
use", not "does this Linux build work", and that is genuinely useful for a manifest that gates its own source
list. It is not a substitute for building on Linux.

## `const if` is the other one, and it is not the same

Echo also has `const if`, an in-body branch decided at compile time:

```echo
const if (mem::is_trivially_copyable<int32>()) {
    echo 'bytes';
}
else {
    echo 'element by element';
}
```

These two solve different problems. Don't mix them up.

`#[if:]` runs on tokens, before parsing. It can test the target and your flags, and nothing else, and the
untaken arm need not even be valid Echo for this platform.

`const if` runs after parsing, inside the monomorphizer. It can test anything the compiler can fold, which
includes type facts like `mem::needs_destruction<T>()`, so it is what a generic container reaches for when a
body has to differ per element type. The untaken arm is parsed and then discarded.

Neither is a runtime `if`, and neither costs anything at runtime.
[Constants](/language/constants) has the full three-way distinction between `const`, a constant, and `const if`.

## What a condition deliberately cannot do

It can't see anything from your program. Not a constant, not a type, not whether a function is declared. The
filter runs before there is a program to ask.

It can't express a version comparison, or a feature flag with a version, or an inverted default.
`--define` is a set of names that are either present or not, and the deliberate consequence is that
there is nothing to learn: if you know what `#[if:]` means, you know all of it.

And there is no `#[if: !defined(X)]` spelling, because there is nothing to define against. `!X` is that.

## Next

- [The echoc CLI](/projects/cli) for `--define`, `--target-os` and `--target-arch`.
- [C interop](/projects/c-interop) for the `extern` blocks these conditions usually wrap.
- [Modules](/projects/modules) for gating a manifest's source list.
