# Atomics

Two things share a syllable and they are not one feature.

`#[atomic]` on a class is a fact about that class's *reference count*. The retain is a load, an add
and a store unless the class opted in.

`atomic<T>` is a type you give a *field*. Every access to the slot is an RMW. The compiler supplies
the verbs. The type supplies the discipline.

They are not allowed to be one mechanism. `const` already has a meaning and it is a per-level bit.
An `atomic` keyword would have two owners.

## The count, not the payload

An unmarked class keeps a cheap retain: a load, an add and a store. That is correct for every
program that never shares a handle across threads, and it is the default because most objects never
do.

Mark the class when a handle will be copied onto another thread with no lock held:

```echo
#[atomic]
class Counter
{
    int32 $hits;
}

Counter $c = Counter(0);
echo $c->hits;        // 0
```

The count is then an atomic RMW. The fields are not. Two threads writing `$hits` still race. Put
the word in an `atomic<T>`, or put the object behind a [`mutex`](/stdlib/thread#the-value-lives-inside-the-lock).
[Threads](/stdlib/thread) is the page about starting the second thread.

It is refused on a struct and on an interface, where there is no count:

```echo
#[atomic]
struct Hits
{
    int32 $n;
}
// error: '#[atomic]' cannot be written on a struct. A struct has no reference count - it is copied,
//        and each copy is one thread's own.
```

A struct is already one thread's own value. Copying it makes another. There is nothing to mark.

## The field you write

`$hits = $hits + 1` on a shared `int32` is a load, an add and a store. That is Java's `volatile++`,
and it loses updates. `atomic<int32>` exists so you cannot write that:

```echo
atomic<int32> $hits = atomic<int32>(0);
echo $hits->add(1);     // 0, the value before the add
echo $hits->load();     // 1
```

The slot is private. The only way in is a method that is an RMW.

The type is [`#[unique]`](/memory/copying#unique-for-a-type-only-one-value-may-ever-name). A struct
copy would memcpy the word, and that copy would be a non-atomic access:

```echo
atomic<int32> $a = atomic<int32>(1);
atomic<int32> $b = $a;
// error: 'atomic<int32>' is unique: exactly one value may name its storage, so it is moved and
//        never copied.
```

Move it (`mv $a`) or borrow it. Two live `atomic<T>` values are two words.

Nothing in the compiler knows what an `atomic` is. There is no `#[core:]` binding and there is
deliberately none. The compiler supplies the verbs. This type is ordinary Echo over them.

## What T is allowed

A word: the 8, 16, 32 and 64-bit integers, `usize` and `isize`, `bool` (except add and sub), and
`ptr<T>` at load, store, exchange and compare_exchange.

There is no `atomic<string>`. A string is three words and owns a count. An exchange would move the
bits without retaining:

```echo
string $name = 'idle';
echo mem::atomic::load<string>($name);
// error: cannot atomically operate on 'string' - it is wider than a word, and an exchange would
//        not retain. Put it in a mutex.
```

The same refusal covers a class handle, a float, an enum, and anything wider than a word. Put a
string in a `mutex`, or copy it: a string copy is a retain of `str::buf`, and that class is already
marked.

`bool` has no add or sub. There is no integer RMW on a flag. `ptr<T>` has no add or sub either: that
would move the address by bytes, not by elements.

```echo
bool $flag = false;
mem::atomic::store<bool>($flag, true);
echo mem::atomic::load<bool>($flag);        // 1

ptr<int32> $slot = ptr<int32>(null);
echo mem::atomic::load<ptr<int32>>($slot) == null;      // 1
```

## The methods

`add` and `sub` return the value *before* the update. `exchange` is a swap. `compare_exchange`
writes `$desired` only if the slot still holds `$expected`, and answers whether it did:

```echo
atomic<int32> $hits = atomic<int32>(0);

echo $hits->add(1);                     // 0
echo $hits->load();                     // 1

$hits->store(10);
echo $hits->sub(3);                     // 10
echo $hits->load();                     // 7

echo $hits->exchange(4);                // 7
echo $hits->load();                     // 4

echo $hits->compare_exchange(4, 9);     // 1, it matched
echo $hits->load();                     // 9
echo $hits->compare_exchange(4, 1);     // 0, the slot is 9 now
echo $hits->load();                     // 9
```

That is the whole surface. There is no `fetch_or`, no `fetch_and`, no weak compare-exchange.

## The rare spelling

A `ptr<int32>` you already hold still writes `mem::atomic::add`. That is the compiler seam a
container talks to a slot through, the same way `mem::take` and `mem::init` are the seam a
container talks to unaccounted storage through. It should look like `mem::`:

```echo
int32 $n = 0;
echo mem::atomic::add<int32>($n, 2);        // 0
echo mem::atomic::load<int32>($n);          // 2
mem::atomic::store<int32>($n, 5);
echo mem::atomic::exchange<int32>($n, 8);   // 5
echo mem::atomic::load<int32>($n);          // 8
```

The type exists so you do not have to. Mixing a plain `$n = 0` with `add` on the same word is a
data race. Discipline is on the caller, which is why `atomic<T>` keeps the slot private.

`mem::atomic::fence()` is the seventh verb. It is a sequentially consistent fence and it takes
nothing.

## Sequentially consistent, no ordering parameter

Every method above is sequentially consistent. An ordering is a claim about two accesses and
nothing in the language can check it, so there is no ordering parameter.

The compiler's own retain and release pick a measured ordering, because they are one protocol.
This surface is not. If you wanted `relaxed`, you would be making a claim Echo cannot see.

## Next

- [Threads](/stdlib/thread) for `spawn`, `mutex` and `task`.
- [Classes](/language/classes) for what a handle is, and why the default count is cheap.
- [Copying](/memory/copying) for `#[unique]`, which is why `atomic<T>` cannot be copied.
- [Attributes](/reference/attributes#atomic) for the mark itself.
