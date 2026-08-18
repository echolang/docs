# A tour of Echo

Every big idea in the language, one snippet each, in an order where each one makes sense given the one
before it. It isn't a reference and it doesn't go deep. By the end you should be able to read Echo code,
and know which chapter to open when you need the details.

Every snippet here compiles and runs as written.

## There is no main

```echo
echo "this runs";
```

Top-level statements in a file are the program. Declarations, functions, structs and classes can go anywhere;
statements run top to bottom.

When a program grows into several files, they run in **filename order**. In practice you keep the statements
in one file and never think about it again.

## Variables have one type, forever

```echo
$count = 3;         // int32, inferred
$ratio = 0.5;       // float64, inferred
string $name = "Echo";
```

The type is fixed at the declaration:

```echo
$count = "three";   // error: cannot assign 'string' to 'int32'
```

`const` makes it read-only on top of that:

```echo
const usize $max = 100;
$max = 200;         // error: cannot assign to '$max' - it is declared const
```

More in [Variables](/language/variables).

## Numbers are specific about their width

```echo
int32 $a = 42;
int64 $b = 42;
uint8 $c = 255;
float32 $d = 3.14f;
float64 $e = 3.14;
```

`int` is an alias for `int32`, `uint` for `uint32`, and `float` for `float32`. An untyped integer literal is
an `int32` and an untyped float literal is a `float64`.

Conversions that lose precision are not silent:

```echo
float $x = 3.14;    // warning: the literal '3.14' is stored in 32bit float
```

[Types](/language/types) and [Expressions](/language/expressions).

## Functions always declare a return type

```echo
function add(int32 $a, int32 $b) : int32
{
    return $a + $b;
}

function log(string $message) : void
{
    echo $message;
}

echo add(1, 2);     // 3
```

The `: void` is not optional. A function with no return type does not parse.

Overloading works, resolved on the argument types:

```echo
function describe(int32 $v) : void { echo 1; }
function describe(string $v) : void { echo 2; }

describe(1);        // 1
describe("x");      // 2
```

[Functions](/language/functions).

## Structs are values

```echo
struct Point
{
    float64 $x;
    float64 $y;
}

$a = Point(3.0, 4.0);
$b = $a;            // a copy
$b->x = 10.0;

echo $a->x;         // 3
```

There is **no `new`**. You call the type. A struct that declares no constructor gets one taking its
properties in declaration order for free, which is where `Point(3.0, 4.0)` comes from.

A struct is a value: it lives where you put it, a local lives on the stack, and assigning it copies it.
Nothing is allocated and nothing is reference counted.

Members are reached with `->`, always, including your own:

```echo
struct Rect
{
    float64 $w;
    float64 $h;

    const function area() : float64
    {
        return $this->w * $this->h;
    }
}

echo Rect(3.0, 4.0)->area();    // 12
```

`const function` means the method only reads `$this`. Write it. A `const` value can only call `const`
methods.

[Structs](/language/structs).

## Classes are the other half

Same declaration syntax, opposite behaviour.

```echo
class Account
{
    private string $owner;
    private int64 $balance;

    constructor(string $owner, int64 $opening)
    {
        $this->owner = $owner;
        $this->balance = $opening;
    }

    function deposit(int64 $amount) : void
    {
        $this->balance = $this->balance + $amount;
    }

    const function balance() : int64
    {
        return $this->balance;
    }
}

$a = Account("Mario", 100);
$b = $a;            // NOT a copy. same object, one more owner
$b->deposit(50);

echo $a->balance(); // 150
```

A class lives on the heap and is reference counted. Assigning one shares it. When the last owner goes away
the object is destroyed and the memory is given back.

That's the whole struct/class decision: **one owner and a copy, or many owners and a shared object.** Pick
per type, at the declaration, and every use site follows from it.

Note the `private` on the properties. A struct with a private property loses its free field-wise constructor,
which is why `Account` writes one out.

[Classes](/language/classes).

## Arrays hold one type

```echo
array<int32> $numbers = [1, 2, 3];
$numbers[] = 4;                 // append
$numbers->push(5);              // the same thing, spelled out

echo $numbers->count();         // 5
echo $numbers[0];               // 1
```

Not a hash map. Not heterogeneous. `array<int32>` is a growable buffer of `int32` and nothing else fits in it.

An array is an object, so the operations live on it: `count`, `push`, `pop`, `remove`, `clear`, `reserve`,
`sub`, and a fair few more.

[Arrays](/collections/arrays).

## Maps need a hashable key

