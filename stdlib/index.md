# The standard library

Echo's standard library is **ordinary Echo**. It is compiled with your program, it is written against the
same language you are writing, and you can turn it off. There is no runtime hiding behind it.

```echo
array<string> $ships = ["Prometheus", "Daedalus"];
$ships[] = "Odyssey";

foreach ($ships as $name) {
    echo $name;
}
```

The array, the append, and the `foreach` are all library code. The rest of this page is where to find
things, and what happens if you build without them.

## Three tiers, and the spelling tells you which

Where a name lives is visible in how you write it. There is no lookup table to memorize.

**Tier one is the language's own vocabulary.** Root namespace, lowercase, spelled like a primitive:

```echo
array<int32> $chevrons = [1, 2, 3];
map<string, int32> $power = map<string, int32>();
string $gate = "Abydos";
range<int32> $seven = 0 .. 7;

assert($chevrons->count() == 3);
```

`array`, `map`, `ordered_map`, `string`, `slice`, `range`, plus `die`, `assert` and `dprint`. You write
these every day, so they cost you no namespace at all.

**Tier two is still about the language, but you do not write it every line.** A short namespace:

```echo
echo mem::size_of<int32>();             // 4
echo hash::of(42) == hash::of(42);      // 1
```

`contract::` (interfaces only), `mem::`, `str::`, `arr::` and `hash::`. Container plumbing, mostly. If you
are writing a data structure you will live here; otherwise you will visit for `mem::size_of` and leave.

**Tier three is ordinary utility with nothing to do with the language.** Fully qualified under `std`:

```echo
echo std::math::sqrt(9.0);      // 3.000000
echo std::env::argc() > 0;      // 1
```

`std::math::` and `std::env::`.

## Nothing in the library is special-cased

The library types have no capabilities your own types cannot have. `map<K, V>` works with `foreach` because
it declares `contract::iterable<V>`, exactly the way a type of yours would ([contract](/stdlib/contract) is
that whole story). `range<T>` is the clearest case, because `0 .. 7` looks like syntax and is not:

```echo
foreach (0 .. 3 as $i) {
    echo $i;                    // 0, 1, 2
}
```

`..` is an infix operator declared in the standard library, returning a `range<T>` that is iterable. So it
works anywhere iteration does, and you could have declared it yourself. See
[Operators](/language/operators).

A handful of library declarations do carry attributes you will not write yourself, which is how the
compiler is able to name a type like `array<T>` when you write `$a = [1, 2]` with no declared type. You
never need to think about them to use the library. [Attributes](/reference/attributes) has them if you are
curious.

## What `--no-stdlib` takes away

Building without the library is legitimate, and the diagnostics tell you what is missing.

`foreach` has no protocol to resolve against:

<!-- verify: no-stdlib -->
```echo
$b = 1;

foreach ($b as $e) {
    echo $e;
}
// error: 'foreach' needs the iteration protocol, and nothing in this program declares
//        '#[core: iterator]'. it lives in the standard library, which this compilation left out.
```

An untyped array literal has no type to take:

<!-- verify: no-stdlib -->
```echo
$a = [1, 2];
// error: an array literal with no declared type needs the core array type, and nothing in this
//        program declares '#[core: array]'. it lives in the standard library, which this
//        compilation left out - write the type, e.g. 'array<int32> $a = [...];'.
```

And `0 .. 3` stops parsing entirely, because without the library the dots are not a symbol:

<!-- verify: no-stdlib -->
```echo
foreach (0 .. 3 as $j) {
}
// error: Unexpected token 'dot (.)' found. Expected 'as'
```

What survives is everything the language itself gives you. Primitives, structs, methods, control flow,
generics, `for`, closures:

<!-- verify: no-stdlib -->
```echo
struct Counter
{
    int32 $value;

    function bump(int32 $by) : int32
    {
        $this->value = $this->value + $by;
        return $this->value;
    }
}

$c = Counter(0);
echo $c->bump(2);       // 2
echo $c->bump(5);       // 7
```

## The whole surface

| Namespace | Holds | Page |
|---|---|---|
| root | `array`, `map`, `ordered_map`, `string`, `slice`, `range`, `die`, `assert`, `dprint` | [Collections](/collections/arrays) |
| `contract::` | `iterator`, `iterable`, `const_iterable`, `keyed` | [contract](/stdlib/contract) |
| `mem::` | allocation, type queries, `take` / `init`, `buffer<T>` | [mem](/stdlib/mem) |
| `hash::` | `of` and the composition primitives | [hash](/stdlib/hash) |
| `str::`, `arr::` | `str::buf`, the C string boundary, two array helpers | [str and arr](/stdlib/str-arr) |
| `std::math::` | constants and the numeric functions | [std::math](/stdlib/math) |
| `std::env::` | arguments, environment, directories, `exit` | [std::env](/stdlib/env) |

## Next

- [contract](/stdlib/contract) for the interfaces `foreach` uses, and how your own type joins them.
- [mem](/stdlib/mem) for what a container is built out of.
- [Collections](/collections/arrays) for the types you will actually reach for first.
