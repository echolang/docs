# Crash reports

Something stopped your program. Maybe a `die` you wrote, maybe a failed `assert`, maybe a `guard` with no
`else`, maybe the bounds check on an array. However it happened, Echo prints two lines to stderr and exits
with status 1:

```
fatal error: chevron seven will not lock
  at program.eco:12
```

For a command line tool that is exactly the right answer. It stops being the right answer when stderr goes
nowhere, when the crash needs to land in your own log format, or when there is a journal you would like
flushed before the process disappears. `crash::` is the hook for that: one function, called as the last thing
your program does.

One boundary up front, because it decides whether this page is what you are looking for. **A crash hook
cannot recover.** It cannot resume the function that stopped, it cannot swallow the failure, and when it
returns the process still exits 1. It is a reporter, not a `catch`. If the caller should be dealing with the
failure instead, you want a `T?` or a [`result<T, E>`](/stdlib/result), and
[Errors and panics](/language/errors-and-panics) is the page for that.

## Installing one

Write a function that takes a `const crash::info&`, and hand its address to `crash::set_hook`:

<!-- verify: dies -->
```echo
function report(const crash::info& $info) : void
{
    echo "{$info->headline}: {$info->message} at {$info->file}:{$info->line}";
}

crash::set_hook(&report);
die("chevron seven will not lock");
```

```
fatal error: chevron seven will not lock at program.eco:7
```

One line, not two, and it is the line your hook wrote. A hook *replaces* the default report rather than
running alongside it.

## What the hook is handed

`crash::info` is four fields and no methods:

| Field | What is in it |
|---|---|
| `headline` | `fatal error`, or `assertion failed` |
| `message` | the detail. The text of your `die`, or empty when there was none |
| `file` | the source file the stop happened in |
| `line` | the line in it |

`headline`, `message` and `file` are `string::view`, not `string`. They borrow, so reading them allocates
nothing, and that is the whole reason for the choice: a crash is the worst possible moment to go asking an
allocator for memory. Copy one if you really need it past the hook, though you are already on your way out of
the process, so usually you do not.

## Keeping the default report

Replacing the default print is often not what you want. You want the default print *and* something of your
own. `crash::default_hook` is that print, handed to you as a function you can call:

<!-- verify: dies -->
```echo
function report(const crash::info& $info) : void
{
    crash::default_hook($info);
    echo "gate log flushed";
}

crash::set_hook(&report);
die("chevron seven will not lock");
```

```
fatal error: chevron seven will not lock
  at program.eco:8
gate log flushed
```

`default_hook` does not exit, so everything after the call still runs. The order is yours.

## Putting the default back

`crash::take_hook` removes whatever is installed and restores the default report:

<!-- verify: dies -->
```echo
function report(const crash::info& $info) : void
{
    echo "hooked";
}

crash::set_hook(&report);
crash::take_hook();
die("chevron seven will not lock");
```

```
fatal error: chevron seven will not lock
  at program.eco:8
```

Both `set_hook` and `take_hook` hand back whatever was installed before, or `null` when the default report
was in place. Reinstalling a saved one goes through a declaration, because `guard` is how an initializer is
written and not an expression you can nest in a call:

<!-- verify: dies -->
```echo
function quiet(const crash::info& $info) : void
{
    echo "quiet: {$info->message}";
}

function loud(const crash::info& $info) : void
{
    echo "LOUD: {$info->message}";
}

crash::set_hook(&quiet);

extern function<void(const crash::info&)>? $previous = crash::set_hook(&loud);
extern function<void(const crash::info&)> $back = guard $previous;
crash::set_hook($back);

die("chevron seven will not lock");
```

```
quiet: chevron seven will not lock
```

## The hook is a C function pointer, not a closure

This one catches people, so it gets its own section. The parameter type is
`extern function<void(const crash::info&)>`, which is a raw C function pointer, and `&name` on a free
function is the only way to make one. A closure will not go in:

<!-- verify: skip -->
```echo
crash::set_hook(function(const crash::info& $info) : void {
    echo "never installed";
});

// error: cannot implicitly convert 'function<void(const crash::info&)>'
//        to 'extern function<void(const crash::info&)>'
```

Same reasoning as the `string::view` fields. A closure carries an environment, an environment is an
allocation, and a hook that allocates can fail in the one situation where you have the least appetite for a
second failure. So the hook captures nothing at all.

When it needs state, put the state somewhere it can reach without capturing. A static property is the usual
answer:

<!-- verify: dies -->
```echo
struct gate
{
    public static string $name = 'unnamed';
}

function report(const crash::info& $info) : void
{
    string $name = gate::$name;
    echo "{$name} stopped: {$info->message}";
}

gate::$name = 'abydos';
crash::set_hook(&report);
die("chevron seven will not lock");
```

