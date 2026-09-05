# C interop

Most of what a real program needs already exists, and most of it is a C library. Echo's way in is an `extern`
block. The thing to get is that **a binding is a declaration, not a wrapper the compiler has to
know about.** There is no binding generator, no header parser, no `#[c_import]`. You write the signature, and
the name goes to the linker.

```echo
extern {
    function abs as c_abs(int32 $value) : int32;
}

echo c_abs(-42);        // 42
```

That's a complete program. From here it's names, types, strings, structs, and how to ship C sources inside
a module.

## The C name comes first, `as` renames it locally

```echo
extern {
    function malloc as raw_alloc(usize $bytes) : ptr<uint8>;
    function free as raw_free(ptr<uint8> $p) : void;
    function strlen as measure(ptr<const uint8> $s) : usize;
}

string $greeting = 'hello';
echo measure($greeting->cstr());   // 5
```

The name on the left is the **symbol**, which is what reaches the linker with no mangling applied. The name
after `as` is what your call sites use. Drop the `as` and both are the same:

```echo
extern {
    function sqrt(float64 $x) : float64;
}

echo sqrt(9.0);     // 3.000000
```

Renaming is worth doing more often than you'd think. C's namespace is flat and its names are terse, so
`c_time` and `raw_alloc` and `measure` say something at the call site that `time` and `malloc` and `strlen`
do not.

Two things an `extern` function may not be: it may not have a body (it ends at the `;`), and it may not be
generic, because a single C symbol has no per-instantiation body to emit.

## Types are yours to get right

Nothing checks your declaration against the real header. There is no header to check against. If C says
`size_t` and you write `int32`, that compiles, links, and then misbehaves on the first value above two
billion.

The mapping you'll use most:

| C | Echo |
|---|---|
| `int` | `int32` |
| `size_t` | `usize` |
| `char *` | `ptr<uint8>` |
| `const char *` | `ptr<const uint8>` |
| `double` | `float64` |
| `float` | `float32` |
| `void *` | `ptr<uint8>` |
| `void (*)(int)` | `extern function<void(int32)>` |
| `void` | `void` |

This is the one part of Echo where the compiler can't help you at all. Get the signature right once, in one
place, and never write it again.

## C enums are integers plus leftovers

A C `enum` is an integer with names taped on. A newer version of the library will invent codes you have
not named. Echo's closed integer enum cannot hold those: `from` answers `T?`, and `null` is a lie or a
crash the moment miniaudio ships `-999`.

