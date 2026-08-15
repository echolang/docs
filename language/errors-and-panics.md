# Errors and panics

**There are no exceptions in Echo.** No `throw`, no `try`, no `catch`. Recoverable failure is a `T?`, or a
[`result<T, E>`](/stdlib/result) when you need a reason. Bugs are `assert` and `die`.

Most of what exceptions get used for splits cleanly into two cases:

| The situation | What to use |
|---|---|
| This can fail, and the caller should deal with it | return `T?`, or `result<T, E>` |
| This cannot fail unless something is broken | `assert`, or `die` |

The line between them is whether a correct program can hit it. A gate address that will not lock is the
first. An index past the end of an array you just built is the second.

## Failure the caller handles: T?

Return an optional and let the caller decide:

```echo
class Wormhole
{
    int32 $id;
}

function dial(int32 $address) : Wormhole?
{
    if ($address == 27) {
        return Wormhole(1);
    }
    return null;        // no such gate, or it is buried
}

Wormhole $open = guard dial(27) else { die("no lock"); }
echo $open->id;     // 1
```

The type says the call can fail, and the compiler will not let you read the result without dealing with
that. `guard` narrows it, `??` supplies a fallback, `?->` short-circuits a chain:

```echo
function chevronCount(int32 $address) : int32?
{
    if ($address == 27) {
        return 7;
    }
    return null;
}

echo chevronCount(27) ?? -1;   // 7
echo chevronCount(99) ?? -1;   // -1
```

The obvious limitation: a `T?` tells you that something failed and nothing about **why**. If you need a
reason, return a [`result<T, E>`](/stdlib/result), or a struct of your own.

[Nullability](/memory/nullability) covers the optional forms properly.

## die

`die` stops the program. It prints your message with the source location and exits with status 1:

<!-- verify: dies -->
```echo
echo "dialling";
die("chevron seven will not lock");
echo "connected";
```

Running that prints:

```
dialling
fatal error: chevron seven will not lock
  at program.eco:2
```

The `echo "connected"` never happens, and the exit status is 1.

`die()` also works with no message. Use it where continuing would be worse than stopping: a corrupt file, an
invariant you rely on that has been violated, a branch that should be unreachable.

As far as [control flow](/language/control-flow) is concerned `die` counts as leaving a scope, which is why
it satisfies a `guard` arm.

## assert

`assert` checks something you believe is already true:

```echo
function power_per_chevron(int32 $total) : int32
{
    assert($total % 7 == 0, "a full gate draws across all seven chevrons");
    return $total / 7;
}

echo power_per_chevron(70);     // 10
```

Both forms exist, with and without a message:

```
assert(condition)
assert(condition, message)
```

A failed assertion looks like `die`, with its own wording:

<!-- verify: dies -->
```echo
echo "dialling";
assert(6 == 7, "seven chevrons required");
echo "never reached";
```

```
dialling
assertion failed: seven chevrons required
  at program.eco:2
```

## assert disappears in release, and that is a trap

Here is the part to internalise. **`assert` is compiled out in a release build**, and a release build is
what `echoc build` gives you by default.

<!-- verify: dies -->
```echo
echo "dialling";
assert(6 == 7, "seven chevrons required");
echo "connected";
```

Run that two ways:

```bash
echoc run program.eco
# dialling
# assertion failed: seven chevrons required
#   at program.eco:2      (exit 1)

echoc build -o program program.eco && ./program
# dialling
# connected               (exit 0)
```

`echoc run` defaults to `--debug` and `echoc build` defaults to `--release`. Same source, different
programs.

The trap follows immediately: **anything with a side effect inside an assert condition disappears with it.**

```echo
int32 $drawn = 0;

function charge(int32& $meter) : bool
{
    $meter = $meter + 1;
    return true;
}

assert(charge($drawn));
echo $drawn;
```

Debug prints `1`. Release prints `0`. The call was never made, because the whole statement was removed
before codegen.

So: an assert condition must be a pure question. If a line does work your program needs, it does not belong
inside an `assert`.

## The compiler's own runtime checks

Echo inserts checks of its own, and they follow the same rule: present in debug, gone in release.

Array bounds are the one you will meet first:

<!-- verify: dies -->
```echo
array<int32> $chevrons = [1, 2, 3, 4, 5, 6, 7];
echo $chevrons[7];      // there is no eighth chevron
```

Under `echoc run` that reports `assertion failed: array index out of range` and stops. Built with
`echoc build`, the check is gone and you read whatever is at that address, which is the C answer:
garbage today, a crash tomorrow, and no complaint either way.

The null narrowing check behaves the same way.

This is a deliberate trade, and it is the usual one. You develop against a build that catches mistakes, and
you ship a build that does not pay for the checks. It is worth knowing which build you are running when
something misbehaves, and worth reaching for `echoc run` first when it does.

If you want the checks in a shipped binary, ask for them:

```bash
echoc build --debug -o program program.eco
```

## Exiting normally

`die` is for failure. To end a program deliberately without anything being wrong, use `std::env::exit`:

<!-- verify: dies -->
```echo
echo "gate shut down cleanly";
std::env::exit(3);
echo "never reached";
```

That prints `gate shut down cleanly` and exits with status 3. No message, no `fatal error:` banner, no implication
that something broke.

Exit code 0 means success, as usual:

```echo
echo "all good";
std::env::exit(0);
```

## Which one

A rough guide for choosing:

- The caller can reasonably recover: return `T?`, or `result<T, E>` when the reason matters.
- A bug in the caller: `assert`, so it is loud in development and free in production.
- A bug in the caller that would corrupt something if execution continued: `die`, so it is loud everywhere.
- Nothing is wrong, the program is simply finished: `std::env::exit`.

And one rule with no exceptions: never put work inside an `assert`.

## Next

- [Nullability](/memory/nullability) for `T?`, `guard`, `??` and `?->`.
- [Control flow](/language/control-flow) for `guard` and how `die` satisfies it.
- [The echoc CLI](/projects/cli) for `--debug` and `--release`.
