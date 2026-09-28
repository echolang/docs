# Fixed arrays

**A `fixed_array<T, N>` is N elements of `T`, stored inline wherever the value lives.** It does not grow, it does not allocate, and `N` is part of the type: `fixed_array<int32, 4>` and `fixed_array<int32, 8>` are unrelated.

```echo
fixed_array<int32, 4> $quad = [1, 2, 3, 4];

echo $quad->count();    // 4
echo $quad[0];          // 1

$quad[0] = 9;
echo $quad[0];          // 9
```

`array<T>` is the one you want by default. Reach for this when the length is a fact about the type - a matrix, a colour, a stack buffer you do not want on the heap.

## `N` is a value, not a type

`const usize N` in a parameter list is a compile-time integer. Writing `4` at the use site binds it:

```echo
struct sized<const usize N>
{
    const function n() : usize
    {
        return N;
    }
}

sized<4> $a = sized<4>();
echo $a->n();       // 4
```

A literal in that slot is typed as `usize` from the parameter. `sized<4>` and `sized<8>` intern as two types.

## A literal must be exactly `N` long

The brackets still make a list. The destination says it is a `fixed_array`, so every element is an indexed write rather than an append, and the count has to match:

```echo
fixed_array<int32, 4> $quad = [1, 2, 3, 4];
echo $quad->count();    // 4
```

<!-- verify: skip -->
```echo
fixed_array<int32, 4> $short = [1, 2, 3];
// error: this literal has 3 elements, 'fixed_array<int32,4>' has 4
```

Leave the type off and `[1, 2, 3, 4]` is still an `array<int32>`. Nothing here changes that default.

There is no `$quad[] = 5`. It does not grow.

## `T[N]` is the storage

The collection is a one-field struct over an inline array. You can write the storage type yourself when a field is all you need:

```echo
struct Transform
{
    float32[16] $m;
}

Transform $t;
echo mem::size<Transform>();    // 64
```

`$t->m[0]` is a place. Bounds on `fixed_array` live in its operators; indexing `T[N]` directly is the storage primitive, like `mem::buffer::at`.

A constructor would otherwise owe every slot. A field of `fixed_array<T, N>` or of `T[N]` starts as
N zeros, the same value `fixed_array<T, N>()` builds, so leaving it unassigned is fine:

```echo
struct Packed
{
    fixed_array<uint8, 4> $bytes;

    constructor()
    {
    }
}

Packed $p = Packed();
echo $p->bytes[0];          // 0
echo $p->bytes->count();    // 4
```

An `int32` field still has to be assigned on every path. The zeros are a fact about the inline
storage, not a general "uninitialized is zero" rule.

## It iterates like an array

`foreach` has no idea what a `fixed_array` is. The type conforms to `contract::iterable<T>` by handing back a `slice_iterator` over `->sub()`:

```echo
fixed_array<int32, 4> $quad = [1, 2, 3, 4];

foreach ($quad as $n) {
    echo $n;
}
```

`->sub()` is written out, the same as on `array<T>`. A slice is a borrow.

## It is already a C buffer

Every slot is live and `N` is the type, so there is no spare to commit. `data()` is the first
element, or `null` when `N` is 0. Hand C that pointer and `N`.

```echo
fixed_array<int32, 4> $quad = [1, 2, 3, 4];

ptr<int32> $p = $quad->data();
$p:$[0] = 9;

echo $quad[0];          // 9
echo $quad->count();    // 4
```

[`array<T>`](/collections/arrays) is the one that grows, and the one that needs `spare` / `commit`
for the uninitialised tail.

## It owns its elements

Copying one copies each element. Destroying one destroys each element. For a `T` that is just bytes, both are a memcpy of the whole blob.

```echo
fixed_array<string, 2> $words = ['a', 'b'];
fixed_array<string, 2> $copy = $words;

$copy[0] = 'c';

echo $words[0];     // a
echo $copy[0];      // c
```

## Next

- [C interop](/projects/c-interop) for handing `data()` to a C function.
- [Arrays](/collections/arrays) for the growable heap collection.
- [Slices](/collections/slices) for a window onto these elements.
- [Generics](/language/generics) for `const usize N` on your own types.
