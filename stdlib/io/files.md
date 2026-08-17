# Files

You have a path and you want the bytes in it, or you want to put bytes there. The answers live in
`std::io`. A path is a `string`. There is no path type.

```echo
usize $n = guard std::io::writefile('gate.txt', "chevron seven\nlocked");
string $text = guard std::io::readfile('gate.txt');

echo $text;     // chevron seven
                // locked

bool $ok = guard std::io::remove('gate.txt');
```

`writefile` creates or truncates. `readfile` is the whole contents. Both answer a
[`result`](/stdlib/result), because a missing path is a correct program, not a bug.

Leave the `else` off when you want the program to stop if the call fails. Write one when you want to
handle the reason: `else ($e) { ... }` still has to leave. `die($e->message())` is legal when you
want the crash to carry the IO error in your own words.

There is no `mkdir`, no `stat`, and nothing that lists a directory.
[What is missing](/reference/limitations) has the rest of that list.

## A missing file is `missing()`, not a die

```echo
string $text = guard std::io::readfile('definitely-missing-echo-docs-xyz') else ($e) {
    echo $e->missing();     // 1
    return 0;
}

echo $text;
```

`$e->missing()` is "nothing of that name exists." `denied()` is "it is there and you are not allowed."
`exists()` on the error is `EEXIST`. `"{$e}"` is `message()`, because `str::from` has an overload.

## A path is a string

`'gate.txt'` is fine when the current directory is the right place. Anywhere else, build one. Interpolation
is how:

```echo
string::view $dir = std::env::tmp();
string $path = "{$dir}/gate.txt";

echo $path->empty();        // 0
```

`cwd()` and `tmp()` are on [Environment](/stdlib/env). There is still no path type behind that string.

## A line at a time

`readfile` is the whole file in one string. When the file is large, or you want one line, open a
`std::io::file` and loop. `writefile` first, so the contents are flushed before anyone else opens the path:

```echo
usize $n = guard std::io::writefile('gate.txt', "Abydos\nChulak\nDakara") else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

std::io::file $in = guard std::io::open('gate.txt', .read) else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

while (true) {
    string? $next = guard $in->readline() else ($e) {
        std::io::eprintln($e->message());
        return 1;
    }

    string $line = guard $next else {
        break;
    }

    echo $line;
}

bool $ok = guard std::io::remove('gate.txt') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}
```

Two guards, two different absences. The `result` failing is an IO error. `null` is end of file. An empty
line is an empty string, not a `null`.

`echo $next` will not compile. A `string?` does not become a `string` after you compared it to `null`,
so the second `guard` is how you get a value you can print.

There is no `foreach` over a file. The loop is yours.

## create truncates, append extends

```echo
usize $a = guard std::io::writefile('gate.txt', "first\n") else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

std::io::file $log = guard std::io::append('gate.txt') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

usize $b = guard $log->write("second\n") else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

$log->close();

string $text = guard std::io::readfile('gate.txt') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

echo $text;     // first
                // second

bool $ok = guard std::io::remove('gate.txt') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}
```

`append($path)` is `open($path, .append)`. `create($path)` is `open($path, .write)`, and `.write`
truncates. Call `create` on a file that already has `"first\n"` in it and you are left with whatever you
write next.

`close()` is in that example on purpose. Writes sit in an 8 KiB window. `readfile` opens the path again,
and it will not see bytes that are still in `$log`'s window. `close` flushes, then releases the
descriptor. Letting `$log` go out of scope does the same thing.

The modes:

| | |
|---|---|
| `.read` | existing file, read only |
| `.write` | create or truncate, write only. `create($path)` is this |
| `.append` | create if needed, writes go at the end. `append($path)` is this |
| `.readwrite` | existing file, both. does not create |

`.write` cannot read. `.read` cannot write. `.readwrite` needs the file to already be there. That last
one is the mode for "write, then seek back, then read" on a single handle.

## The last handle closes

`std::io::file` is a class in `std::io`. Copying one is another handle to the same descriptor, and the
last one to go runs `close`. You usually don't call it. The append example did, because something else
needed to see the bytes before the end of the scope.

