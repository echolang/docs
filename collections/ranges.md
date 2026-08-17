# Ranges

`0 .. 10` looks like syntax. It is not. **`..` and `..=` are ordinary declared operators in the standard
library**, `range<T>` is an ordinary struct, and `foreach` reaches it through the same two interfaces your
own type would declare.

```echo
foreach (0 .. 4 as $i) {
    echo $i;            // 0, 1, 2, 3
}
```

Nothing in the compiler knows what a range is. That's why this page is short, and why `--no-stdlib` leaves
the dots with no symbol behind them.

## Exclusive and inclusive

`..` stops before its upper bound. `..=` includes it:

```echo
foreach (0 .. 3 as $i) {
    echo $i;            // 0, 1, 2
}

foreach (1 ..= 3 as $n) {
    echo $n;            // 1, 2, 3
}
```

The exclusive form is the one that pairs with a count, which is what most loops are written over. The
inclusive form is what you reach for when the bound is a real value rather than a length.

Write the dots with or without spaces. `0..10` and `0 .. 10` are the same three tokens, because the numeric
literal reader declines to eat a dot that is followed by another one:

```echo
foreach (0..3 as $t) {
    echo $t;            // 0, 1, 2
}
```

## Empty is a legitimate answer

A range whose start is not below its end simply produces nothing, which is what makes `0 .. $a->count()`
right for an empty collection with nothing written at the call site:

```echo
foreach (5 .. 5 as $a) { echo 'never'; }
foreach (10 .. 0 as $b) { echo 'never'; }
foreach (5 ..= 4 as $c) { echo 'never'; }

echo 'empty';           // empty

foreach (5 ..= 5 as $d) { echo $d; }    // 5
foreach (5 .. 6 as $e) { echo $e; }     // 5
```

## A range is an ordinary value

It is a struct, so you can store one, pass one, and loop over it later:

```echo
range<int32> $r = 7 .. 10;

foreach ($r as $v) {
    echo $v;            // 7, 8, 9
}
```

A `const` one loops too, and still yields a writable value. That's a bit surprising if you just came from
arrays: a range's cursor borrows *its own* field rather than storage the range owns, so there is nothing
to protect and a `const range<int32>` can honestly hand out an `int32&`.

```echo
const range<int32> $frozen = 0 .. 2;

foreach ($frozen as $f) {
    echo $f;            // 0, 1
}
```

The keyed form gives you the **position**, not the value:

```echo
foreach (10 .. 13 as $i => $v) {
    echo $i;            // 0, 1, 2
    echo $v;            // 10, 11, 12
}
```

## Ranges over any integer type

`range<T>` is generic, and the operator binds `T` from its operands. Signed bounds and negative starts work
the way you would expect:

```echo
foreach (-2 ..= 1 as $s) {
    echo $s;            // -2, -1, 0, 1
}
```

The interesting one is a closed range that ends at the type's maximum. There is no value above `255` for a
`uint8` to test against, so a cursor that stepped first and tested afterwards would wrap to `0` and loop
forever. This one ends on its last step instead:

```echo
uint8 $lo = 253;

foreach ($lo ..= 255 as $byte) {
    echo $byte;         // 253, 254, 255
}
```

That's a real bug that the obvious implementation has, and it is why `range<T>` carries an `$inclusive`
field rather than lowering `$a ..= $b` to `range($a, $b + 1)`.

## The literal that decides your index type

Here is the trap, and it will cost you an afternoon if you walk into it cold.

The operator takes **one** `T` for both operands:

<!-- verify: skip -->
```echo
operator<T> (T $from) .. (T $to) : range<T>
```

So when you write the loop everybody writes:

```echo
array<int32> $xs = [11, 22, 33];

foreach (0 .. $xs->count() as $i) {
    echo $xs[$i];       // 11, 22, 33
}
```

`count()` returns a `usize` and `0` is an untyped literal, so **the count is what binds `T`**. The literal
is the operand with no opinion, and it is written at whatever the other one decided. You get `range<usize>`
and an index you can hand straight back to `$xs[...]`, with nothing converted down on the way.

Both ends being literals is the case with nothing to defer to, and there `int32` is still the answer:

```echo
foreach (0 .. 3 as $i) {
    echo $i;            // 0, 1, 2
}
```

Which is what you want. `-2 ..= 2` would be a strange thing to have to spell as a signed type.

## Precedence

`..` and `..=` get the default a declared symbol gets: looser than every arithmetic and bitwise operator,
tighter than every comparison. So `0 .. $n - 1` is `0 .. ($n - 1)`, which is what it looks like:

```echo
int32 $n = 4;

foreach (0 .. $n - 1 as $i) {
    echo $i;            // 0, 1, 2
}
```

## Why the compiler's ignorance is the point

There is no `#[core:]` binding on `range<T>` and there deliberately never will be. A core name exists so
the compiler can *say* a type it mints itself, and the compiler never mints a range.

Which means the whole feature is this, in `stdlib/core/range.eco`:

<!-- verify: skip -->
```echo
operator<T> (T $from) .. (T $to) : range<T>
{
    return range<T>($from, $to, false);
}

operator<T> (T $from) ..= (T $to) : range<T>
{
    return range<T>($from, $to, true);
}
```

plus a struct conforming to `contract::iterable<T>`. Compile with `--no-stdlib` and the dots are not a
symbol at all.

The consequence for you: a range is not a privileged loop source. Your own type conforms the same way and
loops exactly as well, which is what [Iteration](/collections/iteration) is about. And `for` and
`foreach (0 .. 10 as $i)` are unrelated features that happen to read alike. The first is a language
construct; the second is a library file.

## Next

- [Iteration](/collections/iteration) for the protocol `range<T>` conforms to, and how to write your own.
- [Operators](/language/operators) for declaring an infix operator of your own.
- [Control flow](/language/control-flow) for `for`, which is the language construct this is not.
