# Interfaces

An interface is a list of things a type promises it can do:

```echo
interface Vessel
{
    function hyperspace_speed() : int32;
}

class Hatak : Vessel
{
    int32 $glider_bays;

    function hyperspace_speed() : int32
    {
        return 32;
    }
}

Hatak $enemy = Hatak(4);
echo $enemy->hyperspace_speed();    // 32
```

So far, so ordinary. Here is the part that is different: **an interface does two separate jobs in Echo, and
a given type can usually only do one of them.**

1. It constrains a **type parameter**, and the call is resolved at compile time with no dispatch at all.
2. It is a **type a class value can have**, and the call goes through a vtable.

Both are useful. They have different costs and different rules, and keeping them apart is deliberate rather
than an accident waiting to be tidied up.

## What an interface may contain

Function signatures ending in a semicolon, operator requirements, and associated types. That is all:

```echo
interface Vessel
{
    const function mass() : float64;
    function jump(int32 $light_years) : void;
}
```

No properties:

```echo
interface Vessel
{
    int32 $hull_plating;
}
// error: 'Vessel' is an interface, so it cannot declare a property. An interface holds requirements
//        only - a `function` or `operator` signature ending in ';'.
```

No bodies, no constructor, no destructor, no nested types. An interface describes a capability. It has no
storage and no behaviour of its own, which is what keeps conformance from being inheritance.

## Declaring conformance

Write the interface after a colon:

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

ZPM $module = ZPM(2.5);
echo $module->draw();       // 2.500000
```

Miss a requirement and you are told at the declaration, not at some distant call site:

```echo
interface Vessel
{
    function hyperspace_speed() : int32;
}

class Puddlejumper : Vessel
{
}
// error: 'Puddlejumper' says it conforms to 'Vessel' but does not satisfy
//        'hyperspace_speed() : int32' - it declares no 'hyperspace_speed'.
```

Note that `const` is part of the requirement. A `const function draw()` in the interface must be answered by
a `const function draw()`, because const-ness of the receiver is part of the signature rather than a flag on
the side.

This is not inheritance. There is no base type, nothing is shared, and an interface cannot extend another
interface.

## Job one: constraining a type parameter

This is the one to reach for by default. Put the interface on a type parameter and the compiler generates a
separate copy of the function for each concrete type:

```echo
interface Powered
{
    const function draw() : float64;
}

struct ZPM : Powered
{
    float64 $output;

    const function draw() : float64 { return $this->output; }
}

struct NaquadahReactor : Powered
{
    float64 $cells;

    const function draw() : float64 { return $this->cells * 0.5; }
}

function report<T : Powered>(const T& $unit) : void
{
    echo $unit->draw();
}

report(ZPM(2.5));               // 2.500000
report(NaquadahReactor(5.0));   // 2.500000
```

There is no dispatch here. `report<ZPM>` calls `ZPM::draw` directly and the call can be inlined. The
interface exists only to check, at compile time, that the type has what the body uses.

Structs work fine in this role, which is the point: **this is the only way a struct participates in an
interface.**

## Job two: an interface as a stored type

A class can be stored as its interface. The concrete type disappears from the type system:

```echo
interface Vessel
{
    function hyperspace_speed() : int32;
    function crew() : int32;
}

class Hatak : Vessel
{
    int32 $glider_bays;

    function hyperspace_speed() : int32 { return 32; }
    function crew() : int32 { return $this->glider_bays * 250; }
}

class Daedalus : Vessel
{
    int32 $railguns;

    function hyperspace_speed() : int32 { return 90; }
    function crew() : int32 { return 200; }
}

Vessel $contact = Hatak(4);
echo $contact->hyperspace_speed();      // 32
echo $contact->crew();                  // 1000

$contact = Daedalus(16);
echo $contact->hyperspace_speed();      // 90
echo $contact->crew();                  // 200
```

One variable, two different concrete types over its lifetime, dispatch decided at runtime. This is what you
would expect from PHP or Java, and it costs a vtable pointer and an indirect call.

### Why a struct cannot do this

Try it and the compiler explains itself:

```echo
interface Vessel
{
    function hyperspace_speed() : int32;
}

struct F302 : Vessel
{
    int32 $missiles;

    function hyperspace_speed() : int32 { return 0; }
}

