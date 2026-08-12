# Structs

A struct groups a few values into one named thing. If you have written a PHP class with only public
properties, you already know the shape:

```echo
struct GateAddress
{
    int32 $destination;
    int32 $origin;
}

GateAddress $abydos = GateAddress(27, 1);
echo $abydos->destination;      // 27
```

Two things to notice before anything else.

**There is no `new`.** You call the type. `GateAddress(27, 1)` builds one.

**A struct is a value.** It lives where you put it, exactly like an `int32` does. That single fact drives
everything else on this page.

## A struct is copied, not shared

Assigning a struct copies it. The two names are two separate addresses:

```echo
struct GateAddress
{
    int32 $destination;
    int32 $origin;
}

GateAddress $dialled = GateAddress(27, 1);
GateAddress $backup = $dialled;
$backup->destination = 99;

echo $dialled->destination;     // 27, untouched
```

Which is what you want from an address. Writing one down somewhere else should not re-point the original.

This is the opposite of what a PHP object does, and it is the whole reason `class` also exists. If you want
two names for one object, that is a [class](/language/classes). If you want a value you can pass around
without worrying who else is holding it, this is it.

Passing a struct to a function copies it too, unless the parameter asks for a borrow with `&`. See
[Functions](/language/functions).

## The constructor you get for free

Declare properties and you get a constructor that takes them in order, at no cost:

```echo
struct Chevron
{
    int32 $symbol;
    int32 $position;
}

Chevron $first = Chevron(7, 1);
echo $first->symbol;        // 7
```

Two things suppress that free constructor.

**A hand-written constructor with the same signature.** Yours wins, because otherwise there would be two
candidates taking the same arguments:

```echo
struct Chevron
{
    int32 $symbol;
    int32 $position;

    constructor(int32 $symbol, int32 $position)
    {
        $this->symbol = $symbol % 39;   // there are only 39 glyphs on the ring
        $this->position = $position;
    }
}

Chevron $wrapped = Chevron(45, 1);
echo $wrapped->symbol;      // 6
```

A constructor with a *different* signature does not suppress it. Both exist, and overload resolution picks:

```echo
struct Chevron
{
    int32 $symbol;
    int32 $position;

    constructor(int32 $symbol)
    {
        $this->symbol = $symbol;
        $this->position = 1;
    }
}

Chevron $a = Chevron(7);        // yours
Chevron $b = Chevron(7, 4);     // still the free one
echo $a->position;              // 1
echo $b->position;              // 4
```

**A `private` property.** The free constructor writes every property from outside the type, which is exactly
what `private` forbids, so it is not generated at all:

```echo
struct ZPM
{
    private int32 $used;
    int32 $capacity;
}

ZPM $module = ZPM(0, 4096);
// error: The function 'ZPM' could not be found
```

Write your own constructor and the type works again. That is the usual reason to write one.

## Writing a constructor

A constructor is worth writing when the arguments are not the fields:

```echo
struct ZPM
{
    float32 $charge;

    constructor(float32 $percent)
    {
        $this->charge = $percent / 100.0f;
    }
}

ZPM $module = ZPM(75.0f);
echo $module->charge;       // 0.750000
```

`$this` inside a constructor is a local being filled in, not a receiver that already exists. There is no
`return` at the end: the constructor returns the built value implicitly.

Member access is always `->`, including on `$this`. There is no `.` and no `$this.x`.

## Methods

A method is a function declared in the body. It gets `$this`:

```echo
struct ZPM
{
    int32 $used;
    int32 $capacity;

    function remaining() : int32
    {
        return $this->capacity - $this->used;
    }

    function drain(int32 $amount) : void
    {
        $this->used = $this->used + $amount;
    }
}

ZPM $module = ZPM(1000, 4096);
echo $module->remaining();      // 3096
$module->drain(1000);
echo $module->remaining();      // 2096
```

There is nothing special about a method. It is a function whose first parameter is `$this`, which is why
methods and free functions share one overload-resolution rule, and why `const` on the receiver is just a
type on a parameter.

### const function

`const function` promises the method only reads. That promise is what lets a `const` value call it:

```echo
struct ZPM
{
    int32 $used;
    int32 $capacity;

    const function remaining() : int32
    {
        return $this->capacity - $this->used;
    }

    function drain(int32 $amount) : void
    {
        $this->used = $this->used + $amount;
    }
}

const $sealed = ZPM(1000, 4096);
echo $sealed->remaining();      // 3096
```

Call a non-`const` method on a `const` value and you get told why:

