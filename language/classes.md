# Classes

A class is declared exactly like a [struct](/language/structs), with one keyword changed:

```echo
class Stargate
{
    int32 $lockedChevrons;

    function lock() : void {
        $this->lockedChevrons = $this->lockedChevrons + 1;
    }
}

Stargate $sgc = Stargate(0);
$sgc->lock();
echo $sgc->lockedChevrons;     // 1
```

Same syntax, same constructors, same methods, same `const function`. **The semantics are the opposite.** A
struct is a value that gets copied. A class lives on the heap, is reference counted, and assigning it hands
out another name for the same object:

```echo
class Counter
{
    int32 $value;
}

Counter $a = Counter(0);
Counter $b = $a;
$b->value = 99;

echo $a->value;     // 99, because there is only one object
```

That is the whole decision: **one owner and a copy, or many owners and a shared object.** Everything below
follows from it.

## Which one should you reach for

Reach for a `struct` by default. It is cheaper, it has no allocation, and a value you cannot accidentally
share is a value you cannot accidentally corrupt.

Reach for a `class` when:

- two parts of your program genuinely need to see the same mutations
- the thing has identity rather than just contents (a connection, a window, a node in a graph)
- you need to store it behind an interface, which a struct cannot do

## What it costs

One heap allocation per object, and a header alongside your properties holding a strong count, a weak count
and a type pointer. Every assignment is a counter increment, every scope exit a decrement.

You can watch it happen:

```echo
class Handle
{
    int32 $x;
}

Handle $a = Handle(1);
echo mem::refs($a);        // 1

Handle $b = $a;
echo mem::refs($a);        // 2
```

`mem::refs` and `mem::weaks` exist for exactly this: understanding what your program is actually
doing. They are not something to build logic on.

## When the destructor runs

Not at the closing brace. When the **last** reference goes away:

```echo
class Resource
{
    int32 $tag;

    destructor()
    {
        echo $this->tag;
    }
}

function scope() : void
{
    Resource $a = Resource(7);
    Resource $b = $a;
    echo "inside";
}

scope();
echo "after";
```

That prints `inside`, then `7`, then `after`. `$b` going out of scope dropped the count to one, and `$a`
going out of scope dropped it to zero, which is the moment the destructor ran.

This is the practical difference from a struct, where the destructor runs at a brace you can point at. With
a class, teardown happens wherever the last holder happens to be.

## A class is not nullable by default

Declaring a `Stargate` promises there is a gate there:

```echo
class Stargate
{
    int32 $lockedChevrons;
}

Stargate $sgc = Stargate(0);
echo $sgc->lockedChevrons;     // 0
```

If absence is a real state, say so with `?`:

```echo
class Wormhole
{
    int32 $id;
}

class Stargate
{
    int32 $lockedChevrons;
    Wormhole? $active;
}

Stargate $idle = Stargate(0, null);
echo $idle->lockedChevrons;    // 0
```

`Wormhole? $active` is the honest type. A gate is idle most of the time, and a plain `Wormhole $active`
would demand a connection that never closes.

Everything in [Nullability](/memory/nullability) applies: `guard` to narrow, `??` for a fallback, `?->` to
short-circuit a chain.

Note: `Stargate $sgc;` with no initializer currently compiles and hands you a null handle, which slips past
this rule. That is a hole, not a feature, and it is on [the list](/reference/limitations).

## Statics work here on exactly the struct's terms

