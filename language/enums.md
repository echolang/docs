# Enums

An enum is a type with a fixed list of values, written out where everyone can see them:

```echo
enum DistanceUnit
{
    case meter;
    case kilometer;
    case mile;
}

DistanceUnit $unit = DistanceUnit::kilometer;

if ($unit == DistanceUnit::kilometer) {
    echo "kilometres it is";       // kilometres it is
}
```

Three names, three values, and the compiler can check you handled all of them. A case can also carry data,
and [`match`](#match-reads-which-case-you-are-holding) is how you read it back.

## Why not an int32 and a comment

Because that's what you end up writing otherwise, and it holds until the day somebody passes `7`. Or until
you add a fourth unit and forget one of the four places that switch on it, which is worse, because nothing
tells you.

An enum closes both holes. `DistanceUnit` has exactly three values, they have names, and the compiler can
check that you handled all of them.

## Cases are the only way to build one

A case is a static function on the enum, so `DistanceUnit::meter` is a call. It is spelled without
parentheses when it takes nothing:

```echo
enum DistanceUnit { case meter; case kilometer; case mile; }

$a = DistanceUnit::meter;
$b = DistanceUnit::mile;

echo $a != $b;                     // 1
```

Where the destination already says which enum it is, the leading dot says the rest:

```echo
enum DistanceUnit { case meter; case kilometer; case mile; }

function describe(DistanceUnit $u) : bool
{
    return $u == DistanceUnit::meter;
}

DistanceUnit $unit = .kilometer;   // the declaration named the type
echo describe(.meter);             // 1, the parameter named it
```

That's the same shorthand
[static functions](/language/structs#the-leading-dot-lets-the-destination-name-the-type) use, and the same
machinery underneath. A case is not a special kind of thing, which is a theme here.

`==` and `!=` compare which case a value is holding, because that's all an enum's identity ever is. Nobody
declares that operator and nobody can write one that disagrees.

## A case can carry a backing value

Two different things get called "an enum with values", so let's be precise about which is which.

The first is a **backing value**: a constant attached to each case, usually because something outside your
program already decided what the number is.

```echo
enum HttpStatus : int32
{
    case ok = 200;
    case not_found = 404;
    case teapot = 418;
}

echo HttpStatus::not_found->value();     // 404
```

The type after the `:` is the backing type. Integers and `string` are allowed:

```echo
enum DistanceUnit : string
{
    case meter = "m";
    case kilometer = "km";
    case mile = "mi";
}

echo DistanceUnit::kilometer->value();   // km
```

`value()` is a function rather than a field, and that's deliberate. For an integer backing the value
genuinely *is* the discriminant, so reading it costs nothing. A string can't be a discriminant, and storing
one in every value would mean `DistanceUnit::meter` allocated. So the value lives with the declaration,
`value()` fetches it, and both backings are spelled the same way.

## A case can carry a payload instead

The second thing is a **payload**: values that differ per instance rather than per case.

```echo
enum CurlError
{
    case cannot_resolve_host;
    case cannot_connect;
    case timeout(int32 $after_seconds);
    case http(int32 $code, string $body);
}

$err = CurlError::timeout(30);
```

`CurlError` is now a closed set of shapes rather than a closed set of names. A timeout knows how long it
waited. An HTTP failure carries its status and its body. And `cannot_connect` carries nothing, because there
is nothing to say about it.

A payload and a backing value are mutually exclusive. A case is one or the other, and an enum picks one for
all of its cases.

Reading a payload back needs `match`. That's the next section, and it's what holds the rest of this together.

## match reads which case you are holding

`match` is an expression, so its arms produce a value:

```echo
enum DistanceUnit
{
    case meter(int32 $v);
    case kilometer(int32 $v);
    case mile(int32 $v);
}

function to_meters(DistanceUnit $u) : int32
{
    return match ($u) {
        DistanceUnit::meter($v) => $v,
        DistanceUnit::kilometer($v) => $v * 1000,
        DistanceUnit::mile($v) => $v * 1609,
    };
}

echo to_meters(DistanceUnit::mile(2));    // 3218
```

The names in parentheses bind the payload for that arm. They do **not** take part in choosing it:
`DistanceUnit::meter` and `DistanceUnit::meter($v)` select exactly the same case, and the second one
additionally says what to call what is inside.

Which means there is no arm ordering to keep straight, and no way for one pattern to quietly shadow another.
The case name picks the arm and nothing else does.

### Every case, or an else

A `match` has to cover the enum. Leave one out and you get told which one:

```echo
enum DistanceUnit { case meter; case kilometer; case mile; }

$unit = DistanceUnit::meter;

$n = match ($unit) {
    DistanceUnit::meter => 1,
    DistanceUnit::kilometer => 2,
};
// error: this 'match' does not cover every case of 'DistanceUnit' - one is left out. Name mile, or
//        add an 'else' arm.
```

This is the whole reason enums beat integer constants. Add a fourth case a year from now and the compiler
walks you round every `match` in the program.

When you genuinely only care about one case, `else` covers the rest:

```echo
enum CurlError { case cannot_connect; case timeout(int32 $after); }

$err = CurlError::timeout(30);

$waited = match ($err) {
    CurlError::timeout($after) => $after,
    else => 0,
};

echo $waited;      // 30
```

An `else` that can never run is an error rather than dead code, because in practice it is a case that got
renamed out from under it:

```echo
enum Side { case left; case right; }

$s = Side::left;

$n = match ($s) {
    Side::left => 1,
    Side::right => 2,
    else => 3,
};
// error: this 'match' already covers every case of 'Side', so its 'else' arm can never run.
```

### An arm can be a block instead of a value

Write an arm as a block and it produces nothing, which makes the whole `match` a statement:

```echo
enum CurlError
{
    case cannot_connect;
    case timeout(int32 $after);
}

function report(CurlError $e) : void
{
    match ($e) {
        CurlError::cannot_connect => { echo "refused"; },
        CurlError::timeout($after) => { echo "timed out after"; echo $after; },
    }
}

report(CurlError::timeout(30));    // timed out after
                                   // 30
```

That form takes no trailing semicolon, the same as `if` and `foreach`.

It is all or nothing: every arm produces a value, or every arm is a block. Mixing them is an error, because
the result of the `match` would be two different things depending on which arm ran.

A `match` whose arms all `return` is a way out of the function, so this needs no trailing return:

```echo
enum Side { case left; case right; }

function to_int(Side $s) : int32
{
    match ($s) {
        Side::left => { return -1; },
        Side::right => { return 1; },
    }
}

echo to_int(Side::right);      // 1
```

An arm may also simply never come back. `die` returns `void`, which would normally clash with an arm
handing back an `int32`, and it doesn't: an arm that never returns contributes no type to the unification
at all. That's what makes `unwrap()` writable, where one arm has a `T` and the other only has an `E`:

<!-- verify: dies -->
```echo
enum slot
{
    case filled(int32 $value);
    case blank();
}

function must(const slot& $s) : int32
{
    return match ($s) {
        slot::filled($v) => $v,
        slot::blank()    => die('nothing in the slot'),
    };
}

echo must(slot::blank());
```

### The binding borrows, it does not copy

A payload binding points into the value being matched. Nothing is copied, so a `match` over an enum holding
a `string` allocates nothing:

```echo
enum Message
{
    case empty;
    case text(string $body);
}

function is_blank(Message $m) : bool
{
    return match ($m) {
        Message::empty => true,
        Message::text($body) => $body->size() == 0,
    };
}

echo is_blank(Message::text("chevron seven locked"));    // 0
echo is_blank(Message::empty());                         // 1
```

Methods work on the binding, because a borrow is what a receiver wants anyway. Assign it somewhere that
outlives the arm and it copies, exactly as reading any other borrow does.

One thing to watch: an arm's value is typed on its own, with nothing telling a bare literal what to be. So
`Message::empty => 0` sitting beside an arm that produces a `usize` is two different types, and the compiler
says so rather than guessing. Write the literal at the type you meant.

That also means a `match` yields a **place** when every one of its arms does. An arm handing back a payload
hands back a borrow of the subject, and a method can return it:

```echo
enum slot
{
    case filled(int32 $value);
    case blank();
}

function read(const slot& $s) : int32
{
    return match ($s) {
        slot::filled($v) => $v,
        slot::blank()    => 0,
    };
}

echo read(slot::filled(7));    // 7
echo read(slot::blank());      // 0
```

The subject has to be storage the program already holds, because the borrow points into it. `match ($this)`
inside a method is the shape that matters and it qualifies; a `match` over a call result does not, and
says so. See [What is missing](/reference/limitations).

## An enum owns what its live case holds

A case with an owning payload is torn down properly, and only the case actually being held is touched:

```echo
enum Message
{
    case empty;
    case text(string $body);
}

function consume(Message $m) : void {}

$a = Message::text("hello");
$b = $a;              // copies the string, because that is the live case
consume($b);

$c = Message::empty();
$d = $c;              // copies nothing at all

echo "done";          // done
```

You write none of that. The compiler synthesizes one teardown and one copy per enum, each branching on the
case, the same way it does for a struct that owns something.

## An enum body holds cases and functions, nothing else

Cases, methods, static functions, operators and static properties:

```echo
enum Side
{
    case left;
    case right;

    static int32 $flips = 0;

    const function is_left() : bool
    {
        return $this == Side::left;
    }
}

echo Side::left->is_left();     // 1
```

Not properties, constructors, constants or nested types:

```echo
enum Side
{
    case left;

    public int32 $extra;
}
// error: 'Side' is an enum, so it cannot declare a property. An enum holds `case` declarations, and
//        the functions, operators and statics it answers with.
```

The layout of an enum belongs to the compiler: a discriminant, and a slot per payload field. A property of
your own would be seated beside a discriminant it knows nothing about, and a constructor could build a value
that is none of the cases. A constant is refused for a duller reason: `Side::left` already names a case, so
`Side::LIMIT` would make one spelling mean two things.

## Type parameters work as they do everywhere else

```echo
enum Slot<T>
{
    case empty;
    case filled(T $value);
}

function unwrap_or(Slot<int32> $s, int32 $fallback) : int32
{
    return match ($s) {
        Slot<int32>::empty => $fallback,
        Slot<int32>::filled($v) => $v,
    };
}

echo unwrap_or(Slot<int32>::filled(9), 0);      // 9
echo unwrap_or(Slot<int32>::empty(), -1);       // -1
```

Writing the owner out in every pattern gets old fast, and the leading dot works in patterns too wherever the
subject already says what the type is.

## An enum is how you say what went wrong

This is what payload cases are for. The enum states what can fail as a closed set, and `match` makes the
compiler check that your handling covers it:

```echo
enum ParseError
{
    case empty_input;
    case bad_digit(uint8 $byte);
    case too_long(usize $length);
}

function explain(ParseError $e) : string
{
    return match ($e) {
        ParseError::empty_input => "nothing to parse",
        ParseError::bad_digit($b) => "unexpected byte",
        ParseError::too_long($len) => "too long",
    };
}

echo explain(ParseError::bad_digit(122));    // unexpected byte
```

The library ships the type that carries one of these back to a caller alongside the value they did not get:
[`result<T, E>`](/stdlib/result). It is an enum, written in ordinary Echo, and `guard` reads it through two
interfaces that any enum of yours can declare.

## What an enum is, underneath

A discriminant, plus the payload of whichever case you are holding:

```
enum CurlError {
    case cannot_connect;                     // 0
    case timeout(int32 $after);              // 1
    case http(int32 $code, string $body);    // 2
}
```

The size is the tag plus the widest case, plus whatever padding their alignment wants. A `cannot_connect`
is not as wide as `http`. A plain enum is one byte. Copy and teardown still only touch the live case, so
an `http` being copied does not retain a timeout that is not there.

The payload slots are still ordinary properties as far as the rest of the compiler is concerned. That's
what keeps copy, drop, `match` and debug info from growing an arm per case. The overlay is the lowering.

The layout is otherwise unspecified. Don't `mem::bit_cast` an enum and expect a stable shape.

## Next

- [Structs](/language/structs#a-static-belongs-to-the-type-not-to-a-value) for the static functions and the
  leading-dot shorthand that an enum's cases reuse.
- [Control flow](/language/control-flow) for `guard`, which reads a value that may not be there.
- [Errors and panics](/language/errors-and-panics) for where an enum fits among Echo's failure answers.