```echo
struct ZPM
{
    int32 $used;
    int32 $capacity;

    function drain(int32 $amount) : void
    {
        $this->used = $this->used + $amount;
    }
}

const $sealed = ZPM(1000, 4096);
$sealed->drain(500);
// error: Const violation: cannot call 'ZPM::drain()' on a const 'ZPM' - the method is not declared
//        const, so it may write. Mark it `const function drain(...)` if it only reads.
```

The habit worth forming: mark a method `const` whenever it only reads. It costs nothing and it is what makes
your type usable in a `const` position, including inside somebody else's `const` method.

## Destructors

If your struct owns something that has to be given back, a destructor is where that happens. It runs when
the value goes out of scope:

```echo
struct Wormhole
{
    int32 $id;

    destructor()
    {
        echo $this->id;
    }
}

{
    Wormhole $open = Wormhole(7);
    echo "connected";
}
echo "disengaged";
```

That prints `connected`, then `7`, then `disengaged`. The destructor ran at the closing brace, not at the
end of the program.

Once a struct has a destructor it **owns** something as far as the compiler is concerned, and the rules in
[Ownership and moving](/memory/ownership) start to apply: it cannot be captured by a closure, and copying it
becomes something you have to think about.

## Copy constructors

By default a copy is field by field. When that is wrong, because your struct holds a pointer to something it
allocated, declare a constructor that takes a borrow of its own type. The compiler recognises the shape and
uses it for every copy:

```echo
struct Manifest
{
    int32 $revision;

    constructor(int32 $revision)
    {
        $this->revision = $revision;
    }

    constructor(Manifest& $other)
    {
        $this->revision = $other->revision + 1;
    }
}

Manifest $original = Manifest(10);
Manifest $duplicate = $original;

echo $duplicate->revision;      // 11
```

There is no separate `copy` keyword. A constructor taking `Manifest&` or `const Manifest&` **is** the copy
constructor, and the `+1` above is how you can see it fire.

Prefer `const Manifest&` where you can. A copy constructor taking a mutable borrow cannot be used to copy out
of a `const` value, which quietly rules your type out of a few places. [Copying](/memory/copying) has the
details.

## Nested types

A struct can declare a type inside it. The nested type is reached through `::`:

```echo
struct GateAddress
{
    int32 $count;

    struct symbol
    {
        int32 $index;

        function next() : void
        {
            $this->index = $this->index + 1;
        }
    }

    function iterate() : GateAddress::symbol
    {
        return GateAddress::symbol(0);
    }
}

GateAddress $abydos = GateAddress(7);
$glyph = $abydos->iterate();
echo $glyph->index;     // 0
$glyph->next();
echo $glyph->index;     // 1
```

This is how cursors are written in the standard library, and it keeps a helper type from cluttering the
namespace it sits in. The nested name is spelled in full, `GateAddress::symbol`, everywhere including inside
the outer type.

## private

`private` restricts a member, property or method alike, to the type's own bodies:

```echo
struct ZPM
{
    private int32 $used;
    int32 $capacity;

    constructor(int32 $capacity)
    {
        $this->used = 0;
        $this->capacity = $capacity;
    }

    const function remaining() : int32
    {
        return $this->capacity - $this->used;
    }
}

ZPM $module = ZPM(4096);
echo $module->remaining();      // 4096
```

Nothing outside `ZPM` reads `$used`, and a `private function` is refused from outside the same way. Watch out
for one thing: on a *top-level* declaration the word means the file rather than the type, which is a
different question entirely. [Visibility](/language/visibility) is the whole of that.

A private property may own something, an `array`, a `string`, another struct that owns one, and hiding it is
usually the point: what a type keeps behind `private` is normally exactly what it has an invariant about. You
pay nothing for it. The compiler writes the teardown from inside the type, so the destructor reaches a
property that no caller can name.

## Interfaces

A struct can conform to an interface, and that gives you a compile-time contract rather than dynamic
dispatch:

```echo
interface Powered
{
    const function draw() : float64;
}

struct ZPM : Powered
{
    float64 $output;

    const function draw() : float64
    {
        return $this->output;
    }
}

function report<T : Powered>(const T& $unit) : void
{
    echo $unit->draw();
}

report(ZPM(2.5));       // 2.500000
```

What a struct **cannot** do is be stored *as* a `Powered`. That needs a vtable and a stable address, which a
value type does not have. [Interfaces](/language/interfaces) explains why that split is deliberate, and
[Classes](/language/classes) is the half that can.

## Next

- [Classes](/language/classes) for the reference-counted, shareable half of the same syntax.
- [Ownership and moving](/memory/ownership) for what happens once a struct owns something.
- [Interfaces](/language/interfaces) for conformance and constraints.
