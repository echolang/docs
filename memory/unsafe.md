# Unsafe

`unsafe` sounds like a mode. It is not. **It is permission for exactly one operation: turning a raw
address into a trusted borrow.**

```echo
ptr<int32> $slots = mem::alloc<int32>(4);

unsafe {
    int32& $first = &$slots:$[0];
    $first = 7;
}

echo $slots:$[0];       // 7

mem::free($slots);
```

That is the whole feature. An `unsafe` block is an ordinary block in every other respect: it opens a scope,
its locals are destroyed at the brace, and it compiles to exactly the same thing. The only difference is what
the type checker will accept inside it.

## Everything you expected to be behind it is not

None of this needs the word, and that is the design rather than an oversight:

```echo
ptr<int32> $ints = mem::alloc<int32>(2);

$ints:$[0] = 1;                             // writing through a raw pointer
$ints:$[1] = $ints:$[0] + 1;                // reading one back
ptr<uint8> $bytes = ptr<uint8>($ints:$);    // reinterpreting the type
ptr<int32> $second = $ints:$ + 1;           // address arithmetic

echo $second;                               // 2

mem::free($ints);
```

Allocating, freeing, casting, offsetting, indexing: all ordinary code. A `ptr<T>` promises nothing, so every
access through one is treated as though it might touch anything, and the optimizer stays conservative around
all of it. Nothing has been claimed, so nothing can be violated.

**A `T&` is the opposite.** It is a trusted typed view, and once you have one the type is the contract: every
access through it is optimized as a `T`, here and in every function the borrow is passed to. That claim
travels, it cannot be checked, and it is exactly the thing only you can know. So that is where the word goes.

## The promise you are signing

Do the promotion outside a block and the compiler spells the deal out:

```echo
$n = 0;
ptr<int32> $ints = &$n;
ptr<uint8> $bytes = ptr<uint8>($ints:$);

uint8& $r = uint8&($bytes:$);
// error: cannot form 'uint8&' from a raw address outside an 'unsafe' block
```

The `help:` line under it is the actual contract, and it is worth reading once in full rather than skimming.
Inside `unsafe { }` you assert that the address:

- is non-null
- is aligned for the type
- holds a complete and valid value of that type
- stays valid for as long as the borrow is used
- can be read at that type compatibly with every other typed access to the same storage

And one thing it explicitly does **not** assert: that your borrow is the only one. Aliasing is a separate
question, and the section below is about it.

That last bullet is the one people skip. If some other part of the program is looking at the same bytes as a
different type, both views cannot be right, and the compiler is now optimizing both of them as though they
were.

## One operation, four spellings

The promotion is easy to write by accident, because three of its four forms do not contain a cast. All four
of these are the same thing:

```echo
$n = 0;
ptr<int32> $ints = &$n;
ptr<uint8> $bytes = ptr<uint8>($ints:$);

function takes(uint8& $b) : void
{
    $b = 1;
}

unsafe {
    uint8& $one = uint8&($bytes:$);     // the explicit narrowing
    ptr<uint8> $two = &$bytes:$[0];     // the address of a raw element
    takes($bytes:$[0]);                 // the implicit borrow at an argument
}

echo $bytes:$[0];                       // 1
```

And the fourth, which is the one that catches people, because it looks like an ordinary method call:

```echo
struct Chevron
{
    int32 $symbol;

    function lock() : void
    {
        $this->symbol = $this->symbol + 1;
    }
}

Chevron $glyph = Chevron(6);
ptr<Chevron> $p = &$glyph;

unsafe {
    $p->lock();
}

echo $glyph->symbol;    // 7
```

A method's receiver is a borrow, so calling one through a `ptr<T>` mints one. Same operation, same promise,
no cast anywhere in sight.

An `unsafe` block is **not** inherited by a function declared inside it. The promise is about a region of
source you are looking at, and a body written somewhere else is not one.

## Raw storage, and why mem::init exists

There is a second thing the compiler does not account for, and it is worth understanding even though it is
not gated by the word.

