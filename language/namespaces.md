# Namespaces

A namespace keeps names apart. If you have written PHP you know the idea, and the spelling is close enough
to guess:

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
```

The separator is `::`, not `\`:

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

By convention one file holds one namespace, and the standard library is strict about it. That is a
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

Here is the rule that will eventually surprise you. Functions resolve as an **overload set**, and lookup
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
which overload an unrelated call in another namespace picks, and that is a debugging session nobody enjoys.

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

## There is no use statement

You cannot import a name to shorten it:

```echo
namespace app;

function helper() : void
{
    echo 1;
}

namespace main;

app::helper();      // the only spelling
```

`use app;` does not parse. Every cross-namespace name is written in full at each use site. For deeply nested
names such as `std::math::sqrt` that gets verbose, and an import statement is on
[the list](/reference/limitations).

## Operators ignore all of this

Worth knowing before it bites you: **operators are global.** An operator declared anywhere in your program,
including inside a namespace and including in a library you depend on, applies everywhere.

There is no namespacing for them and no way to scope one. See [Operators](/language/operators).

## How the standard library is laid out

A name's spelling tells you what tier it is in:

| Spelling | What it is | Lives in |
|---|---|---|
| `array`, `string`, `map`, `range`, `die`, `assert` | the language's own vocabulary, written every day | `stdlib/core/` |
| `contract::`, `mem::`, `str::`, `arr::`, `hash::` | still about the language, but not written every line | `stdlib/core/` |
| `std::math::`, `std::env::` | ordinary utility with no special relationship to the language | `stdlib/std/` |

So `array<int32>` is unqualified because you write it constantly, while `mem::size<T>()` is qualified
because you do not. And anything under `std::` is a library like any you would write yourself.

## Next

- [Modules](/projects/modules) for splitting a program across files and depending on a library.
- [Constants](/language/constants) for publishing a named value from a namespace.
- [Operators](/language/operators) for the one thing namespaces do not contain.
