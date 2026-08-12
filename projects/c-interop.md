# C interop

Most of what a real program needs already exists, and most of it is a C library. Echo's way in is an `extern`
block, and the thing to internalise is that **a binding is a declaration, not a wrapper the compiler has to
know about.** There is no binding generator, no header parser, no `#[c_import]`. You write the signature, and
the name goes to the linker.

```echo
extern {
    function abs as c_abs(int32 $value) : int32;
}

echo c_abs(-42);        // 42
```

That is a complete program. The rest of this page is the boundary: names, types, strings, structs, and how to
ship C sources inside a module.

## The C name comes first, `as` renames it locally

```echo
extern {
    function malloc as raw_alloc(usize $bytes) : ptr<uint8>;
    function free as raw_free(ptr<uint8> $p) : void;
    function strlen as measure(ptr<const uint8> $s) : usize;
}

string $greeting = 'hello';
echo measure($greeting->c_str());   // 5
```

The name on the left is the **symbol**, which is what reaches the linker with no mangling applied. The name
after `as` is what your call sites use. Drop the `as` and both are the same:

```echo
extern {
    function sqrt(float64 $x) : float64;
}

echo sqrt(9.0);     // 3.000000
```

Renaming is worth doing more often than you would think. C's namespace is flat and its names are terse, so
`c_time` and `raw_alloc` and `measure` say something at the call site that `time` and `malloc` and `strlen`
do not.

Two things an `extern` function may not be: it may not have a body (it ends at the `;`), and it may not be
generic, because a single C symbol has no per-instantiation body to emit.

## Types are yours to get right

Nothing checks your declaration against the real header. There is no header to check against. If C says
`size_t` and you write `int32`, that compiles, links, and then misbehaves on the first value above two
billion.

The mapping you will use most:

| C | Echo |
|---|---|
| `int` | `int32` |
| `size_t` | `usize` |
| `char *` | `ptr<uint8>` |
| `const char *` | `ptr<const uint8>` |
| `double` | `float64` |
| `float` | `float32` |
| `void *` | `ptr<uint8>` |
| `void` | `void` |

This is the one part of Echo where the compiler cannot help you at all, and it is worth being deliberate
about: get the signature right once, in one place, and never write it again.

## Gather the bindings, then wrap them

A C symbol may only be declared **once per module**. Two `extern` blocks naming `getenv` with signatures that
disagree is a diagnostic, which is loud and good, but it is also a problem nobody should have to think about.
So put the raw declarations in one file, under a namespace, and export something nicer:

```echo
namespace geometry;

extern {
    function hypot as c_hypot(float64 $x, float64 $y) : float64;
}

struct Point
{
    float64 $x;
    float64 $y;

    function length() : float64
    {
        return c_hypot($this->x, $this->y);
    }
}

geometry::Point $p = geometry::Point(3.0, 4.0);
echo $p->length();      // 5.000000
```

The standard library does exactly this. `stdlib/std/env/libc.eco` holds every C symbol `std::env` is built
out of, and nothing else. An `extern` block takes the same visibility modifier a declaration does, and that
one doesn't say `public`, so none of it crosses the module boundary. The `c_` prefix is for the reader
*inside* the module, where that boundary isn't visible in the code in front of them.
See [Visibility](/language/visibility).

Wrap `#[if:]` around a whole block when a symbol only exists on one platform.
[Conditional compilation](/projects/conditional-compilation) has that case in full, and it is the reason the
feature exists.

## Structs across the boundary

Declare the struct in Echo with the same layout, and pass a pointer:

```echo
struct tm
{
    int32 $sec;
    int32 $min;
    int32 $hour;
    int32 $mday;
    int32 $mon;
    int32 $year;
    int32 $wday;
    int32 $yday;
    int32 $isdst;
}

extern {
    function time as c_time(ptr<int64> $out) : int64;
    function localtime as c_localtime(ptr<int64> $t) : ptr<tm>;
}

int64 $epoch = 0;
c_time(&$epoch);

ptr<tm> $raw = c_localtime(&$epoch);

echo $raw->hour >= 0 && $raw->hour < 24;     // 1
```