```echo
map<string, int32> $ages = map<string, int32>();
$ages['mario'] = 34;
$ages->set('ray', 29);

echo $ages->count();        // 2
echo $ages['mario'];        // 34
echo $ages->has('ray');     // 1
```

There is no map literal yet, so you construct it and fill it.

`map<K, V>` is unordered. If you need insertion order preserved, `ordered_map<K, V>` has the same surface and
that extra promise.

[Maps](/collections/maps).

## foreach, over anything that says it can be iterated

```echo
array<int32> $numbers = [1, 2, 3];

foreach ($numbers as $n) {
    echo $n;
}

foreach ($numbers as $i => $n) {
    echo $i;
}
```

Ranges are iterable too, and here is the fun part: `..` is not syntax. It is an ordinary operator declared in
the standard library that returns a `range<T>`.

```echo
foreach (0 .. 3 as $i) {
    echo $i;            // 0 1 2
}

foreach (0 ..= 3 as $i) {
    echo $i;            // 0 1 2 3
}
```

`..` is exclusive of the end, `..=` includes it. The compiler knows nothing about either of them, which means
your own types can be iterated the exact same way by conforming to `contract::iterable<T>`.

[Iteration](/collections/iteration).

## Interfaces do two jobs

Job one: a constraint a generic can name.

```echo
interface Shape
{
    function area() : float64;
}

struct Circle : Shape
{
    float64 $radius;

    function area() : float64
    {
        return std::math::PI * $this->radius * $this->radius;
    }
}

function describe<T: Shape>(T& $s) : void
{
    echo $s->area();
}

$c = Circle(1.0);
describe($c);       // 3.141593
```

Job two: a type a **class** value can have, dispatched at runtime.

```echo
class Square : Shape
{
    float64 $side;

    constructor(float64 $side) { $this->side = $side; }

    function area() : float64 { return $this->side * $this->side; }
}

array<Shape> $shapes = array<Shape>();
$shapes[] = Square(2.0);
$shapes[] = Square(3.0);

foreach ($shapes as $s) {
    echo $s->area();    // 4, then 9
}
```

Only classes can be stored as an interface value, because only a class carries the runtime metadata to
dispatch through. A struct's conformance is a compile-time contract you reach through a constrained generic,
like `describe<T: Shape>` above. That is a deliberate split, not a hole to be filled later.

`instanceof` asks the question at runtime:

```echo
$sq = Square(1.0);
echo $sq instanceof Square;     // 1
```

[Interfaces](/language/interfaces).

## Generics

```echo
function largest<T: numeric>(T $a, T $b) : T
{
    if ($a > $b) {
        return $a;
    }
    return $b;
}

echo largest(3, 7);         // 7
echo largest(1.5, 0.5);     // 1.500000
```

Types take parameters too:

```echo
struct Pair<A, B>
{
    A $first;
    B $second;
}

$p = Pair<int32, string>(1, "one");
echo $p->first;     // 1
echo $p->second;    // one
```

The constraint after the colon can be an interface you wrote, or one of the built-in shorthands: `numeric`,
`integer`, `signed`, `unsigned`, `floating`.

Generics are monomorphized, so each instantiation is a separate compiled function with no dispatch cost.

[Generics](/language/generics).

## Closures

```echo
function<int32(int32)> $double = function(int32 $x) : int32 { return $x * 2; };

echo $double(21);   // 42

function apply(function<int32(int32)> $f, int32 $v) : int32
{
    return $f($v);
}

echo apply($double, 10);    // 20
```

`function<R(P...)>` is the type of a callable value. A closure captures what it reads, by value.

[Closures](/language/closures).

## Ownership, and the word mv

This is the part that is genuinely new, so it gets a little more room.

Every value has exactly one owner. When the owner goes out of scope, the value is destroyed. You can hand
ownership to somebody else, and that is called a **move**:

```echo
$a = Point(1.0, 2.0);
$b = mv $a;         // $b owns it now, $a is unset
echo $a->x;         // error: '$a' has been moved out of
```

A function can ask for ownership by writing `mv` on the parameter, and here is the part I like: **the call
site has to say `mv` too.**

```echo
function consume(mv array<int32> $xs) : int32
{
    return $xs->count();
}

array<int32> $nums = [1, 2, 3];
echo consume(mv $nums);     // 3
echo $nums->count();        // error: '$nums' has been moved out of
```

A function signature cannot quietly eat something you thought you still had. Every place a value stops being
yours is spelled out, in your own source.

