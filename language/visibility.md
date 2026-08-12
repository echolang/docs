# Visibility

Every declaration decides who is allowed to name it, and there is one catch worth knowing before you write a
second file: **no modifier does not mean public. It means "my module, and no further."**

```echo
public function dial() : int32
{
    return 7;
}

echo dial();        // 7
```

In a single-file program that is the whole thing, and none of it costs you anything: your module and your
program are the same thing, so nothing is ever refused and `public` buys you nothing. The rest of this page is
what happens once there is a second file, and what the same word means inside a type.

## Three rungs, and you are standing on the middle one

A top-level `struct`, `class`, `interface`, `function` or `const` sits on one of three rungs. So does an
`extern` block, which takes the same modifier the declarations inside it would.

| Written | Who can name it |
|---|---|
| `private` | the file it was declared in |
| nothing, or `internal` | the module it was declared in |
| `public` | anybody |

```echo
private struct Chevron
{
    usize $index;
}

private function lock(usize $i) : Chevron
{
    return Chevron($i);
}

function encoded(Chevron $c) : usize
{
    return $c->index + 1;
}

internal const usize CHEVRON_COUNT = 7;

public function address() : usize
{
    return encoded(lock(1)) + CHEVRON_COUNT;
}

echo address();     // 9
```

`internal` and writing nothing are the same rung, so adding the word never changes what compiles. It is there
because "I checked, and there is no modifier" is a lousy way to find out that something is deliberately not part
of a library's surface. Write it where that answer matters and skip it where it does not.

## The default points inward, and that costs you something

Most languages default to public and hand you a word for hiding. Echo goes the other way, and I will put the
bill on the table first: the standard library writes `public` 209 times across 25 files. Every one of those is
a line somebody had to type, and a library of yours that forgets one gets "the function could not be found"
rather than anything about visibility.

I still prefer it, for one reason. A declaration that is public by default is part of your interface the second
you type it, and you cannot take it back out later without breaking somebody who was never meant to reach it in
the first place. Defaulting to the module makes your surface something you chose, one `public` at a time. That
cost is paid once per name you actually meant to export. The other one is paid by everybody who depends on you,
forever.

## On a top-level declaration, private means the file

This is the one that catches people, because most languages have no file rung at all. A `private` declaration
is reachable from the file it was written in, and a second file of the *same module* is already outside:

<!-- verify: skip -->
```echo
// gate.eco
private struct Chevron { usize $index; }

private function lock(usize $i) : Chevron { ... }

function encoded() : usize { ... }
```

<!-- verify: skip -->
```echo
// dialer.eco, same module
$n = encoded();             // fine, same module

Chevron $c = lock(1);       // error: 'Chevron' is private to 'gate.eco', so it can only be named in
                            //        that file. Remove the 'private' to reach it from the rest of
                            //        its module, or write 'public' to reach it from anywhere.
```

Note: `private` narrows who may *name* a declaration, not whether the name is taken. Two files still cannot each
declare their own `Chevron`. That is an ordinary redeclaration, and visibility has nothing to say about it.

## Inside a type, private means the type

Same word, different question. On a property or a method, `private` means the type that declared it, and only
that type's own bodies get through:

```echo
struct Gate
{
    private int32 $locked;

    constructor()
    {
        $this->locked = 0;
    }

    private function bump() : int32
    {
        $this->locked = $this->locked + 1;
        return $this->locked;
    }

    function lock() : int32
    {
        return $this->bump();
    }
}

$gate = Gate();
echo $gate->lock();     // 1
```

`lock()` reaches `bump()` because they belong to the same type. Now here is the part worth slowing down for.
It is the *type*, and nothing but the type:

```echo
struct Gate
{
    private int32 $locked;

    private function bump() : int32
    {
        $this->locked = $this->locked + 1;
        return $this->locked;
    }
}

struct Dialer
{
    function nudge(Gate& $g) : int32
    {
        return $g->bump();  // error: 'Gate::bump()' is private to 'Gate' and cannot be called from
    }                       //        here. Only that type's own bodies reach it - if it is part of
}                           //        what 'Gate' offers, drop the 'private'.
```

`Dialer` sits in the same file, the same module and the same namespace as `Gate`, and it still does not get in.
Privacy is per type. Being a neighbour counts for nothing. A private *property* refuses the same way, with its
own wording, and a statement at file scope is refused too, being inside no type at all.

The file and module rungs do not exist down here, so `internal` on a member is refused and points you at the
type instead:

```echo
struct Gate
{
    internal int32 $locked;     // error: 'internal' cannot be written here. A member has no module of
}                               //        its own - it is reachable exactly where the type that owns
                                //        it is.
```

That also means `public struct Gate` publishes its constructor and its methods without a word on any of them.
You mark the type, not every line inside it.