Two things in there are worth pointing at.

`->` reaches through the pointer directly. A plain read of `$raw` would deref it and copy the whole struct
out of libc's storage, which works and is a waste.

And this `tm` is **only ever read**. Real `struct tm` has two more fields after these nine; nothing of ours
writes through the pointer, so leaving them unspelled cannot overrun anything. A binding that asked libc to
*fill* a `tm` of ours would have to declare all of them, and get every one right.

## Strings out: `c_str()`

Echo strings are not C strings, but every buffer the standard library allocates has room for one byte past
its text and holds a `0` there, and every literal is emitted NUL-terminated too. So the common case costs
nothing:

```echo
extern {
    function strlen as c_strlen(ptr<const uint8> $s) : usize;
}

string $name = 'Echo';
echo c_strlen($name->c_str());      // 4
```

The exception is a substring that stops early. It shares its owner's buffer, so the byte after its window is
somebody else's text rather than a terminator. `->clone()` is the fix, and it is the only time you pay:

```echo
extern {
    function strlen as c_strlen(ptr<const uint8> $s) : usize;
}

string $name = 'Echo';

$tail = $name->sub(1, 3);
echo $tail->is_terminated();        // 1, it reaches the end of the buffer

$head = $name->sub(0, 3);
echo $head;                         // Ech
echo $head->is_terminated();        // 0

$safe = $head->clone();
echo c_strlen($safe->c_str());      // 3
```

Calling `c_str()` on the unterminated one is an assertion failure rather than a silent over-read:

```
assertion failed: string is not NUL terminated - clone it first
```

Ask `is_terminated()` when you would rather branch than die.

## Strings in: borrow or copy

Everything C hands back is a bare pointer with the length implied by a terminator, so there is one seam on the
way in and it comes in two versions.

```echo
extern {
    function getenv as c_getenv(ptr<const uint8> $name) : ptr<uint8>;
}

string $key = 'HOME';
ptr<uint8> $home = c_getenv($key->c_str());

// borrows the bytes C already holds. No allocation
string::view $view = str::view_of_c_str($home);
echo $view->size > 0;       // 1

// takes a copy along
string $owned = str::from_c_str($home);
echo $owned->size() > 0;    // 1
```

`view_of_c_str` is the right default when the bytes outlive the read, which is true of an `argv` entry and an
environment variable: both live as long as the process, so copying them buys nothing.

Reach for `from_c_str` when they do not. A buffer you are about to free, anything behind a `setenv`, anything
a library says it may reuse on the next call.

## Shipping C sources with `#[cc:]`

Sometimes a binding needs a shim: something C can say and Echo cannot, or a macro that has to be a real
function before anything can call it. Put the C in the module and let echoc build it.

Four kinds, and the same tag-in-the-grammar rule `#[link:]` uses:

<!-- verify: skip -->
```echo
#[module: "palette"]
#[version: "0.1.0"]

#[cc: sources "c/*.c"]
#[cc: include "c/include"]
#[cc: define { PALETTE_BASE: 40 }]

#[sources: "src/*.eco"]
```

`define` is the one that reads a record, because its keys are the payload rather than a fixed vocabulary, so
several macros fit in one attribute and each keeps its own value. Everything else names one value, and saying
otherwise is a located error:

```
module.eco:2: only 'define' takes a record - a 'include' names one value.
```

The rest of the module:

```c
/* c/include/palette.h */
#ifndef PALETTE_H
#define PALETTE_H

#define PALETTE_RESERVED 2

int palette_swatch_count(void);

#endif
```

```c
/* c/palette.c */
#include "palette.h"

int palette_swatch_count(void)
{
    return PALETTE_BASE + PALETTE_RESERVED;
}
```

<!-- verify: skip -->
```echo
// src/palette.eco
namespace palette;

extern {
    function palette_swatch_count as c_swatch_count() : int32;
}

function swatch_count() : int32
{
    return c_swatch_count();
}
```

Note that the `sources` pattern is `c/*.c` and deliberately does not reach `c/include/`. A header is not a
translation unit, and picking one up would compile it as one.

