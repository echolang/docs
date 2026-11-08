# Try

A function that returns [`result<T, E>`](/stdlib/result) ends up writing this else arm on every call:

```echo
function parse(int32 $n) : result<int32, string>
{
    if ($n < 0) {
        return .error('negative');
    }

    return .ok($n * 2);
}

function twice(int32 $n) : result<int32, string>
{
    int32 $v = guard parse($n) else ($e) {
        return .error($e);
    }

    return .ok($v * 2);
}

echo twice(21)->or(-1);     // 84
```

That arm is always the same sentence. **`try` is that sentence.**

```echo
function parse(int32 $n) : result<int32, string>
{
    if ($n < 0) {
        return .error('negative');
    }

    return .ok($n * 2);
}

function twice(int32 $n) : result<int32, string>
{
    int32 $v = try parse($n);
    return .ok($v * 2);
}

echo twice(21)->or(-1);     // 84
echo twice(-3)->or(-1);     // -1
```

`$v` is a plain `int32` after that line. The failure left as `.error($e)` from `twice`.

If you are coming from PHP: this is not `try` / `catch`. There are still no exceptions. Echo's `try` is a [`guard`](/memory/nullability) that plants `return .error($e)`.

## No binding

The value is not always the point. Drop it:

```echo
function check(int32 $n) : status<int32>
{
    if ($n < 0) {
        return .error($n);
    }

    return .ok;
}

function run() : status<int32>
{
    try check(1);
    try check(-4);
    return .ok;
}

echo run()->failure();      // -4
```

[`status<E>`](/stdlib/status) is the same idea when success has no `T`. Statement `try` is the form.

## The return type

`try` returns `.error($e)` from the function you are in. That function has to be able to say that. A plain `int32` cannot. Neither can a constructor, or file-scope code.

<!-- verify: skip -->
```echo
function load() : result<int32, string>
{
    return .error('gone');
}

function f() : int32
{
    int32 $v = try load();
    return $v;
}
// error: 'try' returns the failure from 'load', and 'int32' cannot carry one
```

Handle those with `guard`. The types that work are [`result<T, E>`](/stdlib/result), [`status<E>`](/stdlib/status), or an enum of yours with an `error` case.

## Failures convert

The inner `E` does not have to be the outer `E`. If `High` converts from `Low`, `try` plants that conversion:

```echo
enum Low
{
    case gone;
}

enum High
{
    case notFound(string $what);

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
echo $msg;                  // the record
```

The conversion is an ordinary [`#[implicit]`](/reference/attributes#implicit). Write it on `High`, or in an [`extension High`](/language/extension) block if you do not own `High`. No conversion, and the compiler says so rather than guessing.

## What it is not

`try { ... }` does not parse. Echo has no try-blocks, no catch, no finally. Handle a failure *here* with `guard`. `try` only passes it up.

<!-- verify: skip -->
```echo
function f() : result<int32, string>
{
    try {
        return .ok(1);
    }
}
// error: Echo has no try blocks
```

It is not an expression either. `return .ok(try parse(1))` is refused. Declare the value, then use it.

A `T?` has no failure to pass up. Absence is not a reason. `guard` it, or use `??` / `?->`.

<!-- verify: skip -->
```echo
function f() : result<int32, string>
{
    int32? $maybe = null;
    int32 $n = try $maybe;
    return .ok($n);
}
// error: 'try' passes a failure up, and 'int32?' carries none
```

A `try` inside a closure returns from the closure, not from the function that created it. Same rule as `return`. The closure's own return type is what has to carry the failure.

```echo
function parse(int32 $n) : result<int32, string>
{
    if ($n < 0) {
        return .error('negative');
    }

    return .ok($n);
}

function<result<int32, string>(int32)> $inner = function(int32 $n) : result<int32, string> {
    int32 $v = try parse($n);
    return .ok($v + 1);
};

echo $inner(3)->or(-1);     // 4
echo $inner(-1)->or(-1);    // -1
```

## Next

- [Results](/stdlib/result) for `result<T, E>` and `guard`.
- [Status](/stdlib/status) for the no-value twin.
- [Extension](/language/extension) for converting one error type into another when you do not own the destination.
- [Errors and panics](/language/errors-and-panics) for `assert` and `die`.
