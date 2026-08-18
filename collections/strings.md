# Strings

Text is three types, and the split between them is the whole design: `string` **owns** its bytes,
`string::view` **borrows** them, and `str::buf` is the reference-counted buffer underneath that you almost
never name. A unique value of at most `string::INLINE` bytes (15 today) lives *in the string* and never touches that buffer.
Longer text, or text more than one `string` names, is a reference-counted window over `str::buf`:
**copying one of those is a retain, not a memcpy.**

```echo
$greeting = 'hello';

echo $greeting;             // hello
echo $greeting->size();     // 5
```

That's a whole program, and it allocates nothing at all. Here is why.

## A literal is a string, and it costs nothing

`'hello'` is not a separate type that converts to a `string`. It *is* a `string`, lowered to static bytes
in the binary, a byte count, and a null owner. No allocation, no reference count touched:

```echo
$name = 'ray';

echo $name->size();         // 3
echo $name->empty();     // 0
echo $name->byte(0);     // 114
```

A null owner owns nothing, which is exactly why the first write to a literal has to clone rather than
scribble on the program's own image. A short unique result of that clone stays in the string; a longer
one is the next section.

## `string::INLINE` bytes, no allocation

A unique `string` of at most `string::INLINE` bytes is stored in the value. Appending `'hello'` to an empty string
allocates nothing. Copying one is a memcpy of those bytes, and mutating the copy leaves the original
alone — there is no buffer to share.

```echo
$s = '';
$s->append('hello');

echo $s;                        // hello

$t = $s;
$t->append('!');

echo $s;                        // hello
echo $t;                        // hello!
```

`string::INLINE + 1` bytes is what first pays for a `str::buf`. After that the value is a window over a
reference-counted buffer, and the rule below applies.

Ask `$s->view()` for a window over the live bytes. The stored `$window` of an inline string is a tag,
not an address: a return in Echo is a move, and a pointer into the callee's frame would dangle.

## Copy-on-write, and the one rule behind it

Every mutating method opens with the same gate: **if this string is not the sole owner of the whole
buffer, clone first.** Three ways it can fail that test, and they collapse into one rule.

The bytes are a literal, so nobody owns them:

```echo
$s = '0123456789abcdef';
$s->append('!');

echo $s;                        // 0123456789abcdef!
echo mem::refs($s->owner); // 1
```

A second string names the same buffer:

```echo
$orig = '0123456789abcdef';
$orig = $orig->clone();

$copy = $orig;
echo mem::refs($orig->owner);  // 2

$orig->append('!');

echo $copy;     // 0123456789abcdef
echo $orig;     // 0123456789abcdef!
```

`$copy = $orig` was one retain. The `append` after it saw a count of two, cloned, and left `$copy` looking
at the original bytes. Two buffers now, each uniquely owned.

Or this string is a *sub-window* of a buffer it does own. The bytes ahead of it are not its to move:

```echo
$whole = '0123456789abcdef';
$whole = $whole->clone();

$part = $whole->sub(0, 3);
$part->append('!');

echo $part;     // abc!
echo $whole;    // 0123456789abcdef
```

A short substring of an inline string copies into its own store rather than sharing — the bytes live
inside the parent value, and a window into them would dangle when the parent is dropped.

And the case the gate exists to let through, a string that *is* the whole of a buffer it alone owns, which
mutates in place with no copy at all:

```echo
$solo = '0123456789abcdef';
$solo = $solo->clone();

$solo->append('g');

echo $solo;                         // 0123456789abcdefg
echo mem::refs($solo->owner);  // 1
```

## A substring shares its parent's bytes

`sub()` narrows the window and keeps the owner, so it is one more reference rather than one more
allocation:

```echo
$own = 'hello world, 16+';
$own = $own->clone();

echo mem::refs($own->owner);   // 1

$sub = $own->sub(6, 5);

echo $sub;                          // world
echo mem::refs($own->owner);   // 2
```

Taking a substring of a substring narrows again, still sharing. No bytes move at any point.

## string::view is the borrowed half

A `string::view` is two words, an address and a byte count, owning nothing. Every operation that only
*reads* text actually lives here, and `string` delegates to it.

A `string` converts to a view implicitly, so a function taking one just works:

```echo
function show(string::view $window) : void
{
    echo $window->size;
}

$owned = 'hello world';
show($owned);       // 11
show('hi');         // 2
```

That conversion is marked `#[implicit]` on the `view()` method and found by the mark, never by the name.
It costs no reference count, which is the entire reason `string::view` is a public type. And because a
declared conversion ranks below every built-in one, an overload taking `string` still wins outright:

```echo
function which(string::view $v) : void { echo 1; }
function which(string $s) : void { echo 2; }

$owned = 'hello';
which($owned);      // 2
```

Note the property, not a method: a view is two public words and hides nothing, so you write `$v->size`
rather than `$v->size()`. `string` has the method because its count lives one level down, in the window it
holds.