```
abydos stopped: chevron seven will not lock
```

## What reaches the hook

Everything that goes through Echo's one stopping path, which is nearly everything that can stop a program:

| The stop | `headline` | `message` |
|---|---|---|
| `die("...")` | `fatal error` | your message |
| `die()` | `fatal error` | empty |
| a failed `assert` | `assertion failed` | your message, or empty |
| a `guard` with no `else` | `fatal error` | `unwrapped an absent value` |
| an array index past the end | `assertion failed` | `array index out of range` |
| a null pointer narrowed to a borrow | `fatal error` | `null pointer cast to a reference` |

The bottom three are the interesting ones, because you did not write them. A hook is how you hear about a
stop nobody in your code asked for:

<!-- verify: dies -->
```echo
function report(const crash::info& $info) : void
{
    echo "{$info->headline}: {$info->message}";
}

crash::set_hook(&report);

array<int32> $chevrons = [1, 2, 3, 4, 5, 6, 7];
echo $chevrons[7];
```

```
assertion failed: array index out of range
```

The elseless `guard` is worth its own look, since it is the one on that list you are most likely to write
without thinking about it. Leaving the `else` off means "this value is there, and if it is not, stop the
program", and it arrives with the guard's own line:

<!-- verify: dies -->
```echo
function report(const crash::info& $info) : void
{
    echo "{$info->headline}: {$info->message} at {$info->file}:{$info->line}";
}

function dial(int32 $address) : int32?
{
    if ($address == 27) {
        return 7;
    }
    return null;
}

crash::set_hook(&report);
int32 $chevrons = guard dial(99);
echo $chevrons;
```

```
fatal error: unwrapped an absent value at program.eco:15
```

One thing that is **not** on the list: `std::env::exit`. Ending on purpose is not crashing, so the hook stays
out of it:

<!-- verify: dies -->
```echo
function report(const crash::info& $info) : void
{
    echo "hooked";
}

crash::set_hook(&report);
echo "shutting the gate down";
std::env::exit(3);
```

```
shutting the gate down
```

That exits with status 3 and the hook is never called.

## Two things to know before you ship

**A release build has fewer stops to report.** `echoc build` defaults to `--release`, which compiles out your
`assert`s, the array bounds check and the null narrowing check. `die` survives, and so does an elseless
`guard`, because that one lowers to a `die` rather than an `assert`. Same hook, fewer calls:

```bash
echoc run program.eco
# assertion failed: seven chevrons required     (exit 1)

echoc build -o gate program.eco && ./gate
# fatal error: chevron seven will not lock      (exit 1)
```

So a hook is not a way to find out about failed assertions in production. There are none in production. The
[CLI](/projects/cli) page covers `--debug` if you want them anyway.

**A hook that crashes does not recurse.** The installed hook is stolen out of its slot before it is called,
so a `die` inside your hook gets the default report rather than your hook a second time:

<!-- verify: dies -->
```echo
function report(const crash::info& $info) : void
{
    die("the hook itself broke");
}

crash::set_hook(&report);
die("chevron seven will not lock");
```

```
fatal error: the hook itself broke
  at program.eco:3
```

Look at the line number: that is the `die` inside the hook, and the original failure's report is gone. Which
is a decent argument for keeping a crash hook boring.

## One hook, one process

There is a single hook for the whole process, not one per thread. Installing from any
[thread](/stdlib/thread) replaces it for all of them and a crash on any thread calls it. The swap itself is
atomic, so `set_hook` races safely against another thread's `set_hook`. The steal at crash time is not, so
two threads crashing in the same instant can both end up inside the hook. Install once during start-up and
neither is something you have to think about.

## The surface

#### `crash::set_hook(extern function<void(const crash::info&)> $hook)`

Installs `$hook` as the crash report, replacing the default print. Returns the hook that was installed
before, or `null` if the default was in place.

#### `crash::take_hook()`

Removes the installed hook and restores the default report. Returns what was installed, or `null` if nothing
was.

#### `crash::default_hook(const crash::info& $info)`

The default report: the `fatal error` or `assertion failed` line and the location under it, and nothing else.
Does not exit, so a hook can call it and carry on.

#### `crash::info`

`headline`, `message` and `file` are `string::view`. `line` is an `int32`. Fields only, no methods.

## Next

- [Errors and panics](/language/errors-and-panics) for `die`, `assert`, and choosing between them and a
  returned failure.
- [Results](/stdlib/result) for failure the caller is supposed to handle.
- [Nullability](/memory/nullability) for `guard` and what leaving the `else` off means.
