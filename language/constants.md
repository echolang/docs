# Constants

A constant is a name for an expression:

```echo
const usize MAX = 100;

usize $limit = MAX;
echo $limit;        // 100
```

No `$`, and that missing `$` is the entire difference between a constant and a `const` variable. It is worth
being precise about, because the two look almost identical and behave nothing alike.

```echo
const usize $max = 100;     // a const variable. has storage, lives in a scope
const usize MAX = 100;      // a constant. has no storage at all
```

## A constant has no value, it has an expression

This is the one idea on the page. **A constant is not evaluated. Its expression is cloned into every place
the name appears**, before anything else in the compiler runs.

Most of the time you never notice, because the expression is a literal:

```echo
const usize MAX = 100;
const GREETING = "hello";
const HALF = MAX / 2;

echo MAX;           // 100
echo GREETING;      // hello
echo HALF;          // 50
```

You notice when the expression does something:

```echo
function tick() : int32
{
    echo 9;
    return 1;
}

const TICK = tick();

echo TICK;
echo TICK;
```

That prints `9`, `1`, `9`, `1`. Two uses of `TICK`, two calls to `tick()`. The constant did not compute a
value once and hand it out twice, it copied the expression `tick()` into both lines.

The same applies to a constructor:

```echo
struct Point
{
    int32 $x;
    int32 $y;
}

const ORIGIN = Point(3, 4);

echo ORIGIN->x;         // 3

Point $p = ORIGIN;
echo $p->y;             // 4
```

Two independent `Point(3, 4)` values, not one shared value. For an immutable point that is exactly what you
want. For something expensive it is not, and a `const` variable is the tool for that instead.

There is deliberately no constant evaluator. Building one would mean a second interpreter inside the
compiler that has to agree with codegen about every operation, forever, and the two would drift. Copying an
expression cannot drift, because there is only ever one implementation of what the expression means.

## Where a constant may be written

**File scope**, which is where most of them go:

```echo
const usize MAX = 100;

echo MAX;       // 100
```

**Namespace scope**, reached by qualifying it:

```echo
namespace app;

const LIMIT = 7;

echo app::LIMIT;    // 7
echo LIMIT;         // 7, unqualified from inside the namespace
```

**Struct or class scope**, reached through `self::` from inside and through the type name from outside:

```echo
struct Buffer
{
    const usize CAPACITY = 4096;

    usize $used;

    function headroom() : usize
    {
        return self::CAPACITY - $this->used;
    }
}

echo Buffer::CAPACITY;      // 4096

Buffer $b = Buffer(1024);
echo $b->headroom();        // 3072
```

Inside the type it is `self::CAPACITY`. A bare `CAPACITY` will not find it.

What a constant **cannot** do is live in a block. A constant has no storage, so there is no scope for it to
belong to. If you want a name inside a function, that is a `const` variable:

```echo
if (1 == 1) {
    const $inner = 7;       // a const variable
    echo $inner;            // 7
}
```

## Typed and untyped

Write the type when you want to pin it, leave it out when the expression already says:

```echo
const usize MAX = 100;      // usize
const COUNT = 100;          // int32, from the literal
const GREETING = "hello";   // string

echo MAX;
echo COUNT;
echo GREETING;
```

An untyped constant takes the type its expression produces at each use site, following the ordinary rules in
[Expressions](/language/expressions).

## Publishing a value from a library

Here is a reason to care that is not obvious: **a constant is the only way a library module can export a
named value.**

A file-scope variable in a module that is not the entry point is dropped. There is nowhere for it to live
and nothing runs its initializer, so it silently does not exist. A constant has no storage, so the problem
does not arise: the expression is copied into the consumer's code and evaluated there.

That is how `std::math::PI` is declared. It is also why there are two spellings:

```echo
echo std::math::PI;         // float64
echo std::math::PI_F32;     // float32
```

An untyped constant would have taken its type from each use site, which for a mathematical constant is more
surprise than convenience.

## What a constant cannot reference

**A variable.** A constant is expanded before any storage exists, so there is nothing to read:

```echo
$runtime = 5;
const BAD = $runtime;
echo BAD;
// error: '$runtime' is a variable, and a constant is copied into each of its use sites before any
//        storage exists
```

**A closure.** Same reason: a closure captures storage.

**Itself, directly or through a chain.** Cycles are detected and reported rather than expanded forever.

## Why a conditional-compilation condition cannot name one

```
#[if: MAX > 10]     // not a thing
```

`#[if:]` conditions are evaluated on the **token stream**, between lexing and parsing, before any
declaration has been read. At that point the compiler does not know that `MAX` is a constant, or that it
exists. This is not an oversight, it is what makes conditional compilation cheap enough to work uniformly
everywhere, including around code that names symbols this platform does not have.

What a condition can test is the target and the `--define` flags. See
[Conditional compilation](/projects/conditional-compilation).

## const if is a third thing

To finish the terminology, since three features share the word:

| Spelling | What it is |
|---|---|
| `const usize $max = 100;` | a variable you cannot write to |
| `const usize MAX = 100;` | a constant, an expression copied to each use site |
| `const if (...) { }` | a branch the compiler takes before your program runs |

The last one is in [Control flow](/language/control-flow).

## Next

- [Variables](/language/variables) for the `const` variable this is not.
- [Control flow](/language/control-flow) for `const if`.
- [Modules](/projects/modules) for exporting across a module boundary.
