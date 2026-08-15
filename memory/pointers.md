# Pointers and references

Echo has two ways to name storage you do not own, and **the only difference between them is that a borrow can
never be null.**

```echo
$chevrons = 7;

int32& $locked = &$chevrons;    // a borrow, always points at something
ptr<int32> $maybe = null;       // a pointer, may point at nothing

echo $locked;       // 7
```

Everything else on this page applies to both. Reach for `T&` by default and for `ptr<T>` when absence is a
real state, exactly the way you would pick between `T` and `T?`.

## & takes an address, and the space matters

`&$x` is the address of `$x`:

```echo
$symbol = 7;
ptr<int32> $p = &$symbol;

echo $p;        // 7
```

Here is the one place in the language where whitespace changes meaning. `&` glued to a name is address-of.
`&` with a space after it is the bitwise and:

```echo
$mask = 12;
$bits = 10;

echo $bits & $mask;     // 8, bitwise
echo &$mask == &$mask;  // 1, two addresses of the same thing
```

That mostly does the right thing by accident, since you rarely write a bitwise and against a variable you
meant to take the address of. When it does bite, it bites silently: `$h & $mask` is a mask and `$h &$mask` is
not. Unpicking it is a lexer question rather than a parser one, so it is not going to change.

Type position is more forgiving. `int& $x` and `int & $x` are both a borrow, because there the type parser is
reading rather than the expression lexer.

## Reading goes through exactly one level

A plain read of a pointer loads the pointer and then loads through it. Once. Not until it finds something
that is not a pointer:

```echo
$a = 1;
ptr<int32> $p = &$a;
ptr<ptr<int32>> $pp = &$p;

echo $p;        // 1, that is the one deref
echo $pp;
// error: cannot echo an address of type 'ptr<int32>' - echo prints values
```

Reading `$pp` gave back a `ptr<int32>`, which is an address, and `echo` prints values. This is a good thing
to have tripped over once: the rule is one level, always, whatever the depth.

`->` is the exception. It reaches through as many levels as it has to:

```echo
struct GateAddress
{
    int32 $destination;
}

$abydos = GateAddress(27);
ptr<GateAddress> $p = &$abydos;
ptr<ptr<GateAddress>> $pp = &$p;

echo $p->destination;       // 27
echo $pp->destination;      // 27
```

## Writing goes through too

Assigning to a pointer writes into the pointee, not into the pointer:

```echo
$chevrons = 1;
ptr<int32> $p = &$chevrons;

$p = 7;
echo $chevrons;     // 7
```

Which means you cannot re-point it that way, and the compiler tells you what to write instead:

```echo
$a = 1;
$b = 2;
ptr<int32> $p = &$a;

$p = &$b;
// error: cannot assign 'int32&' to 'int32' - to change where a pointer points, assign to ':$'
```

## :$ peels one level

`:$` names the pointer itself rather than what it points at. Assigning to it re-seats the pointer:

```echo
$a = 1;
$b = 2;
ptr<int32> $p = &$a;

$p = 100;           // writes into $a
echo $a;            // 100

$p:$ = &$b;         // re-seats $p
$p = 200;           // writes into $b now

echo $a;            // 100, unchanged
echo $b;            // 200
```

That is the whole of `:$`. It compiles to nothing at all: it is a way of saying which of the two things you
mean, not an operation.

It only applies to a pointer, and it does not have members:

```echo
$a = 1;
ptr<int32> $p = &$a;

echo $a:$;
// error: ':$' expects a pointer, got 'int32'
```

## :$ chains, and the last one is just &

Peel twice and you have the address of the pointer's own slot, which is the same thing `&` would have given
you:

```echo
$a = 1;
ptr<int32> $p = &$a;
ptr<ptr<int32>> $out = &$p;

echo $out:$ == &$p;         // 1, the address $out holds
echo $out:$:$ == &$out;     // 1, the address of $out itself
echo $out == $p:$;          // 1, one read of $out is the pointer $p holds
```

Write whichever one reads better. `&$out` is usually the clearer of the two.

## Arithmetic and indexing go through the peel

Address arithmetic is arithmetic on the address, so it happens on `:$`:

```echo
ptr<int32> $p = mem::alloc<int32>(4);

$p:$[0] = 10;
$p:$[1] = 20;

echo $p:$[1];               // 20

ptr<int32> $next = $p:$ + 1;
echo $next;                 // 20
echo ($p:$ < $next:$);      // 1

mem::free($p);
```

Leave the peel off and you get told, because an unqualified `[` is a question for a collection rather than
for an address:

```echo
ptr<int32> $p = mem::alloc<int32>(2);
$p:$[0] = 1;

echo $p[0];
// error: 'ptr<int32>' is a pointer, and a pointer is indexed through ':$'
```

`$p:$++` and `$p:$--` step by one element, the same way `$p:$ + 1` does. And an address only ever compares
against another address: `$p == null` compares the *pointee*, which is a mistake with its own diagnostic. See
[Nullability](/memory/nullability).

