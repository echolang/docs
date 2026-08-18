# Memory

Most programs never touch `mem::`. The ones that do are usually **writing a container**, which is
exactly what the standard library uses it for. This is raw heap memory and the questions you can ask
about a type. The rule for the whole namespace: **nothing here frees anything for you.**

```echo
ptr<int32> $chevrons = mem::alloc<int32>(4);

$chevrons:$[0] = 7;
echo $chevrons:$[0];        // 7

mem::free($chevrons);
```

Every `mem::alloc` needs a matching `mem::free`, and using memory after freeing it is undefined. That's
the bargain. If you're not building a data structure, [Arrays](/collections/arrays) already did all
of this for you and did it correctly.

## Counts are elements, never bytes

Every function here that takes a count takes a number of `T`s:

```echo
ptr<float64> $samples = mem::alloc<float64>(3);     // 24 bytes, because a float64 is 8
mem::zero<float64>($samples, 3);                    // 3 elements, not 3 bytes
echo $samples:$[2];                                 // 0.000000
mem::free($samples);
```

There is no exception to that, and there used to be three. `alloc_bytes`, `realloc_bytes` and `free_bytes`
are the byte-level allocator underneath all of this, and they are `private` to the file they are written in.
So calling one is a located error rather than one more thing to remember not to write. The typed functions
above hand you the same memory with the arithmetic already done.

## alloc hands back a pointer, and that is the point

`mem::alloc<T>` returns `ptr<T>` and not `T&`, and it returns `null` when the allocator refuses:

```echo
ptr<int32> $p = mem::alloc<int32>(1024);

if ($p:$ == null) {
    die("out of memory");
}

mem::free($p);
```

Because the result is a pointer, the type system makes you acknowledge that before you can use it as a
reference. The `:$` on the null check is not decoration: reading `$p` on its own auto-derefs, so the
comparison has to name the address itself. Notice also that no `unsafe` was needed. The allocator handed back bytes and this is what says
they are `T`s, but a `ptr<T>` promises nothing, so nothing has been asserted yet. The word is owed by
whoever turns one of these into a `T&`:

```echo
ptr<int32> $p = mem::alloc<int32>(2);
$p:$[0] = 3;

int32& $slot = &$p:$[0];
// error: cannot form 'int32&' from a raw address outside an 'unsafe' block. A borrow is a trusted
//        typed view: every access through it, here and in everything it is passed to, is optimized
//        as 'int32&' - so establishing one over raw storage is a promise only you can make.
```

[Unsafe](/memory/unsafe) is the page about that promise. Writing through the pointer, as the first example
does, needs nothing.

## realloc may move the block, so keep the address it gives you

```echo
ptr<int32> $p = mem::alloc<int32>(2);
$p:$[0] = 42;

$p:$ = mem::realloc($p, 4096);      // re-seat the pointer itself
echo $p:$[0];                       // 42

mem::free($p);
```

`$p:$ = ...` writes the pointer variable rather than through it. See
[Pointers and references](/memory/pointers) for what `:$` peels. Get this wrong and you keep using an
address the allocator has already recycled, which is the classic version of this bug and is silent for as
long as you are lucky.

`mem::realloc` over `null` allocates, and `mem::free` over `null` is a no-op. That's why a container needs
no separate "not allocated yet" state: empty and unallocated are the same thing.

## copy promises the regions do not overlap. move does not

```echo
ptr<int32> $n = mem::alloc<int32>(5);

$n:$[0] = 10;
$n:$[1] = 20;
$n:$[2] = 30;
$n:$[3] = 40;
$n:$[4] = 50;

// drop element 1 by sliding the three above it down over it
mem::move<int32>($n:$ + 1, $n:$ + 2, 3);

echo $n:$[0];       // 10
echo $n:$[1];       // 30
echo $n:$[2];       // 40

mem::free($n);
```

A container closing a gap is exactly the case that breaks `mem::copy`'s promise, which is why the two are
separate functions rather than one with a flag. And note what `move` does *not* do: nothing is duplicated
and nothing is destroyed, so the number of owners is unchanged. That's what makes it correct for a `T`
that owns something, with no branch on `T` at all.

`mem::zero<T>` fills `$count` elements with zero bytes.

## Four questions you can ask about a type

