# Functions

A function declares the type of every parameter and of the result. **The return type is required.**

```echo
function add(int32 $a, int32 $b) : int32
{
    return $a + $b;
}

echo add(1, 2);     // 3
```

Every parameter has a type, and so does the result. That's the whole shape of it.

## void

A function that returns nothing still has to say so:

```echo
function log(string $message) : void
{
    echo $message;
}
```

Leave the `: void` off and it doesn't parse:

```echo
function log(string $message)
{
    echo $message;
}
// error: Unexpected token 'open_brace '{'' found. Expected 'colon (:)'
```

I know that's a few extra characters on every side-effecting function. I prefer it to the alternative, where
the only way to find out whether something comes back is to read the body.

`void` is not a value. A function that can fail and has nothing to hand back returns
[`status<E>`](/stdlib/status).

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

Declarations are collected before any body is compiled, across every file of the module at once. There are
no forward declarations and no include order to get right. Only top-level *statements* care about order, and
those run in filename order.

## Named arguments

Sometimes a function has two or three arguments of the same type and the call site is just a pile of
numbers. `$name:` binds a parameter by name, in any order, after the positionals:

```echo
function pair(int32 $a, int32 $b) : int32
{
    return $a * 10 + $b;
}

echo pair(1, 2);            // 12
echo pair($b: 2, $a: 1);    // 12
echo pair(1, $b: 2);        // 12
```

The name is the parameter, dollar sign included. `pair(b: 2)` does not parse.

Positionals fill in order first. After the first `$name:`, everything else has to be named too:

<!-- verify: skip -->
```echo
echo pair($a: 1, 2);
// error: positional argument after named argument
```

An unknown `$nope:` is an error. A name at most once.

## Defaults fill holes

A parameter may carry `= expr`. After matching, any hole still empty is filled from it:

```echo
function add(int32 $a, int32 $b = 2) : int32
{
    return $a + $b;
}

echo add(3);                // 5
echo add(3, 4);             // 7
echo add($b: 4, $a: 1);     // 5
```

Defaults do not have to be trailing, because a later parameter can still be named:

```echo
function wrap(int32 $a = 1, int32 $b) : int32
{
    return $a * 10 + $b;
}

echo wrap($b: 8);           // 18
```

`wrap(8)` would bind 8 to `$a` and leave `$b` empty, which is an error. Name the one you mean.

A constructor-call default on a generic is the same hole. `named<T>(const string& $name, map<string, string> $renames = map<string, string>())` still answers `named<int32>(name: 'n')`. `= []` works too, and is the shorter spelling when the type is already on the parameter.

## Labels

`$name:` is optional sugar. A **label** is not. Write it with a colon on the declaration, the same way the
call site writes it, and the call has to use it. Not a positional, not `$name:`:

```echo
function listen(forEvent: string $name, int32 $code) : int32
{
    echo $name;
    return $code;
}

echo listen(forEvent: 'click', 7);
echo listen(forEvent: 'tap', $code: 8);
```

That prints `click`, then `7`, then `tap`, then `8`. `listen('click', 7)` is an error: the parameter is
labelled `forEvent`, so the call must say `forEvent:`. `listen($name: 'click', 7)` is the same error. The
label and the parameter are two different words, on purpose.

Why would you want that? Because the label is part of the overload identity and the `$name` is not. Two
functions that both take `int32` then `string` are one signature. Two functions that take different labels
are two:

```echo
function print(int32 $level, string $message) : int32
{
    echo $message;
    return $level;
}

function print(fromDecimal: int32 $cents, currency: string $code) : int32
{
    echo $code;
    return $cents;
}

echo print(1, 'hi');
echo print(fromDecimal: 100, currency: 'EUR');
```

`print(100, 'EUR')` is the first overload. The second required its labels.

That is the whole reason labels exist: they let you have two call shapes that would otherwise
be the same types in the same order.

There is no `print` statement in Echo, so declaring one is fine. Unlabelled parameters stay positional, with
`$name:` as optional sugar. Constructors are functions too, so the same three spellings work on
`Point(...)`. [Structs](/language/structs) is that chapter.

## construct

Sometimes the function just wants an `M`, and you have the arguments that build one. Writing
`M(...)` at every call is noise.

Mark the last parameter `construct`. Write the constructor arguments at the call:

```echo
struct RouteMeta
{
    public string $path;
}

function plant(construct RouteMeta $m) : string
{
    return $m->path;
}

echo plant('/hello');           // /hello
echo plant(RouteMeta('/x'));    // /x
```

The body still sees one `RouteMeta`. `plant('/hello')` is `plant(RouteMeta('/hello'))`. One
remaining argument that is already `M` is used as-is, which is why `plant(RouteMeta('/x'))`
works, and why `seat<Endpoint<Show>>(Endpoint<Show>('/x'))` does too: the inner constructor
is the value, not a list of constructor arguments.

Zero extra arguments do not construct. That is how a getter `meta<M>()` can sit beside a
`meta<M>(construct M)` setter without the setter eating a no-arg call. Plant a default with
`meta<RouteMeta>(RouteMeta())`.

