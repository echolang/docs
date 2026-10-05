# Sorting

You have a buffer of values and you want them in order. That is `$a->sort()` or
`$a->sort_unstable()`, and it lives on [`array<T>`](/collections/arrays),
[`slice<T>`](/collections/slices) and [`fixed_array<T, N>`](/collections/fixed-arrays). Same
methods, same rules.

```echo
array<int32> $n = [3, 1, 2];
$n->sort();

echo $n[0];     // 1
echo $n[2];     // 3
```

`sort()` is **stable**: equal elements keep the order they arrived in. `sort_unstable()` is the
faster in-place one and does not promise that.

Here is the catch: integers cannot tell the two apart, so `sort()` on an `array<int32>` takes the
unstable kernel and skips a merge you would never observe. A float stays on the stable path,
because `-0.0 == 0.0`.

## What can be sorted

The element type has to be `contract::comparable<T>`. That is one requirement: `operator <`.
Integers, floats and pointers already have one, so they just work. `string` does too, byte
lexicographic.

```echo
array<string> $names = ['chulak', 'abydos', 'dakara'];
$names->sort();
echo $names[0];     // abydos
```

A struct you wrote does **not**, even if it already has a `<`. Having the operator is not enough.
You opt in:

```echo
struct Gate : contract::comparable<Gate>
{
    int32 $address;
}

operator (const Gate& $a) < (const Gate& $b) : bool
{
    return $a->address < $b->address;
}

array<Gate> $gates = [Gate(9), Gate(1)];
$gates->sort();
echo $gates[0]->address;    // 1
```

Forget the conformance and the error is at *your* call, not inside the library:

<!-- verify: skip -->
```echo
struct Gate
{
    int32 $address;
}

array<Gate> $gates = [Gate(1), Gate(2)];
$gates->sort();
// error: Type parameter 'T' of 'sort' is constrained to 'contract::comparable<T>' but was given 'Gate'
```

`array<Gate>` itself is fine. You can still push, pop, iterate. The methods that need an order
are the ones that say so.

## A different order: `by:` and `key:`

Sometimes the natural `<` is not the order you want. `by:` takes a comparator, `key:` takes a
function that picks the thing to compare. Neither needs the element type to be comparable.

A small struct is the fast form. It inlines into the kernel, no indirect call:

```echo
struct Gate
{
    int32 $address;
    int32 $id;
}

struct ById : contract::comparator<Gate>
{
    const function compare(const Gate& $a, const Gate& $b) : ordering
    {
        return $a->id <=> $b->id;
    }
}

array<Gate> $gates = [Gate(9, 2), Gate(1, 4)];
$gates->sort(by: ById());
echo $gates[0]->id;     // 2
```

A closure is the same label and one indirect call per compare. Fine for a one-off, including
descending:

```echo
array<int32> $n = [1, 4, 2];
$n->sort(by: function(const int32& $a, const int32& $b) : ordering {
    return $b <=> $a;
});
echo $n[0];     // 4
```

`key:` is "sort by this field" without writing a comparator type:

```echo
struct Gate
{
    int32 $address;
    int32 $id;
}

array<Gate> $gates = [Gate(9, 2), Gate(1, 4)];
$gates->sort(key: function(const Gate& $g) : int32 {
    return $g->id;
});
echo $gates[0]->id;     // 2
```

The key type has to be comparable. `int32` is. A struct key needs the same opt-in the element
type does for a natural sort.

`<=>` returns [`ordering`](/stdlib/sort): `.less`, `.equal`, `.greater`. It is a standard-library
operator, the same trick [`..`](/language/operators) is. PHP readers know the symbol. Compile
without the library and it is not there.

## A window, not a copy

`sub()` hands you a [`slice<T>`](/collections/slices). Sorting the slice writes through into the
array. Everything outside the window stays put:

```echo
array<string> $w = ['z', 'c', 'a', 'b', 'y'];
$w->sub(1, 3)->sort();

echo $w[0];     // z
echo $w[1];     // a
echo $w[3];     // c
echo $w[4];     // y
```

That is the reason the kernels live on the slice. `array` and `fixed_array` are one call through
`sub()`.

## Already in order?

That is `sort::is_sorted`, over a pointer and a count. It is not a method on the array. Same
`by:` and `key:` as `sort()`. Empty, one element, and all-equal are sorted.

```echo
array<int32> $n = [1, 2, 3];
echo sort::is_sorted($n->data(), $n->count());      // 1

array<int32> $mixed = [1, 3, 2];
echo sort::is_sorted($mixed->data(), $mixed->count());  // 0
```

I left it off the collection because it is a twelve-line walk, not a kernel. `arr::merge` is not
`array::merge` for the same reason.

## Floats, and the catch

`float32` and `float64` have `<`, so they sort. Here is the catch: that is "has a `<`", not "is a
total order". NaN is unordered with everything, including itself, and `-0.0 == 0.0`. I still
wanted `$floats->sort()` to compile, because every language this audience comes from sorts
floats. `ordering::total($a, $b)` is the IEEE-754 total order when you actually need one:
NaN-safe, and it puts `-0.0` before `0.0`.

```echo
array<float64> $n = [3.0, -0.5, 1.5];
$n->sort();
echo $n[0];     // -0.500000
```

## What a broken comparator does

If your `compare` lies (it says `$a < $b` and also `$b < $a`), the result is some permutation of
the input. Elements are not lost, not duplicated, not freed twice. A debug build may `assert`
when it notices. A release build will not. Do not ship a comparator that cannot make up its mind.

## Next

- [Contracts](/stdlib/contract) for `comparable` and `comparator`.
- [Operators](/language/operators) for declaring `<` and `<=>`.
- [Interfaces](/language/interfaces) for why a primitive can answer an operator-only contract.
- [Sorting internals](/stdlib/sort) for the two kernels, if you are writing a container of your own.