```echo
struct Chevron
{
    int32 $n;
}

echo mem::size<int32>();                     // 4
echo mem::align<float64>();                  // 8
echo mem::is_trivially_copyable<Chevron>();     // 1
echo mem::needs_destruction<string>();          // 1
```

`size<T>` is the **allocation stride**, so it includes tail padding. `size<T>() * $n` is exactly the
room `$n` elements need, and `$p:$[$n]` lands where you expect.

`is_trivially_copyable<T>` is true when duplicating a `T` is duplicating its bytes and nothing else. It is
false for a class or an interface (a copy is one more reference), for a type with a hand-written copy
constructor, and for a struct holding any of those however deep. `needs_destruction<T>` is the teardown
counterpart: true when a `T` going out of scope has something to give back, false for a primitive, false for
a pointer, because an address says nothing about what is behind it.

These are the same questions the language already answers for you every time it copies or destroys a value.
Asking them out loud lets your own code branch on the answer instead of guessing.

## Those answers are constants, so a `const if` can branch on them

This is why `mem::` exists as more than an allocator:

```echo
struct Chevron
{
    int32 $n;
}

const if (mem::needs_destruction<Chevron>()) {
    echo "walk the elements";
} else {
    echo "nothing to tear down";        // this arm, and the other one is not compiled
}
```

`array<T>` is built on exactly this, and you can build the same way. Its copy bulk-copies when the element
type allows it and walks element by element when it does not, and its destructor is a loop for an owning `T`
and literally nothing for an `array<int32>`. One generic type, two bodies, chosen before the branch is ever
reached. See [Generics](/language/generics).

One warning: write the element-wise arm anyway. `is_trivially_copyable<T>` says a bulk copy is *allowed*,
never that a per-element one would be wrong.

## take empties a place, init fills one

These two are the seams a container cannot be written without, and they come as a pair.

An ordinary `$place = $value` is a *re*-assignment, so it ends whatever the destination held. Over a slot
that just came out of `mem::alloc` that means running a destructor over whatever bytes the allocator handed
back. `mem::init<T>` is the write that does not:

```echo
mem::buffer<string> $slots = mem::buffer<string>();
$slots->resize(2);

string $name = "";
$name->append("Abydos");

mem::init<string>($slots->at(0), $name);        // the slot held nothing, so nothing is ended

string& $peek = $slots->at(0);
echo $peek;                                     // Abydos

string $out = mem::take<string>($slots->at(0));  // the slot stops being an owner
echo $out;                                       // Abydos
```

`mem::take<T>` is the mirror. It hands the value over and leaves the storage holding bytes that own nothing,
which is what makes the slot safe to free or reuse. An ordinary read would *copy*, leaving a second owner in
a slot nobody is going to release.

The rule for your own container: if the slot you are writing to is one you just grew into existence, an
ordinary `=` is fine, and that's why `$a[] = $v` on an array needs none of this. If the slot is one you
picked, as a hash table picks a slot for a key, you need `init`. And any time you hand a value *out* of
storage you are managing yourself, you need `take`, or you leave a second owner behind in a slot nobody is
going to release.

**Nothing checks either of these for you.** Take twice from one place and two owners release one value.
Initialize a place that already holds one and that value leaks.

`mem::take` on a slot two threads share duplicates ownership. `mem::atomic::exchange` is "take,
atomically", and only for a word. A `string` or a class handle is not one. See
[Atomics](/memory/atomics).

## Both refuse anything the compiler is already accounting for

You can't use them to sidestep ownership, and the refusal says so:

```echo
string $local = "Abydos";
string $a = mem::take<string>($local);
// error: 'mem::take' can only empty storage reached through a pointer, such as an element of a
//        buffer you allocated. This source is a variable, a property or a temporary, and the scope
//        or the value holding it already owes it a teardown - so taking it here would destroy it
//        twice. Write 'mv' to hand a variable over.
```

A variable, a property and a temporary are all refused, in both directions. `mv` is what you want for a
variable ([Ownership and moving](/memory/ownership)), and an ordinary `=` is what you want for a place the
compiler already knows about.

## bit_cast is the safe way to reinterpret

```echo
float32 $x = 1.0f;

uint32 $bits = mem::bit_cast<uint32, float32>($x);
echo $bits;                                         // 1065353216

float32 $back = mem::bit_cast<float32, uint32>($bits);
echo $back;                                         // 1.000000
```

