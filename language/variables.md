# Variables

Variables are declared the way you would expect from PHP, but with a catch: **every variable has a static
type, decided at the declaration, and it never changes.**

```echo
$a = 25;
echo $a;        // 25
```

That is the whole thing for the common case. The rest of this page is what happens when the common case is
not enough.

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

Both spellings produce the same variable. Inference is not a weaker form of declaration, it is the same
declaration with the type worked out for you.

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

Writing the type lets you declare now and assign later:

```echo
string $b;
$b = "later";
echo $b;        // later
```

What you cannot do is skip both. With no type and no initializer there is nothing to infer from, so it is not
a declaration and the parser says so:

```echo
$c;             // error: unexpected token 'varname'
$c = 25;
```

## The type never changes

This is the part that catches people coming from PHP.

```echo
$name = "Echo";
$name = 42;     // error: cannot assign 'int32' to 'string'
```

Nothing was compiled. The type of `$name` was settled on line one and line two contradicts it.

Note the wording: `int32` to `string`. Echo is not refusing to convert, it is refusing to *reassign the
type*. `$name` is a `string` and will be one until it goes out of scope.

## Conversions between number types

Widening is always fine, because nothing can be lost:

```echo
int32 $a = 25;
int64 $b = $a;      // fine
```

Narrowing is where it gets interesting, and the rule depends on whether the compiler can see the value.

**A literal is checked against the actual value.** The compiler knows what `256` is, so it can tell you it
does not fit:

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

**A variable is not checked.** The compiler does not know what is in it at compile time, so a narrowing
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

To be clear: that is the current behaviour, not a design I am happy with. C does the same thing and I have
never once been glad about it. I would rather narrowing needed an explicit cast, and that is on
[the list](/reference/limitations). Until then, know that the literal check is the only one you get.

[Expressions](/language/expressions) has the conversion rules for what happens when you mix types inside an
expression rather than across an assignment.

## const variables

`const` in front of a declaration makes the variable read-only after its initializer:

```echo
const usize $max = 100;
$max = 200;     // error: cannot assign to '$max' - it is declared const
```

It is still a variable. It has storage, it lives in the scope you wrote it in, and it goes away with that
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
else happens. That is how `std::math::PI` is declared, and it is why a constant can live at file scope,
namespace scope or struct scope where a variable cannot.

[Constants](/language/constants) covers the rest, including the surprising consequence that a constant whose
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

There is no hoisting and no function-wide scope. If you have been bitten by a PHP `foreach` variable outliving
its loop, that does not happen here.

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

Reading a moved-from variable is a compile error, not a runtime surprise. That is the entire safety
guarantee, and it is worth understanding properly before you write anything large:
[Ownership and moving](/memory/ownership).

## Next

- [Types](/language/types) for the full list of primitives and their widths.
- [Expressions](/language/expressions) for what happens when you mix them.
- [Constants](/language/constants) for the `$`-less kind.
