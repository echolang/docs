# Slices

A `slice<T>` is **two words: an address and an element count.** It owns nothing, copies for free, and keeps
nothing alive. It is a window onto elements somebody else is responsible for.

```echo
array<int32> $numbers = [1, 2, 3, 4, 5];

slice<int32> $window = $numbers->sub(1, 3);

echo $window->count();      // 3
echo $window[0];            // 2
```

That is the whole type. What makes it worth a page is the rule attached to it: a slice does not keep its
array alive, and nothing in the compiler checks that you noticed.

## Take one with sub()

`sub()` with no arguments is the whole array. `sub($from, $count)` is a window into it:

```echo
array<int32> $numbers = [1, 2, 3, 4, 5];

slice<int32> $whole = $numbers->sub();
slice<int32> $tail = $numbers->sub(2, 2);

echo $whole->count();   // 5
echo $tail->count();    // 2
echo $tail[0];          // 3
```

An array does **not** decay to a slice on its own. `->sub()` is written out, always, so a call taking a
slice never quietly changes what you passed it.

You can narrow a slice again, and the result is still a window onto the original array:

```echo
array<int32> $numbers = [1, 2, 3, 4, 5];

slice<int32> $whole = $numbers->sub();
slice<int32> $middle = $whole->sub(1, 2);

echo $middle[0];        // 2
echo $middle->count();  // 2
```

One asymmetry worth knowing: `slice<T>` has no zero-argument `sub()`. An array has one because "all of it"
is a useful thing to ask an owner for. A slice already is a window, so narrowing it always says how far.

## A slice shares storage, so writes go both ways

This is the point of the type, not a caveat:

```echo
array<int32> $numbers = [1, 2, 3];

slice<int32> $tail = $numbers->sub(2, 1);
$tail[0] = 30;

echo $numbers[2];   // 30
```

There is no copy anywhere in that program. The slice named the array's own storage and wrote into it.

## The surface

<!-- verify: skip -->
```echo
const function count() : usize
const function is_empty() : bool

const function get(usize $index) : T
function at(usize $index) : T&
const function at(usize $index) : const T&

function sub(usize $from, usize $count) : slice<T>
const function sub(usize $from, usize $count) : slice<const T>
```

Plus the two index operators, `$s[$i]` for a mutable slice and a `const` overload beside it. Indices are
`usize` and bounds-checked with `assert`, exactly as on an array.

There is deliberately **no** append. `$s[] = 2` is an error, because a slice owns no storage and therefore
has nothing to grow:

```echo
array<int32> $numbers = [1];
slice<int32> $window = $numbers->sub();

$window[] = 2;
// error: no overload of operator '[]' accepts a 'slice<int32>'
```

If you want to append, go back to the array.

## A slice is copied by copying two words

`slice<T>` declares no constructor, no destructor and no copy constructor, and that is the design rather
than an omission. It owns nothing, so a shallow copy is the *correct* copy:

```echo
array<int32> $numbers = [1, 2, 3];

slice<int32> $a = $numbers->sub();
slice<int32> $b = $a;       // two words duplicated, same elements

$b[0] = 9;
echo $a[0];                 // 9
```

Passing one to a function costs the same nothing. No reference count, no allocation, no destructor at the
other end.

## The const goes inside the angle brackets

`slice<const T>` and `const slice<T>` are different types, and the difference is which thing is read-only.

`slice<const T>` promises **the elements** will not be written. That is what a const array hands you,
because it has no writable elements to give:

```echo
array<int32> $source = [1, 2, 3];
const $frozen = $source;

slice<const int32> $window = $frozen->sub();

echo $window[0];    // 1
echo $window->count();  // 3
```

`const slice<T>` promises **the window** will not be re-seated. The elements behind it are still writable
through anything else that names them.

The reason the `const` lives inside the brackets is that it is part of the type's identity, and inference
keeps it. A generic written over `slice<T>` therefore instantiates twice, once with `T = const int32` and
once with `T = int32`:

```echo
function count_of<T>(slice<T> $window) : usize
{
    usize $n = 0;

    foreach ($window as $ignored) {
        $n = $n + 1;
    }

    return $n;
}

array<int32> $source = [1, 2, 3];
const $frozen = $source;

echo count_of($frozen->sub());  // 3
echo count_of($source->sub());  // 3
```

One function, written once, taking both. [Generics](/language/generics) covers what that costs at compile
time.

## Take a slice, not a const array borrow

This is the signature advice the type exists for. A function that only reads elements should not care who
owns them:

```echo
function total(slice<int32>& $window) : int32
{
    int32 $sum = 0;
    usize $i = 0;

    while ($i < $window->count()) {
        $sum = $sum + $window[$i];
        $i = $i + 1;
    }

    return $sum;
}

array<int32> $numbers = [1, 2, 3, 4, 5];

slice<int32> $whole = $numbers->sub();
slice<int32> $tail = $numbers->sub(3, 2);

echo total(&$whole);    // 15
echo total(&$tail);     // 9
```

Written as `const array<int32>&` instead, that second call is impossible: there is no array holding just
the last two elements, and making one means copying them. The slice version takes a window as happily as it
takes a whole array.

## A slice does not keep its array alive

Here is the catch, and it is a real one: **nothing enforces the lifetime rule.** Echo has no borrow
checker. A slice is a raw address and a count, and the compiler will not stop you from outliving what it
points at.

Two ways to get this wrong. The array is destroyed:

<!-- verify: skip -->
```echo
slice<int32> $window;

{
    array<int32> $numbers = [1, 2, 3];
    $window = $numbers->sub();
}   // the buffer is freed here

echo $window[0];    // reads freed memory. no diagnostic
```

Or the array simply grows, which moves the buffer and is just as fatal:

<!-- verify: skip -->
```echo
array<int32> $numbers = [1, 2];
slice<int32> $window = $numbers->sub();

$numbers[] = 3;     // may reallocate

echo $window[0];    // may read the old buffer
```

The rule is one sentence: **a slice must not outlive the array it came from, and growing that array ends
it.** `reserve` up front is how you make the second case impossible, and keeping slices as locals and
parameters rather than storing them in structs is how you avoid the first.

I would rather have this checked than documented, and that is on [the list](/reference/limitations). Until
then it is a rule you keep, not one you are held to. [Pointers and references](/memory/pointers) has the
same discussion for the rest of the borrowing machinery.

## Next

- [Arrays](/collections/arrays) for the owning side, and for what makes a buffer move.
- [Iteration](/collections/iteration) for looping over a slice, including a const one.
- [Pointers and references](/memory/pointers) for what a borrow is and how far it reaches.
