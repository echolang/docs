# Sorting internals

You will mostly never call `sort::`. [`array<T>`](/collections/arrays),
[`slice<T>`](/collections/slices) and [`fixed_array<T, N>`](/collections/fixed-arrays) already
do: `$a->sort()` and `$a->sort_unstable()` are the surface. This page is the file behind them,
the `ordering` enum those methods talk in, and `is_sorted`, which is the one function here a
program calls itself.

```echo
array<int32> $n = [3, 1, 2];
$n->sort_unstable();
echo $n[0];     // 1
```

[Sorting](/collections/sorting) is the chapter. Come here when you are writing a container and
want the same kernels, or when you need to know what `<=>` actually returns.

## `ordering` is three cases, on purpose

`.less`, `.equal`, `.greater`. That is the whole answer. A comparator that returned `-1 / 0 / 1`
as an `int32` would invite `$c < 0`, and then a function that returned `2` is a sort that walks
off the end.

```echo
echo (1 <=> 2) == ordering::less;           // 1
echo (2 <=> 2) == ordering::equal;          // 1
echo (3 <=> 1) == ordering::greater;        // 1
```

`less()`, `equal()` and `greater()` are the predicates, adjective-style like `empty()`.
`reverse()` flips less and greater and leaves equal alone. `then` is how two keys compose:
equal on the first falls through to the second.

```echo
ordering $age = ordering::equal;
ordering $name = 1 <=> 2;
echo ($age->then($name)) == ordering::less;     // 1
```

`<=>` itself is a **declared** operator in the neighbouring file, `ordering.eco`. The generic
form is derived from `<`, so any `comparable<T>` gets the three-way form for free. `string` and
`string::view` have a concrete overload that does one `memcmp` and wins the tie against that
template.

It is not a built-in. Compile with `--no-stdlib` and `<=>` is not a symbol, the same way `..`
is not. See [Operators](/language/operators).

`ordering::total($a, $b)` is the IEEE-754 total order for `float64` and `float32`. NaN-safe.
`-0.0` before `0.0`. Reach for it when "has a `<`" is not enough, which is the catch
[Sorting](/collections/sorting) already named.

## Two kernels

Sorting is a permutation. Integers can do that with assignment: a move is a copy, `<` is the
language's own. Everything else has to relocate values the same way an array does when it
grows: `mem::take` / `mem::init`. That is why a `string`, a class handle and an owning struct
sort correctly with no arm in the kernel that knows what they are.

`sort::unstable` is the integer path. Insertion up to twenty elements, then a quicksort with a
heapsort fallback. Already-sorted and strictly reversed runs finish in one pass.

`sort::stable` is a top-down merge. It allocates a scratch buffer of `$n` elements above
twenty, nothing below. Integers skip it: their order is total and assignment is a copy, so
stability cannot be observed and the unstable kernel is the same answer. A float stays here,
because `-0.0 == 0.0`.

The public methods pick a kernel. You do not write that yourself unless you are the next
container.

## The adapters

`natural`, `comparing`, `with`, `keyed`. Four small structs the methods construct so the generic
kernel sees one `L` with a `less` method. A `contract::comparator<T>` you wrote becomes
`comparing`. A closure becomes `with`. A key function becomes `keyed`.

The struct form inlines. The closure form is an indirect call per compare, because
`function<R(P...)>` is a pair `{fn, env}` with no per-closure type. If you are sorting a hot
path, write the comparator struct.

These adapters are `internal`. A program in another module does not call them. A type in the
same standard library can.

## Already in order?

`sort::is_sorted($data, $n)` walks once and answers whether the run is already non-decreasing.
Same `by:` and `key:` as the methods. `ptr<const T>` keeps T as T: handing it a
`slice<const T>` would ask `comparable<const T>` and fail.

```echo
array<int32> $n = [1, 2, 3];
echo sort::is_sorted($n->data(), $n->count());      // 1

array<int32> $mixed = [1, 3, 2];
echo sort::is_sorted($mixed->data(), $mixed->count());  // 0
```

Empty and one element are sorted. It is not a method on the array. The check is an algorithm
over a buffer, the same way `arr::merge` is not `array::merge`.

## Next

- [Sorting](/collections/sorting) for `sort`, `sort_unstable`, `by:` and `key:`.
- [Contracts](/stdlib/contract) for `comparable` and `comparator`.
- [Memory](/stdlib/mem) for `is_integer` and `compare_bytes`.
