# Strings

Text is three types, and the split between them is the whole design: `string` **owns** its bytes,
`string::view` **borrows** them, and `str::buf` is the reference-counted buffer underneath that you almost
never name. The consequence you feel every day: **copying a string is a reference count bump, not a
memcpy.**

```echo
$greeting = 'hello';

echo $greeting;             // hello
echo $greeting->size();     // 5
```

That is a whole program, and it allocates nothing at all. Here is why.

## A literal is a string, and it costs nothing

`'hello'` is not a separate type that converts to a `string`. It *is* a `string`, lowered to static bytes
in the binary, a byte count, and a null owner. No allocation, no reference count touched:

```echo
$name = 'ray';

echo $name->size();         // 3
echo $name->is_empty();     // 0
echo $name->byte_at(0);     // 114
```

A null owner owns nothing, which is exactly why the first write to a literal has to clone rather than
scribble on the program's own image. That is the next section.

## Copy-on-write, and the one rule behind it

Every mutating method opens with the same gate: **if this string is not the sole owner of the whole
buffer, clone first.** Three ways it can fail that test, and they collapse into one rule.

The bytes are a literal, so nobody owns them:

```echo
$s = 'ab';
$s->append('cd');

echo $s;                        // abcd
echo mem::ref_count($s->owner); // 1
```

A second string names the same buffer:

```echo
$orig = 'one';
$orig->append('two');

$copy = $orig;
echo mem::ref_count($orig->owner);  // 2

$orig->append('three');

echo $copy;     // onetwo
echo $orig;     // onetwothree
```

`$copy = $orig` was one retain. The `append` after it saw a count of two, cloned, and left `$copy` looking
at the original bytes. Two buffers now, each uniquely owned.

Or this string is a *sub-window* of a buffer it does own. The bytes ahead of it are not its to move:

```echo
$whole = 'abcdef';
$whole = $whole->clone();

$part = $whole->sub(0, 3);
$part->append('!');

echo $part;     // abc!
echo $whole;    // abcdef
```

And the case the gate exists to let through, a string that *is* the whole of a buffer it alone owns, which
mutates in place with no copy at all:

```echo
$solo = 'abc';
$solo = $solo->clone();

$solo->append('d');

echo $solo;                         // abcd
echo mem::ref_count($solo->owner);  // 1
```

## A substring shares its parent's bytes

`sub()` narrows the window and keeps the owner, so it is one more reference rather than one more
allocation:

```echo
$own = 'hello world';
$own = $own->clone();

echo mem::ref_count($own->owner);   // 1

$sub = $own->sub(6, 5);

echo $sub;                          // world
echo mem::ref_count($own->owner);   // 2
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

`append`, `push_byte` and `concat`, and `reserve` when you know roughly how much is coming:

```echo
$s = '';
$s->reserve(32);

$s->append('hello');
$s->append(', ');
$s->append('world');
$s->push_byte(33);          // a byte, not a character

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

## Reading a string

All of it byte-for-byte. No normalization, no case folding, no encoding validation:

```echo
$a = 'hello world';

echo $a->starts_with('hello');  // 1
echo $a->ends_with('world');    // 1
echo $a->contains('lo w');      // 1
echo $a->equals('hello');       // 0
```

`index_of` answers with the haystack's **own size** when there is no match, which is the one value always
to hand that is never a valid index:

```echo
$a = 'hello world';

echo $a->index_of('world');     // 6
echo $a->index_of('zzz');       // 11
echo $a->size();                // 11
```

So the found offset feeds straight back into `sub` with no adjustment:

```echo
$a = 'hello world';

echo $a->sub($a->index_of('world'), 5);     // world
```

## size() and char_count() are different questions

`size()` is bytes and is O(1). `char_count()` walks the string counting UTF-8 codepoints. That the two
disagree is the point, not an oversight:

```echo
$ascii = 'hello';
$accent = "h\u{E9}llo";     // hello, with an e-acute

echo $ascii->size();        // 5
echo $ascii->char_count();  // 5

echo $accent->size();       // 6
echo $accent->char_count(); // 5
```

Five characters in six bytes. `\u{...}` takes a codepoint in hex, and is how you write a character your
editor would rather not show you.

Every index into a string is a **byte** index. `char_count()` is a count, not a validator: invalid UTF-8 is
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

`c_str()` hands over a `ptr<const uint8>` and costs nothing: every buffer this library allocates has room
for one byte past its text and holds a `0` there, and the compiler emits every literal NUL-terminated too.

```echo
extern {
    function strlen as c_strlen(ptr<const uint8> $s) : usize;
}

$owned = 'hello';
$owned = $owned->clone();
$owned->append(' world');

echo $owned->is_terminated();       // 1
echo c_strlen($owned->c_str());     // 11
```

The catch is a substring that stops early. It is a window into the middle of a buffer, so the byte after it
is not a `0`, and `c_str()` asserts rather than running past the end:

```echo
$owned = 'hello world';

$head = $owned->sub(0, 5);
echo $head->is_terminated();    // 0

$safe = $head->clone();
echo $safe->is_terminated();    // 1
```

Cloning is how a substring becomes safe to hand over. [C interop](/projects/c-interop) has the rest.

## Two things that are missing

Stated here because they will be the first two you reach for.

**There is no string formatting at all.** No `printf`, no `sprintf`, no interpolation, no `str::fmt`.
Building a string means `append`. This needs variadics first.

**`string?` does not work.** Declaring a nullable string is rejected with a message about `->` not reaching
through it. Other nullable types are fine, including `string::view?`. Both are on
[the list](/reference/limitations).

## Next

- [Maps](/collections/maps) for `string` as a key, which is what `==` and `hash::of` are for.
- [Slices](/collections/slices) for the same borrow-a-window idea over arbitrary elements.
- [C interop](/projects/c-interop) for what to do with a `ptr<const uint8>` once you have one.
