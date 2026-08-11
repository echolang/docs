# Functions

Functions are declared just like you would expect from PHP. One difference: **the return type is required.**

```echo
function add(int32 $a, int32 $b) : int32
{
    return $a + $b;
}

echo add(1, 2);     // 3
```

Every parameter has a type, and so does the result. That is the whole shape of it.

## void is not the default

A function that returns nothing still has to say so:

```echo
function log(string $message) : void
{
    echo $message;
}
```

Leave the `: void` off and it does not parse:

```echo
function log(string $message)
{
    echo $message;
}
// error: Unexpected token 'open_brace '{'' found. Expected 'colon (:)'
```

I know that is a few extra characters on every side-effecting function. I prefer it to the alternative, where
the only way to find out whether something comes back is to read the body.

## Order does not matter

You can call a function before the file declares it:

```echo
echo fib(10);       // 55

function fib(int32 $n) : int32
{
    if ($n < 2) {
        return $n;
    }

    return fib($n - 1) + fib($n - 2);
}
```

Declarations are collected before any body is compiled, across every file of the module at once. There are no
forward declarations and no include order to get right. Only top-level *statements* care about order, and
those run in filename order.

## Arguments are copies

By default a parameter is the function's own copy of the value:

```echo
struct Coordinate { float64 $x; float64 $y; }

function scaled(Coordinate $c) : Coordinate
{
    $c->x = $c->x * 2.0;
    $c->y = $c->y * 2.0;

    return $c;      // the caller's Coordinate was never touched
}
```

Scribbling on `$c` is fine. It is yours.

For an `int32` that copy is free. For a `struct` of two floats it is nearly free. For something that owns a
heap buffer, like an `array<T>`, it is a real copy of the whole buffer, which is usually not what you meant.
That is what borrows are for.

## Borrowing instead of copying

Put `&` on the parameter type and the function gets access to the caller's value instead of a copy. The call
site says nothing, because a borrow takes nothing: the compiler takes the address for you.

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
echo total($nums);      // 6
echo $nums->count();    // 3, still yours
```

`const T&` is a read-only borrow. Drop the `const` and the function can write through it, which is how you
get an out parameter:

```echo
function fill(array<int32>& $out) : void
{
    $out->push(9);
}

array<int32> $nums = [1, 2, 3];
fill($nums);
echo $nums->count();    // 4
```

Three rules worth knowing up front:

- A borrow is **never null**. That is the difference between `T&` and `ptr<T>`.
- `const T&` and `T&` are different types, so `f(const Foo&)` and `f(Foo&)` are two different overloads and
  the compiler picks the more specific one for a mutable argument.
- Writing `total(&$nums)` explicitly is the same call. A `ptr<T>` parameter is the one that does *not* borrow
  for you, because it may be null and that should look different at the call.

[Pointers and references](/memory/pointers) has the rest.

## Taking ownership

If a function needs to keep the value rather than borrow it, it asks for ownership with `mv`:

```echo
function consume(mv array<int32> $xs) : int32
{
    return $xs->count();
}
```

And the call site has to agree, out loud:

```echo
array<int32> $nums = [1, 2, 3];

echo consume($nums);        // error: '$xs' takes ownership of this argument -
                            //        write 'mv' in front of it
echo consume(mv $nums);     // 3
echo $nums->count();        // error: '$nums' has been moved out of
```

A signature cannot quietly eat something you thought you still had. [Ownership and
moving](/memory/ownership) is the chapter.

## Which one should a parameter be?

The short answer, in the order you should try them:

| Want | Write | Cost |
|---|---|---|
| Read a value, do not keep it | `const T& $x` | nothing |
| Read and write the caller's value | `T& $x` | nothing |
| Your own copy to scribble on | `T $x` | a copy |
| Keep the value for good | `mv T $x` | nothing, but the caller loses it |

For small primitives (`int32`, `bool`, a pointer) just take them by value. A borrow of an `int32` costs more
than the `int32` did.

## Overloading

Several functions can share a name as long as their parameters differ:

```echo
function describe(int32 $v) : void { echo 1; }
function describe(string $v) : void { echo 2; }
function describe(float64 $v) : void { echo 3; }

describe(1);        // 1
describe("x");      // 2
describe(1.5);      // 3
```

Resolution happens on the arguments, at compile time, with no runtime dispatch involved. When nothing fits,
the compiler shows you what it had:

```echo
function f(int32 $a) : void { echo 1; }

f(1, 2);
// error: No overload of 'f' accepts these arguments. Candidates are:
//          f(int32)
```

Overloads are matched on arity first, and a set with exactly one candidate of the right arity wins without
the types being consulted at all. That is why the message above lists the signature rather than complaining
about the second argument specifically.

Note that the return type is **not** part of the signature. Two functions differing only in what they return
are a duplicate, not an overload.

## Generic functions

A function can take type parameters:

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

`T` is inferred from the arguments, so you rarely write it at the call site. The constraint after the colon
can be an interface you declared or one of the built-in shorthands: `numeric`, `integer`, `signed`,
`unsigned`, `floating`.

[Generics](/language/generics).

## Functions as values

A function type is written `function<R(P...)>`, and a function literal in value position is a closure:

```echo
function<int32(int32)> $double = function(int32 $x) : int32 { return $x * 2; };

echo $double(21);           // 42

function apply(function<int32(int32)> $f, int32 $v) : int32
{
    return $f($v);
}

echo apply($double, 10);    // 20
```

[Closures](/language/closures).

## Calling into C

An `extern` block declares functions that exist somewhere else. No body, no mangling, and `as` renames the
symbol locally so it does not collide with an Echo name:

```echo
extern {
    function abs as c_abs(int32 $v) : int32;
}

echo c_abs(-5);     // 5
```

[C interop](/projects/c-interop) covers linking, strings across the boundary, and shipping C sources beside
your Echo.

## What functions cannot do yet

Three things you might reach for that are not there. All of them are on [the list](/reference/limitations),
this is just a heads-up so you do not spend twenty minutes on the syntax.

**Named arguments.** Arguments are positional. `describe(value: 1)` does not parse.

**Default parameter values.** `function f(int32 $a, int32 $b = 2)` parses, and then the default is thrown
away. The signature is still `f(int32, int32)` and calling `f(1)` is an error. Do not use it.

**Variadics.** There is no `...`, which is why there is no `printf` and no string formatting.

One more, and this one is a real hole rather than a missing feature: **a function that falls off the end
without returning is not diagnosed.** It compiles and hands back whatever was in the register.

```echo
function bad() : int32
{
    echo 1;
}   // no error, and bad() returns garbage
```

Make sure every path returns. The compiler will not check for you yet.

## Next

- [Closures](/language/closures) for the value form.
- [Generics](/language/generics) for type parameters.
- [Ownership and moving](/memory/ownership) for what `mv` and `&` really mean.
