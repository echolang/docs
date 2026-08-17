# Arrays

**An `array<T>` is a growable, contiguous buffer of exactly one type.** It is not a hash map and it is not
heterogeneous. The brackets are just how you write one.

```echo
array<int32> $numbers = [1, 2, 3];
$numbers[] = 4;

echo $numbers->count();     // 4
echo $numbers[0];           // 1
```

Because arrays are objects, the things you know from a standard library live on the array itself:
`count()`, `push()`, `pop()`. The catch is how the buffer is grown and when a borrow into it dies.

## Four ways to make one

The constructor, with the element type written out:

```echo
array<int32> $numbers = array<int32>();
$numbers[] = 7;
echo $numbers->count();     // 1
```

A declaration with no initializer, which default-constructs and allocates nothing:

```echo
array<int32> $numbers;
$numbers[] = 7;
echo $numbers->count();     // 1
```

A literal, which takes its type from where it is going:

```echo
array<float64> $ratios = [0.5, 1.5];
echo $ratios[1];            // 1.500000
```

`const` works on that spelling too. The literal fills a mutable array and moves it into the name, so
`$c` is frozen from the moment it exists:

```echo
const $c = [1, 2];
const array<int32> $typed = [1, 2];

echo $c[0];                 // 1
echo $typed[0];             // 1
```

Or `arr::room`, when you already know how many elements are coming:

```echo
array<int32> $numbers = arr::room<int32>(64);

echo $numbers->count();     // 0
echo $numbers->capacity();  // 64
```

Note what is *not* on that list: there is no `array<int32>(5)`. A single number could mean "five slots" or
"one element", and I would rather not guess. `arr::room` says which one you meant.

## A literal takes its type from its destination

Write the type and the elements are checked against it:

```echo
array<int32> $mixed = [1, 2, "three"];
// error: Invalid type conversion: cannot assign 'string' to 'int32'
```

Leave the type out and the **first** element decides:

```echo
$names = ["Mario", "Ray", "Ronon"];         // array<string>
$numbers = [1, 2, 3];                       // array<int32>

echo $names[2];         // Ronon
echo $numbers->count(); // 3
```

An empty literal has nothing to go on, so it needs a destination that says:

```echo
$empty = [];
// error: an empty array literal has nothing to go on
```

```echo
array<int32> $empty = [];   // fine
echo $empty->count();       // 0
```

## The two brackets do different jobs

`$a[$i]` names an existing element. `$a[]` names the slot one past the end, so assigning to it appends:

```echo
array<int32> $numbers = [1, 2];

$numbers[] = 3;         // append
$numbers[0] = 99;       // overwrite

echo $numbers[0];       // 99
echo $numbers->count(); // 3
```

Both are ordinary declared operators, told apart by **arity alone**, and you can declare the same pair for
your own type. [Operators](/language/operators) has the mechanics.

Since `$a[]` names a slot that does not hold anything yet, reading it is refused rather than returning
garbage:

```echo
array<int32> $numbers = [1, 2];
echo $numbers[];
// error: names the slot after the last one, so there is nothing there to read
```

## The methods and the brackets are the same code

`push` is `$this[] = $value` and `at` is `&$this[$index]`. That's not a coincidence to remember, it is
literally how they are written, so the two spellings can never drift apart:

```echo
array<int32> $numbers = array<int32>();

$numbers->push(1);              // same as $numbers[] = 1

int32& $slot = $numbers->at(0); // same as &$numbers[0]
$slot = 5;

echo $numbers[0];               // 5
```

The full surface, off `stdlib/core/array.eco`:

<!-- verify: skip -->
```echo
const function count() : usize
const function capacity() : usize
const function empty() : bool

function reserve(usize $count) : void
function fit(usize $count) : void
function shrink() : void

function push(T $value) : void
function slot() : T&
function extend(const array<T>& $other) : void
function extend(usize $start, usize $count) : void

function pop() : T
function remove(usize $index) : T
function pluck(usize $index) : T
function truncate(usize $count) : void
function clear() : void

const function get(usize $index) : T
function at(usize $index) : T&
const function at(usize $index) : const T&

function sub() : slice<T>
function sub(usize $from, usize $count) : slice<T>
const function clone() : array<T>
```

Every index is a `usize`, and every one of them is bounds-checked with `assert`. `echoc build` drops those
checks, which is the same bargain C's `assert` makes. See [Errors and panics](/language/errors-and-panics).

## Growth is doubling, with a floor

`reserve` doubles the capacity, and doubling from zero is zero, so the first allocation gets a floor
instead. The floor depends on the element size, because the smaller the element the more of them fit in the
smallest block an allocator hands out at all:

```echo
array<usize> $words;
array<uint8> $bytes;

$words[] = 1;
$bytes[] = 1;

echo $words->capacity();    // 4
echo $bytes->capacity();    // 8
```

A request *above* the floor is honoured exactly, which is what keeps `reserve`'s promise that calling it up
front is the one allocation for the whole loop:

```echo
array<usize> $big;
$big->reserve(1000);
echo $big->capacity();      // 1000
```

`fit` skips both the doubling and the floor, for when you want a small buffer sized to the byte:

```echo
array<usize> $tight;
$tight->fit(3);
echo $tight->capacity();    // 3
```

## Growth invalidates every borrow into the array

This is the rule that bites, and nothing enforces it. There is no borrow checker. When an array grows it
may move its buffer, and every `slice<T>` and every `&$a[$i]` you were holding points at the old one:

