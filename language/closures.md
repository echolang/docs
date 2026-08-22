# Closures

Sometimes the thing you want to pass to a function is another function. A comparator, a callback, a small
transformation that isn't worth naming. Echo has a type for that:

```echo
function<int32(int32)> $increment = function(int32 $a) : int32 { return $a + 1; };

echo $increment(41);    // 42
```

`function<R(P...)>` is the type of a callable value, and it behaves like any other type. You can put one in
a variable, pass it, return it, store it in a struct property, or make it a generic type argument.

## The type

The type reads outside in: the return type, then the parameters in parentheses.

```echo
function<int32(int32)> $unary = function(int32 $a) : int32 { return $a * 2; };
function<int32(int32, int32)> $binary = function(int32 $a, int32 $b) : int32 { return $a + $b; };
function<void()> $noop = function() { };

echo $unary(21);        // 42
echo $binary(40, 2);    // 42
```

Note the third one. In a closure literal the return type may be left off when it is `void`, which is the one
place Echo relaxes the rule that [functions](/language/functions) must always state their return type. A
named function still has to say `: void` out loud.

## A parameter

This is the reason the feature exists:

```echo
function apply(function<int32(int32)> $f, int32 $value) : int32
{
    return $f($value);
}

echo apply(function(int32 $a) : int32 { return $a * 2; }, 21);      // 42
```

The literal is written inline at the call site. There is nothing to declare first.

## A return value

A function that returns a callable is how you build a small factory:

```echo
function adder(int32 $seed) : function<int32(int32)>
{
    return function(int32 $x) : int32 { return $x + $seed; };
}

function<int32(int32)> $add10 = adder(10);
echo $add10(32);        // 42
```

`$seed` is a parameter of `adder`, which has returned by the time `$add10` runs. The closure still answers
`42`, which brings us to the part that actually matters.

## Capture is by value

**A closure copies what it captures, at the moment the closure is created.** It doesn't hold a reference to
the variable, and it doesn't see later writes to it:

```echo
function frozen() : int32
{
    int32 $n = 5;
    function<int32()> $read = function() : int32 { return $n; };

    $n = 99;

    return $read();
}

echo frozen();      // 5, not 99
```

There is no by-reference capture. The loop case is the one to watch:

```echo
int32 $i = 0;
while ($i < 3) {
    function<int32()> $step = function() : int32 { return $i * 10; };
    echo $step();       // 0, 10, 20
    $i = $i + 1;
}
```

Each round captures the value `$i` had that round. The classic "all three closures print 3" bug doesn't
happen, because there is no shared binding to go stale.

Captures are stored in an environment allocated when the closure is created and released when the last
holder of the closure goes out of scope. Copying a closure shares that environment rather than duplicating
it:

```echo
function shared() : int32
{
    int32 $n = 21;
    function<int32()> $a = function() : int32 { return $n; };
    function<int32()> $b = $a;      // same environment

    return $a() + $b();
}

echo shared();      // 42
```

## What you can capture

Primitives, pointers, and plain structs copy into the environment. A class handle or a `string`
is retained. A struct with a copy constructor is copied:

```echo
struct Chevron
{
    int32 $symbol;
    int32 $position;
}

function encode() : int32
{
    Chevron $locked = Chevron(20, 22);
    function<int32()> $f = function() : int32 { return $locked->symbol + $locked->position; };

    return $f();
}

echo encode();      // 42
```

The copy is of the *variable*, not "whatever it points at." A class handle or a `string` is a
retain. A `T&` or a `ptr<T>` is one word, the address. The bytes on the other side of that
address are still shared:

```echo
int32 $n = 42;
ptr<int32> $p = &$n;

function<int32()> $f = function() : int32 { return $p; };

echo $f();      // 42
```

