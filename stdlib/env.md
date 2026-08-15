# std::env

`std::env` is the process: what it was started with, what it inherited, where it is, and how it stops.
The thing worth knowing up front is what is *not* in it: **none of this needs a platform conditional in
your code**, because the environment block arrives as the entry point's third argument rather than through
`environ`.

```echo
echo std::env::argc();                  // 1 when nothing was passed
echo std::env::arg(0)->empty();      // 0, argument zero is the program
```

The platform differences that do exist, and there are a few, are handled once inside the library so your
code never sees them. See [Conditional compilation](/projects/conditional-compilation) for how that is
written, if you need the same trick yourself.

## Arguments come in three shapes, and two of them allocate nothing

```echo
// how many, including the program name at index 0
echo std::env::argc();

// one, by index. asserts if you go past the end
string::view $program = std::env::arg(0);
echo $program->empty();          // 0

// all of them, as a cursor
foreach (std::env::args() as $i => $argument) {
    echo $i;
}

// all of them, owned
array<string> $owned = std::env::argv();
echo $owned->count();
```

`argc()` counts the program name, so a program invoked with no arguments answers 1, the way C's `argc`
does.

`arg($i)` and `args()` hand back a `string::view`, which borrows the argument block rather than copying it.
Neither allocates. `argv()` is the one function in the module that allocates on purpose, and it allocates
twice per argument, because each `string` owns a copy of its bytes. Reach for it when you need to keep the
arguments past the point where a view would be awkward, and reach for the other two the rest of the time.

`arg($i)` is not nullable. Going past the end is a mistake in your code rather than a condition to recover
from, so it asserts:

<!-- verify: dies -->
```echo
string::view $nope = std::env::arg(99);
// assertion failed: argument index out of bounds
```

One caveat on the cursor: `args()` stores the current view and overwrites it on every `advance()`. A view
taken from one step is stale on the next, so copy it if you mean to keep it.

## `--` is how `run` gets argv

Everything after a bare `--` belongs to your program rather than to `echoc`:

```bash
echoc run app.eco -- --verbose input.txt
```

The split happens before option parsing, which it has to: source files are recognised at any position, so a
tail left in the stream would make `echoc run app.eco -- a b` go looking for a file called `a`. Only `run`
accepts a `--`, because only `run` has a program to hand the tail to. See
[The echoc CLI](/projects/cli).

Under `build` there is no separator at all. The linked binary's argv is your program's already.

## Under `run`, `arg(0)` is your source and `exe()` is echoc

This is the one trap in the module and it bites during exactly the debugging session where you can least
afford it.

```echo
// under `echoc run gate.eco` this is "gate.eco"
// under a built binary it is whatever the shell used to invoke it
echo std::env::arg(0)->empty();      // 0

// under `echoc run` this is the path to echoc itself
echo std::env::exe()->empty();       // 0
```

`exe()` asks the operating system for the path of the running image, and under `run` the running image is
the compiler. `arg(0)` is prepended by the driver with the name of the source file, because under `run`
that is the honest answer to "what program is this".

So: reach for `arg(0)` when you want the name the program was invoked under, and `exe()` when you want to
find a file sitting next to the binary. Under `build` they agree, which is exactly why testing this only
under `run` will mislead you.

`exe()` is also the other allocating function here, and it is the only one that reads a platform API
directly: `_NSGetExecutablePath` on Darwin, `/proc/self/exe` on Linux, and `argv[0]` as the fallback
elsewhere.

## Environment variables borrow, they do not copy

Nothing is read until you ask for it. `var` is a `getenv` call and no more, and **every answer is a
`string::view` that borrows the environment block:**

```echo
echo std::env::has('PATH');                                     // 1
echo std::env::var('ECO_MISSING', 'fell_back');                 // fell_back

usize $n = 0;
foreach (std::env::vars() as $key => $value) {
    $n = $n + 1;
}
echo $n > 0;                                                    // 1
```

Nothing there allocated. If you change the environment afterwards, through `setenv` or anything that calls
it, a view you were holding may be pointing at bytes that have moved. Take a `clone()` if you are going to.

`vars()` yields in the platform's own order, which is not sorted and not deduplicated. A key appearing twice
is yielded twice, and `var` would have answered with the first. An entry with no `=` in it comes out as a
key with an empty value.

## has, var, and var with a fallback are three different questions

They are not three spellings of one:

```echo
// is it set at all? the only way to tell "set to empty" from "not set"
echo std::env::has('PATH');                             // 1

// what is it, if anything? absence is in the type
string::view $path = guard std::env::var('PATH') else {
    die('PATH is not set');
}
echo $path->empty();                                 // 0

// what is it, or this instead?
echo std::env::var('ECO_MISSING', 'fell_back');         // fell_back
```

The one-argument `var` returns `string::view?`, so absence lives in the type rather than being folded into
an empty string. That means `guard`, `??` and `?->` all work on it, and it means a variable that is set to
the empty string is not silently the same as one that is missing. See [Nullability](/memory/nullability).

The fallback overload is just `var($key) ?? $fallback`. One caveat: it is not safe to pass a
temporary built on the spot, because what comes back is a view and the temporary will not outlive the
statement.

## A sub-window is not a C string

Every key goes through `cstr()` on its way to `getenv`, which needs the bytes to be NUL terminated. Every
literal is, and so is every whole `string`. A **window into one is not**:

<!-- verify: dies -->
```echo
string $both = "PATHHOME";
string::view $window = $both->view()->sub(0, 4);

echo $window;                       // PATH
echo std::env::has($window);
// assertion failed: string is not NUL terminated - clone it first
```

The fix is in the message. This is an assertion rather than a refusal because whether a view happens to end
on a terminator is not something the compiler can know.

## Directories

```echo
string $here = std::env::cwd();
echo $here->empty();                     // 0

string::view $tmp = std::env::tmp();
echo $tmp->empty();                      // 0
```

`cwd()` allocates, unlike almost everything else here, because there is no block to borrow from. It
hands you an owning `string`.

`home()` is `var('HOME')`, so it is **nullable**. An unset `HOME` has no honest answer, and returning
`""` would hand you a path that resolves, to the working directory. `tmp()` is `var('TMPDIR', '/tmp')`
and is *not* nullable, because unlike `HOME` there is an honest answer when the variable is missing.

## exit is not a return

```echo
echo 1;
std::env::exit(0);
echo 2;         // never runs, and the compiler knows it
```

Nothing after the call runs, which means **no destructor runs either**, and no `[memory]` report is printed
under `--explain memory`. That is the same bargain `die` makes, and it is deliberate: an exit code is for
telling a shell what happened, not for unwinding.

`std::env::exit` sets the exit status. `die` also stops the program, but it prints a message first and its
status says "this program failed". Return out of the last statement instead if you want an orderly finish
with every destructor run. See [Errors and panics](/language/errors-and-panics).

## Nothing here returns an error

Worth saying once, because it is consistent across the module and it is a design position rather than an
oversight:

- **Absence** is a nullable type. `var` and `home`.
- **A mistake in your code** is an `assert`. `arg` past the end, a key that is not NUL terminated.
- **A platform failure** is a `die`. `getcwd` refusing a buffer it asked for, a path over 64 KiB.

There is no error value to check anywhere, and there is no silent zero. This module uses `null`, `assert`
and `die`. It does not return a [`result<T, E>`](/stdlib/result).

## The whole surface

| Signature | What it does |
|---|---|
| `argc() : usize` | argument count, including the program name at 0 |
| `arg(usize $index) : string::view` | one argument, borrowed. asserts if out of range |
| `args() : arg_iterator` | a cursor over all of them, for `foreach`. allocates nothing |
| `argv() : array<string>` | all of them, owned. allocates twice per argument |
| `exe() : string` | the path of the running image. **echoc itself under `run`** |
| `pid() : int32` | the process id |
| `exit(int32 $code) : void` | stops now. no destructors, no memory report |
| `has(string::view $key) : bool` | is it set at all, empty or not |
| `var(string::view $key) : string::view?` | its value, borrowed. null when unset |
| `var(string::view $key, string::view $fallback) : string::view` | its value, or the fallback |
| `vars() : var_iterator` | a cursor over every variable, for `foreach`. allocates nothing |
| `cwd() : string` | the current directory, owned |
| `home() : string::view?` | `HOME`, borrowed. null when unset |
| `tmp() : string::view` | `TMPDIR`, or `/tmp` |

## Next

- [Nullability](/memory/nullability) for `guard`, `??` and what a `string::view?` is.
- [Errors and panics](/language/errors-and-panics) for `die` and `assert`, and how `exit` differs.
- [The echoc CLI](/projects/cli) for `--` and the difference between `run` and `build`.