## Casting a pointer needs no ceremony

A pointer type converts to another pointer type by calling it:

```echo
ptr<int32> $ints = mem::alloc<int32>(2);
$ints:$[0] = 0;
$ints:$[1] = 0;

ptr<uint8> $bytes = ptr<uint8>($ints:$);
$bytes:$[0] = 1;

echo $ints:$[0];    // 1

mem::free($ints);
```

No `unsafe` required, and that placement is deliberate rather than an oversight. Computing another address
promises nothing: every access through a `ptr<T>` is treated as though it could touch anything, so the
optimizer stays out of your way. The word is owed by whoever turns one of these into a `T&`, which is
[Unsafe](/memory/unsafe).

A borrow widens to a nullable pointer for free, since that only discards a guarantee:

```echo
$a = 5;
int32& $r = &$a;
ptr<int32> $p = $r:$;

echo $p;    // 5
```

Going the other way is the narrowing, and it needs both an explicit cast and an `unsafe` block.

## const sits on a level, and there are two of them

`const ptr<T>` and `ptr<const T>` are different types, and reading them as "a const pointer" loses the whole
distinction. The `const` applies to the level it is written on.

**A const pointer** cannot be re-seated. What it points at is still writable:

```echo
$a = 1;
const ptr<int32> $p = &$a;

$p = 5;         // fine, writes into $a
echo $a;        // 5
```

```echo
$a = 1;
$b = 2;
const ptr<int32> $p = &$a;

$p:$ = &$b;
// error: cannot re-seat 'const ptr<int32>' - the pointer is const, only its pointee may be written
```

**A const pointee** is the mirror. The pointer can be re-seated. The pointee cannot be written:

```echo
const int32 $a = 1;
const int32& $view = &$a;

$view = 20;
// error: cannot write through 'const int32&' - its pointee is const
```

`const` also travels along the path you took to get somewhere. Reach a member through a const borrow and the
member is const too, which is what makes `const T&` a promise about the whole subtree rather than about one
field.

## At a call site, the compiler takes the address for you

A `T&` parameter borrows a named value without you writing anything:

```echo
function bump(int32& $x) : void
{
    $x = $x + 1;
}

$chevrons = 6;
bump($chevrons);
echo $chevrons;     // 7
```

Writing `bump(&$chevrons)` produces exactly the same call, so use whichever reads better in context. A field
or an element works the same way.

A `ptr<T>` parameter opts out of that, on purpose. It may be null, so handing it a value is not something the
compiler will decide for you:

```echo
function bump(ptr<int32> $x) : void
{
    $x = $x + 1;
}

$chevrons = 6;
bump($chevrons);
// error: cannot implicitly convert 'int32' to 'ptr<int32>'
```

Write `bump(&$chevrons)` and it compiles. The difference is small and it is the point: a `ptr<T>` parameter is
a signature saying "this might be nothing", and it should look different at the call.

## An address must not outlive its storage

There are no lifetimes in the type system, so this is enforced by refusing the shapes that are obviously
wrong. Returning the address of a local is one:

```echo
function address() : ptr<int32>
{
    $local = 7;
    return &$local;
}
// error: cannot return the address of local '$local' - its storage ends with the call
```

Taking the address of something with no storage is another:

```echo
function make() : int32
{
    return 7;
}

ptr<int32> $p = &make();
// error: Cannot take the address of an expression that has no storage
```

And a member of a temporary, which is the sneaky one, because the member has storage and the thing holding it
does not:

```echo
struct Inner
{
    int32 $tag;
}

struct Outer
{
    Inner $in;
}

ptr<int32> $p = &Outer(Inner(1))->in->tag;
// error: 'Inner' has no storage of its own, so the address of its member 'tag' would point into a value
//        destroyed at the end of this statement. Bind it to a variable first.
```

What the compiler will not catch is a pointer that outlives its target through a variable, or one you stashed
in a struct. Those are yours to keep straight.

## Growth invalidates every pointer into a container

This is the one that will actually bite you in real code. A growable container reallocates, and reallocating
may move the block:

```echo
array<int32> $glyphs = [1, 2, 3];
ptr<int32> $first = &$glyphs[0];

$glyphs[] = 4;      // may reallocate, and $first may now be garbage

echo $glyphs->count();      // 4
```

Nothing diagnoses that. The buffer's own `resize` re-seats its pointer through `:$` because `mem::realloc`
hands back an address rather than writing through the old one, and every borrow anybody else took is stale
afterwards.

The rule is simple enough to follow: take the address after you are done growing, or take an index instead of
an address. An index survives a reallocation and a pointer does not.

## Next

- [Unsafe](/memory/unsafe) for turning a raw address into a trusted borrow.
- [Nullability](/memory/nullability) for `ptr<T>` against `T?`, and the `$p:$ == null` rule.
- [Functions](/language/functions) for choosing between `T`, `T&`, `const T&` and `mv T` on a parameter.
