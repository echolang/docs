# Casts

A destination usually decides the type: a typed variable, a parameter, a field. Sometimes there is no destination. A `return` whose expression is wider than the function asked for. An operand of `<`. Then you write the destination next to the value.

```echo
function wide(uint8 $b) : int32
{
    return $b as int32;
}

echo (200 as int32) > 57;       // 1
```

`(int32)$x` does not parse. `int32($x)` is not a function. `as` is postfix, the same way `instanceof` is.

## The simple case

`$x as T` is a written destination. The compiler does the conversion it would have done if a typed slot had been sitting there.

```echo
echo 7 as int64 + 1;            // 8
```

That is `(7 as int64) + 1`. The `as` binds tighter than any binary operator, so the addition happens at `int64`.

A parenthesised group is the other way around. The sum is rebuilt first, then `as` applies to the whole thing:

```echo
echo (7 + 1) as int64;          // 8
echo 1 + 2 as int64;            // 3, which is `1 + (2 as int64)`
```

Same keyword as `foreach ($xs as $x)`. Different job. [Iteration](/collections/iteration) owns the binding.

## A typed slot still converts without it

```echo
float64 $precise = 3.9;
int32 $rounded = $precise;
echo $rounded;                  // 3
```

That narrowing still happens without a word of complaint. `as` is for the sites that have nowhere to land, not a requirement on every conversion.

I am not happy with silent narrowing. I'd rather it needed something written down. Until that changes, a typed slot is still enough. [Primitive types](/reference/primitive-types) has the table. [Expressions](/language/expressions) has the three rules that decide which type an operation happens at.

## What it will convert

Anything the compiler would have converted at a destination, you can write.

**Numbers.** Primitive to primitive, including a narrowing, including `bool`. The operand has to actually be a primitive. A borrow of one is a pointer, so `$r as float64` when `$r` is an `int32&` is refused. Write the destination on a slot, or read the value first.

```echo
int32 $n = 7;
echo $n as float64;             // 7.000000

int64 $big = 5000000000;
echo $big as int32;             // 705032704
```

That last one is the silent truncation a destination would have done too. `as` does not make it safer. It makes it *possible* in a position that had no destination.

**The same type.** `$n as int32` when `$n` is already an `int32` is a no-op. Top-level `const` is dropped for the comparison, so a `const int32` still reads as an `int32`.

**A `T` into a `T?`.** That is a wrap. The other direction is not. See below.

```echo
int32 $n = 7;
int32? $maybe = $n as int32?;
echo $maybe ?? 0;               // 7
```

**A declared `#[implicit]` conversion.** A type that said it can stand in for another one participates here the same way it does at an argument:

```echo
struct Quantity
{
    int64 $n;

    #[implicit]
    static function from(int32 $n) : Quantity
    {
        return Quantity($n);
    }
}

function put(Quantity $q) : void
{
    echo $q->n;
}

put(7 as Quantity);             // 7
```

`put(7)` would have done the same thing. The `as` just says it out loud.

The outbound form is the same idea, written on the source:

```echo
struct Meters
{
    float64 $value;
}

struct Feet
{
    float64 $value;

    #[implicit]
    const function to_meters() : Meters
    {
        return Meters($this->value * 0.3048);
    }
}

function show(Meters $m) : void
{
    echo $m->value;
}

Feet $ten = Feet(10.0);
show($ten as Meters);           // 3.048000
```

A `const T&` operand still finds a `const function` conversion. That is the same peel an argument gets. [Attributes](/reference/attributes) owns the attribute. This page only cares that a written `as` asks it.

**A pointer to a pointer.** `$p as ptr<uint8>` reinterprets the address. `ptr<uint8>($p:$)` is the same conversion written the other way around. No `unsafe` required: computing another address promises nothing. Turning one of those into a `T&` is a different operation and it does need `unsafe`. [Pointers](/memory/pointers) and [Unsafe](/memory/unsafe) have that split.

## What it will not do

`as` does not invent a conversion, and it does not unwrap.

```echo
int32? $maybe = 1;
int32 $x = $maybe as int32;
// error: 'int32?' does not narrow through 'as' - unwrap it with guard, ?? or ?->
```

That is [Nullability](/memory/nullability). `guard`, `??`, and `?->` exist so an absence has to be named.

`$w as Gate` on a `weak<Gate>` is the same kind of refusal. That is `strong($w)`. [Ownership](/memory/ownership) owns the upgrade.

Two unrelated structs refuse it too:

```echo
struct Alpha { int32 $n; }
struct Beta { int32 $n; }

Alpha $a = Alpha(1);
Beta $b = $a as Beta;
// error: 'Alpha' cannot be read as a 'Beta'
```

Matching fields are not a conversion. If you want one, declare it with `#[implicit]`.

## foreach still owns as

`foreach` parses the source, then expects `as`. The binding forms stay in the stream: `as $el`, `as &$el`, `as const &$el`, and the refused `as const $el`. `as const int32` is a cast, because the token after `const` is a type.

```echo
foreach (0 .. 3 as $i) {
    echo $i;                    // 0, then 1, then 2
}

echo 7 as int32;                // 7
```

If `as` continued an expression the way `instanceof` does, `foreach` would never see its binding. So it doesn't. The keyword stays in the stream and `foreach` reads it.

## Next

- [Expressions](/language/expressions) for the three rules that decide a type when you did not write `as`.
- [Primitive types](/reference/primitive-types) for which number conversions happen at a destination.
- [Attributes](/reference/attributes) for declaring a conversion.
- [Pointers](/memory/pointers) for the `ptr<T>(...)` spelling and the `T&` promotion.
