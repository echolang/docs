# Maps

Two types, two promises. `map<K, V>` is a hash table and its iteration order is **unspecified**;
`ordered_map<K, V>` has the same surface plus one guarantee, that it hands entries back in the order they
first arrived.

```echo
map<string, int32> $ages = map<string, int32>();

$ages['mario'] = 34;
$ages['ray'] = 29;

echo $ages->count();        // 2
echo $ages['mario'];        // 34
echo $ages->has('tarek');   // 0
```

There is no map literal yet, so you construct one and fill it. Pick `map` unless you need the order, and
read the cost section before you pick `ordered_map`.

## What a key type owes

Exactly two things: an overload of `hash::of`, and an `operator ==`. Every primitive and `string` already
has both, so `map<string, V>`, `map<int32, V>` and friends need nothing from you.

Notice what that is *not*: it is not an interface. A `contract::hashable` would be the obvious design and
it does not work, because a primitive cannot declare a conformance. A constrained `K` would refuse
`map<int32, V>`, which is the first map anybody writes.

For your own type, declare both:

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

**That is two files, and the second one is a real cost rather than a style note.** A namespace is a
file-level statement, so a `namespace hash;` file cannot also hold the `struct sku` it is about, or the
program using it. A single-file program cannot extend the hash set at all.

Two ways to get the namespace wrong, both silent: `namespace app::hash;` is a different namespace, and an
`of` at the root is invisible to the qualified name `hash::of` that `map`'s own body calls. See
[Namespaces](/language/namespaces) and [hash](/stdlib/hash).

One honest warning: a key type missing either half reports a diagnostic pointing **inside `map.eco`**,
once `K` is bound, rather than at your own code. That is not good and it is known.

## The bracket that reads and the bracket that writes are two declarations

`$m[$k] = $v` is not an assignment to a place. It is literally a call to an index-**write** operator, and
that is what makes insertion possible: a map asked for a key it does not have has no slot to hand back, and
the write is the thing that should create one.

The read bracket is a separate declaration, so **reading through a mutable map neither inserts nor
asserts** on a key that is there:

```echo
map<string, int32> $m = map<string, int32>();

$m['a'] = 1;
$m['b'] = 2;

echo $m['a'];       // 1
echo $m->count();   // 2

// a re-write replaces, it does not insert
$m['a'] = 9;
echo $m['a'];       // 9
echo $m->count();   // 2
```

Reading a key that is *not* there asserts, so use `has` or `get` when you are not sure. The method forms
are the same operators written as calls: `$m->set($k, $v)` **is** `$m[$k] = $v`, and `$m->at($k)` **is**
`&$m[$k]`. One implementation, two spellings.

[Operators](/language/operators) has the mechanics, including why a container may not declare both a place
and a write for the same arity.

There is deliberately no append form. A map has no end to append to, so `$m[] = $v` is an ordinary "no
overload accepts these arguments".

## The surface

<!-- verify: skip -->
```echo
const function count() : usize
const function capacity() : usize
const function is_empty() : bool

const function has(const K& $key) : bool
const function get(const K& $key) : V
function at(const K& $key) : V&
const function at(const K& $key) : const V&

function set(const K& $key, V $value) : void
function remove(const K& $key) : bool
function take(const K& $key) : V

function extend(const map<K, V>& $other) : void
function clear() : void
function reserve(usize $count) : void
function shrink_to_fit() : void

const function keys() : array<K>
const function values() : array<V>
const function clone() : map<K, V>
```

`get` copies the value, `at` borrows it. `remove` answers whether there was anything there; `take` hands
the value over to you:

```echo
map<string, int32> $m = map<string, int32>();
$m['a'] = 1;
$m['b'] = 2;

echo $m->get('a');      // 1
echo $m->remove('b');   // 1
echo $m->remove('b');   // 0
echo $m->take('a');     // 1
echo $m->count();       // 0
```

`keys()` and `values()` both build an `array` and line up index for index, in whatever order the map is
currently in:

```echo
map<string, int32> $m = map<string, int32>();
$m['x'] = 100;
$m['y'] = 200;

array<int32> $vs = $m->values();

int32 $sum = 0;
usize $i = 0;

while ($i < $vs->count()) {
    $sum = $sum + $vs[$i];
    $i = $i + 1;
}

echo $sum;      // 300
```

Note that both are eager: they allocate an array every time you call them.

## capacity() is slots, not entries

A fresh map allocates nothing, so its capacity is zero:

```echo
map<string, int32> $m = map<string, int32>();

echo $m->count();       // 0
echo $m->capacity();    // 0

$m['a'] = 1;
echo $m->count();       // 1
```

Under the hood it is linear probing over a power-of-two number of slots, growing when live entries plus
tombstones pass three quarters of them. `capacity()` reports slots, which is always larger than the entry
count and is not a number to do arithmetic against.