A [`stream`](/stdlib/io/) is the opposite: one `int32`, no destructor, it never closes anything.

## Seeking

You wrote ten bytes and you want everything after the third. Open it, seek, `readall` is the rest:

```echo
usize $n = guard std::io::writefile('gate.txt', '0123456789') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

std::io::file $f = guard std::io::open('gate.txt', .read) else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

int64 $at = guard $f->seek(3, .start) else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

string $rest = guard $f->readall() else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

echo $at;       // 3
echo $rest;     // 3456789

bool $ok = guard std::io::remove('gate.txt') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}
```

`seek($offset, $from)` counts from `.start`, `.current` or `.end`. `position()` is where the next read or
write will land. `size()` is seek-to-end then seek back, so it is not free.

Don't `readall` on a `create()` handle. `.write` is write-only, and the kernel answers with a bad file
descriptor rather than with the bytes you just wrote.

## exists, remove, rename

```echo
bool $missing = guard std::io::exists('definitely-missing-echo-docs-xyz') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

echo $missing;      // 0

usize $n = guard std::io::writefile('gate.txt', 'moved') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

bool $ren = guard std::io::rename('gate.txt', 'chulak.txt') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

string $text = guard std::io::readfile('chulak.txt') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

echo $text;     // moved

bool $old = guard std::io::exists('gate.txt') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}

echo $old;      // 0

bool $ok = guard std::io::remove('chulak.txt') else ($e) {
    std::io::eprintln($e->message());
    return 1;
}
```

`exists` is `result<bool, ioerror>`, not a bare `bool`. Missing is an answer: `ok(false)`. Denied is not
"no". `EACCES` is a file that is there, and you are not allowed to see it, so that comes back as an error.

`remove` and `rename` answer `result<bool, ioerror>`. `ok(true)` is success.

## The window

Every `std::io::file` has an 8 KiB read window and an 8 KiB write window. That's why `readline` on a file is not
one syscall per byte, and why [`stdin->readline()`](/stdlib/io/) is: a `stream` has nowhere to keep
leftover bytes.

Writes land on disk at `flush`, `seek`, `close`, or when the window fills. A write bigger than the window,
with the window empty, goes straight to the kernel, so `writefile` of a large string is still one syscall.

`fd()` is the raw descriptor. The kernel's offset may disagree with `position()` until you `flush`: unread
bytes have already been pulled, unflushed writes have not been pushed. Don't wrap a live file's `fd()`
in a [`reader` or a `writer`](/stdlib/io/buffering). A `std::io::file` already has both windows.

## The whole surface

| | |
|---|---|
| `open` / `create` / `append` | `result<std::io::file, ioerror>` |
| `readfile` / `writefile` | the whole contents |
| `exists` | `result<bool, ioerror>`. missing is `ok(false)` |
| `remove` / `rename` | `result<bool, ioerror>`, `ok(true)` on success |
| `std::io::file::write` | `result<usize, ioerror>`, bytes transferred |
| `std::io::file::read` | into a pointer and a count. `0` is EOF |
| `std::io::file::readall` | the rest of the file, as a `string` |
| `std::io::file::readline` | `result<string?, ioerror>`. `ok(null)` is EOF |
| `std::io::file::seek` / `position` / `size` | `result<int64, ioerror>` |
| `std::io::file::flush` | drain the write window |
| `std::io::file::close` | flush, then close. void. safe twice |
| `std::io::file::fd` | the raw descriptor |
| `ioerror::message` / `missing` / `denied` / `exists` | strerror, and the three questions |

## Next

- [Input and Output](/stdlib/io/) for `print`, streams, and the unbuffered stdin line.
- [Readers and writers](/stdlib/io/buffering) for a window over a stream you do not own.
- [Results](/stdlib/result) for `guard ... else ($e)` and what a `result` is.
- [Environment](/stdlib/env) for `tmp()`, `cwd()` and `pid()`.
- [What is missing](/reference/limitations) for paths, `mkdir`, and directory listing.
