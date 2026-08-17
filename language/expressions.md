# Expressions

Arithmetic in Echo looks exactly like arithmetic everywhere else. The interesting part is what happens when
the two sides of an operator are not the same type, because **Echo converts implicitly, and the destination
gets the last word.**

```echo
echo 2 + 3 * 4;     // 14
echo (1 + 2) * 3;   // 9
```

If that's all you needed, you can stop here. The rest of this page is the type rules underneath it, which
you'll eventually trip over.

## The operators

| Kind | Operators |
|---|---|
| Arithmetic | `+` `-` `*` `/` `%` `**` |
| Comparison | `==` `!=` `<` `>` `<=` `>=` |
| Logical | `&&` `\|\|` `!` |
| Bitwise | `&` `\|` `^` `<<` `>>` |
| Increment | `++` `--` |
| Null | `??` `?->` |

`**` is exponentiation and is right associative, so `2 ** 3 ** 2` is `2 ** 9`:

```echo
echo 2 ** 3 ** 2;   // 512
```

Integer division truncates and `%` is the remainder:

```echo
echo 7 / 2;         // 3
echo 7 % 2;         // 1
echo 7 / 2.0;       // 3.500000
```

`&&` and `||` short-circuit. The right side doesn't run when the left has already decided: `false &&
die("no")` doesn't die, and `true || die("no")` doesn't die. Both sides stay `bool`. There is no
truthiness. `??` and `?->` are the other forms that skip a side; see [Nullability](/memory/nullability).

The bitwise operators are integers only. A float has no bits as far as the language is concerned:

```echo
echo 1.5 & 2.0;
// error: operator '&' is not supported on operands of type 'float64' and 'float64'
```

## Precedence

Lower number binds tighter. This is C's table with one deliberate repair.

| Tier | Operators | Associativity |
|---|---|---|
| 10 | `( )` | n/a |
| 20 | `++` `--` | right |
| 30 | `**` | right |
| 40 | `*` `/` `%` | left |
| 50 | `+` `-` | left |
| 60 | `<<` `>>` | left |
| 70 | `&` | left |
| 80 | `^` | left |
| 90 | `\|` | left |
| 100 | `<` `>` `<=` `>=` `==` `!=` | left |
| 110 | `&&` | left |
| 120 | `\|\|` | left |
| 125 | `??` | right |
| 130 | `=` | right |

The repair is the bitwise trio. In C, `a & b == c` parses as `a & (b == c)`, which is nobody's intent and
has been quietly costing people afternoons since 1972. Here `&` binds tighter than `==`:

```echo
echo 12 & 10 == 8;      // 1, because (12 & 10) is 8
```

`??` is right associative so a chain of fallbacks reads left to right, each tried in turn:
`$a ?? $b ?? $c` is `$a ?? ($b ?? $c)`. See [Nullability](/memory/nullability).

You can declare your own operators, with your own precedence, on the same table.
[Operators](/language/operators) covers that.

## Three conversion rules

When an operation has two types, the compiler reconciles them. Three rules, applied in order.

**1. Floating point wins.** Mix an integer with a float and the operation happens in floating point:

```echo
echo 10 / 4.0;      // 2.500000
```

**2. Higher precision wins.** Between two types of the same kind, the wider one is the answer:

```echo
int32 $count = 5;
float64 $rate = 2.0;
echo $count * $rate;    // 10.000000
```

**3. The destination has the last word.** This is the one that surprises people, and it is the one I would
defend hardest. Where the result is going participates in the decision:

```echo
int32 $a = 1 / 2;
echo $a;            // 0

float32 $b = 1 / 2;
echo $b;            // 0.500000
```

Same expression, two answers. In the second one the destination is a `float32`, so the two literals become
floats before the division happens, so you get the answer you obviously wanted rather than the answer C's
rules would hand you.

I understand this is controversial. Implicit conversion has a bad reputation and it earned most of it. I
still prefer it here, because the conversions are not semi-random: they follow the three rules above, and
the literal cases are all resolved at compile time where nothing can go wrong at runtime.

## Literals convert at compile time, variables at runtime

The distinction matters, so let's make it explicit.

A literal has no type until something gives it one. When the compiler retypes a literal, nothing happens at
runtime at all. The constant that ends up in the program is simply the right one:

```echo
echo 3.14f * 2;     // 6.280000

