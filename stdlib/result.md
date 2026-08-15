# Results

Sometimes a function can fail and the caller needs to know why. `T?` is the cheap answer when absence is
enough. It cannot carry a reason. **`result<T, E>` is a value of type `T`, or a failure of type `E`.**

```echo
function double(int32 $n) : result<int32, string>
{
    if ($n < 0) {
        return .error('negative');
    }

    return .ok($n * 2);
}

int32 $n = guard double(21) else {
    die('nope');
}

echo $n;        // 42
```

The return type says the call can fail. The compiler will not let you read the value without dealing with
that. `guard` is how you usually deal with it.

If you are coming from Rust, this is `Result<T, E>` and the shapes line up almost exactly. If you are coming
from PHP: it is an exception you have to look at, checked by the compiler, with no unwinding anywhere.

## T? when there is nothing to say

A missing value with no story behind it is still a `T?`. A key that is not in a map, `std::env::var` when
the name is unset. There is no reason to invent one.

Reach for `result<T, E>` when the reason is the point: a parser that saw a bad digit, a port that was out
of range, a string that was empty versus one that was too long. The `E` can be a `string`, an `int32`, or
an enum of your own. Anything.

[Nullability](/memory/nullability) is the `T?` chapter. This page is the other one.

## How you build one

Two cases, two constructors. `ok` holds the value. `error` holds the failure.

```echo
result<int32, string> $good = result<int32, string>::ok(7);
result<int32, string> $bad = result<int32, string>::error('nope');

echo $good->has_value();    // 1
echo $bad->failed();      // 1
```

Writing the type twice gets old, and you do not have to. Wherever the destination already names the type,
drop the owner:

```echo
function halve(int32 $n) : result<int32, string>
{
    if ($n % 2 != 0) {
        return .error('odd');
    }

    return .ok($n / 2);
}

echo halve(10)->or(-1);    // 5
echo halve(7)->or(-1);     // -1
```

A return type is a destination. So is a declared variable, and so is a parameter of a call the compiler has
already resolved:

```echo
result<int32, string> $declared = .error('from a declaration');

function takes(result<int32, string> $r) : int32
{
    return $r->or(-1);
}

echo $declared->failure();      // from a declaration
echo takes(.ok(7));             // 7
echo takes(.error('from an argument'));    // -1
```

What it can never be is an unknown. `.ok(5)` on its own has nothing to fill the owner in from, and the
compiler says so rather than guessing:

```echo
$x = .ok(5);
// error: '.ok(...)' takes its type from where its value goes, and nothing here says what that is
```

`E` is named nowhere in `ok`'s signature. The owner at the call site is what binds it, which is why
`result<int32, string>::ok(1)` and `result<int32, int64>::ok(1)` are two different functions and both
compile.

## How you read one

`guard` is the shape you want almost always. It declares the variable. Leave the `else` off and a
failure stops the program, with `E` in the message when `str::from` can print it. Write an `else`
when you want to handle the reason; that block has to leave: `return`, `break`, `continue` or `die`.
That is what makes the declaration safe afterwards.

```echo
function first_word(const string& $line) : result<string, int32>
{
    if ($line->empty()) {
        return .error(-1);
    }

    return .ok(str::trim($line));
}

string $word = guard first_word('  hello  ') else {
    die('empty line');
}

echo $word;    // hello
```

Add a name and you get the `E`. This is the half `T?` cannot do, and it is the whole reason this type
exists:

```echo
function pick(int32 $i) : result<string, int32>
{
    if ($i < 0) {
        return .error($i);
    }

    return .ok('ok');
}

function describe(int32 $i) : string
{
    string $s = guard pick($i) else ($code) {
        return "failed with {$code}";
    }

    return $s;
}

echo describe(1);       // ok
echo describe(-3);      // failed with -3
```

`$code` is a borrow of the failure inside the result, seeded into the `else` block's own scope the same way
a `foreach` binding is. It is only in scope inside the block.

The binding `guard` hands you is a **copy** of the payload, taken out of storage the result still owns.
That is why an owning `T` is safe here: nothing is moved out of a value that is about to be destroyed, and
nothing is aliased into storage that is about to go away.