Named arguments and leading-dot bind to the constructor, not to `$m`:

```echo
enum Method { case get; case post; }

struct Route
{
    public Method $method;
    public string $path;
}

function meta<M>(construct M $value) : M
{
    return $value;
}

Route $r = meta<Route>($method: .get, $path: '/hello');
echo $r->path;                  // /hello
```

A prefix is ordinary parameters. Remaining args build `M`:

```echo
struct Pair
{
    int32 $a;
    int32 $b;
}

function put<M>(string $key, construct M $value) : string
{
    return $key;
}

echo put<Pair>('home', 1, 2);               // home
echo put<Pair>($key: 'home', $a: 1, $b: 2); // home
```

A label on the construct parameter opens the constructor arguments. It does not fill a single
slot:

```echo
struct Pair
{
    int32 $a;
    int32 $b;
}

function bind<T>(once: construct T $value) : T
{
    return $value;
}

Pair $q = bind<Pair>(once: 8, 9);
echo $q->a;                     // 8
echo $q->b;                     // 9
```

Without the label, those extras are an ordinary call. A labelled construct parameter does not
gather unlabelled arguments, which is what lets a callback overload sit beside it:

```echo
class Container
{
}

class Service
{
    public int32 $n;

    public constructor(int32 $n)
    {
        $this->n = $n;
    }
}

function bind<T>(function<T(Container)> $make) : int32
{
    return $make(Container())->n;
}

function bind<T>(put: construct T $value) : int32
{
    return $value->n;
}

echo bind<Service>((Container $c) => Service(7));   // 7
echo bind<Service>(put: 9);                         // 9
```

`bind<Service>((Container $c) => Service(7))` is the callback. `Service` has a one-argument
constructor, and that is not enough to steal the call: there is no `put:`.

Here is the catch. `construct` is last, by value. The body cannot re-forward the raw arguments into another call.
Not a borrow, not an optional, not an enum, not with `mv`. A type named `construct` is still a
type.

If `init` derives a field, that field is not a constructor argument. `construct` uses the same
list.

Write the type argument on a generic. It cannot be inferred from constructor extras of an
unknown `T`. [Generics](/language/generics) has `make<T>`.

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

Scribbling on `$c` is fine. It's yours.

For an `int32` that copy is free. For a `struct` of two floats it's nearly free. For something that owns a
heap buffer, like an `array<T>`, it's a real copy of the whole buffer, which is usually not what you meant.
That's what borrows are for.

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

Three rules up front:

- A borrow is **never null**. That's the difference between `T&` and `ptr<T>`.
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

A signature can't quietly eat something you thought you still had. [Ownership and
moving](/memory/ownership) is the chapter.

## Which parameter

The short answer, in the order I'd try them:

| Want | Write | Cost |
|---|---|---|
| Read a value, do not keep it | `const T& $x` | nothing |
| Read and write the caller's value | `T& $x` | nothing |
| Your own copy to scribble on | `T $x` | a copy |
| Keep the value for good | `mv T $x` | nothing, but the caller loses it |
| Build `M` from the remaining arguments | `construct M $x` | a construction |

`construct` is still by value. The keyword is about the call site, not a fifth access mode.

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

The return type is **not** part of the signature. Two functions differing only in what they return are a
duplicate, not an overload.

Labels are part of that identity. Parameter names are not. `f(int32 $a)` and `f(int32 $b)` collide.
`f(from: int32 $a)` and `f(to: int32 $a)` do not. [Labels](#labels) is the
section.

A present value prefers `T` over `T?`. `'a'` picks `g(string)` over `g(string?)`:

```echo
function g(string $s) : int32 { return 1; }
function g(string? $s) : int32 { return 2; }

echo g('a');                // 1

string? $opt = 'b';
echo g($opt);               // 2
```

Same reason `'a'` picks `from(string)` beside `from(string?)`. A `string?` still picks `from(string?)`.

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
can be an interface you declared, or one of the built-in shorthands: `numeric`, `integer`, `signed`,
`unsigned`, `floating`.

[Generics](/language/generics).

## Functions as values

A function type is written `function<R(P...)>`, and a function literal in value position is a closure:

```echo
function<int32(int32)> $double = (int32 $x) => $x * 2;

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

[C interop](/projects/c-interop) covers linking, strings across the boundary, shipping C sources beside
your Echo, and passing a function to C as `extern function<R(P...)>` with `&name`.

## Missing

A couple of things you might reach for that aren't there. Both are on [the list](/reference/limitations).
This is just so you don't spend twenty minutes on the syntax.

**Variadics.** There is no `...`, which is why there is no `printf` and no string formatting.
Constructing a typed last parameter from the rest of the call is
[`construct M $value`](#construct): the function still takes one `M`.

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
- [Structs](/language/structs) for constructors, which are the same call machinery: `$name:`, defaults,
  labels, and writing any `constructor` deleting the free one.
- [Ownership and moving](/memory/ownership) for what `mv` and `&` really mean.
