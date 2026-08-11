# Control flow

Branches and loops are the least surprising part of Echo. If you have written PHP, C, Java or anything in
that family, you already know most of this page.

```echo
$temperature = 30;

if ($temperature > 25) {
    echo "warm";
} else {
    echo "not warm";
}
```

Two rules apply everywhere and are worth stating once:

**Braces are always required.** There is no single-statement form, so the `if ($x) doThing();` dangling-else
class of bug does not exist here.

**A condition must be a `bool`.** No truthiness, no zero-is-false. `if ($count)` on an integer is not valid
Echo. Write the comparison you meant: `if ($count > 0)`.

## if, else if, else

```echo
function grade(int32 $score) : string
{
    if ($score >= 90) {
        return "A";
    } else if ($score >= 80) {
        return "B";
    } else {
        return "C";
    }
}

echo grade(85);     // B
```

`else if` is two words. There is no `elseif`.

## while

```echo
int32 $countdown = 3;

while ($countdown > 0) {
    echo $countdown;
    $countdown = $countdown - 1;
}
```

That is the whole of it. There is no `do ... while` yet, so a loop that must run at least once needs its
condition arranged accordingly, or a `break` at the bottom.

## for

`while` is fine until the counter bookkeeping starts drifting away from the loop it belongs to. `for` puts
all three parts in one place:

```echo
for (int32 $i = 0; $i < 3; $i++) {
    echo $i;
}
```

**All three clauses are required.** Leave one out and the compiler says so rather than guessing:

```echo
for (int32 $i = 0;; $i++) {
    break;
}
// error: a 'for' needs all three clauses - this one has no condition.
//        write 'for (int32 $i = 0; $i < 10; $i++)'.
```

An infinite loop is `while (true)`, which says what it means.

### The loop variable belongs to the loop

`$i` is scoped to the loop and is gone afterwards:

```echo
for (int32 $i = 0; $i < 3; $i++) {
    echo $i;
}

echo $i;
// error: The variable '$i' is not declared in the current scope
```

If you have been bitten by a loop variable outliving its loop in PHP, that does not happen here.

## foreach

For walking a collection, `foreach` is what you want. It works on anything that says it can be iterated,
which includes arrays, maps, strings and ranges:

```echo
array<int32> $numbers = [10, 20, 30];

foreach ($numbers as $value) {
    echo $value;
}
```

Ranges are worth pointing out because they look like syntax and are not:

```echo
foreach (0 .. 3 as $i) {
    echo $i;        // 0, 1, 2
}
```

`..` is exclusive and `..=` is inclusive. Neither is built into the compiler. Both are ordinary operators
declared in `stdlib/core/range.eco` that return a `range<T>`, and `foreach` accepts one for exactly the same
reason it accepts your own types: it declares that it can be iterated.

There is a lot more to say about that, and [Iteration](/collections/iteration) says it, including how to
bind by reference and how to make your own type iterable.

## break and continue

`break` leaves the loop. `continue` skips to the next round:

```echo
for (int32 $i = 0; $i < 6; $i++) {
    if ($i == 3) {
        continue;
    }
    echo $i;        // 0, 1, 2, 4, 5
}
```

Both apply to the **innermost** loop only. There is no `break 2` and there are no loop labels, so leaving
two loops at once means a flag or a function you can `return` from.

### continue does not mean the same thing in both loops

This is the one detail people get wrong, and it is the reason `for` exists as a separate statement rather
than as sugar over `while`.

In a `while`, `continue` jumps to the **condition**. In a `for`, it jumps to the **step**, and the step then
runs before the condition:

```echo
for (int32 $i = 0; $i < 6; $i++) {
    if ($i == 3) {
        continue;
    }
    echo $i;
}
```

That prints `0 1 2 4 5` and terminates. Write the same thing as a `while` with the increment at the bottom
of the body and `continue` skips the increment, which is an infinite loop. The `for` form cannot make that
mistake because the step is not part of the body.

## guard

`guard` is for the shape where a value might not be there and there is nothing sensible to do if it is not.

