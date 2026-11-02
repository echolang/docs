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

So far, so ordinary. Here's the part that is different: **an interface does two separate jobs in Echo, and
a given type can usually only do one of them.**

1. It constrains a **type parameter**, and the call is resolved at compile time with no dispatch at all.
2. It is a **type a class value can have**, and the call goes through a vtable.

Both are useful. They have different costs and different rules, and keeping them apart is deliberate rather
than an accident waiting to be tidied up.

## What it may contain

Function signatures, operator requirements, and associated types. A signature ends in a
semicolon, or in a body that is its [default](#default-bodies). That's all:

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

No constructor, no destructor, no nested types. An interface describes a capability. It has
no storage of its own, which is what keeps conformance from being inheritance.

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

This is not inheritance. There is no base type, no state is shared, and an interface can't extend another
interface.

## Default bodies

Sometimes a lot of conformers would write the same method. Put the body on the interface. A
conformer that declares the method answers the requirement as usual. One that doesn't gets the
default.

```echo
interface Gate
{
    const function address() : string;

    const function dial() : void
    {
        echo "dialling {$this->address()}";
    }
}

class Abydos : Gate
{
    const function address() : string { return '27-07-15-32-12-30'; }
}

Abydos()->dial();       // dialling 27-07-15-32-12-30
```

`Abydos` wrote one method and has two. That's the point.

Inside a default, `$this` is the conformer itself, not the interface. The body is instantiated
once per conforming type, the same way a constrained generic is, so `$this->address()` above is
a direct call to `Abydos::address`. No dispatch in between.

And since an interface has no properties, a default can only combine what the conformer already
provides. It never touches state.

Writing the method yourself wins, matched by name, every time:

```echo
interface Gate
{
    const function address() : string;

    const function dial() : void
    {
        echo "dialling {$this->address()}";
    }
}

class Chulak : Gate
{
    const function address() : string { return '09-02-23-15-37-20'; }

    const function dial() : void
    {
        echo 'jaffa, kree!';
    }
}

Chulak()->dial();       // jaffa, kree!
```

The catch: a method of that name with the wrong shape is a mistake, not something the default
quietly covers for.

<!-- verify: skip -->
```echo
interface Gate
{
    const function address() : string;
    const function dial() : void { echo $this->address(); }
}

class Chulak : Gate
{
    const function address() : string { return '09-02-23-15-37-20'; }
    const function dial(int32 $chevrons) : void { echo $chevrons; }
}
// error: 'Chulak' says it conforms to 'Gate' but does not satisfy 'const dial() : void' - the closest it
//        declares is 'const Chulak::dial(int32)'.
```

Defaults can call each other. A call from a default to another requirement goes to the
conformer's version. Its own, if it wrote one:

```echo
interface Sized
{
    const function count() : usize;

    const function empty() : bool { return $this->count() == 0; }
    const function any() : bool { return !$this->empty(); }
}

class Fleet : Sized
{
    public array<string> $ships = [];

    const function count() : usize { return $this->ships->count(); }
    const function empty() : bool { echo 'checked'; return $this->ships->empty(); }
}

echo Fleet()->any();    // checked, then 0
```

`any()` is the default. It called `Fleet`'s own `empty()`.

A generic interface takes its parameters from the conformance. Nothing at the call has to
mention `T`:

```echo
interface Stack<T>
{
    function items() : array<T>&;

    function push(T $value) : void { $this->items()->push($value); }
}

class Cargo : Stack<string>
{
    public array<string> $hold = [];

    function items() : array<string>& { return $this->hold; }
}

Cargo $c = Cargo();
$c->push('naquadah');      // T is string, because Cargo says Stack<string>
echo $c->hold->count();    // 1
```

All three ways of calling reach the same body: a direct call, a constrained generic, and a
stored interface value. For a class that wrote nothing, the stored value's slot holds the
default.

Two things a default can't do. It cannot reach anything the interface does not require. There is no telling what a conformer
will have. Today that's caught per conformer, when the default is instantiated for it:

<!-- verify: skip -->
```echo
interface Gate
{
    const function address() : string;
    const function log() : void { echo $this->name(); }
}

class Abydos : Gate
{
    const function address() : string { return '27-07-15-32-12-30'; }
}
// error: The type 'const Abydos' has no member named 'name'
//   note: this is a default body of 'Gate', checked against each conformer it is instantiated for - a
//         default can rely only on what 'Gate' requires
```

And if two of a type's interfaces both offer a default of the same name, the type has to pick:

<!-- verify: skip -->
```echo
interface Dialer
{
    const function address() : string;
    const function engage() : void { echo "dialling {$this->address()}"; }
}

interface Cloaking
{
    const function engage() : void { echo 'cloaked'; }
}

class Alkesh : Dialer, Cloaking
{
    const function address() : string { return '16-28-03-09-31-11'; }
}
// error: 'Alkesh' gets a default 'engage' from both 'Dialer' and 'Cloaking'. Declare 'engage' on 'Alkesh'
//        to say which one it means.
```

A static requirement cannot have a default. Neither can an `extern interface`: those bodies are
the calls the compiler writes through a plugin's table.

## Job one: constraints

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

## Job two: stored values

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

One variable, two different concrete types over its lifetime, dispatch decided at runtime. It costs a
vtable pointer and an indirect call.

A generic class is still a class. Once you have written `View<int32>`, storing it as an interface it
conforms to is the same widening:

```echo
interface Store
{
    function contains(uint32 $e) : bool;
}

class View<T> : Store
{
    uint32 $id;

    function contains(uint32 $e) : bool
    {
        return $e == $this->id;
    }
}

View<int32> $ints = View<int32>(1);
Store $held = $ints;
echo $held->contains(1);        // 1
```

Two instantiations in one `array<Store>` dispatch independently, which is the thing a constrained
generic cannot say: `function f<T: Store>(T& $s)` is one `T` per instantiation.

### Why not a struct

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
is an allocation you didn't ask for.

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

`instanceof` does not change the type of the value. Once a class is stored as `Vessel`, you talk to
it as a `Vessel`. Asking it to be something else is a recast, and you write it:

```echo
interface Vessel
{
    function hyperspace_speed() : int32;
}

interface Armed
{
    function guns() : int32;
}

class Hatak : Vessel, Armed
{
    int32 $glider_bays;

    function hyperspace_speed() : int32 { return 32; }
    function guns() : int32 { return $this->glider_bays * 2; }
}

Vessel $contact = Hatak(4);
Armed $guns = $contact as Armed;
echo $guns->guns();             // 8
```

If the object does not conform, the program stops. `$x as Other?` is the same check with absence
instead of a stop, so you can `guard` it. Implicit `Armed $guns = $contact` is still refused. The
conversion is written.

A generic `function bind<T : Vessel>(T $x)` can recast inside `if ($x instanceof Armed)` even when
some instantiations of `T` are not `Armed`. Both arms are type-checked for every `T`. The recast is
a runtime check, not a static conversion that would refuse the non-conforming ones.

`$contact as Hatak` is the same idea against the class, and hands the object handle back.

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

An interface with an operator requirement can't be a stored type. There is no vtable slot for `<`.

## Primitives

`int32` cannot write `: contract::comparable<int32>`. There is no declaration to hang a
conformance on. For an interface whose requirements are all operators, that is fine: the
operators are the language's own, so the type conforms structurally.

```echo
function lighter<T : contract::comparable<T>>(T $a, T $b) : bool
{
    return $a < $b;
}

echo lighter(1, 3);         // 1
echo lighter(1.5, 0.5);     // 0
```

A `bool` has no `<`, so it does not. A simd comparison produces a mask, not a `bool`, so
`simd<int32, 4>` does not either.

A struct still has to opt in, even if it already declared `<`. Having the operator is not
enough. That is the point of the contract: accidental `<` does not make you sortable.
[Sorting](/collections/sorting) is what that is for.

A method requirement still refuses a primitive. There is no `int32::compare()`.

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

A constraint can name the associated type itself, or another one the same interface declares.
The order they are written in does not matter: they are checked once every associated type is
bound.

```echo
interface Index<K>
{
    function width() : int32;
}

interface Ledger
{
    type Table : Index<Key>;
    type Key : contract::comparable<Key>;

    function table() : Table;
    function first() : Key;

    function later(Key $a, Key $b) : Key
    {
        if ($a < $b) {
            return $b;
        }

        return $a;
    }
}

struct Wide : Index<int64>
{
    function width() : int32 { return 8; }
}

class Chevrons : Ledger
{
    function table() : Wide { return Wide(); }
    function first() : int64 { return 1; }
}

echo Chevrons()->later(7, 3);   // 7
```

`Key` is `int64`, so `contract::comparable<Key>` is asked as `contract::comparable<int64>`, and
`Table` has to be an `Index<int64>`. A default like `later` can use an associated type in its
signature and its body. Each conformer's instance gets its own.

An interface with an associated type can't be a stored type either, for the same reason as the operator
case: the size and shape are not known until the concrete type is.

This is exactly how `foreach` works. `contract::iterable<V>` in `stdlib/core/contract.eco` is one of these,
and the compiler knows those three interfaces and nothing else about iteration. Your own type loops as well
as `array<T>` does because there is no arm anywhere that knows what an array is. See
[Iteration](/collections/iteration).

## No Self

Some languages let a requirement name the implementing type. Echo doesn't have `Self`. Where you need it,
make the interface generic and pass the type in, as `Comparable<Naquadah>` does above. A default can't
name it either, even though it's instantiated per conformer: `$this` is the only handle it has.

## Next

- [Generics](/language/generics) for the type parameters these constrain.
- [Classes](/language/classes) for the half that can be a stored interface value.
- [Iteration](/collections/iteration) for `contract::iterable` and writing your own cursor.
- [Sorting](/collections/sorting) for `contract::comparable` and why a primitive can answer it.
