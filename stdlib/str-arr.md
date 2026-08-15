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
is not a type to build yourself. It has to be `public`, because `string` holds one as a property and anyone
holding a `string` can already name the type, so hiding it would be incoherent. What is actually enforced is
the shape: every mutator is `private` on `string`'s side, so no caller reaches one through the owner it holds.
The type is public. The mutators are private. Do not construct one. See
[Visibility](/language/visibility).

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

## C strings: copy or borrow

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

## `str::from` turns a value into text

```echo
echo str::from(42);         // 42
echo str::from(-42);        // -42
echo str::from(true);       // true
echo str::from(1.5);        // 1.5
```

It is an **overload set**, not an interface, and I did not get to choose that: a primitive cannot declare a
conformance, so no interface could ever cover `int32`. It is the same reason `hash::of` is one.

Which means your own type joins it by declaring one function, in `namespace str`, anywhere in your own
module:

```echo
struct Chevron
{
    int32 $number;
    bool $locked;
}

namespace str;

public function from(const Chevron& $c) : string
{
    if ($c->locked) {
        return "chevron {$c->number} locked";
    }

    return "chevron {$c->number} open";
}

// and from there, this works
$c = Chevron(7, true);
echo "status: {$c}";        // status: chevron 7 locked
```

That is all [interpolation](/collections/strings#interpolation) is: `"{$x}"` becomes `str::from($x)`, and
`"{$x:spec}"` becomes `str::from($x, 'spec')`. A type that renders but does not want to honour format specs
simply has no two-argument overload, and `"{$c:>8}"` says so by name rather than silently ignoring it.

`str::from(1.5)` is `1.5` where `echo 1.5` is `1.500000`. `echo` reaches printf's `%f` and always has, while
`str::from` uses the shortest form that reads well in a sentence: six significant digits for a `float`,
fifteen for a `float64`. Ask for `{$x:.17g}` when you need a value to round-trip.

## split / join / trim

```echo
array<string> $parts = str::split('SG-1,SG-9,SG-11', ',');
echo $parts->count();               // 3

echo str::join($parts, ' / ');      // SG-1 / SG-9 / SG-11

string $padded = '  Chulak  ';
string $trimmed = str::trim($padded);

echo "|{$trimmed}|";                // |Chulak|
```

`n` separators give `n + 1` parts, always. That is the rule worth remembering, because it is the one that
makes `str::join(str::split($t, $s), $s)` give `$t` back. An empty text splits to one empty part, and `',a,'`
on `','` gives three.

Note the extra variable on that last line. A hole opens on `{$` and nothing else, so `"|{str::trim($p)}|"`
is ordinary text rather than a call, and the result has to be bound before you can interpolate it.

`trim_start` and `trim_end` do one side each. All three answer a **window** rather than a copy, so trimming
is free. Call `->clone()` on the result if you want the parent's buffer released.

## parse_int and parse_float

```echo
int64 $n = guard str::parse_int('42') else {
    die('not a number');
}

echo $n;        // 42
```

Both parsers answer a nullable, so failure is `guard ... else` rather than a sentinel you have to look up.
Nothing is forgiven: no leading whitespace, no separators, no trailing text. `str::trim` first if the text
came from a line of input.

```echo
echo str::parse_int('4kg') ?? -1;       // -1
echo str::parse_int(' 4') ?? -1;        // -1
echo str::parse_int('9223372036854775808') ?? -1;    // -1, overflow rather than a wrapped value
```

`str::parse_float` goes through C's `strtod` and requires the whole text to be consumed, which is the
difference between it and calling `strtod` yourself.

## The whole surface

| Signature | What it does |
|---|---|
| `str::from(T $v) : string` | the value as text. one overload per primitive, plus `string` and `string::view` |
| `str::from(T $v, const string& $spec) : string` | the same, honouring a format spec |
| `str::spec_of(const string& $text) : spec` | the spec a `{$x:...}` hole spells, parsed |
| `str::from_c_str(ptr<const uint8> $s) : string` | an owning copy of a NUL-terminated C string |
| `str::from_bytes(ptr<const uint8> $b, usize $n) : string` | an owning copy of `$n` bytes, no terminator needed |
| `str::view_of_c_str(ptr<const uint8> $s) : string::view` | a borrowing window over one. allocates nothing |
| `str::concat(const string& $a, const string& $b) : string` | the two joined. what interpolation lowers to |
| `str::split(const string& $t, const string& $sep) : array<string>` | `n` separators give `n + 1` parts |
| `str::join(const array<string>& $parts, const string& $sep) : string` | the inverse, in one allocation |
| `str::trim` / `trim_start` / `trim_end` `(const string&) : string` | ASCII whitespace off both ends, or one |
| `str::pad_start` / `pad_end` `(const string&, usize $width, uint8 $fill) : string` | widen to `$width` **bytes** |
| `str::repeat(const string& $t, usize $times) : string` | `$t` written over |
| `str::parse_int(const string& $t) : int64?` | base ten, optional sign, nothing else |
| `str::parse_float(const string& $t) : float64?` | through `strtod`, whole text consumed |
| `arr::merge<T>(const array<T>& $a, const array<T>& $b) : array<T>` | a new array, `$a`'s elements then `$b`'s |
| `arr::with_capacity<T>(usize $count) : array<T>` | an empty array with room for `$count` |

## Next

- [Strings](/collections/strings) for `string` and `string::view`, which is where the real surface is.
- [Arrays](/collections/arrays) for `array<T>` itself.
- [C interop](/projects/c-interop) for the `extern` blocks these two conversions exist to serve.
