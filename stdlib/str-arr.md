# str and arr

Two small namespaces, and small is the honest description. `arr::` is two array functions that had nowhere
better to live, and `str::` is the plumbing under `string` plus the two functions that cross the C
boundary. **Nothing here is a string library.** [Strings](/collections/strings) is, and `string` itself owns
almost all of that surface.

```echo
array<int32> $inbound = [1, 2];
array<int32> $outbound = [3];

array<int32> $all = arr::merge($inbound, $outbound);
echo $all->count();     // 3
echo $all->get(2);      // 3
```

## `arr::` is what does not belong on the array

`merge` takes two arrays and gives you a third. It is a free function rather than a method because it
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
large arrays does not thrash.

## `with_capacity` is a function because a constructor would lie

```echo
array<int32> $chevrons = arr::with_capacity<int32>(7);

echo $chevrons->count();        // 0, it is empty
echo $chevrons->capacity();     // 7, and it will not reallocate until the eighth

$chevrons[] = 1;
echo $chevrons->count();        // 1
```

`array<int32>(7)` would have been the obvious spelling and it is the wrong one: anybody who has met
`vec![0; 5]` reads that as *seven elements*, not room for seven. Constructors cannot be named, so the way to
disambiguate is to stop using one. Reach for this whenever you know the final size, which is most of the
time you are filling an array in a loop.

## `str::buf` is the shared block behind every string

A `string` is a window onto a `str::buf`, which owns the actual bytes. The buffer is **shared and reference
counted**, so two strings holding the same text usually hold one buffer between them, and the bytes are
freed once when the last of them goes.

That is the whole reason copying a `string` is cheap, and it is the only thing about `str::buf` you need. It
is not a type to build yourself: `string` maintains invariants on it that nothing outside checks, and there
are no visibility modifiers yet to stop you breaking them ([the list](/reference/limitations) again).

You will meet the name in two places: in a debugger, and in `mem::ref_count<str::buf>` if you want to see
the sharing for yourself.

## A literal allocates nothing, which is why the count starts at zero

<!-- verify: track-allocations -->
```echo
string $literal = "Chulak";
echo mem::ref_count<str::buf>($literal->owner);     // 0
echo mem::live_allocations();                       // 0

string $built = "";
$built->append("Chulak");
echo mem::ref_count<str::buf>($built->owner);       // 1
echo mem::live_allocations();                       // 2

string $shared = $built;
echo mem::ref_count<str::buf>($built->owner);       // 2
echo mem::live_allocations();                       // 2
```

A literal is a window over bytes baked into your binary, with no buffer behind it at all, so its count reads
0 and it costs you no memory at all. A string you actually build costs two allocations. Copying either of
them costs nothing, which is the number worth remembering: **passing strings around is free, building them
is not.**

## Crossing the C boundary: copy, or borrow

An `extern` function that hands you a `ptr<const uint8>` has given you a NUL-terminated C string and no
claim on it. Two functions turn that into something Echo can use, and the choice between them is one
question: **will the source outlive the result?**

```echo
string $gate = "Chulak";
ptr<const uint8> $raw = $gate->c_str();

// borrow: no allocation, valid only while the owner's bytes are
string::view $window = str::view_of_c_str($raw);
echo $window->size;         // 6

// copy: owning, safe to keep
string $owned = str::from_c_str($raw);
echo $owned;                // Chulak
```

`view_of_c_str` walks to the NUL to find the length and points at the same bytes. Use it when the source
lives at least as long as you need the window, which is exactly the case for `argv` entries and environment
variables. That is why [std::env](/stdlib/env) hands back views rather than strings.

`from_c_str` allocates and copies. Use it when the source is about to be freed, or is behind something like
`setenv` that may replace it out from under you.

Note: `string::view` has a `$size` **property** rather than a `size()` method, so it is `$v->size` with no
parentheses. `string` has the method. That inconsistency is real and will catch you once.

## Why this page is short

Because `string` got there first. Concatenation, slicing, searching, `starts_with`, `char_count`, the
mutators, all of it is on the type itself. What is left over here is the buffer nobody should touch and the
two conversions that need a namespace to live in.

What a fuller string library wants first is not more functions in `str::`. It is formatting, an encoding
story beyond "bytes with a UTF-8 aware `char_count`", and a split or join that can hand back an
`array<string>` without a copy per element. Those are on [the list](/reference/limitations).

## The whole surface

| Signature | What it does |
|---|---|
| `str::from_c_str(ptr<const uint8> $s) : string` | an owning copy of a NUL-terminated C string |
| `str::view_of_c_str(ptr<const uint8> $s) : string::view` | a borrowing window over one. allocates nothing |
| `arr::merge<T>(const array<T>& $a, const array<T>& $b) : array<T>` | a new array, `$a`'s elements then `$b`'s |
| `arr::with_capacity<T>(usize $count) : array<T>` | an empty array with room for `$count` |

## Next

- [Strings](/collections/strings) for `string` and `string::view`, which is where the real surface is.
- [Arrays](/collections/arrays) for `array<T>` itself.
- [C interop](/projects/c-interop) for the `extern` blocks these two conversions exist to serve.