Storage reached through a pointer has no owner. A local gets a destructor at the end of its scope, a property
gets one from its owner's teardown, but `$slots:$[0]` is a slot in an allocation and nothing walks it. So an
ordinary assignment into one is wrong in a way that is not obvious:

```echo
ptr<string> $slots = mem::alloc<string>(1);

string $address = '';
$address->append("abydos");

mem::init<string>($slots:$[0], $address);

echo $slots:$[0];       // abydos

string $out = mem::take<string>($slots:$[0]);
mem::free($slots);
```

`$slots:$[0] = $address` would be a **re**-assignment, which ends whatever the destination held before storing
the new value. Over a slot straight out of `mem::alloc` that means running a destructor over whatever bytes
the allocator handed back.

So the two seams:

- **`mem::init<T>($place, $value)`** fills storage that holds nothing. It stores the owner it was handed and
  ends nothing.
- **`mem::take<T>($place)`** empties storage without destroying what was in it. The slot keeps its bytes and
  stops being an owner, and the caller gets the value.

Both are refused when you point them at storage the compiler *is* accounting for:

```echo
string $address = "abydos";
string $stolen = mem::take<string>($address);
// error: 'mem::take' can only empty storage reached through a pointer
```

Which is right: the scope already owes `$address` a teardown, so taking it here would destroy it twice. For a
variable the operation you want is `mv`. See [Ownership and moving](/memory/ownership).

`array<T>` never needs any of this, because its append operator says "fresh slot" by its shape. A container
that seats an element at an index a probe chose has no shape to say it with, and that is the whole reason
these two exist.

## Two borrows of one thing

The `unsafe` promise does not cover aliasing, but the language does check the one case it can see: a single
call reaching the same storage twice with conflicting intent.

```echo
array<int32> $glyphs = [1, 2, 3];
$glyphs->extend($glyphs);
// error: This names the same storage as another argument of the same call
```

`extend` writes through its receiver and reads through its argument, and here both name `$glyphs`. A value
cannot be both written and read by one call, so the compiler refuses rather than producing something that
depends on the order the implementation happens to use.

That check works at the call site, where both arguments' storage is visible. It cannot work inside the body:
once `extend` is running, `$this` and `$other` are two borrows and nothing in the function can tell whether
they name the same thing. Which is the honest limit of the whole system. **A borrow's type is a promise about
how the storage is read, not a promise that nobody else is reading it.**

## When you actually need it

Writing a container is the case, and it is more or less the only one. `mem::buffer<T>` is the standard
library's example: it owns one allocation, it hands out borrows of slots, and it discharges the promotion in
exactly one place.

<!-- verify: skip -->
```echo
function at(usize $index) : T&
{
    unsafe {
        return &$this->data:$[$index];
    }
}
```

Two things make that sound, and neither is the word itself. The buffer's pointer and capacity are `private`,
so nothing outside the file can put them in a state where the assertion is false. And the type is `#[unique]`,
so exactly one value can ever name that allocation. The `unsafe` block is where the invariant is *cashed in*,
not where it is established.

That is the shape to copy. One type, keeping one invariant, with the promotion in a method small enough to
check by eye. Everything above it is ordinary safe code.

## How to not need it

Most of the time the right answer is that somebody already wrote the container:

```echo
array<int32> $glyphs = [];
$glyphs[] = 7;
$glyphs[] = 9;

echo $glyphs[0];            // 7
echo $glyphs->count();      // 2
```

`array<T>`, `map<K, V>` and `string` are built on exactly the machinery on this page, and they have already
paid for it. If you are reaching for `mem::alloc` because you want a growable buffer of things, you want an
`array<T>`.

The second answer is a borrow. If a function needs to look at your data, `const T&` gives it that with no
addresses involved and no promise to sign. Raw storage is for when you are the one deciding where values
live, which is a smaller set of programs than it feels like from inside a systems language.

## Next

- [Pointers and references](/memory/pointers) for `ptr<T>`, `:$` and the address forms.
- [Ownership and moving](/memory/ownership) for `mv`, and why `mem::take` refuses a variable.
- [Arrays](/collections/arrays) for the container you probably want instead.
