# Structs

A struct groups a few values into one named thing:

```echo
struct GateAddress
{
    int32 $destination;
    int32 $origin;
}

GateAddress $abydos = GateAddress(27, 1);
echo $abydos->destination;      // 27
```

Two things to notice.

**There is no `new`.** You call the type. `GateAddress(27, 1)` builds one.

**A struct is a value.** It lives where you put it, exactly like an `int32` does. That single fact drives
everything else.

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

Which is what you want from an address. Writing one down somewhere else shouldn't re-point the original.

If you want two names for one object, that's a [class](/language/classes). If you want a value you can
pass around without worrying who else is holding it, this is it.

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

That constructor is an ordinary function. `$name:`, defaults, and labels all work on it. [Functions](/language/functions)
is the call-site chapter.

### Property defaults

A property may carry a default. That default is a parameter default on the same constructor, so mixed
defaults are fine and `$name:` works:

```echo
struct Chevron
{
    int32 $symbol;
    int32 $position;
    int32 $locked = 0;
}

Chevron $first = Chevron(7, 1);
Chevron $second = Chevron($symbol: 9, $position: 2, $locked: 1);
echo $first->locked;        // 0
echo $second->symbol;       // 9
```

`Chevron()` is legal only when every public field has a default. All-defaults do not replace this
constructor. If `$symbol` and `$position` defaulted too, `Chevron(7, 1)` and `Chevron()` would both work.

A default is an ordinary expression: a literal, a call, another constructor. It cannot name `$this` or
another instance property. Those do not exist yet. It is a recipe, cloned into each constructor that wants
it, not a live initializer sitting on the field.

### Writing a constructor deletes the free one

I used to leave the memberwise constructor around when yours took different arguments. Scrap that. It meant
every type had two ways in, and you had to remember which one you were calling. Writing any `constructor`
deletes the free one. Named arguments then bind to *that* constructor's parameters, not to fields. There is
no back door:

```echo
struct Chevron
{
    int32 $symbol;
    int32 $position;

    constructor(int32 $symbol)
    {
        $this->symbol = $symbol % 39;
        $this->position = 1;
    }
}

Chevron $a = Chevron(45);
echo $a->symbol;            // 6
// Chevron(7, 4) is an error: the memberwise constructor is gone
```

### Field defaults still run in a handwritten body

The recipe still runs first in a constructor you wrote, so a field you did not mention is seated from its
default:

```echo
struct Gate
{
    int32 $id = 1;
    int32 $chevrons;

    constructor(int32 $chevrons)
    {
        $this->chevrons = $chevrons;
    }
}

Gate $g = Gate(7);
echo $g->id;            // 1
echo $g->chevrons;      // 7
```

Here is the catch: a copy constructor fills from `$other`. Running the defaults first would fire them on
every copy, which is a throwaway allocation if the field owns something, and a wrong answer if the default
has a side effect. The copy path skips them.

```echo
struct DialCount
{
    static int32 $n = 0;

    public static function bump() : int32
    {
        DialCount::$n = DialCount::$n + 1;
        return DialCount::$n;
    }
}

struct Wormhole
{
    int32 $id = DialCount::bump();

    constructor() {}

    constructor(Wormhole& $other)
    {
        $this->id = $other->id;
    }
}

Wormhole $open = Wormhole();
echo $open->id;             // 1
Wormhole $backup = $open;
echo $backup->id;           // 1, bump did not fire
echo DialCount::$n;         // 1
```

### Private is omitted, not a third case

A `private` property is not a public argument. It is omitted from the free constructor. Give it a default
and the type is still constructible; the hidden field is seated from inside:

```echo
struct ZPM
{
    private int32 $used = 0;
    int32 $capacity = 4096;
}

ZPM $module = ZPM();
echo $module->capacity;     // 4096
ZPM $other = ZPM(8);
echo $other->capacity;      // 8
```

`$capacity` is still an implicit parameter. `$used` is not. Leave a private field without a default and
there is no free constructor at all: `$used` cannot be a public argument, and it cannot be left blank.
Write a constructor, give the field a default, or assign it in `init`.

An `internal` property stays an implicit parameter. [Visibility](/language/visibility) is the rest of
`private`.

## `init` runs after every successful construction

Some fields are not arguments. They are computed from the ones that are. `init` is that computation, and it
runs at the end of every constructor that actually returns: the implicit one and every one you write. A
`die` path does not return, so `init` does not run.

```echo
struct Chevron
{
    int32 $symbol;
    int32 $position;
    int32 $encoded;

    init
    {
        $this->encoded = $this->symbol * 39 + $this->position;
    }
}

Chevron $first = Chevron(7, 1);
echo $first->encoded;       // 274
// Chevron($encoded: 0) is an error: `$encoded` is not a parameter
```

A field `init` assigns on every completing path is **derived**. It is omitted from the implicit constructor.
A field default on a derived field is dead. Drop it.