[Nullability](/memory/nullability#guard-binds-it-once) has the rest of `guard`, including the rule that
the `else` has to leave.

### A fallback, when you have one

`or` is the const read. It copies the value out, or the fallback you passed:

```echo
function status(int32 $n) : result<int32, string>
{
    if ($n == 0) {
        return .error('zero');
    }

    return .ok($n * 10);
}

echo status(4)->or(-1);    // 40
echo status(0)->or(-1);    // -1
```

That works on a temporary, because a copy does not need the result to outlive the statement. `unwrap()`
is different, and that is the next section.

### match, when both arms do work

It is an enum. Nothing stops you treating it as one, and the leading-dot shorthand works in a pattern too
once the subject has named the type:

```echo
function status(int32 $n) : result<int32, string>
{
    if ($n == 0) {
        return .error('zero');
    }

    return .ok($n * 10);
}

function describe(int32 $n) : string
{
    result<int32, string> $r = status($n);

    return match ($r) {
        .ok($v)    => "value {$v}",
        .error($e) => "error {$e}",
    };
}

echo describe(4);    // value 40
echo describe(0);    // error zero
```

`guard` is shorter for the common case. `match` is what you want when both arms produce something. See
[Enums](/language/enums) for exhaustiveness, bindings, and the rule that a `match` over a call result
cannot hand back a place. That last one is why `unwrap()` is a method on the result rather than a
`match (f())` you write at the call site.

## The methods, by hand

`guard` is the two interfaces spelled for you. When you want the pieces:

```echo
result<int32, string> $r = result<int32, string>::ok(41);

echo $r->has_value();       // 1
echo $r->failed();        // 0
echo $r->unwrap() + 1;      // 42
echo $r->or(-1);      // 41

result<int32, string> $e = result<int32, string>::error('bad');

echo $e->failed();        // 1
echo $e->failure();         // bad
echo $e->or(-1);      // -1
```

`unwrap()` and `failure()` are each valid on one arm only. Call the wrong one and the program stops:

<!-- verify: dies -->
```echo
result<int32, string> $e = result<int32, string>::error('bad');

echo $e->unwrap();
```

```
fatal error: unwrap() on a result holding a failure
```

That is deliberate. The protocol asks `has_value()` first, so by the time `guard` calls `unwrap()` the
test is already done and there is nothing left to re-check. A call you write by hand can get the order
wrong, and then stopping is the only honest answer: the error arm has no `T` to hand back.

### unwrap() is a borrow into the result

`unwrap() : T&` returns a reference, not a copy. A write through it lands in the result itself:

```echo
result<int32, string> $r = result<int32, string>::ok(41);

int32& $slot = $r->unwrap();
$slot = 9;

echo $r->unwrap();      // 9
```

Same for a method call. `$r->unwrap()->push(4)` appends to the array the result is holding.

Two things that look like they should work, and do not.

A call is not an assignment destination, so `$r->unwrap() = 99;` does not parse. Read through the borrow
or call through it. To replace the whole payload, build a new result.

And a borrow out of a temporary is refused, because the result would be gone at the semicolon:

```echo
echo result<int32, string>::ok(5)->unwrap();
// error: 'result<int32,string>' has no storage of its own, so the pointer in it
//        would be an address into a value destroyed at the end of this statement.
//        Bind it to a variable first.
```

Name it first. That is the same rule `map<K, V>::at()` and `slice<T>::at()` live under, and Echo does not
check the rest: a borrow you stash past the result is yours to keep straight. See
[Pointers and references](/memory/pointers).

`or` is the copy, and that is why it is the one that works on a `const` result and on a temporary.
`unwrap()` cannot be `const`. Handing a writable borrow out of a read-only value would be a lie.

## E can be an enum

A `string` is fine for a first draft. Once the set of failures is closed, say so:

```echo
enum ParseError
{
    case empty;
    case out_of_range;
}

function parse_port(const string& $text) : result<int32, ParseError>
{
    int64 $n = guard str::int($text) else {
        return .error(.empty);
    }

    if ($n < 1 || $n > 65535) {
        return .error(.out_of_range);
    }

    return .ok($n);
}

function describe(const string& $text) : string
{
    int32 $port = guard parse_port($text) else ($why) {
        return match ($why) {
            ParseError::empty        => 'not a number',
            ParseError::out_of_range => 'out of range',
        };
    }

    return str::from($port);
}

echo describe('8080');      // 8080
echo describe('nope');      // not a number
echo describe('70000');     // out of range
```

`.error(.empty)` is the destination shorthand twice: the return type names `result<int32, ParseError>`,
and that names `ParseError` for the argument. [Enums](/language/enums) is the chapter for the cases.

## Nothing in the compiler knows what a result is

`result<T, E>` is ordinary Echo in `stdlib/core/result.eco`. There is no `#[core:]` binding on it, no
node for it, no pass that mentions it. `guard` reaches it through two interfaces any type of yours can
declare, and `.ok(...)` / `.error(...)` are the same
[static shorthand](/language/structs#a-static-belongs-to-the-type-not-to-a-value) every enum's cases get.

So you can write your own. `result<T, E>` is not a privileged type. It is the one the library happens to
ship. [Contracts](/stdlib/contract#unwrappable-and-failable) is the two interfaces, and
[Nullability](/memory/nullability#your-own-types-can-be-guarded-too) walks a type that declares them.

I prefer it this way. A language feature would have been a second `T?` with a payload bolted on, and then
every rule about `T?` would have needed a twin. An enum in the library means `match` already works, `guard`
already works, and a type of yours that answers the same two questions guards exactly as well.

## Why an enum, not a struct with a flag

A struct could do this. Hold a `bool $ok` beside a `T` and an `E`, and every function above is writable.

The first problem is the constructors. `result<string, string>` has a value of one type on both arms. Two
hand-written constructors `(T)` and `(E)` are one signature here and collide. As an enum the two cases are
told apart by name, so the question never arises.

The second problem is what a copy costs. Echo synthesizes a struct's copy and its teardown over **every**
property, so a result holding a value would still retain and release the failure it is not holding. For
`result<string, string>` that is two reference counts moving per copy where one should. And a struct
cannot opt out: declare a destructor to branch by hand and [the copy rules](/memory/copying) answer "no
copy at all", so the type stops being copyable.

An enum's copy and teardown are per case by construction. An `ok` touches the value slot and never looks
at the failure slot. That is the entire argument, and it is why the language grew a way to hand a payload
back as a `T&` rather than this type growing a `bool`.

## What it costs

An enum does not overlay its cases. The value is a tag, then a slot for every payload field of every
case, so `result<T, E>` holds both `T` and `E` even though only one of them is live.

```echo
echo mem::size<result<int64, int32>>();    // 24
echo mem::size<int64>();                   // 8
echo mem::size<int32>();                   // 4
```

24 is not 8 + 4. The tag is one byte, `int64` wants 8-byte alignment, and the whole value is padded out
to that alignment. A layout that sat the two payloads on top of each other would be 16. Echo does not
do that yet.

[Enums](/language/enums#what-an-enum-is-underneath) is the reasoning: the slots are ordinary properties,
which is what keeps copy and teardown per case with no special rule for this type. Overlapping them
later would not change a line of Echo.

A result you produce and immediately `guard` is usually inlined down to a test of the tag, so the extra
width never becomes a copy you pay for. A result you store, put in an array, or hand across a function
that does not inline is the 24-byte value above.

## The whole surface

| Function | Answers | Valid when |
|---|---|---|
| `result<T, E>::ok(T $value)` | a result holding a value | always |
| `result<T, E>::error(E $failure)` | a result holding a failure | always |
| `const function has_value() : bool` | is there a value | always |
| `const function failed() : bool` | the complement of `has_value()` | always |
| `function unwrap() : T&` | a borrow of the value | `has_value()` is true, dies otherwise |
| `function failure() : E&` | a borrow of the failure | `failed()` is true, dies otherwise |
| `const function or(T $fallback) : T` | a copy of the value, or `$fallback` | always |

`has_value()` and `unwrap()` are `contract::unwrappable<T>`. `failure()` is `contract::failable<E>`. Those
two are the whole of what `guard` needs.

## Next

- [Nullability](/memory/nullability) for `T?`, `guard`, and writing a type `guard` accepts.
- [Contracts](/stdlib/contract#unwrappable-and-failable) for the two interfaces, in full.
- [Enums](/language/enums) for cases, payloads, `match`, and the layout.
- [Errors and panics](/language/errors-and-panics) for where a result sits among `assert` and `die`.
