# Variables

Variables start with `$`. The catch: **every variable has a static type, decided at the declaration, and
it never changes.**

```echo
$a = 25;
echo $a;        // 25
```

```echo
$a = 25;        // works fine
$a = "hello";   // will not compile
```

## Writing the type, or not

You can write the type in front of the name:

```echo
int32 $count = 25;
string $name = "Echo";
float64 $ratio = 0.5;
bool $ready = true;
```

Or leave it out and let the initializer decide:

```echo
$count = 25;        // int32
$name = "Echo";     // string
$ratio = 0.5;       // float64
$ready = true;      // bool
```

Same variable either way. Inference is not a weaker form of declaration. It's the same declaration with the
type worked out for you.

An untyped integer literal is an `int32` and an untyped float literal is a `float64`. If you want something
else, say so:

```echo
int64 $big = 25;
uint8 $small = 255;
float32 $f = 3.14f;
```

`f` is the only literal suffix Echo has. There is no `25i64` or `25u`. The type goes in front instead, which
I think reads better anyway.

## Declaring without a value

What you can't do is declare a variable with an unknown type. In the examples above, the type comes from the
value. Write the type if you want to assign later:

```echo
string $b;
$b = "later";
echo $b;        // later
```

```echo
$c;             // invalid: the type was unknown at declaration
$c = 25;
```

## The type never changes

This is the part that catches people.

```echo
$name = "Echo";
$name = 42;     // error: cannot assign 'int32' to 'string'
```

Nothing was compiled. The type of `$name` was settled on line one and line two contradicts it.

Echo is not refusing to convert here. It's refusing to *reassign the type*. `$name` is a `string` and will
be one until it goes out of scope.

## Conversions between number types

Widening is always fine, because nothing can be lost:

```echo
int32 $a = 25;
int64 $b = $a;      // fine
```

Narrowing is where it gets interesting, and the rule depends on whether the compiler can see the value.

**A literal is checked against the actual value.** The compiler knows what `256` is, so it can tell you it
doesn't fit:

```echo
uint8 $ok = 255;    // fine
uint8 $no = 256;    // error: the literal '256' is too large for the integer type 'uint8'.
                    //        The maximum value is '255'.
```

Floats warn instead of refusing, because a rounded float is still a usable number:

```echo
float $x = 3.14;
// warning: the literal '3.14' is stored in 32bit float
```

Write `3.14f` when you meant a `float32` and the warning goes away.

**A variable is not checked.** The compiler doesn't know what's in it at compile time, so a narrowing
assignment is accepted and truncates at runtime:

```echo
int64 $big = 5000000000;
int32 $small = $big;
echo $small;        // 705032704
```

```echo
float64 $pi = 3.14159265358979;
float32 $f = $pi;
echo $f;            // 3.141593
```

To be clear: that's the current behaviour, not a design I am happy with. C does the same thing and I have
never once been glad about it. I'd rather narrowing needed something written down, and that's on
[the list](/reference/limitations). Until then, the literal check is the only one you get.

[Expressions](/language/expressions) has the conversion rules for mixing types inside an expression rather
than across an assignment.

## const variables

`const` in front of a declaration makes the variable read-only after its initializer:

```echo
const usize $max = 100;
$max = 200;     // error: cannot assign to '$max' - it is declared const
```

It's still a variable. It has storage, it lives in the scope you wrote it in, and it goes away with that
scope. All `const` does is stop you writing to it.

You can infer the type of a `const` too:

```echo
const $limit = 42;      // const int32
```

### const is not the same as a constant

Echo also has **constants**, and they are a different thing with a confusingly similar name. The difference
is the `$`:

```echo
const usize $max = 100;     // a const variable, has storage
const usize MAX = 100;      // a constant, has none
```

A constant has no storage at all. Its expression is copied into each place the name is used, before anything
else happens. That's how `std::math::PI` is declared, and it's why a constant can live at file scope,
namespace scope or struct scope where a variable can't.

[Constants](/language/constants) covers the rest, including the slightly surprising bit: a constant whose
expression calls a function calls it once per use site.

## Scope

A variable lives from its declaration to the end of the block it is in:

```echo
if ($ready) {
    int32 $inner = 1;
    echo $inner;
}

echo $inner;    // error: $inner does not exist here
```

A `for` loop's variable belongs to the loop:

```echo
for (int32 $i = 0; $i < 3; $i++) {
    echo $i;
}

echo $i;        // error
```

No hoisting. No function-wide scope. A loop variable belongs to the loop.

## When the value owns something

Everything above is true of any variable. Once a variable holds something that owns a resource, like an
`array<T>` or a `string`, one more rule applies: **there is exactly one owner, and when it goes out of scope
the value is destroyed.**

```echo
{
    array<int32> $numbers = [1, 2, 3];
}   // the array's buffer is freed right here
```

Handing that ownership somewhere else is a move, spelled `mv`:

```echo
array<int32> $a = [1, 2, 3];
array<int32> $b = mv $a;

echo $a->count();   // error: '$a' has been moved out of
```

Reading a moved-from variable is a compile error, not a runtime surprise. That's the entire safety
guarantee. [Ownership and moving](/memory/ownership) is the chapter.

## Next

- [Types](/language/types) for the full list of primitives and their widths.
- [Expressions](/language/expressions) for what happens when you mix them.
- [Constants](/language/constants) for the `$`-less kind.