Vessel $contact = F302(8);
// error: Invalid type conversion: 'F302' is a struct, so it cannot be stored as 'Vessel' -
//        a struct carries no runtime type to dispatch through. Take it through a constrained
//        generic instead, e.g. 'function f<T: Vessel>(T& $v)'.
```

A `Vessel` value has to be one size regardless of what is inside it, and it has to carry enough information
to find the right `hyperspace_speed`. A class gets both for free: it is always a pointer, and its heap block
already holds a type pointer. A struct is neither, and making it work would mean boxing it silently, which
is an allocation you did not ask for.

So the rule is: **struct for the compile-time job, class for the runtime job.** The error message points you
at the other one, which is usually the fix.

## instanceof

An interface value can be asked what it really is:

```echo
interface Vessel
{
    function hyperspace_speed() : int32;
}

class Hatak : Vessel
{
    int32 $glider_bays;

    function hyperspace_speed() : int32 { return 32; }
}

Vessel $contact = Hatak(4);

echo $contact instanceof Hatak;     // 1
echo $contact instanceof Vessel;    // 1
```

Works against the concrete class and against the interface. See [Classes](/language/classes).

## Requiring an operator

An interface can require an operator, which is how you say "these values can be compared" without naming a
method:

```echo
interface Comparable<T>
{
    operator (T $a) < (T $b) : bool;
}

struct Naquadah : Comparable<Naquadah>
{
    uint64 $milligrams;
}

operator (Naquadah $a) < (Naquadah $b) : bool
{
    return $a->milligrams < $b->milligrams;
}

function lighter<T : Comparable<Naquadah>>(T& $a, T& $b) : bool
{
    return $a < $b;
}

Naquadah $sample = Naquadah(100);
Naquadah $payload = Naquadah(250);

echo lighter($sample, $payload);    // 1
```

The operator itself is declared at file scope, not inside the struct, because
[operators are always free functions](/language/operators). The interface requirement just says one must
exist.

An interface with an operator requirement cannot be a stored type. There is no vtable slot for `<`.

## Generic interfaces

An interface can take type parameters, and a conformance names the arguments:

```echo
interface Container<T>
{
    const function first() : T;
}

struct Coordinate : Container<int32>
{
    int32 $x;
    int32 $y;

    const function first() : int32 { return $this->x; }
}

Coordinate $target = Coordinate(12, 40);
echo $target->first();      // 12
```

## Associated types

Sometimes a requirement's type is not known until the implementing type says so. The classic case is
iteration: a collection has a cursor, but every collection has its *own* cursor type.

`type Iter : Stepper<V>` declares that:

```echo
interface Stepper<V>
{
    function advance() : bool;
    function current() : V;
}

interface Walkable<V>
{
    type Iter : Stepper<V>;
    function iterate() : Iter;
}

struct symbol_cursor : Stepper<int32>
{
    int32 $at;

    function advance() : bool
    {
        $this->at = $this->at + 1;

        if ($this->at > 3) {
            return false;
        }

        return true;
    }

    function current() : int32 { return $this->at; }
}

struct GateAddress : Walkable<int32>
{
    function iterate() : symbol_cursor { return symbol_cursor(0); }
}

function total<C : Walkable<int32>>(C& $address) : int32
{
    $it = $address->iterate();
    int32 $sum = 0;

    while ($it->advance()) {
        $sum = $sum + $it->current();
    }

    return $sum;
}

echo total(GateAddress());      // 6
```

`GateAddress` never writes `type Iter = symbol_cursor`. The compiler infers it from the return type of
`iterate()` and then checks that `symbol_cursor` really does conform to `Stepper<int32>`.

An interface with an associated type cannot be a stored type either, for the same reason as the operator
case: the size and shape are not known until the concrete type is.

This is exactly how `foreach` works. `contract::iterable<V>` in `stdlib/core/contract.eco` is one of these,
and the compiler knows those three interfaces and nothing else about iteration. Your own type loops as well
as `array<T>` does because there is no arm anywhere that knows what an array is. See
[Iteration](/collections/iteration).

## There is no Self

Some languages let a requirement name the implementing type. Echo does not have `Self`. Where you need it,
make the interface generic and pass the type in, as `Comparable<Naquadah>` does above.

## Next

- [Generics](/language/generics) for the type parameters these constrain.
- [Classes](/language/classes) for the half that can be a stored interface value.
- [Iteration](/collections/iteration) for `contract::iterable` and writing your own cursor.
