# Nullability

Nothing in Echo is nullable by default. A `Wormhole` is a wormhole. **A `Wormhole?` is the one that might not
be there**, and that `?` is the only way to say so.

```echo
class Wormhole
{
    int32 $id;
}

Wormhole? $active = null;
echo $active == null;       // 1

$active = Wormhole(7);
echo $active == null;       // 0
```

If you never write a `?`, null never enters your program. The rest of this page is for when absence is a real
state and you want the type to say it out loud.

## null needs permission

Writing `null` at a type that did not ask for it is a compile error, not a runtime surprise:

```echo
class Wormhole { int32 $id; }

Wormhole $active = null;
// error: 'Wormhole' cannot be null - add '?' to its type if it may be absent
```

The same goes for an `int32`, a struct, a callable and a borrow. A borrow gets its own sentence, because the
fix is a different type rather than a `?`:

```echo
int32 $chevrons = 7;
int32& $locked = null;
// error: 'int32&' cannot be null - declare it as a nullable pointer instead
```

`T&` is the type that promises there is something there. If you need "maybe an address", that is `ptr<T>`.

## What the question mark costs

It depends on what it is sitting on, and the split is worth knowing before you put a `?` on a hot struct.

**Free** over anything that is already one machine address: a class handle, a `ptr<T>`, a `weak<T>`. A null
address *is* the absent case, so `Wormhole?` is the same size as `Wormhole` and the same value flows through.

**A flag plus the value** over everything else. `int32?` is an `int32` with a "is it there" bit beside it, and
so is `Chevron?` for a struct. Bigger than the thing it wraps, and it has to be unpacked to be read.

```echo
struct Chevron
{
    int32 $symbol;
}

int32? $count = null;
Chevron? $locked = null;

echo $count == null;        // 1
echo $locked == null;       // 1
```

Neither one is expensive. It is just not free, which occasionally matters and is easy to forget because the
syntax is one character.

## You cannot read through it

This is the rule that makes the whole thing worth having. A `T?` does not have the members of a `T`:

```echo
class Wormhole { int32 $id; }

Wormhole? $active = null;
echo $active->id;
// error: 'Wormhole?' may not be there, so '->' cannot reach through it - use '?->' to skip when it is
//        absent, '??' to supply a replacement, or 'guard' to bind it once and read it plainly
```

That message is the table of contents for the next three sections. There are exactly three ways through, and
you pick by what you want to happen when the value is absent.

## ?? supplies a replacement

`A ?? B` is `A` when it is there and `B` when it is not:

```echo
function chevronCount(bool $dialled) : int32?
{
    if ($dialled) {
        return 7;
    }

    return null;
}

echo chevronCount(true) ?? -1;      // 7
echo chevronCount(false) ?? -1;     // -1
```

`B` runs **only** when `A` turned out to be absent, which is unusual enough to be worth proving:

```echo
function fallback() : int32
{
    echo "computing a fallback";
    return -1;
}

int32? $present = 7;
int32? $absent = null;

echo $present ?? fallback();    // 7, and nothing else was printed
echo $absent ?? fallback();     // computing a fallback, then -1
```

So the right side may be as expensive as it likes, and may have effects that must not happen on the common
path.

It chains to the right, so a run of fallbacks reads the way you would hope:

```echo
int32? $primary = null;
int32? $secondary = 5;

echo $primary ?? $secondary ?? 42;      // 5
```

If the right side is itself nullable, the answer still may be absent and the type says so. That is what makes
the chain above legal rather than a type error in the middle.

## ?-> reaches through, or stops

`?->` reads a member when the base is there and answers null when it is not:

```echo
class Wormhole { int32 $id; }

Wormhole? $active = null;
echo $active?->id ?? -1;        // -1
```

It short-circuits, so a chain stops at the first absent link and never evaluates the rest:

```echo
class Gate
{
    int32 $id;
    Gate? $downstream;
}

Gate $sgc = Gate(1, null);

echo $sgc->downstream?->id ?? -1;       // -1
```

The result is nullable, which is why `?? -1` is doing real work in both examples rather than decorating them.
An already-nullable continuation is not wrapped twice, so `$a?->maybeB()` is one `B?` and not a `B??`.

A chain that ends in a call is a statement, the same way `$n->close();` is. Absence skips the call:

```echo
class Wormhole
{
    int32 $id;

    function close() : void
    {
        echo $this->id;
    }
}

Wormhole? $active = Wormhole(1);
$active?->close();          // 1

Wormhole? $gone = null;
$gone?->close();            // nothing
```

## guard binds it once

