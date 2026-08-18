# String functions

`string` itself owns almost all of the surface. [Strings](/collections/strings) is that chapter.
`str::` is the plumbing under it, plus the two functions that cross the C boundary. **Nothing here is
a string library.**

```echo
echo str::from(42);         // 42
echo str::from(true);       // true
echo str::from(1.5);        // 1.5
```

## `str::buf` is the shared block behind every string

A `string` is a window onto a `str::buf`, which owns the actual bytes. The buffer is **shared and reference
counted**, so two strings holding the same text usually hold one buffer between them, and the bytes are
freed once when the last of them goes.

That's why copying a `string` is cheap, and it's the only thing about `str::buf` you need. It
is not a type to build yourself. It has to be `public`, because `string` holds one as a property and anyone
holding a `string` can already name the type, so hiding it would be incoherent. What is actually enforced is
the shape: every mutator is `private` on `string`'s side, so no caller reaches one through the owner it holds.
The type is public. The mutators are private. Don't construct one. See
[Visibility](/language/visibility).

You'll meet the name in two places: in a debugger, and in `mem::refs<str::buf>` if you want to see
the sharing for yourself.

## A literal allocates nothing, which is why the count starts at zero

<!-- verify: track-allocations -->
```echo
string $literal = "Chulak";
echo mem::refs<str::buf>($literal->owner);     // 0
echo mem::live_allocations();                       // 0

string $built = "";
$built->append("Chulak");
echo mem::refs<str::buf>($built->owner);       // 1
echo mem::live_allocations();                       // 2

string $shared = $built;
echo mem::refs<str::buf>($built->owner);       // 2
echo mem::live_allocations();                       // 2
```

A literal is a window over bytes baked into your binary, with no buffer behind it at all, so its count reads
0 and it costs you no memory at all. A string you actually build costs two allocations. Copying either of
them costs nothing, which is the number to remember: **passing strings around is free, building them
is not.**

## C strings: copy or borrow

An `extern` function that hands you a `ptr<const uint8>` has given you a NUL-terminated C string and no
claim on it. Two functions turn that into something Echo can use, and the choice between them is one
question: **will the source outlive the result?**

```echo
string $gate = "Chulak";
ptr<const uint8> $raw = $gate->cstr();

// borrow: no allocation, valid only while the owner's bytes are
string::view $window = str::cview($raw);
echo $window->size;         // 6

// copy: owning, safe to keep
string $owned = str::from($raw);
echo $owned;                // Chulak
```

`cview` walks to the NUL to find the length and points at the same bytes. Use it when the source
lives at least as long as you need the window, which is exactly the case for `argv` entries and environment
variables. That's why [Environment](/stdlib/env) hands back views rather than strings.

`from` allocates and copies. Use it when the source is about to be freed, or is behind something like
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

It's an **overload set**, not an interface, and I didn't get to choose that: a primitive cannot declare a
conformance, so no interface could ever cover `int32`. It's the same reason `hash::of` is one.

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

That's all [interpolation](/collections/strings#interpolation) is: `"{$x}"` becomes `str::from($x)`, and
`"{$x:spec}"` becomes `str::from($x, 'spec')`. A type that renders but does not want to honour format specs
simply has no two-argument overload, and `"{$c:>8}"` says so by name rather than silently ignoring it.

`str::from(1.5)` is `1.5` where `echo 1.5` is `1.500000`. `echo` reaches printf's `%f` and always has, while
`str::from` uses the shortest form that reads well in a sentence: six significant digits for a `float`,
fifteen for a `float64`. Ask for `{$x:.17g}` when you need a value to round-trip.

## split / join / trim

```echo
str::parts $parts = str::split('SG-1,SG-9,SG-11', ',');
echo $parts->count();               // 3

echo str::join($parts, ' / ');      // SG-1 / SG-9 / SG-11

string $padded = '  Chulak  ';
string $trimmed = str::trim($padded);

echo "|{$trimmed}|";                // |Chulak|
```

`n` separators give `n + 1` parts, always. Remember that one, because it's the rule that
makes `str::join(str::split($t, $s), $s)` give `$t` back. An empty text splits to one empty part, and `',a,'`
on `','` gives three.

The parts are **offsets** into the source, not a new `string` each. That is why a 400 000-field
split is one retain of the text plus an array of `{off, len}`, and why a short source can stay
inline: `at()` rebuilds the window from the live source. `$p->at($i)` is a `string::view`.
`$p->owned()` is the list of owning strings, and you reach for it when a part has to outlive `$p`.
A part of at most `string::INLINE` bytes becomes its own inline value; a longer one retains the
parent buffer.

Note the extra variable on that last line. A hole opens on `{$` and nothing else, so `"|{str::trim($p)}|"`
is ordinary text rather than a call, and the result has to be bound before you can interpolate it.

`ltrim` and `rtrim` do one side each. All three answer a **window** rather than a copy, so trimming
is free. Call `->clone()` on the result if you want the parent's buffer released.

## int and float

```echo
int64 $n = guard str::int('42') else {
    die('not a number');
}

echo $n;        // 42
```

