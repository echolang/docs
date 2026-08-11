# std::math

`std::math` is thin, and it is thin on purpose: **most of what is in it is one machine instruction rather
than a function call.**

```echo
echo std::math::sqrt(9.0);      // 3.000000
echo std::math::PI;             // 3.141593
```

So reach for these freely. `sqrt` in a loop costs what the hardware costs, not what a call costs.

## The constants have no `$`

```echo
echo std::math::PI;         // 3.141593
echo std::math::E;          // 2.718282
echo std::math::SQRT_2;     // 1.414214
```

They are **constants, not variables**, which in Echo is a real distinction rather than a naming convention.
A constant has no storage at all: its expression is copied into each place the name is used. That is what
lets one live at file scope, where a variable cannot.

Every one of them is a `float64`, because a float literal is double precision unless it ends in `f`. Where
you want single precision, use the `_F32` twin:

```echo
echo std::math::cos(std::math::PI);         // -1.000000
echo std::math::cos(std::math::PI_F32);     // -1.000000, but through the float32 overload
```

See [Constants](/language/constants) for what a `$`-less declaration actually does, including the
consequence that a constant whose expression calls a function calls it once per use site.

## Every function comes in two, and the argument picks

There is a `float` overload and a `float64` overload of everything, and they are a plain overload set:

```echo
echo std::math::sqrt(2.0);      // 1.414214, the float64 one
echo std::math::sqrt(2.0f);     // 1.414214, the float32 one
```

They are separate functions all the way down, so single-precision math never round-trips through a double.
The `f` suffix is the only literal suffix Echo has, and this is the place you will use it most.

## Trigonometry, exponentials, logarithms

```echo
echo std::math::sin(0.0);           // 0.000000
echo std::math::atan2(1.0, 1.0);    // 0.785398
echo std::math::pow(2.0, 10.0);     // 1024.000000
echo std::math::exp2(10.0);         // 1024.000000
echo std::math::log2(1024.0);       // 10.000000
```

`atan2` takes **y first**, matching C. The full list is in the table at the bottom of this page: `sin`,
`cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `sinh`, `cosh`, `tanh`, `sqrt`, `pow`, `exp`, `exp2`,
`exp10`, `log`, `log2`, `log10`.

What is *not* there yet: `fmod`, `hypot`, `cbrt`, `signbit`, `isnan`. They are on
[the list](/reference/limitations).

## Rounding, and the two functions that disagree about 2.5

```echo
echo std::math::floor(2.7);         // 2.000000
echo std::math::ceil(2.1);          // 3.000000
echo std::math::trunc(-2.7);        // -2.000000
echo std::math::round(2.5);         // 3.000000
echo std::math::roundeven(2.5);     // 2.000000
```

`round` rounds half away from zero. `roundeven` is banker's rounding, which rounds an exact half to the
nearest even number, and on 2.5 that is the difference between 3 and 2. If you are summing a lot of rounded
values and care about drift, `roundeven` is the one you want. There is also `rint`, which rounds according
to the current rounding mode.

## min and max spell out their integer overloads

Beside the two float overloads, `min` and `max` each carry four integer ones: `int32`, `int64`, `uint32`,
`uint64`.

```echo
echo std::math::min(3, 9);          // 3
echo std::math::max(3.0, 9.0);      // 9.000000
```

There is **no generic `min`**, because comparing signed and unsigned integers are two different operations
and a single body would have nothing to choose between them with. What you see of that is a mixed-signedness
call having no single best candidate:

```echo
int32 $a = 3;
uint32 $b = 9;

