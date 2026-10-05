---
description: 'Vectors. A type, lane-wise operators, and a handful of verbs in simd::.'
---

# SIMD

A loop over sixteen bytes is sixteen loads. A vector is one instruction. Echo gives you that as a
type, not as a library struct that happens to be the right size.

`simd<T, N>` is N lanes of one primitive, packed. The operators you already know run lane by lane.
The verbs that are not operators live in `simd::`, so `simd` itself stays a type name you can write.

## What this is

A lane is an integer, a float, or a `bool`. N is a power of two, at least 2. The whole vector is at
most 16 bytes.

```echo
simd<int32, 4> $a = simd::splat<int32, 4>(1);
simd<int32, 4> $b = simd::splat<int32, 4>(2);
simd<int32, 4> $c = $a + $b;

echo simd::all($c == simd::splat<int32, 4>(3));    // 1
```

Every lane of `$c` is 3. `all` reduces the mask to a `bool`. That is the whole of the happy path.

## Operators, lane by lane

Integer lanes do `+ - * & | ^` and the six comparisons. Float lanes do `+ - * /` and the
comparisons. Bool lanes do `& | ^ == !=`. Unary `-` and `~` follow the same split. `!` flips a
mask.

A shift takes a **scalar** count. The count is splatted for you. Two vectors on a shift will not
compile.

Integer `/` `%` `**` will not compile either. Neither will `&&` and `||`: those short-circuit on a
`bool`, and a mask is not one.

There is no implicit broadcast. `$v + 1` is a diagnostic. Write `simd::splat`.

<!-- verify: skip -->
```echo
simd<int32, 4> $v = simd::splat<int32, 4>(1);
simd<int32, 4> $w = $v + 1;
// error: cannot apply '+' to 'simd<int32, 4>' and 'int32' - there is no implicit broadcast; write simd::splat
```

## A comparison is a mask

This is the one that bites.

```echo
simd<uint8, 16> $a = simd::splat<uint8, 16>(1 as uint8);
simd<uint8, 16> $b = simd::splat<uint8, 16>(1 as uint8);

echo simd::any($a == $b);    // 1, some lane matched
echo simd::all($a == $b);    // 1, every lane matched
```

`$a == $b` is a `simd<bool, 16>`, not a `bool`. `if ($a == $b)` will not compile. The condition has
to be a `bool`, and a vector comparison is a mask. `simd::any` and `simd::all` are the reductions.

`select` is the branch you actually wanted: lane-wise `mask ? a : b`. A vector min is one line:

```echo
simd<int32, 4> $a = simd::splat<int32, 4>(3);
simd<int32, 4> $b = simd::splat<int32, 4>(1);
simd<int32, 4> $lo = simd::select($a < $b, $a, $b);

echo simd::all($lo == $b);    // 1
```

## The verbs

`namespace simd` in the standard library. You do not implement these.

| Verb | What it does |
|---|---|
| `splat<T, N>(T)` | every lane is this value |
| `load<T, N>(ptr<const T>)` | N consecutive `T` at element alignment |
| `store<T, N>(ptr<T>, simd<T, N>)` | the reverse |
| `select<T, N>(mask, a, b)` | lane-wise `mask ? a : b` |
| `bitmask<N>(simd<bool, N>)` | bit i is lane i, as a `uint64` |
| `from_array` / `to_array` | convert to and from `T[N]` |
| `any` / `all` | reduce a mask to a `bool` |

Load and store go through a `ptr<T>` on purpose. Alignment is the element's, so a packed
`ptr<uint8>` never becomes a faulting vector load.

```echo
ptr<uint8> $p = mem::alloc<uint8>(16);
simd<uint8, 16> $v = simd::splat<uint8, 16>(0x80 as uint8);
simd::store<uint8, 16>($p, $v);

simd<uint8, 16> $loaded = simd::load<uint8, 16>($p);
echo simd::bitmask($loaded == $v);    // 65535, every lane matched

mem::free($p);
```

Bit 0 of the mask is lane 0. Sixteen matching lanes is `65535`.

`from_array` and `to_array` are explicit. `T[N]` is N slots you index. `simd<T, N>` is N lanes in
one value. They are not the same type, and a silent conversion between them would be the wrong
kind of convenient.

## What is not here yet

No `$v[i]`. A lane is not a place. No implicit splat of a scalar beside a vector. No widths past
16 bytes. A vector by value is refused on an `extern` signature, because the calling convention
differs per platform. Pass a `ptr<simd<T, N>>`.

Bit scans live in `bits::`: `trailing_zeros`, `leading_zeros`, `count_ones`.

## Next

- [Types](/language/types) for where `simd<T, N>` sits next to `ptr<T>` and `T[N]`.
- [Expressions](/language/expressions) for the built-in operators these run lane-wise.
- [Pointers and references](/memory/pointers) for the `ptr<T>` load and store take.
- [Limitations](/reference/limitations) for the refused shapes in one list.