Most of the time you don't want to give the thing away, you just want the function to look at it. That's a
borrow, written `&` on the parameter. The call site says nothing, because a borrow takes nothing and so
doesn't need announcing the way `mv` does:

```echo
function total(const array<int32>& $xs) : int32
{
    int32 $sum = 0;
    foreach ($xs as $x) {
        $sum = $sum + $x;
    }
    return $sum;
}

array<int32> $nums = [1, 2, 3];
echo total($nums);          // 6
echo $nums->count();        // 3, still yours
```

`const T&` is a read-only borrow, `T&` is a mutable one. Drop the `const` and the function can write through
it, which is how you get an out parameter:

```echo
function fill(array<int32>& $out) : void
{
    $out->push(9);
}

fill($nums);
echo $nums->count();        // 4
```

[Ownership and moving](/memory/ownership) is the real chapter. Read it before you write anything large.

## Null is a type, not a value

A type is non-nullable unless you say otherwise with `?`:

```echo
function halve(int32 $n) : int32?
{
    if ($n < 0) {
        return null;
    }
    return $n / 2;
}
```

There are three ways to deal with the result, and you'll use all of them.

`??` supplies a fallback:

```echo
echo halve(8) ?? -1;        // 4
echo halve(-4) ?? -1;       // -1
```

`?->` reaches through, and stops at the first null:

```echo
Node? $n = Node(7);
echo $n?->tag ?? -1;
echo $n?->next?->tag ?? -1;
```

`guard` binds the value. Leave the `else` off and the program stops if the value is not there, the way
an uncaught failure would. Write an `else` when you have somewhere to go; that arm has to leave, so
after the guard the compiler knows the value is there:

```echo
function halveOr(int32 $n, int32 $fallback) : int32
{
    int32 $v = guard halve($n) else {
        return $fallback;
    }

    return $v + 100;    // $v is a plain int32 here
}
```

[Nullability](/memory/nullability).

## Pointers, when you want them

```echo
int32 $x = 5;
ptr<int32> $p = &$x;
```

`ptr<T>` is a nullable pointer. `T&` is the same thing with a promise that it is not null, which is why
borrows are spelled that way. Both are real types you can put in a struct, pass around, and reach through.

Echo will happily let you do pointer arithmetic and casting, but it makes you write `unsafe` around the parts
where it can no longer check you. Useful in the right hands and dangerous in the wrong ones. You know the
drill.

[Pointers and references](/memory/pointers).

## Operators are declarations

You can overload the built-in ones for your own types, and you can declare entirely new ones with their own
precedence. Suffix operators are my favourite bit:

```echo
struct Distance
{
    uint64 $millimeters;
}

operator (Distance $a) + (Distance $b) : Distance
{
    return Distance($a->millimeters + $b->millimeters);
}

operator (uint64 $a)mm : Distance { return Distance($a); }
operator (uint64 $a)cm : Distance { return Distance($a * 10); }
operator (uint64 $a)m  : Distance { return Distance($a * 1000); }

$distance = 1m + 50cm + 500mm;
echo $distance->millimeters;    // 2000
```

[Operators](/language/operators).

## Namespaces

```echo
namespace geometry;

struct Point { float64 $x; float64 $y; }
```

`namespace` is a file-level statement, so one namespace per file. Elsewhere you reach it by qualifying,
or by a `use` that binds a shorter name for the rest of this file:

```echo
use geometry::Point;

Point $p = Point(1.0, 2.0);
```

`use std::math;` lets you write `math::sqrt`. `use std::math::sqrt;` lets you write `sqrt`. The
standard library is organised this way: `std::math::sqrt`, `std::env::args`, `mem::alloc`.

[Namespaces](/language/namespaces).

## Failing loudly

```echo
assert($count > 0);
assert($count > 0, "count must be positive");

die("something went wrong");
```

`die` stops the program with a nonzero exit status. `assert` does the same when its condition is false, and
is **compiled out entirely in a release build**, which is the default for `echoc build`.

There are no exceptions. There is no `try`/`catch`.

[Errors and panics](/language/errors-and-panics).

## Where to go from here

You can now read Echo. Pick whichever of these is the reason you are here:

- [Coming from PHP](/guide/coming-from-php) for the differences listed bluntly, in one table.
- [Ownership and moving](/memory/ownership) for the concept most likely to bite you.
- [Modules](/projects/modules) to set up a real project with more than one file.
- [Threads](/stdlib/thread) to start an OS thread, and [Atomics](/memory/atomics) for what is safe
  to share across one.
- [What is missing](/reference/limitations) before you plan anything around a feature.
