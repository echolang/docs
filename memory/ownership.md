# Ownership and moving

Every value has exactly one owner, and **when the owner goes out of scope the value is destroyed.** Not when
the garbage collector gets around to it, not when a count happens to reach zero. At the closing brace.

```echo
struct Wormhole
{
    int32 $id;
    ptr<uint8> $stream;

    destructor()
    {
        echo $this->id;
        mem::free($this->stream);
    }
}

{
    Wormhole $open = Wormhole(7, mem::alloc<uint8>(64));
    echo "connected";
}

echo "disengaged";
```

That prints `connected`, then `7`, then `disengaged`. The destructor ran at the brace, and nothing you write
can make it run twice or not at all.

If your values do not own anything, that is the entire chapter and you can stop here. The rest is what
happens when you want to hand ownership somewhere else. The examples below drop the buffer and keep the
destructor, because a destructor is all it takes: a struct that has one **owns** something as far as the
compiler is concerned, and every rule on this page follows from that.

## The last one declared is the first destroyed

```echo
struct Wormhole
{
    int32 $id;

    destructor()
    {
        echo $this->id;
    }
}

Wormhole $first = Wormhole(1);
Wormhole $second = Wormhole(2);
Wormhole $third = Wormhole(3);

echo 0;
```

`0`, then `3`, `2`, `1`. Reverse order is the only order that works: a value declared later may hold a
reference to one declared earlier, so it has to be gone before its target is. A struct's own properties
follow the same rule, last property first.

## Leaving early destroys everything on the way out

A `return` from inside a nested block leaves every scope it passes through, innermost first:

```echo
struct Wormhole { int32 $id; destructor() { echo $this->id; } }

function dial(bool $abort) : int32
{
    Wormhole $outbound = Wormhole(1);

    if ($abort) {
        Wormhole $retry = Wormhole(2);
        return 10;
    }

    return 20;
}

echo dial(true);
echo dial(false);
```

`2`, `1`, `10`, then `1`, `20`. `break` and `continue` do the same for the scopes they leave, stopping at the
loop.

## mv hands ownership over

A move is written `mv`, and it transfers the obligation to destroy along with the value:

```echo
struct Wormhole { int32 $id; destructor() { echo $this->id; } }

Wormhole $open = Wormhole(7);
Wormhole $handed = mv $open;

echo "one wormhole, one teardown";
```

One destructor line, not two. `$handed` owns it now and `$open` owes nothing, so the scope end only tears
down what is still owned.

## Reading a moved-from variable is a compile error

This is the guarantee the whole design is for:

```echo
struct Wormhole { int32 $id; destructor() { echo $this->id; } }

Wormhole $open = Wormhole(7);
Wormhole $handed = mv $open;

echo $open->id;     // error: '$open' has been moved out of
```

Nothing was compiled. There is no use-after-move at runtime because there is no use-after-move at all.

You can put a new value in the variable, though. A moved-from variable is empty, not poisoned:

```echo
struct Wormhole { int32 $id; destructor() { echo $this->id; } }

Wormhole $slot = Wormhole(1);
Wormhole $kept = mv $slot;
$slot = Wormhole(2);

echo 0;
```

`0`, then `1`, then `2`. Two wormholes were built and two were destroyed, in the reverse order of the
variables that ended up holding them.

### Moving on one path only

The move is tracked per path, so moving inside an `if` with no matching move on the other side is refused
rather than guessed at:

```echo
struct Wormhole { int32 $id; destructor() { echo $this->id; } }

function close(mv Wormhole $w) : void {}

Wormhole $open = Wormhole(7);

if (true) {
    close(mv $open);
}
// error: '$open' owns a resource and is moved out of on only one branch
```

A loop gets the same treatment with its own sentence, which is the same reason read backwards: the second
iteration would move something that left on the first. `'$open' is moved out of inside a loop, so the next
iteration would move a value that is no longer there.` Declare the value inside the loop, or move it after.

## A function asks for ownership with mv, and the call site has to agree

```echo
struct Wormhole { int32 $id; destructor() { echo $this->id; } }

function close(mv Wormhole $w) : void
{
    echo "closing";
}

Wormhole $open = Wormhole(7);
close(mv $open);

echo "after";
```

`closing`, `7`, `after`. Note where the `7` lands: the wormhole is destroyed at the end of `close`, because
that is where its owner now goes out of scope.

Leave the `mv` off at the call and you are told to write it:

```echo
struct Wormhole { int32 $id; destructor() { echo $this->id; } }

function close(mv Wormhole $w) : void {}

Wormhole $open = Wormhole(7);
close($open);   // error: '$w' takes ownership of this argument - write 'mv' in front of it
```

I like this rule more than any other one in the language. A signature cannot quietly eat something you
thought you still had, and you never have to read a function's declaration to find out whether your variable
survived the call. Every place a value stops being yours is a word in your own source.

A temporary is exempt, because there is no variable left holding the wreckage:

```echo
struct Wormhole { int32 $id; destructor() { echo $this->id; } }

function open(int32 $id) : Wormhole
{
    return Wormhole($id);
}

function close(mv Wormhole $w) : void
{
    echo "closing";
}

close(open(7));
echo "after";
```

And writing `mv` on a temporary is refused, since it was already on its way:

```echo
function open(int32 $id) : int32
{
    return $id;
}

$w = mv open(7);    // error: 'mv' needs an expression with storage to move out of
```

## Returning a value moves it out

A local handed back by `return` is moved, not copied. No destructor at the end of the callee, no duplicate:

```echo
struct Wormhole { int32 $id; destructor() { echo $this->id; } }

function dial(int32 $id) : Wormhole
{
    Wormhole $w = Wormhole($id);
    return $w;
}

Wormhole $active = dial(7);
echo "connected";
```