`ptr<uint32>(&$x)` would give you a second typed path to a live `float32`, and every access through it is a
promise you have to make with `unsafe`. This gives you a *value* instead, and nothing else names that
storage, so there is nothing to promise. It needs no `unsafe` and could not honestly be written to need one.

Both type parameters are spelled out because Echo binds a generic's type arguments all or none, and `To` is
the one it cannot work out for you. The two types must be the same size, and a mismatch is a failed
assertion at runtime rather than a compile error, so check yours with `mem::size` if it is not obvious.

## Reading the counts on a class handle

```echo
class Wormhole
{
    int32 $address;
}

Wormhole $w = Wormhole(7);
Wormhole $second = $w;

echo mem::refs<Wormhole>($w);      // 2
echo mem::weaks<Wormhole>($w);     // 1
```

`refs` is about the *object*: at zero the destructor runs. `weaks` is about the *memory*: at zero
the block is given back. They are not the same moment, and the gap between them is exactly what a `weak<T>`
lives in. All the strong references together hold one weak count, seated with the first, which is why a
freshly built object reads 1 there.

Both take a **borrow** rather than a value, and that's not a detail you can ignore: a by-value class
parameter would itself be one more reference, so it would answer one too high at every call.

Both answer 0 for a null handle, which is more useful than it sounds. A copy-on-write check asks "am I the
only owner", and a handle holding nothing is not uniquely owned either, so one condition covers both cases.

## live_allocations needs a flag, and a scope

```bash
echoc run --track-allocations leak_test.eco
```

Without it, the call is refused where you wrote it:

```echo
echo mem::live_allocations();
// error: 'live_allocations' has nothing to read without allocation tracking
```

Refused rather than answered 0, because 0 is the one wrong answer you could not tell from the right one.
`--explain memory` turns tracking on as well, and prints a summary when the program ends.

With the flag on, it counts *allocations*, not elements and not bytes, and it counts everything, including
the ones you never asked for by name: a class, a closure's captured environment, an array's storage.

<!-- verify: track-allocations -->
```echo
{
    array<int32> $chevrons = [1, 2, 3];
    echo mem::live_allocations();       // 1
}

echo mem::live_allocations();           // 0
```

**Read it after a scope, not at the end of a file.** A local is still alive on the last line of a program,
so a check there tells you nothing. Wrap the thing you are measuring in a block and read the count after the
closing brace.

Growing an existing block does not move the number, and neither does a `realloc` the allocator refused,
because the block is still yours after a failure.

## `mem::buffer<T>` is one allocation, owned by exactly one value

`mem::alloc<T>` hands back an address and no claim on it. Nothing says who frees it and nothing says whether
a second value already holds it. `mem::buffer<T>` says both:

```echo
{
    mem::buffer<int32> $store = mem::buffer<int32>();
    echo $store->capacity();            // 0, and it has allocated nothing

    $store->resize(4);
    echo $store->capacity();            // 4

    mem::init<int32>($store->at(0), 42);

    slice<int32> $window = $store->sub(0, 1);
    echo $window->get(0);               // 42
}   // the allocation goes back here
```

It is deliberately not a container. It has no length, no bounds check and no iteration, because how many of
its slots are live is its *owner's* business. `at()` and `sub()` are both unchecked: capacity is the only
bound a buffer could test, and that is the bound that passes for exactly the reads that are wrong.

What it does have is **exactly one owner, enforced.** A buffer cannot be copied:

```echo
mem::buffer<int32> $a = mem::buffer<int32>();
$a->resize(1);

mem::buffer<int32> $copy = $a;
// error: 'mem::buffer<int32>' is unique: exactly one value may name its storage, so it is moved
//        and never copied.
```

Hand it over with `mv` instead. Its address and capacity are private, so there is also no way to read the
address out, write one in, or build a second buffer around an allocation that already has an owner. The
point of closing those doors is that **two live `mem::buffer<T>` values are always two separate
allocations**, which is a promise `mem::alloc` on its own can never make. That's what `array<T>` is built
on, and why you'd reach for a buffer over a bare `ptr<T>`.