// conceptually
echo 3.14f * 2.0f;
```

No conversion instruction. No cost. The `2` was never an `int32` in the emitted program.

A variable is different. Its type is already settled, so reconciling it means an actual conversion:

```echo
int32 $multiplier = 2;
float32 $val = 3.14f * $multiplier;
echo $val;          // 6.280000
```

Conceptually, that second line becomes:

```echo
int32 $multiplier = 2;
float32 $val = 3.14f * ($multiplier as float32);
```

That `$multiplier as float32` is a written destination. [Casts](/language/casts) is the page for the
spelling. The compiler inserts the same conversion when a typed slot is already waiting. An optimizer will
often make it disappear, but assume it is there when you are reasoning about a hot loop.

## What the compiler refuses

Because a literal's value is visible at compile time, the compiler can check it. It does.

**An integer literal that does not fit:**

```echo
int32 $x = 3000000000;
// error: Integer overflow: The literal '3000000000' is too large for the integer type 'int32'.
//        The maximum value is '2147483647'.
```

It refuses rather than wrapping. A wrap here would be a number nobody chose.

**A float literal with a fractional part going into an integer:**

```echo
int32 $x = 3.9;
// error: Invalid type conversion: The floating point number literal '3.9' cannot be implicitly
//        converted to an integer type due to non zero decimal values.
```

`int32 $x = 3.0;` is fine, nothing is lost.

**A negative literal going somewhere unsigned:**

```echo
usize $n = -1;
// error: Invalid type conversion: The integer literal '-1' cannot be implicitly converted to an
//        unsigned integer because it is negative.
```

**A float literal losing precision** is a warning rather than an error, because a rounded float is still a
usable number:

```echo
float $x = 3.14;
// warning: the literal '3.14' is stored in 32bit float
```

Write `3.14f` and the warning goes away.

### The check only covers literals

Here is the catch, and it is a big one. Every refusal above depends on the compiler being able to see the
value. Put that value in a variable first and all of it evaporates:

```echo
int64 $big = 5000000000;
int32 $small = $big;
echo $small;        // 705032704
```

No error, no warning, just a truncated number. Same for floats, and same for signedness. This is C's
behaviour and I have never once been glad about it. Narrowing should need something explicit, and that is
on [the list](/reference/limitations).

Until then: the literal check is the only check you get.

## Shifts are the odd ones out

Every binary operator reconciles its two sides to a common type, except `<<` and `>>`. Their right side is
a **count**, not a second value, and it gets no vote:

```echo
int32 $neg = -16;
uint32 $two = 2;
int32 $signed_count = 2;

echo $neg >> $two;              // -4
echo $neg >> $signed_count;     // -4
```

Both answer `-4`. If the count reconciled like an ordinary operand, the unsigned `2` would make the whole
operation unsigned and the first line would answer `1073741820`: the same shift, written two ways,
disagreeing.

The *left* side still decides everything. `>>` on a signed type replicates the sign bit; on an unsigned
type it brings in zeroes:

```echo
int32 $neg = -16;
uint32 $wide = 4294967280;

echo $neg >> 2;     // -4,          sign preserved
echo $wide >> 2;    // 1073741820,  zeroes shifted in
```

A shift by more bits than the type has is undefined in most languages. Here it is simply refused:

```echo
echo 1 << 32;
// error: this shifts a 'int32' by 32 or more bits, which at runtime is undefined; here it is
//        simply refused.
```

## Folding, and const(...)

The compiler folds constant expressions before your program runs. Usually you never notice:

```echo
echo 1 << 3;        // 8, computed at compile time
```

`const(...)` makes the folding a requirement instead of an optimization. The compiler must be able to answer
the expression, or it is an error:

```echo
const int32 ANSWER = const(2 * 21);
echo ANSWER;        // 42
```

That looks pointless in isolation, and mostly it is. It earns its keep next to `const if`, where the
compiler branches on a value before the program exists (see [Control flow](/language/control-flow)), and
inside generic code, where the answer depends on the type parameter.

Folding is not a licence to be wrong. An overflow during folding is refused rather than wrapped, and the
folded answer always agrees with the runtime one. A `const if` and the ordinary `if` beside it can never
take different arms over the same operands.

## Next

- [Types](/language/types) for the primitives all of this is defined over.
- [Operators](/language/operators) for overloading these and declaring new ones.
- [Nullability](/memory/nullability) for `??`, `?->` and `!`.
