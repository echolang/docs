# Types

Every value in Echo has exactly one type, and the compiler knows it before your program runs. There is no
`mixed`, no union type and no runtime type juggling.

What might surprise you is how few types the compiler actually knows about:

```echo
int32 $count = 3;
string $name = "Echo";
```

One of those is built into the language. The other is a struct in the standard library, written in Echo, with
no special treatment at all. **The compiler ships a handful of primitives and everything else is a library.**

## The primitives

These are the types the compiler understands on its own. Nothing has to be imported and nothing can shadow
them.

| Type | Size | Range |
|---|---|---|
| `int8` | 1 byte | -128 to 127 |
| `int16` | 2 bytes | -32,768 to 32,767 |
| `int32` | 4 bytes | -2,147,483,648 to 2,147,483,647 |
| `int64` | 8 bytes | -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807 |
| `uint8` | 1 byte | 0 to 255 |
| `uint16` | 2 bytes | 0 to 65,535 |
| `uint32` | 4 bytes | 0 to 4,294,967,295 |
| `uint64` | 8 bytes | 0 to 18,446,744,073,709,551,615 |
| `usize` | pointer width | 0 to whatever fits |
| `isize` | pointer width | signed, same width |
| `float32` | 4 bytes | IEEE 754 single |
| `float64` | 8 bytes | IEEE 754 double |
| `bool` | 1 byte | `true` or `false` |
| `void` | n/a | the absence of a value |

You can ask for a size yourself, which is occasionally handy and is the same number the table claims:

```echo
echo mem::size<int32>();     // 4
echo mem::size<usize>();     // 8 on a 64-bit machine
```

`void` is only ever a return type. There is no `void` variable, and a function that returns nothing still
has to say `: void` out loud. See [Functions](/language/functions).

## Three aliases, and only three

```echo
int $a = 1;         // int32
uint $b = 2;        // uint32
float $c = 3.0f;    // float32
```

That's the whole alias list. `int` is **not** the machine word. It's `int32` on every platform, the same way
`long` should have been. If you want a pointer-width integer, `usize` and `isize` exist for exactly that.

There is no `double`. `float64` is spelled `float64`.

## What an untyped literal decides

Leave the type off and the literal picks:

```echo
$a = 25;        // int32
$b = 0.5;       // float64
$c = true;      // bool
$d = "hi";      // string
$e = 0xFF;      // uint8, and it is 255
$g = 0b1011;    // uint8 too, and it is 11
$f = 3.14f;     // float32, and that is the f talking
```

An untyped integer literal is an `int32`. An untyped float literal is a `float64`. Those two don't agree
about width, and that's deliberate: an integer that needs more than 32 bits is unusual, and a float that
wants less precision than a `float64` is a decision you should have to write down.

A `0x` or `0b` literal is the exception. With nothing else to go on it takes an unsigned type sized to the
number of digits you wrote, so `0xFF` is a `uint8` and `0x00FF` is a `uint16` despite being the same number.
Write the zeros when you mean the width. [Primitive types](/reference/primitive-types) has the table.

Writing it down usually means putting the type in front:

```echo
int64 $big = 25;
uint8 $small = 255;
```

Floats get a second way, and it's the last line of the first example.

### The f suffix

`3.14` and `3.14f` are two different literals, not one literal spelled two ways. The `f` is part of the
literal itself, so it settles the type on its own, with no type in front and nothing left to infer:

```echo
$a = 0.5;               // float64, 8 bytes
$b = 0.5f;              // float32, 4 bytes
float32 $c = 3.14f;     // type and suffix agree, which is the boring case
```

The suffix is also how you say you meant it. A `float64` literal landing in a `float32` warns, because the
number in the program is not quite the number you typed:

```echo
float32 $pi = 3.14;     // warning: results in a loss of precision
```

Write `3.14f` and the warning goes away. [Variables](/language/variables) has the rest of the narrowing
rules.

## usize is where counts live

`usize` is a pointer-width unsigned integer, and it is not an alias for `uint64`. It's its own type with
its own identity.

That matters because every length, count, capacity and index in the standard library is spelled with it:

```echo
array<int32> $numbers = [1, 2, 3];
usize $n = $numbers->count();
echo $n;        // 3
```

If `usize` were an alias, moving to a target with a different pointer width would silently change every one
of those signatures. As its own type, the signature stays `usize` and the width is a detail underneath it.

