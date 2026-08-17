# Hashing

You'll mostly never call `hash::`. `map<K, V>` calls it to turn a key into a bucket index. You'll call
it the day you want your own type to be a map key, and the surprise is what that takes:
**a `hash::of` overload and an `operator ==`, and deliberately not an interface.**

```echo
map<string, int32> $power = map<string, int32>();
$power["naquadah"] = 3;

echo $power->get("naquadah");       // 3
```

`string` already has both, so that just works. So does every primitive. Here's what happens when the
key is a type you wrote.

## Why a key requirement is not a `contract::`

`contract::hashable` would read better than an overload set, and it cannot work. **A primitive cannot
declare a conformance.** So a constrained `K` would refuse `map<int32, V>` and `map<usize, V>`, the two maps
everybody writes first, on the grounds that `int32` never opted in. An overload's parameter type has no such
restriction: it can be anything, including a type you don't own.

This is the mirror image of the argument `array<T>` makes about its elements. There, opt-in conformance was
rejected because a type that *forgets* to opt in goes back to being bit-copied in silence. Here it is
rejected because a type that *cannot* opt in is excluded outright. Same shape, opposite failure.

## The overload set, as it actually is

Ten integer types, `bool`, both floats, `string` and `string::view`. That's all of it, and there is
deliberately **no generic `of<T>`** above them. When your key type is not in the set, the compiler simply
tells you what is:

```echo
struct sku
{
    int32 $n;
}

operator (const sku& $a) == (const sku& $b) : bool
{
    return $a->n == $b->n;
}

map<sku, int32> $stock = map<sku, int32>();
$stock[sku(1)] = 5;
// error: No overload of 'of' accepts these arguments. Candidates are:
//          hash::of(const int8&)
//          ...
//          hash::of(const string&)
//          hash::of(const string::view&)
```

Be ready for where that error is reported: it points at the line inside the library that asked for the hash,
not at your `$stock[...]`. That's not great and it's on [the list](/reference/limitations), but the
message names the missing thing exactly, so it's still the fastest error in the language to act on.

Every overload takes `const T&`, a borrow, so hashing a key never copies it or touches a reference count.
Yours should do the same.

## Teaching a map about your own type

Add an overload. Nothing is registered anywhere, and nothing needs to be:

<!-- verify: skip -->
```echo
// key.eco
struct sku
{
    int32 $n;
}

operator (const sku& $a) == (const sku& $b) : bool
{
    return $a->n == $b->n;
}
```

<!-- verify: skip -->
```echo
// hash_key.eco
namespace hash;

function of(const sku& $k) : uint64
{
    return of($k->n);
}
```

Every `namespace hash;` file in a program contributes to the same overload set, and that set is the one
`map<K, V>` calls. Your overload is found automatically. There is nothing to register and nothing to
import.

**It has to be a file of its own, and that's a real cost rather than a style note.** A namespace is a
file-level statement, so a `namespace hash;` file cannot also hold the `struct sku` it is about, or its
`operator ==`, or the program using them. Which means a single-file program cannot extend the set at all.

For a type made of parts, fold the parts together with `combine`:

<!-- verify: skip -->
```echo
namespace hash;

function of(const GateAddress& $a) : uint64
{
    return combine(of($a->chevrons), of($a->point_of_origin));
}
```

## Two ways to get the extension wrong, and both look like nothing happening

**A nested namespace does not extend anything.** `namespace app::hash;` is a different namespace, and inside
that file a bare `of(...)` *hides* the real set rather than joining it, because an overload set stops at the
first namespace with a candidate for the name.

**An `of` at the root is invisible.** `hash::of` is a qualified name, looked up in exactly that namespace
rather than walked outward. A function called `of` at file scope will never be found by it.

In both cases your overload compiles fine and the map still reports the missing candidate. If you see that
diagnostic while looking straight at a function you just wrote, check the namespace line first.

## Only the low bits of your hash are ever used

**A map picks its bucket from the bottom of the word and nothing else:**

```echo
uint64 $h = hash::of(42);
echo $h & 7;            // 2, the bucket in a table of capacity 8
```

