# Arrays

You already have `array<T>` on [the collections page](/collections/arrays). Methods live there:
`push`, `pop`, `count`. `arr::` is the two operations that do not belong on one array, because they
answer a question about arrays rather than about a single value.

```echo
array<int32> $inbound = [1, 2];
array<int32> $outbound = [3];

array<int32> $all = arr::merge($inbound, $outbound);
echo $all->count();     // 3
echo $all->get(2);      // 3
```

## merge does not belong on either argument

`merge` takes two arrays and gives you a third. It's a free function rather than a method because it
touches a property of neither argument: both come in as `const array<T>&`, nothing is consumed, and nothing
is changed.

```echo
array<string> $gates = ["Abydos"];
array<string> $more = ["Chulak", "Dakara"];

array<string> $network = arr::merge($gates, $more);
echo $network->count();     // 3
echo $network->get(1);      // Chulak
```

The elements are **copied** by the ordinary rules, so an element type whose copy needs a constructor needs
one here too. See [Copying](/memory/copying). It allocates once for the result and no more, so merging two
large arrays doesn't thrash.

## `room` is a function because a constructor would lie

```echo
array<int32> $chevrons = arr::room<int32>(7);

echo $chevrons->count();        // 0, it is empty
echo $chevrons->capacity();     // 7, and it will not reallocate until the eighth

$chevrons[] = 1;
echo $chevrons->count();        // 1
```

`array<int32>(7)` would have been the obvious spelling and it's the wrong one. Anybody who has met
`vec![0; 5]` reads that as *seven elements*, not room for seven. Constructors can't be named, so the way to
disambiguate is to stop using one. Reach for this whenever you know the final size, which is most of the
time you're filling an array in a loop.

## The whole surface

| Signature | What it does |
|---|---|
| `arr::merge<T>(const array<T>& $a, const array<T>& $b) : array<T>` | a new array, `$a`'s elements then `$b`'s |
| `arr::room<T>(usize $count) : array<T>` | an empty array with room for `$count` |

## Next

- [Arrays](/collections/arrays) for `array<T>` itself, which is where the real surface is.
- [String functions](/stdlib/str) for `str::from`, `split`, `join` and the rest of `str::`.