The problem it solves: you have a `T?`, you need a `T`, and the pyramid of `if` nesting that usually follows
is miserable to read.

```echo
function lookup(int32 $key) : int32?
{
    if ($key > 0) {
        return $key * 2;
    }
    return null;
}

function doubled(int32 $key) : int32
{
    guard int32 $value = lookup($key) else { return -1; }

    return $value;
}

echo doubled(3);        // 6
echo doubled(-1);       // -1
```

`$value` is declared into the **enclosing** scope, not into the guard, so the rest of the function uses it
as an ordinary non-null `int32`. No nesting, no unwrapping.

Two rules keep that promise honest.

**The subject has to be nullable.** Guarding something that is always present is pointless, and the compiler
tells you so:

```echo
guard int32 $v = 5 else { die("nope"); }
// error: 'guard' needs a value that may be absent, and 'int32' always is one - write 'int32?'
//        if it may not be, or drop the guard
```

**The `else` arm has to leave.** It must end in `return`, `break`, `continue` or `die`:

```echo
int32? $maybe = null;

guard int32 $value = $maybe else { echo "absent"; }
// error: the 'else' of a guard has to leave - end it with 'return', 'break', 'continue' or 'die'.
//        otherwise '$value' would be read after the value it names turned out not to be there
```

That rule is what makes `$value` safe on the line after. If the `else` could fall through, the guarded
variable would be readable in a state where it holds nothing.

A `break` counts, which makes `guard` a natural loop terminator:

```echo
function pick(int32 $i) : int32?
{
    if ($i < 3) {
        return $i;
    }
    return null;
}

int32 $i = 0;
while ($i < 10) {
    guard int32 $v = pick($i) else { break; }
    echo $v;            // 0, 1, 2
    $i = $i + 1;
}
echo "stopped";
```

Note: an ordinary `if ($x != null)` does **not** narrow the type. Only `guard` does. That trips up everyone
arriving from PHP at least once. [Nullability](/memory/nullability) covers the rest of `T?`, `??` and `?->`.

## die

`die` leaves for good. It prints its message, tears nothing down and exits with a failure status:

```echo
function half(int32 $n) : int32
{
    if ($n % 2 != 0) {
        die("not even");
    }
    return $n / 2;
}

echo half(10);      // 5
```

As far as control flow is concerned, `die` counts as leaving a scope, which is why it satisfies a `guard`
arm. [Errors and panics](/language/errors-and-panics) covers it properly, along with `assert`.

## const if

Everything above happens while your program is running. `const if` happens before that: the compiler picks
an arm and the other one never becomes part of the program at all.

```echo
const if (mem::is_trivially_copyable<int32>()) {
    echo "just copy the bytes";
} else {
    echo "call the copy constructor";
}
```

The condition must be answerable at compile time. A variable cannot appear in one, because a variable does
not have a value yet.

This is not an optimization you could have got from a normal `if`. The arm that loses is **discarded before
type checking**, so it may contain code that would not even compile for the current type. That is what makes
it useful inside generic code:

```echo
function describe<T>() : void
{
    const if (mem::needs_destruction<T>()) {
        echo "owns something";
    } else {
        echo "plain data";
    }
}

describe<int32>();          // plain data
describe<array<int32>>();   // owns something
```

Not everything is answerable this early. Layout queries in particular are not, because the compiler only
knows a type's size once it is emitting code:

```echo
const if (mem::size_of<int32>() == 4) {
    echo "four";
}
// error: 'size_of' is answered from the target's layout, which the compiler only knows once it is
//        emitting code - so it cannot decide a 'const' expression.
```

If you want a compile-time branch on the **platform** rather than on a type, that is a different feature
with a different spelling: `#[if: os == darwin]`. See
[Conditional compilation](/projects/conditional-compilation).

## Next

- [Iteration](/collections/iteration) for what `foreach` can walk and how to make your own type iterable.
- [Nullability](/memory/nullability) for `T?`, `??` and `?->` beside `guard`.
- [Errors and panics](/language/errors-and-panics) for `die` and `assert`.