echo std::math::min($a, $b);
// error: The call to 'min' is ambiguous. These overloads all match equally well:
//          std::math::min(int32, int32)
//          std::math::min(uint32, uint32)
```

Cast the operands to one type first. That is the honest answer: a `min` that silently picked one would be
choosing which of your two values gets reinterpreted, and it would be wrong about half the time.

There are no `int8` or `int16` overloads, which means a `min` over two `uint8`s widens. That costs nothing
in practice and it is still a gap.

## abs takes any number you give it

```echo
echo std::math::abs(-3);        // 3
echo std::math::abs(-3.0);      // 3.000000
echo std::math::abs(-3.0f);     // 3.000000
```

Unlike `min`, `abs` does have a generic form, sitting in the same overload set as the two float ones. The
ordinary rules sort it out: a float argument matches a float overload exactly, and an integer one
instantiates the generic. Concrete beats generic, so a float never goes near the generic body. See
[Generics](/language/generics).

One wrinkle worth knowing. The generic works by comparing against zero, which over an unsigned type is never
true, so `abs` on a `uint32` compiles and hands you the value back unchanged. The answer is right, since the
absolute value of an unsigned number is itself, but you have written a call that cannot do anything.

## clamp is float only

```echo
echo std::math::clamp(11.0, 0.0, 5.0);      // 5.000000
```

There are exactly two overloads, `float` and `float64`, both `min(max($value, $min), $max)`. Clamping
integers has no candidate, and because an integer literal converts to both float widths equally well, what
you get is an ambiguity rather than a missing-overload message:

```echo
echo std::math::clamp(11, 0, 5);
// error: The call to 'clamp' is ambiguous. These overloads all match equally well:
//          std::math::clamp(float32, float32, float32)
//          std::math::clamp(float64, float64, float64)
```

`min` and `max` have the integer overloads, so `std::math::min(std::math::max(11, 0), 5)` works today. The
missing integer `clamp` is a gap in the library rather than in the language, and it is on
[the list](/reference/limitations).

## A constant is not a compile-time number

This is the one that surprises people, and it is not a `std::math` rule at all:

```echo
const if (std::math::PI > 3.0) {
    echo 1;
}
// error: a floating-point value is not something the compiler folds - its arithmetic belongs to the
//        target rather than to the tree.
```

`const if` folds integer and boolean expressions. Floating-point arithmetic belongs to the target, not to
the tree, so the compiler refuses to answer rather than answering with the host's idea of the result. Use an
ordinary `if`. It is one branch, and any optimizer will fold it for the target that actually matters.

## The whole surface

| Group | Functions | Notes |
|---|---|---|
| trigonometry | `sin` `cos` `tan` `asin` `acos` `atan` `atan2` `sinh` `cosh` `tanh` | `atan2` takes y first |
| roots and powers | `sqrt` `pow` | |
| exponentials | `exp` `exp2` `exp10` | |
| logarithms | `log` `log2` `log10` | |
| rounding | `floor` `ceil` `trunc` `round` `roundeven` `rint` | `round` and `roundeven` disagree on an exact half |
| sign | `abs` `copysign` | `copysign($magnitude, $sign)`, magnitude first |
| selection | `min` `max` | no generic form, so cast mixed signedness first |
| fused | `fma($a, $b, $c)` | `$a * $b + $c` with a single rounding |
| clamping | `clamp($value, $min, $max)` | float widths only |

Every one of these has a `float` and a `float64` overload. `min` and `max` add `int32`, `int64`, `uint32`
and `uint64`. `abs` adds a generic form that covers the integer types.

| Constant | Value | Twin |
|---|---|---|
| `PI` | 3.141592653589793 | `PI_F32` |
| `TAU` | 6.283185307179586 | `TAU_F32` |
| `HALF_PI` | 1.5707963267948966 | `HALF_PI_F32` |
| `E` | 2.718281828459045 | `E_F32` |
| `LN_2` | 0.6931471805599453 | `LN_2_F32` |
| `LN_10` | 2.302585092994046 | `LN_10_F32` |
| `SQRT_2` | 1.4142135623730951 | `SQRT_2_F32` |

## Next

- [Constants](/language/constants) for what a `$`-less declaration is and where one may live.
- [Types](/language/types) for `float` against `float64`, and the `f` suffix.
- [Expressions](/language/expressions) for what happens when you mix widths in one expression.
