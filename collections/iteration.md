# Iteration

`foreach` walks arrays, maps, strings, slices and ranges, and it does that without a single line in the
compiler that knows what any of them are. **It knows three interfaces and nothing else**, so a type of
yours loops exactly as well as the standard library's.

```echo
array<int32> $numbers = [10, 20, 30];

foreach ($numbers as $value) {
    echo $value;        // 10, 20, 30
}
```

The `as` here is the binding. `$x as T` is a cast, a different job. [Casts](/language/casts) is that page.

The catch is the copy you don't pay for, and that a type of yours loops the same way.

## Keys, when the source has them

```echo
array<int32> $numbers = [10, 20, 30];

foreach ($numbers as $i => $value) {
    echo $i;            // 0, 1, 2
    echo $value;        // 10, 20, 30
}
```

For an array the key is the index. For a map it is the key. Not every source has one, and asking a source
that does not is an error rather than a zero:

<!-- verify: skip -->
```echo
foreach ($plain as $k => $v) { }
// error: its cursor declares no key contract - so there is no '$k' to bind
```

## Three ways to bind the element

By value is the default. `$value` is a copy, and writing it leaves the collection alone:

```echo
array<int32> $numbers = [1, 2, 3];

foreach ($numbers as $x) {
    $x = $x * 100;
    echo $x;            // 100, 200, 300
}

foreach ($numbers as $y) {
    echo $y;            // 1, 2, 3
}
```

`&$x` borrows the element, so a write reaches the collection:

```echo
array<int32> $numbers = [1, 2, 3];

foreach ($numbers as &$x) {
    $x = $x * 2;
}

foreach ($numbers as $y) {
    echo $y;            // 2, 4, 6
}
```

`const &$x` is the same borrow, read-only and said out loud:

```echo
array<int32> $numbers = [7, 8];

foreach ($numbers as const &$x) {
    echo $x;            // 7, 8
}
```

The mode is decided at the loop rather than by the collection, and that's deliberate: the same array is
read in one loop and written through in the next, and only the loop knows which.

## The copy you do not pay for

**A by-value binding that nothing in the body writes is silently bound `const V&` instead.** You write the
obvious thing and you get the borrow anyway:

```echo
array<int32> $numbers = [1, 2, 3];

foreach ($numbers as $reader) {  // bound as const int32&, no copy
    echo $reader;
}

foreach ($numbers as $writer) {  // written, so a real copy
    $writer = 9;
}
```

For an `int32` that saves nothing worth measuring. For a struct with a destructor it is the difference
between one copy constructor and one destructor per iteration and none at all.

The elision is only sound because of a rule you are expected to keep: **do not mutate a collection while
you are iterating it.** Nothing checks it. Growing a container during a loop re-seats its storage, and the
cursor is still pointing at the old one, so it is the [slice](/collections/slices) lifetime rule wearing a
different hat. Collect what you want to change and apply it after the loop.

## Method calls on a borrow binding do not work

This one will catch you, because a read-only borrow loop is the obvious thing to write:

```echo
struct Item
{
    int32 $n;

    const function trace() : void { echo $this->n; }
}

array<Item> $items = [];
$items->slot()->n = 5;

foreach ($items as const &$item) {
    $item->trace();
}
// error: cannot implicitly convert 'const Item&&' to 'const Item&'
```

The receiver ends up as a borrow of a borrow, and nothing unwraps it. Note the method is already
`const function`, so this is not a constness refusal: it fails the same way for `&$item`.

Two things do work in the meantime: field access on the borrow, and binding by value, which for a
read-only loop is elided to that same borrow anyway.

```echo
struct Item
{
    int32 $n;

    const function trace() : void { echo $this->n; }
}

array<Item> $items = [];
$items->slot()->n = 5;

foreach ($items as const &$item) {
    echo $item->n;      // 5
}

foreach ($items as $item) {
    $item->trace();     // 5
}
```

This is a bug, not a design, and it is on [the list](/reference/limitations).

## A const collection is a different contract

A `const` collection reaches a **second** interface, `contract::const_iterable`, and gets a cursor over
elements it may only read:

```echo
array<int32> $source = [1, 2, 3];
const $frozen = $source;

foreach ($frozen as $x) {
    $x = $x * 10;       // the copy, not the array
    echo $x;            // 10, 20, 30
}

foreach ($frozen as const &$y) {
    echo $y;            // 1, 2, 3
}
```

By value works, because the copy is yours. The read-only borrow works, because that's what the elements
are. A **writable** borrow is refused, and the message names both halves:

```echo
array<int32> $source = [1, 2, 3];
const $frozen = $source;

foreach ($frozen as &$x) {
    $x = 9;
}
// error: asks for a borrow it could write through, but 'const array<int32>' hands out 'const int32'
```

Why a second interface rather than a second `iterate()` overload? Because **a requirement's receiver is
part of the requirement.** A `const function iterate()` cannot answer an interface that asked for a
mutable one, and vice versa. Being able to iterate a value nobody may write is a genuinely different
capability from being able to iterate one you own, so it is a different contract.
[Interfaces](/language/interfaces) has the general rule.

