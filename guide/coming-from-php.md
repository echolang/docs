# Coming from PHP

Echo's syntax is borrowed from PHP on purpose. Everything underneath it is different on purpose too.

This page is the blunt list of what will surprise you, roughly in the order you will trip over it. If you
have read [the tour](/guide/tour) you have seen most of this already; this is the version organised by "what
you expected" rather than by topic.

## The short version

| PHP | Echo |
|---|---|
| Dynamically typed | Statically typed, one type per variable, forever |
| `$arr = [1, "two", 3.0]` | `array<int32>` holds `int32` and nothing else |
| Arrays are hash maps | Arrays are contiguous buffers. Maps are `map<K, V>` |
| `new Foo()` | `Foo()`. There is no `new` |
| `$obj->method()`, `$arr['k']`, `Foo::bar()` | `->` for members, `[]` for indexing, `::` for namespaces |
| `echo "Hi $name"` | `echo "Hi {$name}"`. Interpolation is `{$...}`, and `'` is verbatim as it is in PHP |
| Everything is a reference-ish object | `struct` is a value, `class` is reference counted |
| Garbage collected | Ownership plus reference counting, no GC |
| `function f($a)` | `function f(int32 $a) : void` |
| `try` / `catch` / `throw` | No exceptions. `die`, `assert`, `T?`, and `result<T, E>` |
| `require` / `use` | A `module.eco` manifest and qualified names |
| Runs on a request, dies | Compiles to a native binary |

## Types are not optional

This is the whole point, so it comes first.

```echo
$name = "Echo";
$name = 42;         // error: cannot assign 'int32' to 'string'
```

The type is decided at the declaration and cannot change. You can write it out or let it be inferred from the
initializer, but you cannot skip the initializer and decide later:

```echo
$a = 25;            // fine, int32
string $b;          // fine, the type is written down
$b = "later";
```

A declaration with neither a type nor an initializer has nothing to infer from, so it is not a declaration at
all and the parser rejects it.

Numbers are specific about width too. There is no single `int`. There is `int8` through `int64`, unsigned
versions of each, `usize`, `isize`, `float32` and `float64`. `int` is an alias for `int32` if you want the
short spelling.

## Arrays are not hash maps

In PHP an array is a hash map that will hold anything. In Echo those are two different types and you pick
one.

```echo
array<int32> $numbers = [1, 2, 3];      // a contiguous buffer of int32
map<string, int32> $ages = map<string, int32>();
```

An `array<T>` is a real array: elements sit next to each other in memory, indexing is a pointer offset, and
appending is amortised constant time. That is where the performance comes from.

A `map<K, V>` is the hash map. It is unordered; `ordered_map<K, V>` is the same thing that also remembers
insertion order.

Two things that follow:

- There is **no map literal**. `["LHR" => "Heathrow"]` does not parse. You construct the map and fill it.
- `$arr[] = $v` still appends, and still reads the way you expect.

## No new, and no `.` for members

```echo
$p = Point(1.0, 2.0);       // calling the type constructs it
echo $p->x;                 // properties
echo $p->length();          // methods
```

`->` is used for every member access. Not `.`, not `::`. `::` is reserved for namespaces and nested types
(`std::math::sqrt`, `string::view`), which is a narrower job than PHP gives it.

A struct with no constructor and no private properties gets a constructor taking its properties in
declaration order, for free. That is where `Point(1.0, 2.0)` comes from when you never wrote one.

## echo prints exactly one thing, and adds a newline

```echo
echo 'Hello';       // prints Hello and a newline
echo 42;            // prints 42 and a newline
```

No comma-separated list and no `printf`. Interpolation is how you print more than one thing, and the quote
rule is PHP's with one extra constraint: `"` interpolates `{$...}`, `'` is verbatim, and the braces are
required. `"Hi $name"` prints the dollar sign.

```echo
$name = 'Ronon';
$rolls = 3;

echo "{$name} rolled {$rolls} dice";
```

`{$x:.2f}` asks for two decimals, `{$n:>8}` right-aligns, `{$n:x}` is hex. The `sprintf` you would reach
for next is usually already there. [Strings](/collections/strings#interpolation) has the spec. There is
also [`std::io`](/stdlib/io) when you want `print` without the newline, or stderr.

`echo` cannot print a struct. Use `dprint` for that:

```echo
dprint($point);
// [Point] {
//   [float64] $x = 1
//   [float64] $y = 2
// }
```

## struct or class, decided once

PHP has one kind of object. Echo has two, and the difference is who owns the thing.

```echo
struct Point { float64 $x; float64 $y; }   // a value
class Account { /* ... */ }                 // a reference counted object
```

```echo
$a = Point(1.0, 2.0);
$b = $a;            // a copy. two independent Points

