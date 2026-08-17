# Operators

Writing `add_mass($a, $b)` everywhere gets old quickly. Echo lets you teach `+` about your own type:

```echo
struct Naquadah
{
    uint64 $milligrams;
}

operator (Naquadah $a) + (Naquadah $b) : Naquadah
{
    return Naquadah($a->milligrams + $b->milligrams);
}

Naquadah $total = Naquadah(500) + Naquadah(250);
echo $total->milligrams;    // 750
```

Read the declaration out loud and it says what it is: a left operand, a symbol, a right operand, a return
type. **An operator is an ordinary function with a funny name.** It goes in the overload set for that
symbol, it obeys the same resolution rules as any other call, and there is no separate machinery for it
anywhere in the compiler.

Two things follow from that:

**Operators are declared at file scope, not inside a type.** They are free functions. `Naquadah` above does
not mention `+` at all.

**Order doesn't matter.** Like any function, an operator can be declared below the code that uses it.

## The declaration form

```
operator [<type params>] [(precedence, associativity)] (LHS) SYMBOL (RHS) : ReturnType
```

The parts in brackets are optional. Everything else is required, including the return type, because an
operator is an expression and an expression has to produce something:

```echo
struct Naquadah
{
    uint64 $milligrams;
}

operator (Naquadah $a) = (Naquadah $b) : void
{
}
// error: operator '=' returns void. An operator is an expression, so it has to return something.
```

## You cannot redefine what is already built in

If the language already spells a meaning for a symbol over those operand types, that meaning wins:

```echo
operator (int32 $a) + (int32 $b) : int32
{
    return 0;
}
// error: operator '+' is built in for these operand types, so this declaration would never be used -
//        where the language spells a meaning, the built-in one wins.
```

The check is on the **operand types**, not on the symbol. `+` over two `Naquadah` values is fine because
nothing is built in for that. `+` over two `int32`s is not, because there is nothing you could add.

In practice the rule is: at least one operand has to be a type you declared.

`=` cannot be declared at all, and neither can `++` or `--` in their usual form. Assignment and
increment are statements about storage rather than expressions over values.

## Declaring a brand new operator

You are not limited to the symbols the language ships. A word works:

```echo
operator (float64 $a) avg (float64 $b) : float64
{
    return ($a + $b) / 2.0;
}

echo 10.0 avg 20.0;             // 15.000000
echo 1.0 + 2.0 avg 3.0 + 5.0;   // 5.500000
```

That second line is the interesting one. `avg` got the default precedence, which sits below `+`, so it
parsed as `(1.0 + 2.0) avg (3.0 + 5.0)` and gave `5.5`.

Note that declaring `avg` as an operator doesn't stop you declaring a *function* called `avg`. They live in
different worlds:

```echo
operator (float64 $a) avg (float64 $b) : float64
{
    return ($a + $b) / 2.0;
}

function avg(int32 $a, int32 $b, int32 $c) : int32
{
    return $a + $b + $c;
}

echo 10.0 avg 20.0;     // 15.000000
echo avg(1, 2, 3);      // 6
```

### Choosing a precedence

Put the tier and associativity in parentheses after the keyword. Lower binds tighter, on the same table as
the built-in operators in [Expressions](/language/expressions):

```echo
operator(35, left) (int32 $a) tight (int32 $b) : int32 { return $a + $b; }
operator(45, left) (int32 $a) loose (int32 $b) : int32 { return $a + $b; }

echo 2 tight 3 * 4;     // 20, because tight binds harder than *
echo 2 loose 3 * 4;     // 14, because * binds harder than loose
```

`*` sits at 40. `tight` at 35 grabs its operands first, so that's `(2 tight 3) * 4`. `loose` at 45 lets `*`
go first, so that's `2 loose (3 * 4)`.

Associativity works the way you would expect:

```echo
operator(45, right) (int32 $a) rassoc (int32 $b) : int32 { return $a - $b; }

echo 10 rassoc 5 rassoc 2;      // 7, because it groups as 10 rassoc (5 rassoc 2)
```

## Prefix operators

One operand, symbol first:

```echo
struct Shield
{
    bool $raised;
}

operator !!(Shield $s) : bool
{
    return $s->raised;
}

operator -(Shield $s) : Shield
{
    return Shield(false);
}

Shield $forward = Shield(true);
echo !!$forward;        // 1

Shield $dropped = -$forward;
echo $dropped->raised;  // 0
echo -5;                // -5, the built-in negation is untouched
```

## Suffix operators, and the units trick

A suffix operator takes its operand on the left and has nothing on the right. This is my favourite bit of
the whole feature, because it gives you typed literals:

```echo
struct Naquadah
{
    uint64 $milligrams;
}

operator (Naquadah $a) + (Naquadah $b) : Naquadah
{
    return Naquadah($a->milligrams + $b->milligrams);
}

operator (uint64 $a)mg : Naquadah { return Naquadah($a); }
operator (uint64 $a)g  : Naquadah { return Naquadah($a * 1000); }
operator (uint64 $a)kg : Naquadah { return Naquadah($a * 1000000); }

$payload = 1kg + 500g + 250000mg;
echo $payload->milligrams;      // 1750000
```

`1kg` is not special syntax. It is `1` passed to the `kg` suffix operator, which returns a `Naquadah`, and
then `+` on `Naquadah` does the rest. Three tiny declarations and mixing up your units stops being possible
in that part of your program, which for a cargo of naquadah is worth the ten lines.

Note there is no space before the suffix symbol. `1kg`, not `1 kg`.

## The index operator

`[]` is declared like any other operator, with the index in brackets:

```echo
struct Coordinate
{
    int32 $x;
    int32 $y;
}

operator (Coordinate& $c)[usize $axis] : int32&
{
    if ($axis == 0) {
        return &$c->x;
    }
    return &$c->y;
}

Coordinate $target = Coordinate(11, 22);
echo $target[0];    // 11
echo $target[1];    // 22
```

Returning `int32&` hands back a **place**, so the bracket works on both sides of an assignment:

```echo
struct Coordinate
{
    int32 $x;
    int32 $y;
}

operator (Coordinate& $c)[usize $axis] : int32&
{
    if ($axis == 0) {
        return &$c->x;
    }
    return &$c->y;
}

Coordinate $target = Coordinate(11, 22);
$target[0] = 99;
echo $target->x;    // 99
```

Declare a `const` receiver overload alongside it to make reads work through a `const` value. That's what
`array<T>` does: `operator<T> (array<T>& $a)[usize $i] : T&` and
`operator<T> (const array<T>& $a)[usize $i] : const T&`.

### The separate write form

There is a second index operator that handles the *write* directly, rather than handing back a place:

```
operator (Container& $c)[Key $k] = (Value $v) : void
```

Why have both? Because for some containers, "give me the place at this key" is not answerable. A `map<K, V>`
asked for a key that is not there has no slot to hand back, and the write is the thing that should create
one.

This form matters for ownership. When you write through a returned place, the compiler treats it as
reassignment: whatever was there gets destroyed first. Over a slot that has never held a valid value, that
is a destructor call over uninitialised memory. The write operator is a plain function call instead, so the
container's own body decides what happens to the old value, and the compiler stays out of it.

`array<T>` declares no write operator and keeps the place. `map<K, V>` declares one, and
`$m["key"] = $value` is literally a call to it. Note a container may not declare both for the same arity: if
it did, whether `$m[$missing] = $v` inserted or asserted would depend on which candidate scored higher,
which is not a thing a program's meaning should rest on.

### Appending

An index operator with an empty bracket is the append form:

```
operator<T> (array<T>& $a)[] : T&
```

That's what makes `$numbers[] = 4` work. It is distinguished from the others by arity, nothing else.

## Generic operators

Type parameters go directly after the keyword:

```echo
struct CargoBay<T>
{
    T $forward;
    T $aft;
}

operator<T> (CargoBay<T>& $bay)[usize $slot] : T&
{
    if ($slot == 0) {
        return &$bay->forward;
    }
    return &$bay->aft;
}

CargoBay<int32> $hold = CargoBay<int32>(11, 22);
echo $hold[0];      // 11
```

`..` and `..=` are declared exactly this way in `stdlib/core/range.eco`:

```
operator<T> (T $from) .. (T $to) : range<T>
```

Let that sink in for a second. **Ranges are not syntax.** They are two operator declarations in a
library file, and `foreach (0 .. 10 as $i)` works because the thing they return declares that it can be
iterated. Compile with `--no-stdlib` and the dots stop meaning anything.

One current gap: a generic overload of a symbol that *does* have a built-in meaning is refused, because
inside the template the operands are still `T` and the compiler answers "that might be a primitive". See
[Generics](/language/generics).

## A word of caution

Operators are global. There is no namespacing on them, so a library you depend on that declares `avg` has
declared it for your whole program.

Use them where the notation genuinely helps: vectors, matrices, units, money, ranges. If a reader would have
to look up what your symbol does, a named function was the better call.

## Next

- [Expressions](/language/expressions) for the built-in operators and the precedence table.
- [Generics](/language/generics) for generic operators and their one limitation.
- [Interfaces](/language/interfaces) for requiring an operator in a contract.