`connected`, then a single `7`. The same applies to `$this` at the end of a constructor, which is why a
constructor can build something owning without it being destroyed on the way out.

And it applies through a call in the same statement. `return wrap($w)` is `return $w` with something in
between, so `$w` is handed to `wrap` rather than copied for it. The `return` was going to end its life
either way:

```echo
struct Cargo { int32 $mass; destructor() { echo $this->mass; } }

function stow(Cargo $c) : int32
{
    echo "stowed";
    return $c->mass;
}

function launch() : int32
{
    Cargo $hold = Cargo(3);
    return stow($hold);
}

echo launch();
```

`stowed`, then `3` as the cargo is destroyed inside `stow`, then `3` again as the result. One `Cargo`, one
destructor. `Cargo` never had to say what a copy of it would mean, because none is taken.

Write the same call one line earlier and it is refused, which is the rule showing you its edge:

```echo
function unloaded() : int32
{
    Cargo $hold = Cargo(4);
    int32 $mass = stow($hold);      // error: 'Cargo' owns a resource and cannot be copied
                                    // implicitly at this argument
    return $mass;
}
```

Here `$hold` is still yours on the next line, so the call needs a value of its own and `Cargo` has not said
how to make one. `mv $hold` is the answer if you meant to hand it over. In the `return` above you did
not have to write it, because there was nothing left for it to be.

## mv is not a performance hint

`mv` does not exist to make a call cheaper, and reaching for it because a value looks expensive is the wrong
instinct.

What `mv` moves is **the obligation to destroy**. It says nothing about how the bytes travel, it does not
promise the value stays at the same address, and it does not turn a by-value parameter into a free one.

If you want a call to avoid work, the answer is a borrow. If you want the callee to keep the value, the
answer is `mv`. Those are two different questions, and answering the second to solve the first is how you end
up with a function that owns things it never needed.

## Borrowing is what you want most of the time

A borrow gives a function access to your value and takes nothing:

```echo
struct Wormhole { int32 $id; destructor() { echo $this->id; } }

function report(const Wormhole& $w) : int32
{
    return $w->id;
}

Wormhole $open = Wormhole(4);
echo report($open);
echo report($open);

echo 0;
```

`4`, `4`, `0`, then `4`. Called twice, destroyed once, and the call site says nothing at all: the compiler
takes the address for you.

`const T&` is a read-only borrow and `T&` is one you can write through. Both are non-null, both cost the same
as a pointer, and neither owns anything. [Pointers and references](/memory/pointers) is the chapter for what
you can do with them.

## A temporary lives until the call returns

Hand a freshly built value straight to a borrow parameter and it stays alive for exactly as long as the call:

```echo
struct Wormhole
{
    int32 $id;

    constructor(int32 $id)
    {
        $this->id = $id;
        echo 1;
    }

    destructor()
    {
        echo 3;
    }
}

function report(Wormhole& $w) : int32
{
    echo 2;
    return $w->id;
}

report(Wormhole(5));
echo 4;
```

`1`, `2`, `3`, `4`. Built, borrowed, destroyed, and only then does the next statement run. Not destroyed
before the callee saw it, and not left lying around until the end of the scope.

## mv moves a whole variable, nothing smaller

You cannot move a field out of a struct or an element out of an array:

```echo
struct Wormhole { int32 $id; destructor() { echo $this->id; } }

struct Gate
{
    Wormhole $active;
    int32 $chevrons;
}

Gate $sgc = Gate(Wormhole(1), 7);
Wormhole $stolen = mv $sgc->active;
// error: 'mv' can only move a whole variable
```

The struct would be left with a hole in it and nothing in the type says which fields are still there. Moving
the whole `Gate` works. Moving a piece of it is on [the list](/reference/limitations).

## A class answers all of this with a count

Everything above is about values. A [class](/language/classes) is not a value: it is a reference-counted
object on the heap, and assigning one hands out another name for it rather than another copy of it.

```echo
class Stargate
{
    int32 $lockedChevrons;
}

Stargate $sgc = Stargate(0);
echo mem::ref_count($sgc);      // 1

Stargate $alias = $sgc;
echo mem::ref_count($sgc);      // 2
```

So there is nothing to move. A class handle is copied freely, the destructor runs when the last holder goes
away rather than at a brace you can point at, and `mv` has no work to do. The rules on this page start
mattering again the moment a *struct* owns something.

## Cycles leak, and weak references are the fix

Reference counting has one failure mode and Echo does not pretend otherwise. Two objects holding each other
never reach zero, and there is no cycle collector coming.

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
}

dial();
echo "done";
```

Both destructors run. Pick the direction that owns, make the other one `weak<T>`, and the counts reach zero
in order. Had both edges been strong, neither destructor would run and nothing would tell you.

A weak reference does not keep its object alive, so reading one is a question rather than an access. Ask it
with `strong()`, which gives you a `T?`:

<!-- verify: dies -->
```echo
class Stargate { int32 $lockedChevrons; }

function watch() : weak<Stargate>
{
    Stargate $sgc = Stargate(7);
    weak<Stargate> $w = &$sgc;
    return $w;
}

weak<Stargate> $dangling = watch();

Stargate $stillThere = guard strong($dangling) else {
    echo "the gate is gone";
    die("nothing to report");
}

echo $stillThere->lockedChevrons;
```

The gate really is gone by then, so that program prints `the gate is gone` and stops. Reading through a dead
weak reference is not something you can do by accident: there is no spelling for it.

## Next

- [Copying](/memory/copying) for what happens when you do not move, and what a copy costs.
- [Pointers and references](/memory/pointers) for `T&`, `ptr<T>` and the address forms.
- [Classes](/language/classes) for reference counting, `weak<T>` and `instanceof` in full.
