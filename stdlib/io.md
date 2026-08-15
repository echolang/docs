# std::io

`echo` gets you through more of a program than you would think, and then one day you need to write to stderr,
or write without a trailing newline, or hand "where the output goes" to a function. That is the whole reason
this namespace exists.

```echo
std::io::println('Chevron seven, locked.');

string $line = guard std::io::readline() else {
    std::io::eprintln('nothing on stdin');
    return 0;
}

std::io::println("you said: {$line}");
```

Everything here takes a `string`, and [interpolation](/collections/strings#interpolation) is how a value
becomes one. There is no `printf`-shaped function and there is deliberately not going to be one. A format
string that is checked when the program runs is a class of bug I would rather the language simply not have.

## print, println, and their stderr twins

```echo
std::io::print('no newline');
std::io::println(' and one with');

std::io::eprint('to stderr');
std::io::eprintln(' also stderr');
```

Four functions, and the only difference between the pairs is which stream they write to. `eprint` and
`eprintln` go to standard error, so a program whose output is being piped somewhere can still say something
to the person running it.

## A stream is a value

`std::io::stdout` is not a function call. It is a **constant**, so you write it without parentheses, and it
can be copied into a variable and handed around like the number it is:

```echo
std::io::stdout->write('straight to fd 1');
std::io::stdout->writeline(' with a newline');

stream $target = std::io::stdout;
$target->writeline('through a copy');
```

There are three: `std::io::stdout`, `std::io::stderr` and `std::io::stdin`.

That works because a `stream` is one `int32`, the file descriptor, and because a constant in Echo is
[its expression copied into every use site](/language/constants). `std::io::stdout` *is* `stream(1)`,
written once. Copying it costs nothing and there is no shared object being kept alive.

The methods:

| | |
|---|---|
| `write(const string&)` | the string's bytes, nothing else |
| `writeline(const string&)` | the same, then a newline |
| `write(ptr<const uint8>, usize)` | raw, when you already have a pointer and a length |
| `flush()` | flush every buffered stdio stream |
| `fd() : int32` | the descriptor this stream names |
| `readline() : string?` | the next line without its newline, or `null` at end of input |

`write` uses the string's **length**, never a terminator. A substring shares its parent's buffer and simply
stops early, so `%s` or `strlen` would run off the end of one.

## Reading a line

`readline` answers a nullable, so the absence case is spellable rather than a sentinel you have to know
about:

```echo
string $name = guard std::io::readline() else {
    std::io::println('no name given');
    return 0;
}

std::io::println("hello, {$name}");
```

`null` means *there was nothing at all*. A final line with no newline is still answered in full, and an
empty line is an empty string rather than a `null`. That is the distinction `guard` exists to make easy.

`std::io::readline()` is `std::io::stdin->readline()` written the short way.

**It is unbuffered: one `read` per byte.** A library module has no mutable state of its own, so leftover
bytes past the newline have nowhere to live, and buffering here would steal input from anything else on
fd 0. Keep this function when you are mixing readers.

## A reader and a writer

Buffering needs a value you hold. `reader` and `writer` wrap a `stream`. They do not own the
descriptor and they do not close it. The last `writer` flushes.

```echo
std::io::reader $in = std::io::reader(std::io::stdin);
string? $line = guard $in->readline() else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

echo $line == null;
```

```echo
std::io::writer $out = std::io::writer(std::io::stdout);
usize $n = guard $out->write('chevron') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

usize $z = guard $out->flush() else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

echo $n;
```

`write` and `writeline` go into an 8 KiB window and hit the kernel when it fills, on `flush`, or
when the last handle goes. If you wrap stdout, `flush` before `echo`. `echo` goes through printf,
the writer through `write(2)`, and an unflushed window is a third place for output to sit.

`file` is the same pair of windows on a descriptor it owns. You do not wrap a live file's `fd()` in
either of these: that would steal bytes from the file's own window.

## Files

A `stream` is a borrowed fd. A `file` is one you opened, so it closes itself, and leftover bytes have
somewhere to sit. That is why `readline` on a file is not one syscall per byte.

```echo
string $path = '';
$path->append(str::from(std::env::tmp()));
$path->append('/echo-io-docs-');
$path->append(str::from(std::env::pid()));
$path->append('.txt');

usize $n = guard std::io::writefile($path, 'chevron seven\nlocked') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

string $body = guard std::io::readfile($path) else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

echo $n;
echo $body;

bool $rm = guard std::io::remove($path) else ($e) {
    std::io::eprintln($e->message());
    return 1;
}
```

`writefile` creates or truncates. `readfile` is the whole contents. Both answer a
[`result`](/stdlib/result), because a missing path is a correct program, not a bug.

A missing file is `missing()`, not a die:

```echo
file $f = guard std::io::open('definitely-missing-echo-docs-xyz', .read) else ($e) {
    echo $e->missing();
    return 0;
}

echo 'opened';
```

The modes:

| | |
|---|---|
| `.read` | existing file, read only |
| `.write` | create or truncate, write only. `create($path)` is this |
| `.append` | create if needed, writes go at the end. `append($path)` is this |
| `.readwrite` | existing file, both. does not create |

`file` is a class. Copying one is another handle to the same fd, and the last one to go runs `close`.
`close` is also a method, if you want the fd back before the end of the scope.

```echo
string $path = '';
$path->append(str::from(std::env::tmp()));
$path->append('/echo-io-docs-file-');
$path->append(str::from(std::env::pid()));
$path->append('.txt');

file $out = guard std::io::create($path) else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

usize $w = guard $out->write('alpha\nbeta') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

$out->close();

file $in = guard std::io::open($path, .read) else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

string? $line = guard $in->readline() else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

echo $line ?? '';

bool $rm = guard std::io::remove($path) else ($e) {
    std::io::eprintln($e->message());
    return 1;
}
```

Writes go through an 8 KiB window and land on disk at `flush`, `seek`, `close`, or when the window fills.
A write bigger than the window, with the window empty, goes straight to the kernel, so `writefile` of a
large string is still one syscall.

Reads fill the same size of window. `readline` scans it for a newline and only hits the kernel when the
line crosses a fill.

`fd()` is the raw descriptor. The kernel's offset may disagree with `position()` until you `flush`: unread
bytes have already been pulled, unflushed writes have not been pushed. Do not wrap a live file's `fd()`
in a `reader` or a `writer`.

The rest of the surface:

| | |
|---|---|
| `reader` / `writer` | a window over a `stream`. do not own, do not close |
| `open` / `create` / `append` | `result<file, ioerror>` |
| `readfile` / `writefile` | the whole contents |
| `exists` | `bool`. no reason, the answer is yes or no |
| `remove` / `rename` | `result<usize, ioerror>`, `0` on success |
| `file::write` / `write` | `result<usize, ioerror>`, bytes transferred |
| `file::read` | into a pointer and a count. `0` is EOF |
| `file::readall` | the rest of the file, as a `string` |
| `file::readline` | `result<string?, ioerror>`. `ok(null)` is EOF |
| `file::seek` / `position` / `size` | `result<int64, ioerror>` |
| `file::flush` | drain the write window |
| `file::close` | flush, then close. void. safe twice |
| `ioerror::message` / `missing` / `denied` / `exists` | strerror, and the three questions |

`"{$e}"` is `message()`, because `str::from` has an overload.

## It stays in order with `echo`

`echo` writes numbers through C's `printf`, which is buffered, and text through `write`, which is not.
Every `std::io` write flushes stdio first, so the two interleave the way they read:

```echo
echo 1;
std::io::println('two');
echo 3;
std::io::println('four');
```

```
1
two
3
four
```

Without the flush that prints `two`, `four`, `1`, `3` the moment output is a pipe rather than a terminal,
which is exactly where nobody is looking.

## echo is not sugar for println

For a one-liner they look interchangeable. They are not, and I kept them apart on purpose.

`echo` is a statement built into the language, which makes it the only output a program has when it is
compiled with `--no-stdlib`, where there is no `string` type at all. Every function on this page needs one.

The second difference is the one that will actually catch you. The two render a float differently:

```echo
$seconds = 3.5;

echo $seconds;                      // 3.500000
std::io::println("{$seconds}");     // 3.5
```

`echo` reaches printf's `%f` directly and always has. `str::from`, which is what a `{$...}` hole becomes, uses
the shortest form that reads well in a sentence. Neither one is wrong, but they are not interchangeable, and
if the digits matter you want to pick on purpose rather than find out later.

Use `echo` for a quick value. Use `std::io` when you need a destination, no newline, a file, or a function
you can pass around.

## Next

- [Strings](/collections/strings) for interpolation, `data()`, and writing into a spare.
- [`str` and `arr`](/stdlib/str-arr) for `str::from`, `split`, `join`, `trim` and the number parsers.
- [`std::env`](/stdlib/env) for arguments, the environment and `exit`.
- [C interop](/projects/c-interop) for handing `data()` or `fd()` to a C library.