Both arms of an `if` count. Assign `$encoded` in the `then` and forget the `else`, and that is not every path.

`init` may read a field only if every constructor assigned it on the way in. The implicit constructor does,
by construction. A handwritten `constructor()` that never writes `$symbol` cannot then have `init` read
`$this->symbol`.

## A copy is not a construction

A copy copies every field, derived ones included. The copy equals its original, and a field you wrote
after construction stays written. That holds whether the compiler copied the value or moved it, which
is its choice to make and not something you can see:

```echo
struct Panel
{
    int32 $width;
    int32 $bg;

    init
    {
        $this->bg = 0;
    }
}

Panel $main = Panel(640);
$main->bg = 3;
Panel $backup = $main;
echo $backup->bg;           // 3, the copy keeps what you wrote
```

Want each copy recomputed? Write the copy constructor. `init` runs after it like after any other
constructor you write, and `$b = $a` calls it just as `Wormhole($a)` does:

```echo
class Gate
{
    int32 $id;
}

struct DialCount
{
    static int32 $n = 0;

    public static function bump() : int32
    {
        DialCount::$n = DialCount::$n + 1;
        return DialCount::$n;
    }
}

struct Wormhole
{
    Gate $gate;
    int32 $stamp;

    constructor(Gate $gate)
    {
        $this->gate = $gate;
    }

    constructor(const Wormhole& $other)
    {
        $this->gate = $other->gate;
    }

    init
    {
        $this->stamp = DialCount::bump();
    }
}

Wormhole $open = Wormhole(Gate(1));
echo $open->stamp;          // 1
Wormhole $backup = $open;
echo $backup->stamp;        // 2, init ran after the copy constructor
echo $open->stamp;          // 1
```

`init` is a word the type body recognises, not a keyword. `mem::init` is still a function. There is no
parameter list and no call site: `$p->init()` looks up a method named `init` and will not find this. One per
type. An enum that writes one is an error. [Keywords](/reference/keywords) is the list of contextual words.

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

Constructors are functions, so labels work. That is the natural way to have two ways in that would otherwise
be the same types:

```echo
struct Chevron
{
    int32 $symbol;

    constructor(int32 $symbol)
    {
        $this->symbol = $symbol % 39;
    }

    constructor(fromGlyph: int32 $glyph)
    {
        $this->symbol = $glyph;
    }
}

Chevron $wrapped = Chevron(45);
echo $wrapped->symbol;                  // 6
Chevron $literal = Chevron(fromGlyph: 7);
echo $literal->symbol;                  // 7
```

`Chevron(fromGlyph: 7)` is the second constructor. `Chevron(45)` is the first, and wraps. There is no free
memberwise `Chevron(int32)` besides the one you wrote, because writing any constructor deleted it.

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

Mark a method `const` whenever it only reads. It costs nothing, and it's what makes your type usable in a
`const` position, including inside somebody else's `const` method.

## A static belongs to the type, not to a value

Everything so far needs a value to exist. A method needs one to be called on, a property lives inside each
one. Sometimes what you want belongs to the type itself, and `static` is how you say so.

A `static function` is called on the type and takes no `$this`:

```echo
struct GateAddress
{
    public int32 $destination;
    public int32 $origin;

    static function earth() : GateAddress
    {
        return GateAddress(1, 1);
    }

    static function outbound(int32 $to) : GateAddress
    {
        return GateAddress($to, 1);
    }
}

$home = GateAddress::earth();
$away = GateAddress::outbound(27);

echo $home->destination;        // 1
echo $away->destination;        // 27
```

This is the natural home for the *named constructors* a type wants. `earth()` and `outbound(27)` say what
they build. Two plain constructors taking one `int32` each would not, and could not both exist anyway.

A static and a method may share a name. They are told apart at the call site, so they never collide:

```echo
struct GateAddress
{
    public int32 $destination;

    static function unknown() : int32
    {
        return 0;
    }

    function unknown() : int32
    {
        return $this->destination;
    }
}

echo GateAddress::unknown();            // 0
echo GateAddress(27)->unknown();        // 27
```

## A static property is one value the whole type shares

```echo
struct Chevron
{
    static int32 $locked = 0;

    public int32 $index;

    static function lock() : Chevron
    {
        Chevron::$locked = Chevron::$locked + 1;
        return Chevron(Chevron::$locked);
    }
}

$first = Chevron::lock();
$second = Chevron::lock();

echo $first->index;         // 1
echo $second->index;        // 2
echo Chevron::$locked;      // 2
```

It is not in the layout, so it costs a `Chevron` value nothing. Three things about it, all visible from the
outside.

**The initializer runs the first time something reads or writes it**, not when the program starts. A static
nothing ever names is never initialized, so its initializer's side effects never happen:

```echo
function calibrate() : int32
{
    echo 99;
    return 7;
}

struct Dhd
{
    static int32 $calibration = calibrate();
    public int32 $x;
}

echo 1;                     // 1, and calibrate() has not run

echo Dhd::$calibration;     // 99, then 7
echo Dhd::$calibration;     // 7, it only runs once
```

**It is torn down at the end of `main`, in reverse order of initialization.** A static may hold anything a
value can, including something that owns memory, and it is given back the same way:

```echo
struct Log
{
    static string $prefix = 'gate';
    public int32 $x;
}

echo Log::$prefix;          // gate
```

`die`, a failed `assert` and `std::env::exit` stop the program without running those teardowns, which is the
same thing they already do to values in scope.

**An initializer may name statics declared before it, and nothing else.** That's what makes it impossible
to write two statics that wait on each other:

```echo
struct Limits
{
    static int32 $base = 2;

    // $base is above it, so this is fine
    static int32 $doubled = Limits::$base * 2;

    public int32 $x;
}

echo Limits::$doubled;      // 4
```

Statics work on a generic type too, and each instantiation gets its own:

```echo
struct Box<T>
{
    static int32 $made = 0;

    public T $v;

    static function of(T $value) : Box<T>
    {
        Box<T>::$made = Box<T>::$made + 1;
        return Box<T>($value);
    }
}

$a = Box<int32>::of(1);
$b = Box<int32>::of(2);
$c = Box<bool>::of(true);

echo Box<int32>::$made;     // 2
echo Box<bool>::$made;      // 1
```

`static` is a member modifier, so it only means something inside a type. On a free function or a local
variable there is no type to do the owning, and the compiler says so.

## The leading dot lets the destination name the type

Writing the type twice gets tiring where it's already obvious:

```echo
struct Response
{
    public int32 $status;
    public bool $ok;

    static function accepted() : Response
    {
        return Response(202, true);
    }

    static function failed(int32 $status) : Response
    {
        return Response($status, false);
    }
}

function handle(bool $good) : Response
{
    if ($good) {
        return .accepted();
    }

    return .failed(500);
}

echo handle(true)->status;      // 202
echo handle(false)->status;     // 500
```

`.accepted()` is `Response::accepted()`. The leading dot means *the type this value is going into*, and
there are exactly three places that can say what that is:

- a **return type**, as above
- a **declared variable's type**, `Response $r = .accepted();`
- a **parameter** of a call, `send(.failed(404));`

It nests, which is where it earns its keep:

```echo
struct Failure
{
    public int32 $code;

    static function timeout(int32 $seconds) : Failure
    {
        return Failure($seconds);
    }
}

struct Outcome
{
    public Failure $why;
    public bool $ok;

    static function failed(Failure $why) : Outcome
    {
        return Outcome($why, false);
    }
}

function attempt() : Outcome
{
    return .failed(.timeout(30));
}

echo attempt()->why->code;      // 30
```

The outer `.failed(...)` takes its type from the return type, and the inner `.timeout(30)` then takes its
own from `failed`'s parameter.

The one place this won't work is where the destination is the thing you were asking the compiler to work
out. A shorthand has no type of its own until an overload is chosen, so it can't be what chooses one. Write
the type when that happens:

```echo
struct Metres
{
    public float64 $v;

    static function of(float64 $v) : Metres
    {
        return Metres($v);
    }
}

struct Feet
{
    public float64 $v;

    static function of(float64 $v) : Feet
    {
        return Feet($v);
    }
}

function show(Metres $m) : float64 { return $m->v; }
function show(Feet $f) : float64 { return $f->v; }

// show(.of(3.0)) cannot work: naming the type is what picks the overload
echo show(Metres::of(3.0));     // 3.000000
echo show(Feet::of(3.0));       // 3.000000
```

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
[Ownership and moving](/memory/ownership) start to apply: copying it is refused unless you have said how,
so a closure captures it only with `function[mv $x]()` or a copy constructor.

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

Field defaults do not run on this path. The constructor fills from `$other`, and running the defaults first
would fire them on every copy. [Field defaults still run in a handwritten body](#field-defaults-still-run-in-a-handwritten-body)
is the catch.

Prefer `const Manifest&` where you can. A copy constructor taking a mutable borrow can't be used to copy out
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

Nothing outside `ZPM` reads `$used`, and a `private function` is refused from outside the same way. A
private property is also omitted from the free constructor, covered above. Watch out for one more thing:
on a *top-level* declaration the word means the file rather than the type, which is a different question
entirely. [Visibility](/language/visibility) is the whole of that.

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

What a struct **can't** do is be stored *as* a `Powered`. That needs a vtable and a stable address, which a
value type doesn't have. [Interfaces](/language/interfaces) explains why that split is deliberate, and
[Classes](/language/classes) is the half that can.

## Next

- [Classes](/language/classes) for the reference-counted, shareable half of the same syntax.
- [Ownership and moving](/memory/ownership) for what happens once a struct owns something.
- [Interfaces](/language/interfaces) for conformance and constraints.