## Your type loops the same way

Two pieces. A **cursor** conforming to `contract::iterator<V>`, which knows how to step and what it is
looking at:

<!-- verify: skip -->
```echo
interface iterator<V>
{
    function advance() : bool;
    function current() : V&;
}
```

And a **source** conforming to `contract::iterable<V>`, which hands one back:

<!-- verify: skip -->
```echo
interface iterable<V>
{
    type Iter : iterator<V>;

    function iterate() : Iter;
}
```

`advance()` is called first and its answer gates the loop, so `current()` is only ever reached after a
`true`. That's the whole contract, and it is what lets `current()` skip a bounds check `advance()` already
did.

Put together, a countdown:

```echo
struct countdown_cursor : contract::iterator<int32>, contract::keyed<usize>
{
    int32 $value;
    usize $step;

    constructor(int32 $from)
    {
        $this->value = $from + 1;
        $this->step = 0;
    }

    function advance() : bool
    {
        if ($this->value <= 1) {
            return false;
        }

        $this->value = $this->value - 1;
        $this->step = $this->step + 1;
        return true;
    }

    function current() : int32&
    {
        return &$this->value;
    }

    function key() : usize
    {
        return $this->step - 1;
    }
}

struct Countdown : contract::iterable<int32>
{
    int32 $from;

    function iterate() : countdown_cursor
    {
        return countdown_cursor($this->from);
    }
}

$c = Countdown(4);

foreach ($c as $i => $v) {
    echo $i;            // 0, 1, 2, 3
    echo $v;            // 4, 3, 2, 1
}
```

You never write `type Iter`. It is an **associated type**, inferred from `iterate()`'s return type and then
checked against the constraint. And `contract::keyed<usize>` on the cursor is the only reason `$i => $v`
is spellable: it is a separate interface precisely so the capability set can grow without every cursor
repeating `advance` and `current`.

A type that declares neither says so plainly:

<!-- verify: skip -->
```echo
foreach ($bag as $e) { }
// error: 'Bag' cannot be iterated - it declares neither 'contract::iterator' nor 'contract::iterable'
```

## foreach takes a cursor too

`foreach` also takes something that already *is* a cursor, which is what makes an adaptor (a filter, a map)
an ordinary struct rather than a language feature. There are two cases and the difference is visible:

A cursor sitting in a **variable** is borrowed, not copied, because driving it advances it and you have to
see that. So it comes back spent:

```echo
struct counter : contract::iterator<int32>
{
    int32 $value;
    int32 $limit;

    constructor(int32 $limit)
    {
        $this->value = 0;
        $this->limit = $limit;
    }

    function advance() : bool
    {
        if ($this->value >= $this->limit) {
            return false;
        }

        $this->value = $this->value + 1;
        return true;
    }

    function current() : int32& { return &$this->value; }
}

counter $held = counter(3);

foreach ($held as $v) {
    echo $v;            // 1, 2, 3
}

foreach ($held as $v) {
    echo -1;            // nothing: it is spent
}

echo $held->value;      // 3
```

A cursor from a **call** has no owner but the loop, so it is taken by value and dropped at loop exit. Each
call gets its own:

<!-- verify: skip -->
```echo
foreach (counter(2) as $v) { echo $v; }     // 1, 2
foreach (counter(2) as $v) { echo $v; }     // 1, 2
```

One thing you cannot do is freeze a cursor. Stepping one writes to it, and `advance()` is not declared
`const`:

<!-- verify: skip -->
```echo
const $cursor = $source->iterate();

foreach ($cursor as $x) { }
// error: stepping a cursor writes to the cursor, and 'contract::iterator::advance()' is not declared const
```

Iterate what it was taken from instead.

## What it lowers to

A `foreach` is a transient node. It is rewritten before codegen into the loop you would have written by
hand, which is why there is no `foreach` arm anywhere in codegen, in the ownership rules or in the
control-flow rules:

<!-- verify: skip -->
```echo
{
    $__it = <source>->iterate();

    while ($__it->advance()) {
        K  $k  = $__it->key();      // keyed form only
        V& $el = $__it->current();  // or a copy, per the binding mode
        <your body>
    }
}
```

The cursor lives in a scope of its own, so it is destroyed at loop exit.

What that costs: for an array or a slice the cursor holds its window **by value**, which makes the end an
ordinary loop-invariant local, which gives the loop a computable trip count, which means it vectorizes. A
`foreach` summing an `array<int32>` at `--optimize whole` compiles to the same vector loop the hand-written
index loop does. You are not paying for the abstraction.

## Next

- [Ranges](/collections/ranges) for `0 .. 10`, which is a library type conforming to these same interfaces.
- [Interfaces](/language/interfaces) for associated types, and for what conformance actually checks.
- [Control flow](/language/control-flow) for `while` and `for`, and where `break` and `continue` go.