**A view keeps nothing alive.** Same rule as [slices](/collections/slices): it is valid only while
whatever owns the bytes is, and growing that buffer invalidates it.

## Building a string

`append`, `push` and `concat`, and `reserve` when you know roughly how much is coming:

```echo
$s = '';
$s->reserve(32);

$s->append('hello');
$s->append(', ');
$s->append('world');
$s->push(33);          // a byte, not a character

echo $s;                    // hello, world!
echo $s->size();            // 13
```

`reserve` is also how you say "I am about to write to this": it pays the copy-on-write clone once, at a
size you chose, so the appends after it do not reallocate.

`concat` leaves both operands alone and returns a third string:

```echo
$left = 'foo';
$right = 'bar';

echo $left->concat($right);     // foobar
echo $left;                     // foo
```

`clear()` keeps the allocation, so the string is immediately reusable:

```echo
$s = '';
$s->append('something');

$s->clear();
echo $s->size();        // 0

$s->append('again');
echo $s;                // again
```

Appending a string to itself is correct rather than a special case. The parameter is by value, so `$other`
holds a second reference, the gate sees a count of two and clones, and the source still names the old
untouched bytes:

```echo
$self = 'ab';
$self->append($self);

echo $self;     // abab
```

`data()` is the bytes with no terminator required. `cstr()` is that plus the assert that C can walk off
the end of a substring. A window that stops early is still a valid pointer and length:

```echo
$owned = 'hello';
$owned = $owned->clone();
$owned->append(' world');

$head = $owned->sub(0, 5);
echo $head->terminated();        // 0
echo $head->data() != null;         // 1
```

To let C write *into* a string, reserve, take `spare()`, then `commit` the count it wrote:

```echo
$s = '';
$s->reserve(8);

ptr<uint8> $p = $s->spare();
$p:$[0] = 65;
$p:$[1] = 66;
$s->commit(2);

echo $s;                // AB
echo $s->room();        // 6
```

`room()` is how many bytes `spare()` can accept without growing. Growing the buffer after `spare()`
invalidates the pointer. There is no mutable `data()`: a write into the middle of a shared or literal
buffer is the thing the copy-on-write gate exists to prevent.

## Reading a string