A consumer depends on `palette` and writes nothing else. Both build modes work, including `run`: the JIT
cannot open an object file, so echoc gathers the module's C objects into a loadable library and `dlopen`s
that.

```bash
cd plotter
echoc run        # 42
echoc build -o plot && ./plot
```

## `#[cc:]` contributes objects, and nothing else

This is worth stating plainly because the intuition from other languages points the wrong way. **No include
path and no macro from `#[cc:]` reaches Echo's front end.** `PALETTE_BASE` is not a constant your Echo can
see, and `c/include` is not somewhere Echo looks for anything. The C build produces object files. That is the
entire contribution.

The one loose flag, `#[cc: flag "-O0"]`, is safe untyped where a link flag was not: it reaches one known tool
and is never re-read.

## The C object cache, and the one consequence you can see

A C translation unit's inputs are its source **and every header it reached**, and only the compiler's own
depfile names those. The depfile is written *by* the compile, so the cache has to be split in two: the
object's filename carries a digest of the settings (compiler, target, mode, includes, defines, flags), which
is knowable up front, and a sidecar beside it carries the content key, written afterwards from the depfile
that compile just produced.

The consequence you can observe: **an object's filename does not move when a header changes.** Edit
`palette.h`, rebuild, and the `.o` has the same name and different contents:

```
ecobuild/cc/
  palette-a49937ac7dcb1fa2.5e58919c7b8b3c7b.o
  palette-a49937ac7dcb1fa2.5e58919c7b8b3c7b.d
  palette-a49937ac7dcb1fa2.5e58919c7b8b3c7b.key
  libpalette.65d0a3220f2b119b.dylib
```

So if you ever cache something on top of these, key on the content digest and not on the path.

## Calling a C variadic function

`printf`, `snprintf`, `open`, `fcntl`: a lot of C's surface takes an argument list that does not end.
Echo has no `...` in its own grammar, so the tail is spelled as the last parameter's **type**:

```echo
extern {
    function snprintf as c_snprintf(
        ptr<uint8> $out, usize $size, ptr<const uint8> $format, variadic_args $args) : int32;
}

ptr<uint8> $buffer = mem::alloc<uint8>(64);
string $format = '%d chevrons, %.1f seconds';

int32 $written = c_snprintf($buffer, 64, $format->c_str(), [7, 2.5]);

echo str::view_of_c_str($buffer);        // 7 chevrons, 2.5 seconds
echo $written;                           // 23

mem::free($buffer);
```

Four parameters, four arguments. The brackets are what C receives as its variadic tail, and the call still
has exactly the arity its declaration states. That is the whole reason it is spelled this way rather than
with an ellipsis: you can read a call site's arity without going to look at the declaration.

**The list has to be written right there.** That is not a style rule I am imposing on you. A C variadic call
decides where each argument goes from its type *at the call site*, so a collection assembled at runtime could
not be unpacked without building a `va_list` by hand, which is not portable. An empty list is fine and means
no varargs at all.

**Each element is promoted the way C promotes an argument with no parameter to match it.** A `float`
becomes a `float64`, and anything narrower than 32 bits becomes an `int32` or a `uint32`. The compiler does
that, not your declaration, which is also where a C compiler does it. You never write the widening
yourself and you cannot get it wrong.

What may be in the list is primitives and pointers. A struct is refused, because how C's variadic
convention unpacks one is platform specific. A `string` is a struct, so pass its `->c_str()`:

```echo
extern {
    function printf as c_printf(ptr<const uint8> $format, variadic_args $args) : int32;
}

string $format = 'hello, %s';
string $name = 'Ronon';

c_printf($format->c_str(), [$name->c_str()]);
```

`variadic_args` is legal in exactly one place: the last parameter of an `extern` declaration, with at
least one parameter before it. Everywhere else is a compile error naming the position.

## Next

- [Linking](/projects/linking) for telling the linker where the library actually is.
- [Conditional compilation](/projects/conditional-compilation) for a symbol that exists on one platform.
- [Modules](/projects/modules) for how a binding module reaches its consumers.
