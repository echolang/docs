# Namespaces

A namespace keeps names apart. The separator is `::`.

```echo
namespace geometry;

struct Point
{
    int32 $x;
    int32 $y;
}

function make(int32 $x, int32 $y) : Point
{
    return Point($x, $y);
}

namespace app;

geometry::Point $p = geometry::make(3, 4);
echo $p->x;     // 3
```

## namespace is a statement, not a block

There are no braces. A `namespace` statement says "everything after this line is in that namespace", until
another one says otherwise:

```echo
struct Shared
{
    int32 $v;
}

namespace app;

function take(Shared $s) : int32
{
    return $s->v;
}

namespace main;

echo app::take(Shared(7));      // 7
```

Note the root-level `struct Shared` above the first `namespace` line. Anything declared before the first
`namespace` statement lives at the root, and is reachable unqualified from everywhere.

By convention one file holds one namespace, and the standard library is strict about it. That's a
readability rule, not a language rule.

## Lookup resolves outward

An unqualified name is looked for in the current namespace first, then outward toward the root:

```echo
struct Shared
{
    int32 $v;
}

namespace app;

struct Holder
{
    Shared $inner;      // found at the root
}

namespace main;

app::Holder $h = app::Holder(Shared(9));
echo $h->inner->v;      // 9
```

This is why the standard library can write `iterator<V>` inside `namespace contract` rather than
`contract::iterator<V>`. Both spellings work; the short one is what sharing a namespace buys you.

A name declared closer wins:

```echo
struct Named
{
    int32 $root;
}

namespace app;

struct Named
{
    int32 $app;
}

function which(Named $n) : int32
{
    return $n->app;     // app::Named, not the root one
}

namespace main;

echo app::which(app::Named(5));     // 5

Named $r = Named(1);
echo $r->root;                      // 1, the root one out here
```

## Hidden, not extended

Here's the rule that will eventually surprise you. Functions resolve as an **overload set**, and lookup
stops at the first namespace that has *any* candidate with that name. Outer candidates are not added to the
set. They are hidden.

```echo
function greet(int32 $n) : void
{
    echo "root int";
}

namespace app;

function greet(string $s) : void
{
    echo "app string";
}

function run() : void
{
    greet("hi");
}

namespace main;

app::run();             // app string
echo 0;
```

So far so good. Now call it with an `int32` from inside `app`:

```echo
function greet(int32 $n) : void
{
    echo "root int";
}

namespace app;

function greet(string $s) : void
{
    echo "app string";
}

function run() : void
{
    greet(1);
}
// error: Invalid type conversion: cannot implicitly convert 'int32' to 'string'
```

The root `greet(int32)` exists and is not a candidate. `app` declared a `greet`, so the search stopped
there, and the only overload in scope takes a `string`.

The fix is to qualify what you meant. From inside `app`, the root one is reachable by writing it out.

I prefer this to merging the sets. Merging means adding a function in one namespace can silently change
which overload an unrelated call in another namespace picks, and that's a debugging session nobody enjoys.

## Nested types share the syntax

`::` also reaches a type declared inside another type:

```echo
struct Collection
{
    usize $count;

    struct cursor
    {
        usize $index;
    }
}

Collection::cursor $c = Collection::cursor(0);
echo $c->index;     // 0
```

Same separator, different thing: the left side is a type rather than a namespace. See
[Structs](/language/structs).

## use is a file-local alias

A `use` binds a shorter name for the rest of this file. It doesn't publish anything into a namespace,
so a second file of the same namespace doesn't see it, and a library's `use` cannot leak into a
consumer.

```echo
namespace geometry;

struct Point
{
    int32 $x;
    int32 $y;
}

function make(int32 $x, int32 $y) : Point
{
    return Point($x, $y);
}

namespace app;

use geometry;
use geometry::Point;

Point $p = geometry::make(3, 4);
echo $p->x;     // 3
```

Three shapes:

```echo
use std::math;                      // prefix: math::sqrt
use std::math::sqrt;                // item:   sqrt(...)
use std::math::{sqrt, abs};         // group
use std::math::sqrt as square_root; // alias
```

The last segment decides what you bound. A namespace is a prefix, so you still write `math::sqrt`. A
type, a function or a constant is an item, so the short name stands in every role that name has:
`Point` as a type, `Point(...)` as a constructor, `Point::origin` as a static. There is no
`use function` or `use const`. Echo already keeps those in different stores, so one `use` is enough.

An alias is only a spelling. The declaration stays where it was, with the same visibility. `use`
of a name another module did not mark `public` is refused at the `use`.

A `use` is a file-scope statement, like `namespace`. It applies to the whole file, wherever you
wrote it. It is not legal inside a body.

There is no `use std::math::*;`. Adding a function in a namespace must not silently change which
overload an unrelated call picks, and a star import is that happening on purpose. Name the
namespace, or name the items.

## Operators ignore all of this

This one will bite you if you don't know it: **operators are global.** An operator declared anywhere in your
program, including inside a namespace and including in a library you depend on, applies everywhere.

There is no namespacing for them and no way to scope one. See [Operators](/language/operators).

## How the standard library is laid out

A name's spelling tells you what tier it is in:

| Spelling | What it is | Lives in |
|---|---|---|
| `array`, `string`, `map`, `range`, `die`, `assert` | the language's own vocabulary, written every day | `stdlib/core/` |
| `contract::`, `mem::`, `str::`, `arr::`, `hash::` | still about the language, but not written every line | `stdlib/core/` |
| `std::math::`, `std::env::` | ordinary utility with no special relationship to the language | `stdlib/std/` |

So `array<int32>` is unqualified because you write it constantly, while `mem::size<T>()` is qualified
because you don't. And anything under `std::` is a library like any you would write yourself.

## Next

- [Modules](/projects/modules) for splitting a program across files and depending on a library.
- [Constants](/language/constants) for publishing a named value from a namespace.
- [Operators](/language/operators) for the one thing namespaces do not contain.
