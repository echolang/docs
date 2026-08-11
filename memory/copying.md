# Copying

Assigning a struct copies it, which is what you would expect from a value:

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

For two `int32`s that copy is the bytes and there is nothing to discuss. **The interesting part starts when
one of the fields owns something**, because then a copy is a real operation and somebody has to say what it
means.

## A copy happens in three places

There is no `copy` keyword, so it is worth knowing where one appears without you writing anything:

**Assigning or declaring from another value.**

```echo
struct GateAddress { int32 $destination; int32 $origin; }

GateAddress $dialled = GateAddress(27, 1);
GateAddress $backup = $dialled;         // copy
echo $backup->origin;                   // 1
```

**Passing by value.** A parameter without `&` and without `mv` is the function's own copy.

**Handing back a value you only borrowed.** The callee does not own `$src`, so it cannot give it away:

```echo
struct GateAddress { int32 $destination; int32 $origin; }

function duplicate(const GateAddress& $src) : GateAddress
{
    return $src;                        // copy
}

GateAddress $abydos = GateAddress(27, 1);
echo duplicate($abydos)->destination;   // 27
```

Returning a *local* is not a copy, it is a move. See [Ownership and moving](/memory/ownership).

## The free copy is field by field

If you write nothing, the compiler folds an answer out of your properties, one property at a time, all the
way down through nested structs. A field that copies as bytes copies as bytes. A field that is a class handle
becomes one more reference. A field with a copy constructor of its own gets its constructor called:

```echo
struct ZPM
{
    int32 $serial;

    constructor(int32 $serial)
    {
        $this->serial = $serial;
    }

    constructor(const ZPM& $other)
    {
        echo "cloning a ZPM";
        $this->serial = $other->serial;
    }
}

struct Bay
{
    ZPM $left;
    ZPM $right;
}

Bay $primary = Bay(ZPM(1), ZPM(2));
Bay $spare = $primary;

echo $spare->right->serial;     // 2
```

`Bay` has no copy constructor and does not need one. It printed `cloning a ZPM` twice, once per field, and
that composition is the whole rule: a struct is copyable exactly when every part of it is.

## Two things stop the compiler writing one

**A property with no rule of its own.** A raw `ptr<uint8>` is an address, and duplicating an address gives
you two values that both think they own the allocation:

```echo
struct GateLog
{
    int32 $id;
    ptr<uint8> $entries;

    destructor()
    {
        mem::free($this->entries);
    }
}

GateLog $primary = GateLog(1, mem::alloc<uint8>(64));
GateLog $backup = $primary;
// error: 'GateLog' owns a resource and cannot be copied implicitly at this declaration
```

The message tells you the three ways out, and they are the three real options: move it, borrow it, or say
what a copy means.

**A declared destructor.** Even when every field has an answer, a destructor stops the synthesis:

```echo
class Wormhole
{
    int32 $id;
}

struct Gate
{
    Wormhole $active;

    destructor()
    {
        echo "shutting down";
    }
}

Gate $sgc = Gate(Wormhole(1));
Gate $spare = $sgc;
// error: 'Gate' owns a resource and cannot be copied implicitly at this declaration
```

That one looks harsh at first. A `Wormhole` handle copies fine on its own, so why not copy the `Gate`? Because
you wrote a destructor, which means the value does something on the way out, and duplicating it would run that
body twice over a thing you never said could be duplicated. If it can, say so.

## A copy constructor is a constructor that takes its own type

There is no separate syntax. A constructor whose only parameter is a borrow of the type it belongs to **is**
the copy constructor, and the compiler uses it for every copy of that type:

```echo
struct GateLog
{
    int32 $id;
    ptr<uint8> $entries;

    constructor(int32 $id)
    {
        $this->id = $id;
        $this->entries:$ = mem::alloc<uint8>(64);
    }

    constructor(const GateLog& $other)
    {
        echo "copying the log";
        $this->id = $other->id;
        $this->entries:$ = mem::alloc<uint8>(64);
    }

    destructor()
    {
        mem::free($this->entries);
    }
}

GateLog $primary = GateLog(1);
GateLog $backup = $primary;

echo $backup->id;       // 1
```

Note `$this->entries:$ = ...`. Writing `$this->entries = ...` would write *through* the pointer rather than
setting it, which is a whole topic of its own: [Pointers and references](/memory/pointers).

The same declaration is reached whether you write `$backup = $primary` or spell it out as
`GateLog($primary)`. A type gets exactly one copy constructor, so declaring both `GateLog&` and
`const GateLog&` is an error rather than an overload set.

## Prefer const on the source

