# Status

Sometimes a function can fail and there is **no value** on the success path. `result<T, E>` still
wants a `T`. **`status<E>` is ok, or a failure of type `E`.**

```echo
function start(bool $ok) : status<string>
{
    if (!$ok) {
        return .error('nope');
    }

    return .ok;
}

function go(bool $ok) : void
{
    guard start($ok) else ($e) {
        die($e);
    }

    echo "ok";
}

go(true);       // ok
```

There is nothing to bind. Statement [`guard`](/memory/nullability) is the form. `.ok` takes no list.

## Why not result with a dummy T

`result<bool, E>` is a lie: the bool is always true. `void` is not a type argument, so there is no
`result<void, E>` either. A boundary that never had a T names only the error.

`status<E>` is an ordinary enum in `stdlib/core/status.eco`. Nothing in the compiler knows what it
is. `guard` reaches it through `contract::checkable` and `contract::failable<E>`. You can write your
own.

## How you build one

```echo
status<string> $good = status<string>::ok;
status<string> $bad = .error('nope');

echo $good->has_value();    // 1
echo $bad->failed();        // 1
echo $bad->failure();       // nope
```

A return type is a destination, so `.ok` and `.error($e)` drop the owner wherever the type is already
named.

## How you read one

Statement `guard`. Leave the `else` off and a failure stops the program. Write `else ($e)` when you
want the reason. That block has to leave.

```echo
function start() : status<int32>
{
    return .ok;
}

guard start() else ($code) {
    die("start: {$code}");
}

echo 1;     // 1
```

`match` reads it as the ordinary enum it is:

```echo
function describe(status<string> $s) : string
{
    return match ($s) {
        .ok        => "ok",
        .error($e) => $e,
    };
}

echo describe(.ok);              // ok
echo describe(.error('nope'));   // nope
```

An initializer `guard` over a status is refused: there is nothing to bind. Write the statement form.

## The methods, by hand

| Function | Answers | Valid when |
|---|---|---|
| `status<E>::ok` | a success | always |
| `status<E>::error(E $failure)` | a failure | always |
| `const function has_value() : bool` | did this succeed | always |
| `const function failed() : bool` | the complement of `has_value()` | always |
| `function failure() : E&` | a borrow of the failure | `failed()` is true, dies otherwise |

`has_value()` is `contract::checkable`. `failure()` is `contract::failable<E>`. There is no
`unwrap()`. There is no value.

## Next

- [Results](/stdlib/result) for when there is a `T`.
- [Contracts](/stdlib/contract) for `checkable` and `failable`.
- [Nullability](/memory/nullability) for statement `guard`.