$x = Account("Mario", 100);
$y = $x;            // the same object, now with two owners
```

A struct lives where you put it, costs nothing to create, and is copied on assignment. A class lives on the
heap, is reference counted, and is shared on assignment. Coming from PHP, `class` is the one that behaves the
way you already expect.

Pick per type, at the declaration. There is no way to say "this one struct, on the heap, this once".

## Ownership will be the new idea

Everything above is a syntax difference you absorb in an afternoon. This one is a concept.

A value has exactly one owner. Handing it to somebody else is a **move**, and both sides have to say so:

```echo
function consume(mv array<int32> $xs) : int32
{
    return $xs->count();
}

array<int32> $nums = [1, 2, 3];
echo consume(mv $nums);
echo $nums->count();        // error: '$nums' has been moved out of
```

Most of the time you do not want to hand it over, you want to lend it:

```echo
function total(const array<int32>& $xs) : int32
{
    int32 $sum = 0;
    foreach ($xs as $x) { $sum = $sum + $x; }
    return $sum;
}

echo total($nums);          // 6, and $nums is still yours
```

If you have written Rust, this is that, with a friendlier default and slightly fewer rules. If you have not,
[Ownership and moving](/memory/ownership) is the chapter to actually sit down with.

The upside is that there is no garbage collector, no pause, and no surprise about when a destructor runs. It
runs when the owner goes out of scope, in reverse order of declaration, every time.

## Null is opt-in

In PHP anything can be `null`. In Echo a type is non-nullable unless it ends in `?`.

```echo
int32 $a = null;    // error: 'int32' cannot be null - add '?' to its type if it may be absent
int32? $b = null;   // fine
```

Which means `??` and `?->` are not just convenience, they are how you get at the value at all:

```echo
echo halve(8) ?? -1;
echo $node?->next?->tag ?? -1;
```

And `guard` is the one you will reach for most, because it unwraps into a plain non-nullable value for the
rest of the scope:

```echo
int32 $v = guard halve($n) else {
    return $fallback;
}

return $v + 1;      // $v is int32, not int32?
```

The `else` arm has to leave the scope. That is what makes the guarantee afterwards worth anything.

## No exceptions

There is no `throw`, no `try`, no `catch`.

- For "this can fail and the caller should handle it", return a `T?`, or a
  [`result<T, E>`](/stdlib/result) when you need a reason.
- For "this should never happen", `assert(...)`, which is compiled out in release builds.
- For "this happened and there is no recovering", `die("message")`, which stops the program with a nonzero
  exit status.

That is a smaller toolkit than PHP's and it is deliberate. There is no stack to unwind.

## Files and includes

There is no `require` and no `use`. A project is a directory with a `module.eco` manifest:

```echo
#[module: "greeter"]
#[version: "0.1.0"]

#[sources: "src/*.eco"]
```

Everything in the module sees everything else in the module, regardless of file order, with no imports. Names
from other namespaces are reached by qualifying them: `geometry::Point`, `std::math::sqrt`.

Depending on another module is one line:

```echo
#[depends: "../lib_geometry"]
```

No Composer, no packagist, no lockfile. A dependency is a path on disk. Git dependencies parse and are then
refused, because nothing fetches a repository yet.

## Things that are exactly the same

It is worth saying what you get to keep, because it is most of the surface:

- `$` on variables, `//` and `/* */` comments, semicolons, braces
- `if` / `else` / `while` / `for` / `foreach` / `break` / `continue`, all spelled the way you expect
- `foreach ($items as $item)` and `foreach ($items as $key => $item)`
- `function` for functions, `class` for classes, `interface` for interfaces, `instanceof`
- `->` for members, `[]` for indexing
- `&&`, `||`, `!`, the comparison operators, `??`, `?->`
- `true`, `false`, `null`
- `$a++`, `+=` and friends

You can read Echo on day one. The type system and the memory model are the two things worth slowing down for.

## Next

- [A tour of Echo](/guide/tour) if you skipped it.
- [Ownership and moving](/memory/ownership) for the one genuinely new concept.
- [What is missing](/reference/limitations) so you know what not to plan around.