`??` and `?->` handle a value at one use site. When you want to check once and then read the thing plainly
for the rest of the function, that is `guard`:

```echo
class Wormhole
{
    int32 $id;

    function close() : void
    {
        echo "closed";
    }
}

function shutdown(Wormhole? $active) : int32
{
    Wormhole $open = guard $active else { return -1; }

    echo $open->id;
    $open->close();
    return 0;
}

echo shutdown(Wormhole(7));
echo shutdown(null);
```

`7`, `closed`, `0`, then `-1`. The binding lands in the **enclosing** scope, not in the else arm, so from the
`guard` onwards `$open` is an ordinary non-null local and everything reads normally.

The type can be inferred like any other declaration, though writing it is usually clearer:

```echo
class Wormhole { int32 $id; }

function dial() : Wormhole?
{
    return Wormhole(7);
}

$open = guard dial() else { die("no gate"); }
echo $open->id;     // 7
```

### The else arm has to leave

```echo
class Wormhole { int32 $id; }

function dial() : Wormhole?
{
    return null;
}

Wormhole $open = guard dial() else { echo "no gate"; }
echo $open->id;
// error: the 'else' of a guard has to leave - end it with 'return', 'break', 'continue' or 'die'
```

Which is the only thing that could work. If the else arm could fall through, the line after the guard would
read a binding for a value that turned out not to be there. `return`, `break`, `continue`, `die`, or an `if`
whose branches all do one of those: any of them satisfies it.

## Your own types can be guarded too

`guard` is not a feature of `T?`. Anything that means "maybe a value" can be guarded, and a type says that
it means it by declaring `contract::unwrappable<V>`:

```echo
struct ParsedInt : contract::unwrappable<int32>
{
    private int32 $value;
    private bool $ok;

    constructor(int32 $value)
    {
        $this->value = $value;
        $this->ok = true;
    }

    constructor(bool $ok)
    {
        $this->value = 0;
        $this->ok = $ok;
    }

    public const function has_value() : bool
    {
        return $this->ok;
    }

    public function unwrap() : int32&
    {
        return &$this->value;
    }
}

function parse(int32 $n) : ParsedInt
{
    if ($n < 0) {
        return ParsedInt(false);
    }

    return ParsedInt($n * 2);
}

function doubled(int32 $n) : int32
{
    $v = guard parse($n) else { return -1; }
    return $v;
}

echo doubled(10);       // 20
echo doubled(-1);       // -1
```

Two methods and that is the whole protocol. `has_value()` is asked first and its answer gates the unwrap, so
`unwrap()` never has to check again. That is the same bargain `contract::iterator<V>` makes between
`advance()` and `current()`.

Note that `has_value()` is `const` and `unwrap()` is not. Reading *whether* a value is there promises nothing
about the storage, while taking it out hands back a borrow somebody may write through. So a `const` subject
is refused, and the message says why.

### A reason, not just an absence

A `T?` records that a value is missing and nothing about why. When the why matters, declare
`contract::failable<E>` beside it. The else arm can then bind the reason:

```echo
struct ParseError
{
    public usize $at;
    public int32 $code;
}

struct ParsedInt : contract::unwrappable<int32>, contract::failable<ParseError>
{
    private int32 $value;
    private bool $ok;
    private ParseError $error;

    constructor(int32 $value)
    {
        $this->value = $value;
        $this->ok = true;
        $this->error = ParseError(0, 0);
    }

    constructor(ParseError $error)
    {
        $this->value = 0;
        $this->ok = false;
        $this->error = $error;
    }

    public const function has_value() : bool
    {
        return $this->ok;
    }

    public function unwrap() : int32&
    {
        return &$this->value;
    }

    public function failure() : ParseError&
    {
        return &$this->error;
    }
}

function parse(int32 $n) : ParsedInt
{
    if ($n < 0) {
        return ParsedInt(ParseError(3, 22));
    }

    return ParsedInt($n * 2);
}

function doubled(int32 $n) : int32
{
    $v = guard parse($n) else ($error) {
        echo $error->at;            // 3
        return -$error->code;
    }

    return $v;
}

echo doubled(10);       // 20
echo doubled(-1);       // -22
```

`else ($error)` binds a borrow of whatever `failure()` hands back, scoped to the arm, the same way a
`foreach` binding is scoped to its body.

Two interfaces rather than one, because they are two separate capabilities. A type that unwraps but declares
no `failable` has no reason to give, so writing `else ($e)` against one is a compile error that says exactly
that. The same goes for a plain `T?`, where there is genuinely nothing to bind.