Write `const GateLog&` unless you genuinely need to write to the source. A mutable borrow reserves the right
to modify the thing being copied, and the compiler takes that seriously: a value it cannot promise not to
write to cannot be copied out of a `const` place.

```echo
struct GateLog
{
    int32 $id;

    constructor(int32 $id)
    {
        $this->id = $id;
    }

    constructor(GateLog& $other)
    {
        $this->id = $other->id;
    }
}

const GateLog $sealed = GateLog(1);
GateLog $working = $sealed;
// error: cannot implicitly convert 'const GateLog&' to 'GateLog&'
```

Change that one word to `const GateLog& $other` and the same program compiles. The cost of getting it wrong
is not obvious at the declaration and shows up much later, in somebody else's `const` method, which is why it
is worth making a habit.

This propagates. A struct holding your type can only promise a `const` source if your type does, so one
mutable copy constructor at the bottom of a graph rules the whole graph out. `array<T>` copies its elements
out of a `const` borrow of itself, so an element type with a mutable copy constructor cannot live in a copied
array at all, and the error you get points at a line inside the standard library rather than at your
declaration. That is the "much later, somewhere else" I mean.

## A class is retained, not copied

A [class](/language/classes) is a reference-counted object, so assigning one is one more name for the same
object and never a duplicate:

```echo
class Counter
{
    int32 $value;
}

Counter $a = Counter(7);
Counter $b = $a;

$b->value = 99;
echo $a->value;         // 99, one object
```

A class may still declare `constructor(Counter& $other)`, and it will never be used for `$b = $a`. It is an
ordinary constructor that happens to take a `Counter`, and calling it builds a second object:

```echo
class Counter
{
    int32 $value;

    constructor(int32 $value)
    {
        $this->value = $value;
    }

    constructor(Counter& $other)
    {
        $this->value = $other->value + 100;
    }
}

Counter $a = Counter(7);

Counter $shared = $a;           // a retain
Counter $built = Counter($a);   // a construction

echo $shared->value;            // 7
echo $built->value;             // 107

$shared->value = 9;
echo $a->value;                 // 9, same object
echo $built->value;             // 107, a different one
```

That is deliberate and it is asked in that order: a class is a reference before it is anything else. If you
want a second object, say `Counter($a)` and it is right there in the source.

## clone() says it out loud

The standard library's containers copy deeply on assignment, which is what you want and also what you might
not notice:

```echo
array<int32> $glyphs = [1, 2, 3];
array<int32> $spare = $glyphs;      // a full copy of the buffer
$spare[] = 4;

echo $glyphs->count();              // 3
echo $spare->count();               // 4
```

`clone()` is exactly the same operation with the cost written at the call site:

```echo
array<int32> $glyphs = [1, 2, 3];
array<int32> $spare = $glyphs->clone();
$spare[] = 4;

echo $glyphs->count();              // 3
echo $spare->count();               // 4
```

Which is the point of it being a method rather than a rule. It buys you nothing the assignment did not
already do, and a reader scanning the line does not have to know what `array<T>` decided about copies to see
that a buffer got duplicated. `array<T>`, `map<K, V>`, `ordered_map<K, V>` and `string` all have one.

`string` is the one where the two differ in cost. It shares its buffer until somebody writes, so an
assignment is cheap and `clone()` gives you an independent one up front. The observable behaviour is the
same either way:

```echo
string $address = "abydos";
string $label = $address;
$label->append("!");

echo $address;      // abydos
echo $label;        // abydos!
```

## unique, for a type only one value may ever name

`#[unique]` on a struct says exactly one value may name this type's storage. Copying is not refused because
nobody said how, it is refused because there is no such thing:

```echo
#[unique]
struct Handle
{
    int32 $id;
}

Handle $a = Handle(7);
Handle $b = $a;
// error: 'Handle' is unique: exactly one value may name its storage, so it is moved and never copied
```

Move it or borrow it:

```echo
#[unique]
struct Handle
{
    int32 $id;
}

function read_id(const Handle& $h) : int32
{
    return $h->id;
}

Handle $a = Handle(7);
Handle $b = mv $a;

echo read_id($b);       // 7
```

The refusal is inherited: a struct holding a unique value cannot be copied either, and that is what makes
"two live values means two regions" a fact about the type rather than a convention people follow.

This is what `mem::buffer<T>` is built on, and it is the reason `array<T>` can be sure its buffer is its own.
It is refused on a class and on an interface, with a sentence each explaining why the question does not
apply: a class is already one object, and an interface stores nothing.

## Next

- [Ownership and moving](/memory/ownership) for `mv`, destruction and the alternative to copying.
- [Structs](/language/structs) for constructors, destructors and `const function`.
- [Classes](/language/classes) for reference counting and what a handle really is.
