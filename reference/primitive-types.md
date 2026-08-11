# Primitive types

Fourteen primitives, three aliases, one literal suffix. That is the entire set of types the compiler knows
about on its own, and **everything else you write, including `string` and `array<T>`, is a library type**.

```echo
int32 $count = 3;
usize $index = 0;
float64 $ratio = 0.5;
bool $ready = true;
```

[Types](/language/types) is the chapter with the reasoning. This page is the table, the literal grammar, and
the exact wording of every conversion the compiler refuses.

## The table

| Type | Bits | Signed | Minimum | Maximum |
|---|---|---|---|---|
| `int8` | 8 | yes | -128 | 127 |
| `int16` | 16 | yes | -32,768 | 32,767 |
| `int32` | 32 | yes | -2,147,483,648 | 2,147,483,647 |
| `int64` | 64 | yes | -9,223,372,036,854,775,808 | 9,223,372,036,854,775,807 |
| `uint8` | 8 | no | 0 | 255 |
| `uint16` | 16 | no | 0 | 65,535 |
| `uint32` | 32 | no | 0 | 4,294,967,295 |
| `uint64` | 64 | no | 0 | 18,446,744,073,709,551,615 |
| `isize` | pointer width | yes | same as `int64` today | same as `int64` today |
| `usize` | pointer width | no | 0 | same as `uint64` today |
| `float32` | 32 | n/a | IEEE 754 single | IEEE 754 single |
| `float64` | 64 | n/a | IEEE 754 double | IEEE 754 double |
| `bool` | 1 | n/a | `false` | `true` |
| `void` | 0 | n/a | n/a | n/a |

`bool` is one bit in the emitted code and one byte in memory, which is the usual arrangement and never
something you have to think about.

Ask for a size yourself and you get the same numbers:

```echo
echo mem::size_of<int32>();     // 4
echo mem::size_of<bool>();      // 1
echo mem::size_of<usize>();     // 8
```

## usize and isize are pointer width, and today that is always 8

Their width is one compile-time constant in the compiler, `ECO_TARGET_POINTER_SIZE`, and it is 8. There is no
per-target logic behind it yet, so on every platform Echo currently builds for, `usize` is 64 bits.

What matters more than the number is that **they are their own types, not aliases**. Assigning a `uint64`
into a `usize` is a real conversion, not a no-op the compiler waves through:

```echo
uint64 $raw = 7;
usize $converted = $raw;
echo $converted;        // 7
```

That distinction is what keeps every length, count, capacity and index in the standard library spelled
`usize` rather than accidentally spelled `uint64` on one platform and `uint32` on another.

## Three aliases

```echo
int $a = 1;         // int32
uint $b = 2;        // uint32
float $c = 3.0f;    // float32
```

There are no others. No `double`, no `byte`, no `char`, no `short`, no `long`. `int` is `int32` everywhere
and is not the machine word.

Note that `numeric`, `integer`, `signed`, `unsigned` and `floating` look like they belong on this list and do
not. They are generic constraint aliases, usable only in a type parameter's constraint, never as the type of
a variable. See [Generics](/language/generics).

## What an untyped literal decides

| Literal | Type |
|---|---|
| `25` | `int32`, promoted to `int64` only if it does not fit |
| `0.5` | `float64` |
| `0.5f` | `float32` |
| `true` | `bool` |
| `"hi"` | `string` |
| `0xFF` | `uint8`, and the width comes from the digit count |

The last row is the one that surprises people, so it gets its own section.

### A hex literal picks its width from how you wrote it

`parse_literal_hex` counts the digits after `0x` and picks an unsigned type to fit them. Nothing about the
value, and nothing about the destination:

| Digits | Type |
|---|---|
| 1 to 2 | `uint8` |
| 3 to 4 | `uint16` |
| 5 to 8 | `uint32` |
| 9 or more | `uint64` |

So `0xFF` is a `uint8` and `0x00FF` is a `uint16`, despite being the same number.

**A hex literal also skips the range check that every other literal gets.** The destination type is never
consulted, so instead of being refused, the value is quietly truncated on the way in:

```echo
uint8 $x = 0xFFFF;
echo $x;                // 255, and nothing was said about it

int8 $y = 0xFF;
echo $y;                // -1
```

Both of those are bugs rather than rules. `uint8 $x = 65535;` written in decimal is a clean compile error.
Write hex when you mean a bit pattern, and put the type in front when the width matters.

## Every literal form

Exists:

| Form | Example | Notes |
|---|---|---|
| decimal integer | `25`, `-3` | the sign is part of the token, see below |
| decimal float | `0.5`, `1.` | a trailing dot gets an implicit zero, so `1.` is `1.0` |
| float suffix | `3.14f` | `f` is the only suffix in the language, and only on floats |
| hexadecimal | `0xFF`, `0Xff` | see the width rule above |
| string | `"hi"`, `'hi'` | both quotes are accepted and mean the same thing |
| bool | `true`, `false` | |

Does not exist:

- **Binary literals.** `0b101` lexes as `0` followed by an identifier `b101` and the parser gives up on it.
  The token type exists in the compiler and nothing ever produces one.
- **Octal.** No `0o17`, no leading-zero form.
- **Digit separators.** `1_000` is `1` followed by an identifier `_000`.
- **Exponent notation.** `1e9` stops at the `e`.
- **Typed integer suffixes.** No `25i64`, no `25u`. Put the type in front instead.
- **Character literals.** There is no `char` type, so there is nothing for `'a'` to be. It is a one-byte
  `string`.

### The minus sign glues to a digit

`-` immediately followed by a digit is read as part of the number, which is what makes `-3` a literal rather
than a negation of `3`. The cost is that a binary `-` needs spaces around it:

```echo
echo 1 - 2;         // -1
```

Written `1-2` you get `unexpected '-2' - two expressions with no operator between them.`

## Escape sequences

| Escape | Means |
|---|---|
| `\n` `\t` `\r` | newline, tab, carriage return |
| `\0` | a nul byte |
| `\\` `\"` `\'` | a literal backslash or quote |
| `\xNN` | one byte, exactly two hex digits |
| `\u{...}` | a unicode scalar, one to six hex digits, braces required |

```echo
echo "tab:\there";      // tab:	here
echo "\x41";            // A
echo "\u{1F600}";       // an emoji
```

There is no `\a`, `\b`, `\f` or `\v`, and no unbraced `\uXXXX`. Anything else after a backslash is an error,
not a passthrough. String literals are validated as UTF-8 at compile time.

## Conversions

**There are two separate machines here, and knowing which one you are in is the whole story.** A literal is
checked at parse time against the destination, because the compiler can see the value. A variable is not
checked at all, because it cannot.

### A literal is checked

| Case | Result |
|---|---|
| fits the destination | converted at compile time, no runtime cost |
| integer literal too large | error |
| integer literal too small | error |
| negative literal into an unsigned type | error |
| `float64` literal into a `float32` that loses bits | warning |
| float literal with a fraction into an integer type | error |
| any literal into a struct or class | error |
| hex literal | not checked at all, see above |

The exact wording, so you can recognise it:

```echo
uint8 $no = 256;
// error: Integer overflow: The literal '256' is too large for the integer type 'uint8'.
//        The maximum value is '255'.
```

```echo
uint8 $n = -1;
// error: Invalid type conversion: The integer literal '-1' cannot be implicitly converted to an
//        unsigned integer because it is negative.
```

```echo
float64 $x = true;
// error: Invalid type conversion: The boolean literal 'true' cannot be implicitly converted to the
//        expected type 'float64'.
```

The one warning:

```echo
float32 $pi = 3.14;
// warning: This operation results in a loss of precision: The literal '3.14' is stored in 32bit float
//          which will result in the effctive value 3.14
```

Yes, `effctive`. Writing `3.14f` makes the warning go away, because then the literal was a `float32` to begin
with and no precision was lost on the way in.

### A variable is not checked

Every conversion in this table happens silently, at runtime, between variables:

| From | To | What happens |
|---|---|---|
| narrower int | wider int | sign-extends if the **source** is signed, zero-extends if it is unsigned |
| wider int | narrower int | truncates |
| int | float | converted, may lose precision |
| float | int | truncates toward zero |
| `float64` | `float32` | rounded |
| `bool` | int | `1` or `0` |
| int or float | `bool` | `true` when the value is not zero |

```echo
int64 $big = 5000000000;
int32 $small = $big;
echo $small;            // 705032704

float64 $pi = 3.14159265358979;
float32 $f = $pi;
echo $f;                // 3.141593
```

The type checker deliberately does not look at primitive-to-primitive conversions. It refuses conversions
between pointers, structs, classes, interfaces, callables and weak handles, and waves numbers through. I am
not happy with that. I would rather narrowing needed something written down, and it is on
[the list](/reference/limitations). Until then the literal check is the only safety net you get.

There is **no cast operator** to reach for either. `(int32)$x` does not parse and `int32($x)` is not a
function. Conversion happens by assigning to a typed destination or passing to a typed parameter, and that is
the only spelling there is. The one exception is inside an `unsafe` block, where `uint8&($bytes:$)` promotes
raw storage to a typed borrow, which is a different operation with a similar shape.

## void

`void` is the type of nothing. It is what a function that returns nothing declares, and saying it out loud is
required:

```echo
function log(string $line) : void
{
    echo $line;
}

log("done");        // done
```

By intent it appears in return position only. In practice **nothing refuses `void $x;`**: the type checker
waves it through and the compiler then hangs trying to lay it out. Do not write it. That is a bug, and it is
on [the list](/reference/limitations).

`void` is also not the same thing as "the compiler has not worked this out yet", which is a separate internal
state you will never see spelled in your program.

## Next

- [Types](/language/types) for the reasoning behind these choices, and the value/reference split.
- [Expressions](/language/expressions) for what happens when you mix two of these in one expression.
- [Keywords](/reference/keywords) for the words that are reserved, none of which are type names.