That's the one thing to know if you ever write a hash by hand rather than composing one out of `hash::of`.
A hash built only out of multiplies looks perfectly random when you print the whole word and collides
constantly in the table, because multiplying pushes randomness *upward* and leaves the low bits about as
structured as it found them. Run yours through `hash::mix` at the end, which folds the top of the word back
down over the bottom:

```echo
echo hash::mix(1);      // 6238072747940578789
```

`mix` never merges two different inputs, so passing a hash through it can only help.

## An integer is hashed by value, not by width

```echo
int64 $one = 1;
echo hash::of(1) == hash::of($one);     // 1
```

An `int32` 1 and an `int64` 1 hash identically. That costs you nothing, because a map has one key type and
nothing inside one can tell the difference. Signedness does still separate, so `int32 -1` and
`uint32 4294967295` land in different buckets.

## combine is not commutative, on purpose

```echo
echo hash::combine(hash::of(1), hash::of(2));   // 14817379100790678232
echo hash::combine(hash::of(2), hash::of(1));   // 15867421936784253806
```

Which is exactly why you should reach for `combine` instead of writing `of($a) ^ of($b)` yourself. `^` is
commutative, so an xor-based hash gives a coordinate `(1, 2)` the same bucket as `(2, 1)`, and a map full of
transposed pairs then degenerates into a linked list.

`bytes` and `step` are the byte-at-a-time pieces underneath. Reach for them when your type is made of
several byte runs and you want to fold them all into one hash without going through `combine`.

## bits is the one you have to ask for by name

```echo
struct Chevron
{
    int32 $n;
}

Chevron $c = Chevron(3);
echo mem::size<Chevron>();       // 4
echo hash::bits<Chevron>($c) == hash::bits<Chevron>(Chevron(3));    // 1
```

This hashes a `T`'s raw bytes, and it is wrong for every type that holds an address. A `string` byte-hashed
is a heap pointer hashed, so two strings holding the same text in two different buffers would land in two
buckets while comparing equal, which is the one way a hash table breaks that nothing else catches. It is
also wrong for a struct with padding, whose padding bytes are not defined.

That's exactly why there is no generic `of<T>` sitting above it. A catch-all would answer for a type nobody
thought about, silently and wrongly. Making you write `bits` is making you say you checked.

## A float makes a poor key, and the library only fixes half of it

`+0.0` and `-0.0` compare equal and do not share bytes, which would otherwise put one key in two buckets.
The float overloads handle that for you:

```echo
float64 $zero = 0.0;
float64 $neg = -0.0;

echo $zero == $neg;                         // 1
echo hash::of($zero) == hash::of($neg);     // 1
```

The other half of IEEE-754 has no fix available. **A NaN is never equal to itself**, so a NaN key can be
stored and then never found again, whatever its hash is. Nothing here can help with that, and it's the
reason a float is a poor key in general.

## These numbers are not a format

Not cryptographic, not stable across architectures, and not a serialization format. This is an in-memory
bucket index and nothing else. Don't write one to a file and expect the next build to agree with it, and
don't use one where an attacker chooses the keys.

## The whole surface

| Signature | What it does |
|---|---|
| `of(const T& $value) : uint64` | 15 overloads: 10 integer types, `bool`, `float32`, `float64`, `string`, `string::view` |
| `mix(uint64 $key) : uint64` | stirs a hash so its low bits are usable. merges nothing |
| `combine(uint64 $seed, uint64 $value) : uint64` | folds a second hash into a first. not commutative |
| `bytes(ptr<const uint8> $data, usize $size, uint64 $seed) : uint64` | hashes a byte run, continuing from a seed |
| `step(uint64 $seed, uint8 $byte) : uint64` | folds one byte in |
| `bits<T>(const T& $value) : uint64` | the raw bytes. wrong for anything holding an address |

## Next

- [Maps](/collections/maps) for `map<K, V>` itself, and what a key type is used for besides hashing.
- [Operators](/language/operators) for the `operator ==` a key also owes.
- [Namespaces](/language/namespaces) for why the extension point costs you a file.