The practical consequence: **a count is unsigned, so subtracting past zero wraps rather than going
negative.** `$numbers->count() - 5` is a very large number, not `-2`.

## bool is not a small integer

This is the one that will genuinely hurt you if you treat `bool` as a small integer.

`bool` is its own type. It is not an integer that happens to hold 0 or 1:

```echo
bool $ready = true;
echo $ready;        // 1
echo !$ready;       // 0
```

`echo` prints a `bool` as `1` or `0`, because `echo` prints numbers and that's the number. Those two
integers are also what a `bool` destination accepts as a literal: `1` is `true`, `0` is `false`.

```echo
bool $on = 1;
bool $off = 0;
echo $on;           // 1
echo $off;          // 0
```

Anything else is not a bool. `3` is not `true`. There is no truthiness, no zero-is-false for the rest of
the integers, no empty-string-is-false, none of it:

```echo
bool $ready = 3;
// error: a literal of type 'int32' cannot be written where a 'bool' is expected - Echo has no
//        truthiness in a written literal, so say which of the two you meant
```

The other direction is refused outright. There is no number `true` means:

```echo
int32 $n = true;
// error: a literal of type 'bool' cannot be written where a 'int32' is expected - Echo has no
//        truthiness in a written literal, so say which of the two you meant
```

A condition has to actually be a `bool` too:

```echo
$count = 5;

if ($count > 0) {       // fine, the comparison produces a bool
    echo "some";
}
```

Writing `if ($count)` with an integer is not valid Echo, and right now it fails as a compiler crash rather
than a polite diagnostic. That's on [the list](/reference/limitations).

A **variable** still converts either way, as [Primitive types](/reference/primitive-types) sets out. An
`int32` into a `bool` is compared against zero at runtime. It's only a written literal other than `0` or
`1` that has to say which of the two it meant.

## `$x as T`

A destination usually decides the type. Sometimes there is no destination. Then you write it next to the
value:

```echo
function wide(uint8 $b) : int32
{
    return $b as int32;
}

echo (200 as int32) > 57;       // 1
```

`(int32)$x` does not parse, and `int32($x)` is not a function. [Casts](/language/casts) is the page: what
it will convert, what it will not (no unwrap, no `strong`), and why `foreach` still owns `as`.

## Values and references

Every type in Echo is one of two things, and the difference is where it lives.

A **value type** lives where you put it. Primitives are value types, and so is every `struct`. Assigning one
copies it:

```echo
struct GateAddress
{
    int32 $destination;
    int32 $origin;
}

GateAddress $dialled = GateAddress(27, 1);
GateAddress $backup = $dialled;     // a copy, not a second name for the same address
$backup->destination = 99;

echo $dialled->destination;         // 27
```

A **reference type** lives on the heap and is reference counted. Every `class` is one. Assigning one hands
out another reference to the same object:

```echo
class Stargate
{
    int32 $chevrons_locked;
}

Stargate $sgc = Stargate(0);
Stargate $embarkation_room = $sgc;      // both names, one gate
$embarkation_room->chevrons_locked = 7;

echo $sgc->chevrons_locked;             // 7
```

Same declaration syntax, opposite semantics, one keyword apart. [Structs](/language/structs) and
[Classes](/language/classes) each get a chapter, because the choice between them is the most consequential
one in the language.

## Everything else is the standard library

`string`, `array<T>`, `map<K, V>`, `slice<T>`, `range<T>`: none of these are compiler types. They are
structs written in Echo, in `stdlib/core/`, using the same features your code has:

```echo
array<int32> $numbers = [1, 2, 3];
$numbers[] = 4;
echo $numbers->count();     // 4
```

That `[]` append is an operator declaration in `stdlib/core/array.eco`. `..` in a `for` range is an operator
declaration in `stdlib/core/range.eco`. Compile with `--no-stdlib` and the dots stop being a symbol the
program can use, because nothing declares them any more.

A small number of these types are pointed at by name so the compiler can talk about them (that's what
`#[core: array]` does), but the shape is still the library's. There is no privileged array type you can't
write yourself.

## Next

- [Casts](/language/casts) for `$x as T`, the written destination.
- [Expressions](/language/expressions) for what happens when you mix these types in one expression.
- [Structs](/language/structs) and [Classes](/language/classes) for the value/reference split.
- [Primitive types](/reference/primitive-types) for the table on its own, without the prose.
