# Files

You have a path and you want a stream: a line at a time, a seek, a write that is not the whole
file. That is `std::io::file`. You open it with [`std::fs::open`](/stdlib/fs). The whole contents
in one go is `readfile` / `writefile` on that page.

```echo
usize $n = guard std::fs::writefile('gate.txt', "Abydos\nChulak\nDakara");
std::io::file $in = guard std::fs::open('gate.txt', .read);

foreach ($in as $i => $line) {
    echo $i;        // 0, then 1, then 2
    echo $line;     // Abydos, then Chulak, then Dakara
}

echo $in->error() == null;      // 1
bool $ok = guard std::fs::remove('gate.txt');
```

End of file stops the loop. An empty line is an empty string, and it is still a turn. A read that
fails stops the loop too and leaves the reason on `$in->error()`. Check it if you need to tell a
short file from a dead disk.

Leave the `else` off when a failure should stop. Write one when you want the reason:
`else ($e) { ... }` still has to leave.

## Missing

```echo
std::io::file $in = guard std::fs::open('definitely-missing-echo-docs-xyz', .read) else ($e) {
    echo $e->missing();     // 1
    return 0;
}

echo 'opened';
```

`$e->missing()` is "nothing of that name exists." `denied()` is "it is there and you are not allowed."
`exists()` on the error is `EEXIST`. `"{$e}"` is `message()`, because `str::from` has an overload.

## readline

`readline()` is the `result` in your own hand. Two guards, two different absences: the `result`
failing is an IO error, `null` is end of file.

```echo
usize $n = guard std::fs::writefile('gate.txt', "Abydos\nChulak");
std::io::file $in = guard std::fs::open('gate.txt', .read);

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

bool $ok = guard std::fs::remove('gate.txt');
```

`echo $next` will not compile. A `string?` does not become a `string` after you compared it to
`null`, so the second `guard` is how you get a value you can print. `foreach` is the version that
does not make you write that.

## create truncates, append extends

```echo
usize $a = guard std::fs::writefile('gate.txt', "first\n");
std::io::file $log = guard std::fs::append('gate.txt');
usize $b = guard $log->write("second\n");
$log->close();

string $text = guard std::fs::readfile('gate.txt');
echo $text;     // first
                // second

bool $ok = guard std::fs::remove('gate.txt');
```

`append($path)` is `open($path, .append)`. `create($path)` is `open($path, .write)`, and `.write`
truncates. Call `create` on a file that already has `"first\n"` in it and you are left with
whatever you write next.

`close()` is in that example on purpose. Writes sit in an 8 KiB window. `readfile` opens the path
again, and it will not see bytes that are still in `$log`'s window. `close` flushes, then releases
the descriptor. Letting `$log` go out of scope does the same thing.

The modes:

| | |
|---|---|
| `.read` | existing file, read only |
| `.write` | create or truncate, write only. `create($path)` is this |
| `.append` | create if needed, writes go at the end. `append($path)` is this |
| `.readwrite` | existing file, both. does not create |
| `.create_new` | create, fail if it exists. write only. `create_new($path)` is this |

`.write` cannot read. `.read` cannot write. `.readwrite` needs the file to already be there. That
last one is the mode for "write, then seek back, then read" on a single handle.

`create_new($path)` is `open($path, .create_new)`. On an open handle, `truncate` flushes and gives
unread bytes back first, then sets the size. Growing fills with zeros. Path `truncate` lives on
[Filesystem](/stdlib/fs). `sync()` flushes the window, then asks the kernel to put the bytes on
disk.

## The last handle closes

`std::io::file` is a class. Copying one is another handle to the same descriptor, and the last one
to go runs `close`. You usually don't call it. The append example did, because something else
needed to see the bytes before the end of the scope.

A [`stream`](/stdlib/io/) is the opposite: one `int32`, no destructor, it never closes anything.

## Seeking

You wrote ten bytes and you want everything after the third. Open it, seek, `readall` is the rest:

```echo
usize $n = guard std::fs::writefile('gate.txt', '0123456789');
std::io::file $f = guard std::fs::open('gate.txt', .read);
int64 $at = guard $f->seek(3, .start);
string $rest = guard $f->readall();

echo $at;       // 3
echo $rest;     // 3456789

bool $ok = guard std::fs::remove('gate.txt');
```

`seek($offset, $from)` counts from `.start`, `.current` or `.end`. `position()` is where the next
read or write will land. `size()` is `info()`'s size, asked of the open descriptor.

Don't `readall` on a `create()` handle. `.write` is write-only, and the kernel answers with a bad
file descriptor rather than with the bytes you just wrote.

An open file has `$f->info()` too. It asks the descriptor, so a rename since the open does not
matter, and it flushes the write window first. Path `info` is on [Filesystem](/stdlib/fs).

## The window

Every `std::io::file` has an 8 KiB read window and an 8 KiB write window. That's why `readline` on
a file is not one syscall per byte, and why [`stdin->readline()`](/stdlib/io/) is: a `stream` has
nowhere to keep leftover bytes.

Writes land on disk at `flush`, `seek`, `close`, or when the window fills. A write bigger than the
window, with the window empty, goes straight to the kernel.

`fd()` is the raw descriptor. The kernel's offset may disagree with `position()` until you `flush`:
unread bytes have already been pulled, unflushed writes have not been pushed. Don't wrap a live
file's `fd()` in a [`reader` or a `writer`](/stdlib/io/buffering). A `std::io::file` already has
both windows.

## Surface

| | |
|---|---|
| `std::fs::open` / `create` / `append` / `create_new` | `result<std::io::file, ioerror>` |
| `std::io::file::write` | `result<usize, ioerror>`, bytes transferred |
| `std::io::file::read` | into a pointer and a count. `0` is EOF |
| `std::io::file::readall` | the rest of the file, as a `string` |
| `std::io::file::readline` | `result<string?, ioerror>`. `ok(null)` is EOF |
| `foreach` over a `file` | lines, newline stripped. key is the 0-based line number |
| `std::io::file::error` | `ioerror?`. null unless a read during `foreach` failed |
| `std::io::file::seek` / `position` / `size` | `result<int64, ioerror>` |
| `std::io::file::info` | `result<fileinfo, ioerror>`, of the descriptor, after a flush |
| `std::io::file::truncate` / `sync` | `status<ioerror>` |
| `std::io::file::flush` | drain the write window |
| `std::io::file::close` | flush, then close. void. safe twice |
| `std::io::file::fd` | the raw descriptor |
| `ioerror::message` / `missing` / `denied` / `exists` / `not_a_directory` | strerror, and the four questions |

## Next

- [Filesystem](/stdlib/fs) for `path`, `readfile`, `exists`, `copy`, `info`.
- [Directories](/stdlib/io/directories) for `opendir`, `mkdir`, `rmdir`, and `foreach` over a directory.
- [Input and Output](/stdlib/io/) for `print`, streams, and the unbuffered stdin line.
- [Readers and writers](/stdlib/io/buffering) for a window over a stream you do not own.
- [Results](/stdlib/result) for `guard ... else ($e)` and what a `result` is.
- [Environment](/stdlib/env) for `tmp()`, `cwd()`, `pid()`.
- [Time](/stdlib/time) for the `timestamp` a `fileinfo` carries.
