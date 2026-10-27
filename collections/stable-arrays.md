# Stable arrays

You append to an [`array<T>`](/collections/arrays), and every `T&` you were holding is trash. The
buffer moved. That is the contract `array` actually gives you, and it is the right one when you
wanted one contiguous region.

Sometimes you wanted the other thing: grow, but keep the seats. A tree of cells. A tape of
operators that point at earlier operators. You take `ptr<T>` into a slot, you append some more, and
that pointer still names the same element.

**A `stable_array<T>` is a growable, owning sequence whose live slots never move.** You append. You
index. You iterate. When it is gone, every element is gone.

```echo
stable_array<int32> $tape;
$tape[] = 7;

ptr<int32> $first = &$tape[0];

usize $i = 0;
while ($i < 64) {
    $tape[] = 1;
    $i = $i + 1;
}

echo $first;            // 7
$first = 9;
echo $tape[0];          // 9
```

Growth took another block and left the old one alone. `$first` is still the first slot.

Reach for `array` by default. Reach for this when you are going to store a `T&` or a `ptr<T>` into
an element and then keep appending.

| Type | Grows | Live slots move |
|---|---|---|
| [`fixed_array<T, N>`](/collections/fixed-arrays) | no | no (`N` is the type) |
| [`array<T>`](/collections/arrays) | yes | yes |
| `stable_array<T>` | yes | no |

It is not a pool. A hole in the middle is never reused. `pop` and `clear` only back the bump up, so
the next append may land on an address that was live before. Pointers into a popped or truncated
slot are dangling.

It is also not a drop-in for `array` when you needed one region. There is no `data()`, no `sub()`,
no C spare, and no `sort()`. Those all want contiguous bytes. No `remove` or insert in the middle
either: those would slide live slots.

## Append is a place

`$a[] = $v` and `push` do the same thing. `slot()` and `&$a[]` hand back the new element so you can
fill it in place, and that place stays valid across later appends:

```echo
struct Cell
{
    int32 $tag;
    int32 $value;
}

stable_array<Cell> $tape;
Cell& $s = $tape->slot();
$s->tag = 1;
$s->value = 42;

$tape[] = Cell(2, 7);
echo $s->value;         // 42
```

A method returning `T&` is not a place, so `&$a->slot()` is refused. Bind the slot, or take
`&$a[]`. Both survive growth.

A destination-typed literal fills through that same append:

```echo
stable_array<int32> $a = [1, 2, 3];
echo $a->count();       // 3
echo $a[1];             // 2
```

Leave the type off and `[1, 2, 3]` is still an `array<int32>`. Write the type when you want this
one.

`reserve` may append a large last block rather than a ladder of small ones. Existing slots still
do not move. `capacity()` is the sum of every block. `shrink()` drops trailing empty blocks after
a `clear` or a run of `pop`s. It does not compact live slots. Compacting would move bytes.

`$b = $a` is a deep copy, like `array`. New blocks, new addresses. `extend` copies from an
`array<T>` or from another `stable_array<T>`. The source is untouched.

## Iteration

`foreach` has no idea what a `stable_array` is. The type conforms to `contract::iterable<T>` and
hands back a cursor that walks the blocks:

```echo
stable_array<int32> $a = [10, 20, 30];

int32 $sum = 0;
foreach ($a as $i => const &$n) {
    $sum = $sum + $n;
}
echo $sum;              // 60
```

Appending during the loop does not move slots the cursor already named. It also does not make the
new slots appear in that walk: the cursor snapshots `count()` when you asked for it.

`pop` from empty, and `$a[i]` past the end, are `assert`. A debug `echoc run` stops. `echoc build`
drops the check.

## Next

- [Arrays](/collections/arrays) for the contiguous default, and for `data()` / `spare()` / `sort()`.
- [Fixed arrays](/collections/fixed-arrays) when the length is part of the type.
- [Pointers and references](/memory/pointers) for `T&` and `ptr<T>`, and for the growth rule this type opts out of.
- [Iteration](/collections/iteration) for `foreach` and the copy it does not make you pay for.