Both parsers answer a nullable, so failure is `guard ... else` rather than a sentinel you have to look up.
Nothing is forgiven: no leading whitespace, no separators, no trailing text. `str::trim` first if the text
came from a line of input.

```echo
echo str::int('4kg') ?? -1;       // -1
echo str::int(' 4') ?? -1;        // -1
echo str::int('9223372036854775808') ?? -1;    // -1, overflow rather than a wrapped value
```

`str::float` goes through C's `strtod` and requires the whole text to be consumed, which is the
difference between it and calling `strtod` yourself.

## upper / lower / ucfirst / lcfirst

```echo
echo str::upper('straße');      // STRASSE
echo str::lower('CAFÉ');        // café
echo str::ucfirst('écho');      // Écho
echo str::lcfirst('ÉCHO');      // éCHO
```

Unicode Default Case Conversion, locale-independent. `ß` becomes `SS`, `ﬁ` becomes `FI`, and Turkish
`I` is not a different letter, because there is no locale. Greek capital sigma at the end of a word
becomes `ς` rather than `σ`. That's the only contextual mapping, and it's hard-coded rather than a
condition engine.

`ucfirst` titles the **first codepoint** and leaves the rest. Titlecase, not uppercase: they agree
for almost every letter and disagree on a handful of digraphs. `straße` starts with `s`, so the
answer is `Straße`. `ß` on its own titles to `Ss`.

Already-cased text is the same string, sharing its buffer. `str::upper('HELLO')` allocates nothing.
Changing case always allocates; leaving it alone never does. That's [trim](#split--join--trim)'s
bargain, and the reason the parameter is a `string` rather than a view.

Invalid UTF-8 is copied, not rejected. [chars()](/collections/strings#size-and-chars-are-different-questions)
already counts it rather than validating, and these four do not invent a stricter contract.

## iequals is ASCII, and allocates nothing

`str::lower($a) == str::lower($b)` is the Unicode answer, and it's two buffers. A header name, an
HTTP token, a hex digit is none of that: the protocol said "case-insensitive" and meant A-Z.

```echo
echo str::iequals('Content-Type', 'content-type');      // 1
echo str::iequals('Content-Type', 'content-length');    // 0
echo str::iequals('straße', 'STRASSE');                 // 0, ß is not SS here
```

A `string` reaches it without a cast. The parameters are views, so a comparison costs no allocation
and no reference count, which is what a scan over thirty headers needs.

## The whole surface

| Signature | What it does |
|---|---|
| `str::from(T $v) : string` | the value as text. one overload per primitive, plus `string` and `string::view` |
| `str::from(T $v, const string& $spec) : string` | the same, honouring a format spec |
| `str::spec_of(const string& $text) : spec` | the spec a `{$x:...}` hole spells, parsed |
| `str::from(ptr<const uint8> $s) : string` | an owning copy of a NUL-terminated C string |
| `str::from(ptr<const uint8> $b, usize $n) : string` | an owning copy of `$n` bytes, no terminator needed |
| `str::cview(ptr<const uint8> $s) : string::view` | a borrowing window over one. allocates nothing |
| `string::data()` / `string::view::data()` | the bytes, no terminator required |
| `string::spare()` / `room()` / `commit($n)` | let C write into the buffer |
| `string::append(ptr<const uint8>, usize)` | `append` for a pointer and a length |
| `string::capacity()` | text bytes the buffer can hold without growing |
| `str::concat(const string& $a, const string& $b) : string` | the two joined. what interpolation lowers to |
| `str::split(const string& $t, const string& $sep) : str::parts` | `n` separators give `n + 1` windows into `$t` |
| `str::parts::owned() : array<string>` | the same parts as owning strings. short ones stay inline; longer ones retain the parent |
| `str::join(const str::parts& $p, const string& $sep) : string` | the inverse of `split`, in one allocation |
| `str::join(const array<string>& $parts, const string& $sep) : string` | the same, over a list you built |
| `str::trim` / `ltrim` / `rtrim` `(const string&) : string` | ASCII whitespace off both ends, or one |
| `str::trim` / `ltrim` / `rtrim` `(string::view) : string::view` | the same, over a window |
| `str::lpad` / `rpad` `(const string&, usize $width, uint8 $fill) : string` | widen to `$width` **bytes** |
| `str::repeat(const string& $t, usize $times) : string` | `$t` written over |
| `str::int(const string& $t) : int64?` | base ten, optional sign, nothing else |
| `str::float(const string& $t) : float64?` | through `strtod`, whole text consumed |
| `str::upper` / `lower` `(const string&) : string` | Unicode uppercase / lowercase. already-cased text shares the buffer |
| `str::ucfirst` / `lcfirst` `(const string&) : string` | titlecase / lowercase of the first codepoint |
| `str::iequals(string::view $a, string::view $b) : bool` | same bytes, ignoring ASCII case. allocates nothing |

## Next

- [Strings](/collections/strings) for `string` and `string::view`, which is where the real surface is.
- [Arrays](/stdlib/arr) for `arr::merge` and `arr::room`.
- [C interop](/projects/c-interop) for the `extern` blocks these conversions exist to serve.
