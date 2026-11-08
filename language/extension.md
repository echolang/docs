# Extension

[`#[implicit]`](/reference/attributes#implicit) is how a type you wrote says it can stand in for another one. Easy, when both types are yours.

The catch is the type you want to convert *from* often isn't. `int32` is not yours. A library's `Low` error enum is not yours. You still want `put(7)` to construct your `Quantity`.

**`extension Type { ... }` is `#[implicit]` on a type you do not own.**

```echo
struct Quantity
{
    int64 $n;
}

extension Quantity
{
    #[implicit]
    public static function from(int32 $n) : Quantity
    {
        return Quantity($n);
    }
}

function put(Quantity $q) : void
{
    echo $q->n;
}

put(7);                         // 7
echo Quantity::from(7)->n;      // 7
```

Same conversion as if `from` had been written inside `Quantity`. The block is how you attach it after the fact. You can still call it by name.

`extension` is not reserved. A case can be named `extension`. The word is only recognised at file or namespace scope, in front of a type and a `{`.

## Outbound

A `const` method on the source, converting *to* a type that source does not own:

```echo
struct Window { usize $n; }
struct Buffer { usize $n; }

extension Buffer
{
    #[implicit]
    public const function window() : Window
    {
        return Window($this->n);
    }
}

function show(Window $w) : void
{
    echo $w->n;
}

show(Buffer(7));                    // 7
echo Buffer(7)->window()->n;        // 7
```

`window()` is a real method. The attribute is what makes `show(Buffer(7))` compile without writing it.

## With try

This is the pairing [`try`](/language/try) is for. The inner function failed as `Low`. The outer one speaks `High`. The extension is the dictionary:

```echo
enum Low
{
    case gone;
}

enum High
{
    case notFound(string $what);
}

extension High
{
    #[implicit]
    public static function from(Low $e) : High
    {
        return .notFound('the record');
    }
}

function low() : result<int32, Low>
{
    return .error(.gone);
}

function high() : result<int32, High>
{
    int32 $v = try low();
    return .ok($v);
}

string $msg = match (high()->failure()) {
    .notFound($what) => $what,
};
echo $msg;                          // the record
```

## Same conversion

The block does not invent a second kind of conversion. Rank, uniqueness, `as`, borrows: all the same rules. [Attributes](/reference/attributes#implicit) owns those.

A pair has one conversion, in the whole program. There is no orphan rule. Two modules both converting `Low` to `High` is a compile error, not a silent pick. I want that. The alternative is the call site depending on which library happened to be parsed first.

An overload that already takes the source type still wins:

```echo
struct Low { int32 $n; }
struct High { int32 $n; }

function f(Low $l) : int32 { return $l->n; }
function f(High $h) : int32 { return $h->n + 100; }

extension High
{
    #[implicit]
    public static function from(Low $l) : High
    {
        return High($l->n);
    }
}

echo f(Low(3));     // 3
```

`f(Low)` is exact. Exact beats a conversion.

Two different sources onto one destination are fine. A chain is not: `A` to `B` and `B` to `C` does not make `A` convert to `C`. Write the pair you mean.

```echo
struct A { int32 $n; }
struct B { int32 $n; }
struct C { int32 $n; }

extension B
{
    #[implicit]
    public static function from(A $a) : B { return B($a->n); }

    #[implicit]
    public static function from(C $c) : B { return B($c->n); }
}

function show(B $b) : void
{
    echo $b->n;
}

show(A(1));     // 1
show(C(2));     // 2
```

## Visibility

The member's own word is the visibility. `public` exports it. The default is this module. `private` is this file.

Attribute first, then visibility, then the function. `public #[implicit]` is refused. So is `#[implicit]` on the block itself: the block is not a declaration, the conversion inside is.

An extension is not inside the type. Private fields stay private. Go through a method the type actually wrote.

## Only conversions

A plain method, a constructor, a property: declare those on the type.

<!-- verify: skip -->
```echo
struct Buffer { usize $n; }

extension Buffer
{
    public function describe() : string
    {
        return 'buffer';
    }
}
// error: an 'extension' block holds conversions, and this is a method
```

It names a struct, a class, or an enum. Not a primitive, not an interface, not an `extern struct`, not a generic.

## Next

- [Attributes](/reference/attributes#implicit) for the conversion itself.
- [Try](/language/try) for passing a converted failure up.
- [Casts](/language/casts) for `$x as T`, which finds the same conversion.
- [Visibility](/language/visibility) for `public` / `internal` / `private`.