## Every insert may invalidate every borrow

This is the rule that matters in practice. Growth re-seats the whole table, so a `V&` handed out by `at()`
or bound by a `foreach` **is valid until the next insert and no further**:

<!-- verify: skip -->
```echo
int32& $slot = $m->at($key);

$m['something'] = 1;    // may rehash

$slot = 5;              // may write into the old table
```

`remove` and `take` only write a state word, so those are safe. `reserve` up front is how a run of inserts
leaves your borrows alone. Same shape of rule as an [array](/collections/arrays) growing under a slice, and
nothing enforces either.

## A map owns its keys and its values

Both, and both are destroyed exactly once. The two moments worth naming are a replace, where the old value
has to end because nothing else will, and a copy, where the value has to be retained rather than bit-copied:

```echo
map<string, string> $m = map<string, string>();

string $v = '';
$v->append('hello');

$m->set('greet', $v);
echo $m->get('greet');      // hello

// a replace: the old value is destroyed on the way
string $v2 = '';
$v2->append('bye');
$m->set('greet', $v2);

echo $m->get('greet');      // bye
echo $m->count();           // 1

// a copy: a second table, and the value retained rather than duplicated
map<string, string> $c = $m;
$c->set('extra', $v);

echo $m->count();           // 1
echo $c->count();           // 2
```

`take` is the hand-over: the slot stops being an owner at the same moment your local starts.
[Ownership and moving](/memory/ownership) is the general rule this is an instance of.

## Nesting composes

The outer bracket reads and the inner one writes, in one statement:

```echo
map<string, map<string, int32>> $outer = map<string, map<string, int32>>();
string $a = 'a';

$outer[$a] = map<string, int32>();
$outer[$a]['x'] = 7;

echo $outer[$a]['x'];       // 7
echo $outer[$a]->count();   // 1
```

A map of arrays works the same way, mixing the write contract with an array's ordinary place write. One
rule to remember: **a key in a target position must be a variable, not a literal.** An assignment target
and an `&` operand both refuse to give a temporary storage. Reading is free, so `echo $m['a']` is fine
either way.

## ordered_map remembers insertion order

Same surface, one guarantee. Re-writing an existing key does **not** move it to the back; a removed and
re-inserted key goes last, because as far as the order is concerned it is a new arrival:

```echo
ordered_map<string, int32> $m = ordered_map<string, int32>();

$m['zebra'] = 1;
$m['apple'] = 2;
$m['mango'] = 3;

$m['zebra'] = 10;       // a re-write, not a re-insert

foreach ($m as $k => $v) {
    echo $k;            // zebra, apple, mango
}

$m->remove('apple');
$m['apple'] = 20;       // and now it is last

foreach ($m as $k => $v) {
    echo $k;            // zebra, mango, apple
}
```

`keys()` is the order array itself, so it is the one method cheaper here than on a plain map.

### What ordered_map costs

Four things, and they are the reason it is not the default:

- **One extra `K` per entry.** The order is kept as a second array of keys. For a `string` that is two
  words and one more reference to the same buffer, not a second allocation. For a large `K` it is memory.
- **`K` must be copyable.** A `K` with a destructor and no copy constructor can be a `map` key and cannot
  be an `ordered_map` key.
- **`remove` is O(n).** The key has to come out of the order array in place, which is a scan and a shift.
- **Iteration costs one hash lookup per step**, because the values are reached through the table by key.
  Sequential in the keys, random in the values.

It also has no `shrink_to_fit`. Everything else on `map`'s surface is here.

## Writing to a const map, or to a temporary

Both are refused, and both messages are worth seeing once:

```echo
map<string, int32> $m = map<string, int32>();
$m['a'] = 1;

const map<string, int32>& $ro = &$m;
$ro['a'] = 2;
// error: cannot write to an element of 'const map<string,int32>'
```

Reading through the const borrow is fine, through methods and through its own bracket overload.

```echo
function make() : map<string, int32>
{
    return map<string, int32>();
}

make()['a'] = 1;
// error: has no storage of its own, so writing to one of its elements would be lost
```

Bind it to a variable first, and the write has somewhere to land.

## What is not there yet

Three, stated here because you will look for them.

**No map literal.** Construct and fill.

**No optional lookup.** There is no `$m->find($k)` returning a `V?`, so `has` then `get` is two probes for
one question.

**`map<K, V>` uses linear probing.** It is correct and it is not fast. A better table is planned, and it is
on [the list](/reference/limitations) with the rest.

## Next

- [Iteration](/collections/iteration) for `foreach ($m as $k => $v)` and what the cursor is doing.
- [hash](/stdlib/hash) for `hash::of`, `hash::mix` and `hash::combine` in full.
- [Arrays](/collections/arrays) for what `keys()` and `values()` hand back.
