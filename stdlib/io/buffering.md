# Readers and writers

A `stream` is one `int32`. It has nowhere to keep leftover bytes, which is why
[`stdin->readline()`](/stdlib/io/) is one `read` per byte. Buffering needs a value you hold.

`reader` and `writer` wrap a `stream`. They don't own the descriptor and they don't close it. The last
`writer` flushes.

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

Leftover bytes now have somewhere to sit, so a line is not one syscall per character.

## The window

`write` and `writeline` go into an 8 KiB window and hit the kernel when it fills, on `flush`, or
when the last handle goes. Reads fill the same size of window. `readline` scans it for a newline and only
hits the kernel when the line crosses a fill.

If you wrap stdout, `flush` before `echo`. `echo` goes through printf, the writer through `write(2)`,
and an unflushed window is a third place for output to sit.

## They do not own the descriptor

A `reader` or `writer` copies the fd out of the stream and forgets the stream. Closing stdin because a
`reader` went out of scope would be a hell of a surprise, so they don't. A
[`std::io::file`](/stdlib/io/files) is the type that closes what it opened.

The last `writer` does flush. A `reader` does nothing on the way out: unread bytes in the window are
simply dropped, and the next reader of that descriptor will not see them. That's the cost of having
stolen them from the kernel in the first place.

## Do not wrap a live file

A `std::io::file` already has both windows. Wrapping its `fd()` in a `reader` or a `writer` would steal
bytes from the file's own window, and the two would disagree about where you are. If you have a
`std::io::file`, use that.

These two are for streams you don't own: stdin, stdout, stderr, or a descriptor someone else handed you.

## The whole surface

| | |
|---|---|
| `reader(stream)` | a read window. does not own, does not close |
| `reader::read` | into a pointer and a count. `0` is EOF |
| `reader::readline` | `result<string?, ioerror>`. `ok(null)` is EOF |
| `reader::readall` | the rest of the descriptor, as a `string` |
| `writer(stream)` | a write window. does not own, does not close |
| `writer::write` | `result<usize, ioerror>`, into the window |
| `writer::writeline` | the same, then a newline |
| `writer::flush` | drain the window. the last handle does this |

`ioerror` is the same type [files](/stdlib/io/files) use. `"{$e}"` is `message()`.

## Next

- [Input and Output](/stdlib/io/) for `print`, streams, and the unbuffered stdin line.
- [Files](/stdlib/io/files) for a descriptor you opened.
- [Results](/stdlib/result) for `guard ... else ($e)`.