`resize` is the one operation that is neither a create nor a destroy. It consumes the old region and
produces its replacement: the block may move, the elements are relocated bitwise, the number of owners is
unchanged. Every borrow into the buffer is stale afterwards, and that's the owner's rule to keep, because
the buffer cannot see the borrows.

## `mem::atomic::` is the rare spelling

The type you write on a field is [`atomic<T>`](/memory/atomics). A `ptr<int32>` you already hold
still writes `mem::atomic::add`. Sequentially consistent. An ordering is a claim about two
accesses and nothing in the language can check it, so there is no ordering parameter.

```echo
int32 $n = 0;
echo mem::atomic::add<int32>($n, 2);        // 0
echo mem::atomic::load<int32>($n);          // 2
```

Mixing a plain `$n = 0` with `add` on the same word is a data race. Discipline is on the caller,
which is why `atomic<T>` keeps the slot private. [Atomics](/memory/atomics) is the chapter.

## The whole surface

| Signature | What it does |
|---|---|
| `alloc<T>(usize $count) : ptr<T>` | room for `$count` elements, uninitialized. `null` on failure |
| `realloc<T>(ptr<T> $p, usize $count) : ptr<T>` | resizes, preserving what fits. may move the block |
| `free<T>(ptr<T> $p) : void` | releases it. freeing `null` is a no-op |
| `copy<T>(ptr<T> $dst, ptr<T> $src, usize $count) : void` | the regions must not overlap |
| `move<T>(ptr<T> $dst, ptr<T> $src, usize $count) : void` | the regions may overlap |
| `zero<T>(ptr<T> $p, usize $count) : void` | fills `$count` elements with zero bytes |
| `size<T>() : usize` | allocation stride in bytes, a compile-time constant |
| `align<T>() : usize` | required alignment in bytes, a compile-time constant |
| `is_trivially_copyable<T>() : bool` | true when a copy is a byte copy and nothing else |
| `needs_destruction<T>() : bool` | true when going out of scope has something to give back |
| `take<T>(T& $place) : T` | hands the value over and empties the place |
| `init<T>(T& $place, T $value) : void` | stores into a place that holds nothing |
| `bit_cast<To, From>(From $value) : To` | the bits, read as another type of the same size |
| `refs<T>(T& $handle) : usize` | references naming the object. 0 for null |
| `weaks<T>(T& $handle) : usize` | handles needing the block to stay readable. 0 for null |
| `live_allocations() : usize` | allocations still outstanding. needs `--track-allocations` |
| `atomic::load<T>(const T& $slot) : T` | sequentially consistent load of a word |
| `atomic::store<T>(T& $slot, T $value)` | sequentially consistent store |
| `atomic::add<T>(T& $slot, T $delta) : T` | RMW add, returns the previous value |
| `atomic::sub<T>(T& $slot, T $delta) : T` | RMW sub, returns the previous value |
| `atomic::exchange<T>(T& $slot, T $desired) : T` | swap, returns the previous value |
| `atomic::compare_exchange<T>(T& $slot, T $expected, T $desired) : bool` | write `$desired` if the slot is `$expected` |
| `atomic::fence()` | sequentially consistent fence |
| `buffer<T>()` | an empty buffer, holding no allocation |
| `buffer<T>::capacity() : usize` | how many elements it has room for |
| `buffer<T>::resize(usize $count) : void` | consumes the old region, produces its replacement |
| `buffer<T>::at(usize $index) : T&` | a borrow of one slot, unchecked |
| `buffer<T>::sub(usize $from, usize $count) : slice<T>` | a window over `$count` slots, unchecked |
| `buffer<T>::copy(usize $to, usize $from, usize $count)` | the ranges must not overlap |
| `buffer<T>::move(usize $to, usize $from, usize $count)` | the ranges may overlap |
| `buffer<T>::copy(usize $to, const buffer<T>& $src, usize $from, usize $count)` | between two buffers |

## Next

- [Unsafe](/memory/unsafe) for the promise a `T&` over raw storage makes, and where it is owed.
- [Pointers and references](/memory/pointers) for `ptr<T>`, `T&` and what `:$` peels.
- [Ownership and moving](/memory/ownership) for `mv`, which is what `take` refuses in favour of.
- [Atomics](/memory/atomics) for `atomic<T>` and why the slot is private.
