# Input and Output

`echo` gets you through more of a program than you'd think. Then one day you need to write to stderr,
or write without a trailing newline, or hand "where the output goes" to a function. That's why
`std::io` exists.

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

Files are [their own page](/stdlib/io/files). A buffered `reader` or `writer` is
[another](/stdlib/io/buffering). This one is printing, streams, and the line you read from stdin.

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

A stream does not own the descriptor and never closes it. A [`std::io::file`](/stdlib/io/files) does.

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
empty line is an empty string rather than a `null`. That's the distinction `guard` exists to make easy.

`std::io::readline()` is `std::io::stdin->readline()` written the short way.

**It is unbuffered: one `read` per byte.** A library module has no mutable state of its own, so leftover
bytes past the newline have nowhere to live, and buffering here would steal input from anything else on
fd 0. Keep this function when you are mixing readers. Wrap stdin in a
[`reader`](/stdlib/io/buffering) when you want the window.

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

- [Files](/stdlib/io/files) for opening a path, `readfile` / `writefile`, and `std::io::file`.
- [Readers and writers](/stdlib/io/buffering) for a window over a stream you do not own.
- [String functions](/stdlib/str) for `str::from`, `split`, `join`, `trim` and the number parsers.
- [Environment](/stdlib/env) for arguments, the environment and `exit`.
- [C interop](/projects/c-interop) for handing `data()` or `fd()` to a C library.