`ParsedInt` above is a teaching example, and you do not have to write it. The library ships
[`result<T, E>`](/stdlib/result), which declares both interfaces over any `T` and any `E` you like:

```echo
function parse_port(const string& $text) : result<int32, string>
{
    int64 $n = guard str::int($text) else {
        return .error('not a number');
    }

    return .ok($n);
}

int32 $port = guard parse_port('8080') else ($why) {
    echo "bad port: {$why}";
    die('stop');
}

echo $port;    // 8080
```

Use `T?` when there is nothing to say about why the value is missing, and `result<T, E>` when there is. That
is the whole of the choice.

## Asking whether it is there

`== null` and `!= null` work on anything nullable:

```echo
struct Chevron { int32 $symbol; }

Chevron? $locked = Chevron(7);

if ($locked != null) {
    echo "locked";
}
```

`!` asks the same question. Over a `bool` it is negation, and over anything that may be absent it is exactly
`== null`:

```echo
class Wormhole { int32 $id; }

Wormhole? $active = null;

echo !$active;              // 1
echo $active == null;       // 1
```

Comparing a value that is *always* there against null is refused rather than answered `false`, because the
question is a mistake and answering it would hide one:

```echo
struct Chevron { int32 $symbol; }

Chevron $locked = Chevron(7);
echo $locked == null;
// error: cannot compare 'Chevron' against null - it is always there, write 'Chevron?' if it may be absent
```

Note that `== null` is the only comparison a nullable answers. `$a == $b` over two `int32?` is not a thing:
narrow it first, with any of the three forms above.

## A pointer is already nullable, and there is a trap

`ptr<T>` carries the flag on the pointer level, so it is nullable without a `?`. The trap is that reading a
pointer auto-dereferences it, so `$p == null` asks about the *pointee*:

```echo
ptr<int32> $p = null;
echo $p == null;
// error: cannot compare 'int32' against null - null-check the address with ':$'
```

`:$` names the pointer itself, which is the thing you meant to compare:

```echo
ptr<int32> $p = null;
echo $p:$ == null;      // 1
```

[Pointers and references](/memory/pointers) has the rest of what `:$` does.

## weak references answer the same way

A `weak<T>` does not keep its object alive, so reading one is always a question about whether it is still
there. `strong()` asks it and gives you a `T?`:

```echo
class Stargate
{
    int32 $lockedChevrons;
}

Stargate $sgc = Stargate(7);
weak<Stargate> $watcher = &$sgc;

Stargate $stillThere = guard strong($watcher) else { die("gate is gone"); }
echo $stillThere->lockedChevrons;       // 7
```

All three forms accept a `weak<T>` directly and do the upgrade for you, which is usually what you want:

```echo
class Stargate { int32 $lockedChevrons; }

Stargate $sgc = Stargate(7);
weak<Stargate> $watcher = &$sgc;

echo $watcher?->lockedChevrons ?? -1;   // 7
echo !$watcher;                         // 0
```

The upgrade is balanced: the reference exists for the duration of the read and is given back afterwards, so
none of those forms quietly extends the object's life past the statement. A `guard` is the exception on
purpose, since the whole point is that the binding lives on.

What you cannot do is read a weak reference directly. `$watcher->lockedChevrons` is refused, and the message
tells you to upgrade it first. [Classes](/language/classes) covers why weak references exist at all.

## Where a written null gets its type

`null` has no type of its own. It takes the type of wherever it is going, and there are four places that can
tell it: a declaration, a return, a comparison, and a call argument.

```echo
class Wormhole { int32 $id; }

function log(Wormhole? $w) : int32
{
    if ($w == null) {
        return -1;
    }

    return 0;
}

Wormhole? $none = null;     // the declaration says
echo log(null);             // the parameter says, -1
```

That covers essentially everything you will write. A `null` with no destination at all has nothing to take a
type from, and the compiler says so rather than picking one.

Note: a `T?` whose `T` owns something (a `string?`, an `array<int32>?`, a struct holding either) works the
same as every other nullable, and costs one more machine word plus a branch when it is torn down or copied.
The value inside is destroyed only when it is there, and copying one copies what is inside it only when there
is something to copy. If `T` owns something and never said how it is copied, `$b = $a` over a `T?` is refused
exactly as it is over a `T`, and the message names `guard` as the way to reach the value.

## Next

- [Classes](/language/classes) for `weak<T>`, reference counting and cycles.
- [Pointers and references](/memory/pointers) for `ptr<T>`, `T&` and `:$`.
- [Control flow](/language/control-flow) for `guard` beside the rest of the branching forms.