A `static function` called on the type, a `static` property the type owns one of, the leading-dot shorthand,
all of it. The rules do not change for a class, so they are written up once, on
[the struct page](/language/structs#a-static-belongs-to-the-type-not-to-a-value).

The one thing worth repeating here is what a class adds. A `static` property holding a class handle owns a
reference like any other and gives it back when the program ends, so a class parked in a static stays alive
for the whole run. Usually that is the point. Occasionally it is the bug.

## instanceof

Because a class object carries a type pointer, you can ask what it is:

```echo
class Hatak
{
    int32 $gliderBays;
}

class Daedalus
{
    int32 $railguns;
}

Hatak $enemy = Hatak(4);

echo $enemy instanceof Hatak;       // 1
echo $enemy instanceof Daedalus;    // 0

if ($enemy instanceof Hatak) {
    echo "raise shields";
}
```

A null handle is not an instance of anything, which is the answer you want:

```echo
class Hatak
{
    int32 $gliderBays;
}

Hatak? $sensorContact = null;
echo $sensorContact instanceof Hatak;      // 0
```

`instanceof` works against an interface too, and that is where it earns its keep. See
[Interfaces](/language/interfaces).

It does **not** work on a struct. A struct has no header and no type pointer, so there is nothing to ask.

## Interfaces, and the vtable

A class is the half of the language that can be stored *as* an interface:

```echo
interface Vessel
{
    function hyperspaceSpeed() : int32;
}

class Hatak : Vessel
{
    int32 $gliderBays;

    function hyperspaceSpeed() : int32
    {
        return 32;
    }
}

class Daedalus : Vessel
{
    int32 $railguns;

    function hyperspaceSpeed() : int32
    {
        return 90;
    }
}

Vessel $contact = Hatak(4);
echo $contact->hyperspaceSpeed();      // 32

$contact = Daedalus(16);
echo $contact->hyperspaceSpeed();      // 90
```

One variable, two different concrete types over its lifetime, dispatch decided at runtime. This is what you
would expect from PHP or Java, and it costs a vtable pointer and an indirect call.

That is the job a struct cannot do, and [Interfaces](/language/interfaces) explains why the split is
deliberate rather than a gap waiting to be filled.

## Reference cycles leak

Reference counting has one well-known failure and Echo does not paper over it. If two objects hold strong
references to each other, neither count ever reaches zero.

The gate and its wormhole are exactly that shape. The gate owns the connection it opened:

```echo
class Wormhole
{
    int32 $id;

    destructor()
    {
        echo $this->id;
    }
}

class Stargate
{
    int32 $lockedChevrons;
    Wormhole? $active;

    destructor()
    {
        echo 100;
    }
}

function dial() : void
{
    Stargate $sgc = Stargate(7, null);
    Wormhole $outbound = Wormhole(1);

    $sgc->active = $outbound;
    // if Wormhole also held a strong Stargate, neither destructor would ever run
}

dial();
echo "done";
```

There is no cycle collector and there is not going to be one. The fix is to decide which direction of the
relationship owns, and make the other one weak.

## weak references

`weak<T>` refers to an object without keeping it alive. Here the direction is obvious: the gate owns the
wormhole it opened, and the wormhole only needs to know where it came from.

```echo
class Wormhole
{
    int32 $id;
    weak<Stargate> $origin;

    destructor()
    {
        echo $this->id;
    }
}

class Stargate
{
    int32 $lockedChevrons;
    Wormhole? $active;

    destructor()
    {
        echo 100;
    }
}

function dial() : void
{
    Stargate $sgc = Stargate(7, null);
    Wormhole $outbound = Wormhole(1, null);

    $sgc->active = $outbound;       // strong, forward
    $outbound->origin = &$sgc;      // weak, backward

    echo mem::refs($sgc);      // 1
    echo mem::refs($outbound); // 2
}

dial();
echo "done";
```

Both destructors run. The forward edge owns, the backward edge watches, and the counts reach zero in order.

Note the `&` on `$outbound->origin = &$sgc`. The destination decides that this is a weak reference, and the
`&` is how you write taking a reference to something you do not intend to own.

### Using a weak reference

A weak reference cannot be read directly, because the object may be gone. Upgrade it with `strong()`, which
gives you a `T?`:

```echo
class Stargate
{
    int32 $lockedChevrons;
}

Stargate $sgc = Stargate(7);
weak<Stargate> $watcher = &$sgc;

Stargate $stillThere = guard strong($watcher) else { die("gate is gone"); }
echo $stillThere->lockedChevrons;     // 7
```

`strong` is a free function, not a method: `strong($watcher)`, not `$watcher->strong()`.

For convenience the three optional forms accept a `weak<T>` directly and do the upgrade for you:

```echo
class Stargate
{
    int32 $lockedChevrons;
}

Stargate $sgc = Stargate(7);
weak<Stargate> $watcher = &$sgc;

echo $watcher?->lockedChevrons ?? -1;      // 7
Stargate $stillThere = guard $watcher else { die("gate is gone"); }
echo $stillThere->lockedChevrons;         // 7
```

Once the object is gone, all of those answer absent rather than reading freed memory. The weak count is what
keeps the block readable long enough to answer the question, which is why teardown is two moments: the
payload dies when the strong count hits zero, and the block is freed when the weak count follows.

## Next

- [Structs](/language/structs) for the value half, and the constructor rules both share.
- [Interfaces](/language/interfaces) for storing a class behind a contract.
- [Nullability](/memory/nullability) for `T?`, `guard`, `??` and `?->`.