One consequence people trip over: a single `private` property suppresses the field-wise constructor outright,
because that constructor writes every property from outside the type. [Structs](/language/structs) has that
case in full.

## public const is the read-only field you actually wanted

Put `const` on a property and you get the field everybody asks for. Readable from anywhere, written once while
the object is being built, refused everywhere else, and that includes inside the type:

```echo
struct Coordinate
{
    public const float64 $x;
    public const float64 $y;

    constructor(float64 $x, float64 $y)
    {
        $this->x = $x;
        $this->y = $y;
    }
}

Coordinate $c = Coordinate(3.0, 4.0);
echo $c->x;     // 3.000000
```

```echo
struct Coordinate
{
    public const float64 $x;

    constructor(float64 $x) { $this->x = $x; }
}

Coordinate $c = Coordinate(3.0);
$c->x = 9.0;    // error: cannot assign to 'x' - it is declared const
```

There is no third rule making that work. `const` on a property is simply the property's *type*, so everything
`const` already does applies: that write is refused the way any write to const storage is, `&$c->x` hands you a
`const float64&`, and passing it to an `inout` parameter does not fit. The one thing a constructor gets is the
field's first write, which it needs in order to exist at all.

The `public` in `public const` is doing nothing, since a member is public anyway. Write it where it helps the
reader and drop it where it does not.

Note: assigning a whole struct still copies a `const` property, because the target's own type is not const.
That is a hole, and it is on [the list](/reference/limitations).

## Seven shapes take no modifier

Write one on any of these and you get a located error. Behind all seven is the same reason: there is nothing
left to narrow.

```echo
struct Gate
{
    private struct Symbol       // error: 'private' cannot be written here. A type declared inside
    {                           //        another is only ever named through its owner, so it is
        int32 $glyph;           //        already as reachable as that owner is.
    }
}
```

- **A nested type** is only ever named through its owner, so it is already as reachable as the owner is.
- **An associated type** is part of what an interface requires, so it is as reachable as the interface.
- **A destructor** is never called by name. The compiler runs it where the value ends.
- **A constant inside a type** is reached through that type, same as a nested type.
- **An operator** has one global symbol and one entry in one precedence table, whichever module declares it.
  See [Operators](/language/operators).
- **An interface requirement** *is* the interface's surface. It is what an implementor promises to answer.
- **Anything inside a body.** A `struct` or `function` written in a block is reachable from that block and
  nowhere else already.

The modifier is consumed before it is refused, so the declaration behind it still parses. One misplaced word
costs you one diagnostic rather than a wrecked file.

Note: the modifier goes after any attributes and directly ahead of the declaration it is about. Put it in front
of an attribute and you get a located error saying exactly that.

## An invisible declaration still competes

If a call resolves to something you are not allowed to see, you get told about that declaration by name. Echo
does not quietly skip it and pick a different overload:

<!-- verify: skip -->
```echo
// in module 'sealedlib'
function scale(int32 $n) : int32 { ... }        // no modifier, so: module only
public function scale(int64 $n) : int64 { ... }

// in your module
echo scale(1);      // error: 'scale(int32)' is internal to the module 'sealedlib', so the module
                    //        'main' cannot name it. Write 'public' on the declaration to make it
                    //        part of what 'sealedlib' offers.
```

`scale(int32)` is the better match, so that is what the call resolves to, and *then* it gets refused. The
alternative is a program that silently calls the `int64` one because the overload you meant was invisible. I
would rather read an error message than debug that on a Friday.

Worth keeping straight: this is not the hiding that [Namespaces](/language/namespaces) describes, where an
outer overload set genuinely never joins the candidates. Here the candidate is right there, wins, and is then
turned down.

## A generic body sees straight past the module rung

One deliberate exception. A generic body is written in one module and compiled into whichever module uses it,
so "which module is asking" has no single answer, and the answer that looks obvious is the one that breaks
things. `map<K, V>` calls `hash::of($key)` on your key type, and for a type you declared, that overload lives
in *your* module:

```echo
struct Glyph
{
    int32 $code;
}

namespace hash;

public function of(const Glyph& $g) : uint64
{
    return hash::of($g->code);
}

namespace app;

echo hash::of(Glyph(7));    // 1346066267577507604
```

Judging that call against the standard library would refuse a program whose author did nothing wrong, so a
generic instantiation is exempt from the module rung entirely. That is a hole, since you can reach another
module's internals by routing a call through a generic, and it is on [the list](/reference/limitations).

## Next

- [Namespaces](/language/namespaces) for the other thing that keeps names apart, and how the two combine.
- [Modules and manifests](/projects/modules) for what a module actually is and how one depends on another.
- [Structs](/language/structs) for the rest of what a property can be, including `mv` and borrowed fields.