There is no `function[&$blob]()`. Capture does not alias a local. If the blob is a
[class](/language/classes), capture the handle and the payload stays on the heap. If it is a
struct, capture `&$blob` (or a `ptr<T>`) and keep the struct alive for as long as the closure
runs. [Threads](/stdlib/thread#share-the-object-not-a-copy-of-it) is the page that puts that on
another core.

A `#[unique]` type is refused, because there is nothing to copy:

```echo
#[unique]
struct Token
{
    usize $id;
}

function outer() : usize
{
    Token $t = Token(3);
    function<usize()> $f = function() : usize { return $t->id; };
    return $f();
}
// error: 'Token' is unique: exactly one value may name its storage, so it is moved and never copied
```

To hand the local over instead of copying it, name it in a capture list with `mv`. The source is
then dead in the enclosing body, the same way `mv $t` is anywhere else:

```echo
#[unique]
struct Token
{
    usize $id;
}

function outer() : usize
{
    Token $t = Token(3);
    function<usize()> $f = function[mv $t]() : usize { return $t->id; };
    return $f();
}

echo outer();       // 3
```

A written list is closed: only those names are captured, each copy or move as written.
`function[$n]()` copies `$n` and refuses anything else. `function[]()` captures nothing. No
list at all is the default, every enclosing local the body reads is copied.

```echo
function only_n() : int32
{
    int32 $n = 5;
    function<int32()> $f = function[$n]() : int32 { return $n; };
    return $f() + $n;
}

echo only_n();      // 10
```

The original local still owns its copy when you did not write `mv`. The environment is a minted
`#[atomic]` class, so the closure can be spawned onto another thread. [Threads](/stdlib/thread) is
that page.

Capturing through two levels of closure works. The outer closure captures the local, and the inner
one captures the outer environment's property:

```echo
function outer() : int32
{
    int32 $n = 5;
    function<int32()> $f = function() : int32 {
        function<int32()> $g = function() : int32 { return $n; };
        return $g();
    };
    return $f();
}

echo outer();       // 5
```

A named `function` between the two has no environment, so it cannot hand a capture through. Pass
the value as an argument, or write the inner body as a closure too.

## And a C function pointer is a different type

`function<R(P...)>` is Echo's callable: two words, an environment, a closure. C has no spelling
for that. When a C library wants a callback, the type is `extern function<R(P...)>`: one word,
no environment, produced by `&name`. [C interop](/projects/c-interop#callbacks-passing-a-function-to-c)
has the rest, including why a closure cannot be one.

## A property

A closure is an ordinary value, so it can be a struct or class property:

```echo
struct Sensor
{
    function<int32(int32)> $filter;
    int32 $range;
}

Sensor $long_range = Sensor(function(int32 $reading) : int32 { return $reading * 2; }, 7);

echo $long_range->filter(21);   // 42
echo $long_range->range;        // 7
```

That's the closest thing Echo has to a strategy object, and it costs one pointer plus the environment. A
sensor that takes its filter as a value can be re-rigged without touching the sensor.

It works as a type argument too:

```echo
struct CargoBay<T>
{
    T $contents;
}

CargoBay<function<int32()>> $hold = CargoBay<function<int32()>>(function() : int32 { return 42; });
echo $hold->contents();
```

## Generic inference reaches through a callable

A type parameter can be bound by the callable's own signature, which means the usual higher-order helpers
infer cleanly:

```echo
function apply<T>(function<T(T)> $f, T $value) : T
{
    return $f($value);
}

echo apply(function(int32 $a) : int32 { return $a + 1; }, 41);      // 42
```

`T` is bound to `int32` by the closure literal and the argument together. See
[Generics](/language/generics).

## A callable is never null

There is no empty callable, so `function<R(P...)>` cannot hold `null`:

```echo
function<int32()> $f = null;
// error: 'function<int32()>' cannot be null - a callable has no empty value -
//        write 'function<...>?' if it may be absent
```

The diagnostic tells you the fix. If absence is a real state for your value, say so in the type with `?` and
handle it like any other optional. See [Nullability](/memory/nullability).

One more small thing: `echo` can't print a callable, because there is nothing sensible to print:

```echo
function<int32()> $f = function() : int32 { return 1; };
echo $f;
// error: 'echo' has no way to print a 'function<int32()>' - call it and print the result
```

## Next

- [Functions](/language/functions) for the named kind, overloading and borrows.
- [Generics](/language/generics) for inference through a callable parameter.
- [Ownership and moving](/memory/ownership) for what "owns a resource" means.