<!-- verify: skip -->
```echo
int32& $first = $a->at(0);

$a[] = 999;         // may reallocate

$first = 1;         // the borrow may now point at freed memory
```

Reserve up front and the problem goes away, because there is no reallocation left to trip over.
[Pointers and references](/memory/pointers) covers what a borrow is and how long it is good for.

## slot appends without building a value first

Sometimes you want to write into the new element rather than construct one and copy it in. `slot()`
hands back a borrow of the fresh slot, and `&$a[]` is the same thing spelled with brackets:

```echo
struct Point
{
    int32 $x;
    int32 $y;
}

array<Point> $points = array<Point>();

Point& $slot = &$points[];
$slot->x = 1;

$points->slot()->y = 2;

echo $points->count();      // 2
echo $points[0]->x;         // 1
echo $points[1]->y;         // 2
```

Neither form *reads* the slot, which is why both are legal where `echo $a[]` is not.

## An array owns its elements

If `T` owns something, the array owns it too, and it ends when the array does:

```echo
{
    array<string> $words = [];

    $words[] = '';
    $words[0]->append('hello');

    echo $words[0];             // hello
}   // the buffer and the string are both freed right here
```

Copying an array copies the elements. For a `string` that means one more reference to the same buffer, not
a duplicated allocation:

```echo
array<int32> $a = [1, 2, 3];
array<int32> $b = $a;

$b[0] = 99;

echo $a[0];     // 1
echo $b[0];     // 99
```

`$b = $a` and `$a->clone()` are the same copy, one inferred and one said out loud. If you want to hand the
buffer over instead of duplicating it, that's a move:

```echo
array<int32> $a = [1, 2, 3];
array<int32> $b = mv $a;

echo $b->count();   // 3
```

[Ownership and moving](/memory/ownership) is the full story.

## The removal methods are not interchangeable

`pop()` **hands the element over** rather than copying it. The array stops owning it at the same moment
the caller starts:

```echo
array<string> $words = [];
$words[] = '';
$words[0]->append('popped');

string $out = $words->pop();

echo $out;              // popped
echo $words->count();   // 0
```

`remove($i)` keeps the order and shifts everything after it down. `pluck($i)` does **not** keep the
order: it relocates the last element into the hole, which is why it is the cheap one:

```echo
array<string> $letters = [];
$letters[] = 'x';
$letters[] = 'y';
$letters[] = 'z';

echo $letters->pluck(0);  // x
echo $letters[0];               // z
echo $letters->count();         // 2
```

`truncate($n)` drops everything past `$n`, destroying what it drops. `clear()` is `truncate(0)`: the
elements go, the buffer stays, and the array is immediately usable again. That's the reason to clear
rather than reassign.

```echo
array<int32> $numbers = [1, 2, 3, 4];

$numbers->truncate(2);
echo $numbers->count();     // 2

$numbers->clear();
echo $numbers->count();     // 0
echo $numbers->capacity();  // 4
```

## An array cannot extend itself

`extend` borrows its source and writes into its receiver, and those two accesses cannot name one array:

```echo
array<int32> $a = [1, 2];
$a->extend($a);
// error: This names the same storage as another argument of the same call
```

Say which range you meant instead, and it is unambiguous:

```echo
array<int32> $a = [1, 2, 3];

$a->extend(0, $a->count());     // double it

echo $a->count();   // 6
echo $a[3];         // 1
```

For two different arrays, `extend` is fine, and `arr::merge` is the version that builds a third:

```echo
array<int32> $a = [1, 2, 3];
array<int32> $b = [4, 5];

array<int32> $merged = arr::merge($a, $b);

echo $merged->count();      // 5
echo $merged->capacity();   // 5
echo $a->count();           // 3
```

`merge` reserves the total up front, so the whole result is one allocation, and both inputs are `const`
borrows so neither is consumed.

## An element is a destination like any other

Writing into an element destroys what was there and stores the new value, exactly as writing into a
field does. `$at` is not evaluated twice:

```echo
array<string> $rows = array<string>();
$rows->push('first');

usize $at = 0;
$rows[$at] = 'replaced';

echo $rows[0];      // replaced
```

A literal written into an element is checked against the element type, exactly as one written into a
declaration is. A value that does not survive the trip is refused rather than truncated:

```echo
array<int32> $ints = [];
$ints[] = 2.5;
// error: The floating point number literal '2.5' cannot be implicitly converted to an integer type
//        due to non zero decimal values.
```

One that converts exactly still converts, and says nothing, because nothing was lost:

```echo
array<int64> $wide = [1, 2.0];

echo $wide[0];      // 1
echo $wide[1];      // 2
```

The same goes for a literal inside the brackets, since `[1, 2.5]` is those appends written another way.
Note that the element type comes from the **first** element, so `[2.5, 1]` is an `array<float64>` holding
`2.5` and `1.0`. That ordering rule is deliberate.

## One thing that compiles and is wrong

It is real, it is silent, and it is on [the list](/reference/limitations).

**An array literal inside a field-wise constructor loses its elements.** `Bag([7, 9])` and then reading it
back is a use-after-destruction at every optimization level, with no diagnostic. Build the array first and
pass it in.

## Next

- [Slices](/collections/slices) for handing out a window onto an array without copying it.
- [Iteration](/collections/iteration) for `foreach`, and for the copy it does not make you pay for.
- [`arr::merge` and `arr::room`](/stdlib/arr), which do not belong on the type.
- [Ownership and moving](/memory/ownership) for what happens when `T` owns something.