All of it byte-for-byte. No normalization, no case folding, no encoding validation. Case conversion
lives next door in [`str::upper`](/stdlib/str#upper--lower--ucfirst--lcfirst) and friends; the type
itself still compares and slices as bytes.

```echo
$a = 'hello world';

echo $a->starts('hello');  // 1
echo $a->ends('world');    // 1
echo $a->contains('lo w');      // 1
echo $a->equals('hello');       // 0
```

`find` answers with the haystack's **own size** when there is no match, which is the one value always
to hand that is never a valid index:

```echo
$a = 'hello world';

echo $a->find('world');     // 6
echo $a->find('zzz');       // 11
echo $a->size();                // 11
```

So the found offset feeds straight back into `sub` with no adjustment:

```echo
$a = 'hello world';

echo $a->sub($a->find('world'), 5);     // world
```

## size() and chars() are different questions

`size()` is bytes and is O(1). `chars()` walks the string counting UTF-8 codepoints. That the two
disagree is the point, not an oversight:

```echo
$ascii = 'hello';
$accent = "h\u{E9}llo";     // hello, with an e-acute

echo $ascii->size();        // 5
echo $ascii->chars();  // 5

echo $accent->size();       // 6
echo $accent->chars(); // 5
```

Five characters in six bytes. `\u{...}` takes a codepoint in hex, and is how you write a character your
editor would rather not show you.

Every index into a string is a **byte** index. `chars()` is a count, not a validator: invalid UTF-8 is
counted rather than rejected.

## == is a declared operator, not syntax

Comparing two strings is an ordinary operator declared in the standard library, and both operands are
borrows, so a comparison costs no reference count at all:

```echo
$a = 'hello';
$b = '';
$b->append('hello');

echo $a == $b;      // 1
echo $a == 'world'; // 0
echo $a != 'world'; // 1
```

Different buffers, one text, and `==` says so. A substring compares by text too, not by buffer identity:

```echo
$a = 'hello';
$big = 'xxhelloxx';

echo $big->sub(2, 5) == $a;     // 1
```

Why an operator rather than only `->equals()`? Because `==` is the one spelling that works for a **type
parameter**. A generic body comparing two `K`s writes `$a == $b`, and that has to resolve to a built-in
comparison when `K` is a primitive and to a declared operator when it is a struct. There is no `equals` on
`int32` to call instead. [Maps](/collections/maps) is what needs it.

There is no `+` for strings, and no ordering operators. Use `concat` and `equals`.

## Crossing into C

`cstr()` hands over a `ptr<const uint8>` and costs nothing: every buffer this library allocates has room
for one byte past its text and holds a `0` there, and the compiler emits every literal NUL-terminated too.
`data()` is the same pointer without the terminator requirement, which is what you want for a C API that
already has a length.

```echo
extern {
    function strlen as c_strlen(ptr<const uint8> $s) : usize;
}

$owned = 'hello';
$owned = $owned->clone();
$owned->append(' world');

echo $owned->terminated();       // 1
echo c_strlen($owned->cstr());     // 11
```

The catch is a substring that stops early. It is a window into the middle of a buffer, so the byte after it
is not a `0`, and `cstr()` asserts rather than running past the end:

```echo
$owned = 'hello world';

$head = $owned->sub(0, 5);
echo $head->terminated();    // 0

$safe = $head->clone();
echo $safe->terminated();    // 1
```

Cloning is how a substring becomes safe to hand over. [C interop](/projects/c-interop) has the rest.

## Interpolation

Building a string out of values needs no format function and no `append`. It is part of the literal:

```echo
$name = 'Ronon';
$age = 3;

echo "{$name} is {$age} years old.";        // Ronon is 3 years old.
```

That's interpolation. Format specs and how your own types join in come next.

Every `{$...}` is a hole, and what goes in one is an **expression**, not just a name:

```echo
struct Point
{
    int32 $x;
    int32 $y;
}

$p = Point(3, 4);
$xs = [10, 20, 30];

echo "sum {$p->x + $p->y}";     // sum 7
echo "second {$xs[1]}";         // second 20
```

### Double quotes interpolate, single quotes do not

This is the one place in Echo where the two quote characters mean different things, and it is the escape
hatch. If you want the braces to stay, use `'`:

```echo
$name = 'Ronon';

echo "{$name} interpolates";    // Ronon interpolates
echo '{$name} does not';        // {$name} does not
```

A hole opens on `{$` and on nothing else, so a lone brace is ordinary text and needs no escape:

```echo
echo "a { brace and a } brace";     // a { brace and a } brace
```

For the case that is left there is `\{`:

```echo
$name = 'Ronon';
echo "not a hole: \{$name}";        // not a hole: {$name}
```

One consequence of the `{$` rule: a hole has to *start* from a value, so `"{twice($n)}"` is text rather
than a call. Bind it first.

### Formats

`{$x:spec}` asks for a particular rendering. The spec is `[align][width][.precision][type]`, and every part
is optional:

```echo
$n = 42;
$pi = 3.14159265358979;

echo "|{$n:>8}|";       // |      42|
echo "|{$n:<8}|";       // |42      |
echo "|{$n:^8}|";       // |   42   |
echo "{$n:x}";          // 2a
echo "{$pi:.2f}";       // 3.14
echo "{$pi:.3e}";       // 3.142e+00
```

| part | means |
|---|---|
| `<` `>` `^` | left, right, centred. Absent means right for numbers, left for text |
| a number | a minimum width, **in bytes**. Wider text is never truncated |
| `.` and a number | decimals for `f` and `e`, significant digits for `g`, a maximum length for text |
| `d` `x` `X` `b` `o` | base ten, hex, upper hex, binary, octal |
| `f` `e` `g` | fixed, scientific, shortest |
| `s` | text |

### It is all `str::from`

There is no magic here, and that's the point. `"{$x}"` becomes `str::from($x)`, and `"{$x:.2f}"` becomes
`str::from($x, '.2f')`. So your own type joins in by declaring one function:

```echo
struct Point
{
    int32 $x;
    int32 $y;
}

namespace str;

public function from(const Point& $p) : string
{
    return "({$p->x}, {$p->y})";
}
```

after which `"{$p}"` works everywhere. [String functions](/stdlib/str) has the whole surface.

## Printing

`echo` takes exactly one value and appends a newline. Interpolation is how you get several values into that
one:

```echo
$name = 'Ronon';
$rolls = 3;

echo "{$name} rolled {$rolls} dice";
```

For the things `echo` cannot do (writing without a newline, writing to stderr, passing an output stream
around) there is [Input and Output](/stdlib/io/):

```echo
std::io::println('to stdout');
std::io::eprintln('to stderr');
std::io::print('no newline');
```

One difference: `echo` renders a float as `3.500000` and `str::from` renders it as `3.5`.
`echo` reaches printf's `%f` directly and always has; `str::from` uses the shortest form that reads well in
a sentence.

## Next

- [Maps](/collections/maps) for `string` as a key, which is what `==` and `hash::of` are for.
- [Slices](/collections/slices) for the same borrow-a-window idea over arbitrary elements.
- [Input and Output](/stdlib/io/) for writing text out and reading a line back.
- [String functions](/stdlib/str) for `str::from`, `split`, `join`, `trim` and the C string boundary.
- [C interop](/projects/c-interop) for what to do with a `ptr<const uint8>` once you have one.