An [open integer enum](/language/enums#an-integer-enum-can-be-open) is the type you actually have:

```echo
extern { function ma_result() : int32; }

enum Error : int32
{
    case ok = 0;
    case invalidArgs = -2;
    case other;
}

Error $e = Error::from(ma_result());
```

`from` always succeeds. A named code becomes that case. `-999` becomes `Error::other`, and `$e->value()`
is still `-999`, so you can hand it to `ma_strerror`. `match` stays exhaustive if you handle `other`.

Here is the catch. Do not declare the C function as returning `Error`. The layout is `{ int32 }`, which
is not C's `int`. Wrap with `from` on the way in, unwrap with `value()` on the way out.

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

Two things in there I want to point at.

`->` reaches through the pointer directly. A plain read of `$raw` would deref it and copy the whole struct
out of libc's storage, which works and is a waste.

And this `tm` is **only ever read**. Real `struct tm` has two more fields after these nine; nothing of ours
writes through the pointer, so leaving them unspelled can't overrun anything. A binding that asked libc to
*fill* a `tm` of ours would have to declare all of them, and get every one right.

## Incomplete types: a name, no layout

A lot of C libraries never spell the struct. You get a name, a handful of functions that take a pointer to
it, and that's the whole contract. If those were all `ptr<uint8>`, a `Handle` and a `Resource` would be the
same type, and you could pass either into the wrong function.

`extern struct` is the name, with no layout:

```echo
extern struct Handle;
extern struct Resource;

ptr<Handle> $h = null;
ptr<Resource> $r = null;

echo ($h == null);      // 1
echo ($r == null);      // 1
```

`ptr<Handle>` is not `ptr<Resource>`. Passing one where the other is wanted is a type error, not a comment
you hope a reader notices:

```echo
extern struct Handle;
extern struct Resource;

function start(ptr<Handle> $h) : void
{
}

ptr<Resource> $r = null;
start($r);
// error: cannot implicitly convert 'ptr<Resource>' to 'ptr<Handle>'
```

I don't want `void*` with a comment. If two C types are different, the compiler should treat them as
different.

Here is the catch. A plain read of `ptr<int32>` loads through to the `int32`. A plain read of `ptr<Handle>`
is the address itself, because there is nothing to load. That's why `$h == null` works without `:$`: the
pointer is the value. `:$` still names the slot if you want to re-seat it.

You cannot construct a `Handle`, you cannot borrow one, you cannot ask `mem::size<Handle>()`, and you
cannot offset the pointer. There is no size to stride by:

```echo
extern struct Handle;

function take(Handle $h) : void
{
}
// error: 'Handle' is an incomplete type, so a value of it cannot exist - name it only as 'ptr<Handle>'
```

`void *` stays `ptr<uint8>`. Turning one into a `ptr<Handle>` is a written `as`, the same pointer-to-pointer
reinterpret as everywhere else. The `:$` is doing the job it always does: you want the address, not the
byte at the other end.

```echo
extern struct Handle;

ptr<uint8> $raw = null;
ptr<Handle> $h = $raw:$ as ptr<Handle>;
echo ($h == null);      // 1
```

The Echo class around the handle is then just a class. Refcount, `#[atomic]` if it crosses threads, a
destructor that hands the pointer back to C. It is not a type-safety patch over `void*`. The type safety
is already on the pointer.

<!-- verify: skip -->
```echo
extern struct Handle;

extern {
    function c_destroy(ptr<Handle> $h) : void;
}

class Owned
{
    ptr<Handle> $raw;

    constructor(ptr<Handle> $raw)
    {
        $this->raw = $raw;
    }

    destructor()
    {
        if ($this->raw != null) {
            c_destroy($this->raw);
        }
    }
}
```

`extern struct` has no body. If you know the layout, declare a plain `struct` as `tm` does above. You can
write `struct Handle;` inside the `extern` block too, next to the functions that take it. Same thing.

## Strings out: `cstr()`

Echo strings are not C strings, but every buffer the standard library allocates has room for one byte past
its text and holds a `0` there, and every literal is emitted NUL-terminated too. So the common case costs
nothing:

```echo
extern {
    function strlen as c_strlen(ptr<const uint8> $s) : usize;
}

string $name = 'Echo';
echo c_strlen($name->cstr());      // 4
```

The exception is a substring that stops early. It shares its owner's buffer, so the byte after its window is
somebody else's text rather than a terminator. `->clone()` is the fix, and it is the only time you pay:

```echo
extern {
    function strlen as c_strlen(ptr<const uint8> $s) : usize;
}

string $name = 'Echo';

$tail = $name->sub(1, 3);
echo $tail->terminated();        // 1, it reaches the end of the buffer

$head = $name->sub(0, 3);
echo $head;                         // Ech
echo $head->terminated();        // 0

$safe = $head->clone();
echo c_strlen($safe->cstr());      // 3
```

Calling `cstr()` on the unterminated one is an assertion failure rather than a silent over-read:

```
assertion failed: string is not NUL terminated - clone it first
```

Ask `terminated()` when you'd rather branch than die.

`data()` is the same pointer without that assert. Use it when C already has a length, which is most of
the interesting APIs (`CURLOPT_POSTFIELDS` plus `CURLOPT_POSTFIELDSIZE`, `write(2)`, anything that is
not `%s`):

```echo
string $name = 'Echo';
$head = $name->sub(0, 3);

echo $head->terminated();        // 0
echo $head->data() != null;         // 1
echo $head->size();                 // 3
```

To let C write *into* a string, reserve, hand it `spare()`, then `commit` the count it produced. Growing
the buffer after `spare()` invalidates the pointer.

```echo
string $body = '';
$body->reserve(8);

ptr<uint8> $dst = $body->spare();
$dst:$[0] = 69;
$dst:$[1] = 99;
$dst:$[2] = 104;
$dst:$[3] = 111;
$body->commit(4);

echo $body;         // Echo
```

## Arrays out: the same protocol, over elements

Strings were designed for C. Arrays were designed as Echo collections, and then there was no honest way
to say "write N floats into this buffer." There is now, and it is the string sequence with a different
unit.

```echo
array<float32> $frames = arr::room<float32>(4);

ptr<float32> $p = $frames->spare();
$p:$[0] = 1.0f;
$p:$[1] = 2.0f;
$frames->commit(2);

echo $frames->count();     // 2
echo $frames[0];           // 1.000000
```

`room()` on the array is how many elements `spare()` can accept without growing. `data()` is the live
prefix, for C that already has a length. Growing the buffer after `spare()` invalidates the pointer.

A [`fixed_array<T, N>`](/collections/fixed-arrays) is already a C buffer: every slot is live, so there
is no spare. `$quad->data()` is the first element and `N` is the count.

This only works for a `T` that is bytes. C cannot construct an Echo `string`, and `commit` on an
`array<string>` dies rather than invent a constructor.

Pass the pointer and the count yourself. A live [`slice<T>`](/collections/slices) is two public words
(`$data` and `$len`) if the window is already elements:

```echo
array<int32> $numbers = [1, 2, 3];
slice<int32> $window = $numbers->sub();

echo $window->data:$ != null;   // 1
echo $window->len;              // 3
```

## Strings in: borrow or copy

Everything C hands back is a bare pointer with the length implied by a terminator, so there is one seam on the
way in and it comes in two versions.

```echo
extern {
    function getenv as c_getenv(ptr<const uint8> $name) : ptr<uint8>;
}

string $key = 'HOME';
ptr<uint8> $home = c_getenv($key->cstr());

// borrows the bytes C already holds. No allocation
string::view $view = str::cview($home);
echo $view->size > 0;       // 1

// takes a copy along
string $owned = str::from($home);
echo $owned->size() > 0;    // 1
```

`cview` is the right default when the bytes outlive the read, which is true of an `argv` entry and an
environment variable: both live as long as the process, so copying them buys nothing.

Reach for `from` when they do not. A buffer you are about to free, anything behind a `setenv`, anything
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
can't open an object file, so echoc gathers the module's C objects into a loadable library and `dlopen`s
that.

```bash
cd plotter
echoc run        # 42
echoc build -o plot && ./plot
```

## `#[cc:]` contributes objects, and nothing else

Here's the bit that other languages train you to expect the wrong way around. **No include
path and no macro from `#[cc:]` reaches Echo's front end.** `PALETTE_BASE` is not a constant your Echo can
see, and `c/include` is not somewhere Echo looks for anything. The C build produces object files. That's
the entire contribution.

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

int32 $written = c_snprintf($buffer, 64, $format->cstr(), [7, 2.5]);

echo str::cview($buffer);        // 7 chevrons, 2.5 seconds
echo $written;                           // 23

mem::free($buffer);
```

Four parameters, four arguments. The brackets are what C receives as its variadic tail, and the call still
has exactly the arity its declaration states. That's why it is spelled this way rather than
with an ellipsis: you can read a call site's arity without going to look at the declaration.

**The list has to be written right there.** That's not a style rule I am imposing on you. A C variadic call
decides where each argument goes from its type *at the call site*, so a collection assembled at runtime could
not be unpacked without building a `va_list` by hand, which is not portable. An empty list is fine and means
no varargs at all.

**Each element is promoted the way C promotes an argument with no parameter to match it.** A `float`
becomes a `float64`, and anything narrower than 32 bits becomes an `int32` or a `uint32`. The compiler does
that, not your declaration, which is also where a C compiler does it. You never write the widening
yourself and you can't get it wrong.

What may be in the list is primitives and pointers. A struct is refused, because how C's variadic
convention unpacks one is platform specific. A `string` is a struct, so pass its `->cstr()`:

```echo
extern {
    function printf as c_printf(ptr<const uint8> $format, variadic_args $args) : int32;
}

string $format = 'hello, %s';
string $name = 'Ronon';

c_printf($format->cstr(), [$name->cstr()]);
```

**A pointer in the list is the pointer.** This is the one place the language's usual rule would say
otherwise: everywhere else a plain read of a `ptr<T>` gives you the value
at the other end, and you write `:$` when you mean the address itself. A variadic tail has no parameters
opposite it to read *toward*, so each element is passed as its own type and a pointer variable arrives as
an address, the same thing `->cstr()` has always given you.

```echo
ptr<uint8> $buffer = mem::alloc<uint8>(64);
ptr<uint8> $text = mem::alloc<uint8>(8);

string $format = '<%s>';

c_snprintf($buffer, 64, $format->cstr(), [$text]);      // the address, as C wants
c_snprintf($buffer, 64, $format->cstr(), [$text:$]);    // the same address, said explicitly
```

`variadic_args` is legal in exactly one place: the last parameter of an `extern` declaration, with at
least one parameter before it. Everywhere else is a compile error naming the position.

## Callbacks: passing a function to C

C libraries are mostly callback registration. GLFW's `glfwSetKeyCallback`, a signal handler, a
`qsort` comparator: they all take a function pointer, and they all take **C's** function pointer:
one word, no environment.

Echo's own callable, `function<R(P...)>`, is two words. C has no declaration for the second one.
The type C can name is `extern function<R(P...)>`:

```echo
extern {
    function apply(extern function<int32(int32)> $fn, int32 $v) : int32;
}

function double_it(int32 $x) : int32
{
    return $x * 2;
}

echo apply(&double_it, 21);     // 42
```

`&name` is the only *safe* producer. It is the address of a function this compiler compiled, so the
signature is checked: primitives, `ptr<T>`, another `extern function`, and `void` as a return.
A struct by value is refused, because that is where echoc's lowering and clang's ABI classification
come apart silently. Pass a `ptr<T>`.

The marked unsafe one is the one-word reinterpret between `ptr<T>` and `extern function<R(P...)>`.
That is what a loader does: `dlsym` hands back a `void*`, you store it typed per slot, and you call
through it. Any signature is accepted, the way any `ptr` reinterpret is — the signature is your
promise. Without that cast, only libraries whose symbols are known at link time are bindable.

```echo
function stub() : int32
{
    return 42;
}

unsafe {
    ptr<uint8> $p = &stub as ptr<uint8>;
    extern function<int32()> $back = $p:$ as extern function<int32()>;
    echo $back();       // 42
}
```

A C callback has no environment. State it needs is a static, or arrives through the parameters C
gives it. That's the honest answer, not a limitation to apologise for. A closure literal at an
`extern function<...>` destination is refused for the same reason: name it and pass `&name`.

`extern function<...>?` is the nullable form, and `null`, `guard`, `??` and `?->` work on it the
way they work on every other type that can be absent.

An `extern` *declaration* is still a promise about someone else's function, and is still not
checked against a header. A `extern function<...>` is a promise **echoc keeps**: it hands out
the address of a function it compiled.

## Next

- [Linking](/projects/linking) for telling the linker where the library actually is.
- [Conditional compilation](/projects/conditional-compilation) for a symbol that exists on one platform.
- [Modules](/projects/modules) for how a binding module reaches its consumers.
