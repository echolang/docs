# Directories

You have a path and you want the names inside it. That is `std::io::opendir`, then `foreach`. A path
is still a `string`. There is no path type.

```echo
bool $made = guard std::io::mkdir('gate-dir');

string $path = std::env::join('gate-dir', 'dial.txt');

usize $n = guard std::io::writefile($path, 'seven chevrons');

std::io::dir $d = guard std::io::opendir('gate-dir');

foreach ($d as $entry) {
    echo $entry->name();        // dial.txt
    echo $entry->is_file();     // 1
}

bool $rm = guard std::io::remove($path);
bool $rd = guard std::io::rmdir('gate-dir');
```

`opendir` answers a [`result`](/stdlib/result), because a missing directory is a correct program, not
a bug. The loop itself yields values. `.` and `..` are not in the stream. I skipped them on purpose:
Python does, Rust does, and a loop that has to filter the two names every directory on earth contains
is a loop I did not want to write.

Leave the `else` off when a failure should stop the program. Write one when you want the reason.

There is no recursive walk. One directory, its children, and if you want a tree you recurse. That is
a different type and it is not this one.

## A missing directory is `missing()`, not a die

```echo
std::io::dir $d = guard std::io::opendir('definitely-missing-echo-docs-dir-xyz') else ($e) {
    echo $e->missing();     // 1
    return 0;
}

echo 'opened';
```

Same questions [`ioerror`](/stdlib/io/files) already answers on a file. Opening a file as a
directory is not `missing()`. It fails, and `not_a_directory()` is true.

## name, path, and kind

Each turn of the loop is a `dirent`. `name()` is the basename. `path()` is
[`std::env::join`](/stdlib/env) of the opened directory and the name. It is not canonical, and it is
not absolute just because you asked: `opendir('foo')` yields `foo/bar`.

```echo
bool $made = guard std::io::mkdir('chulak-dir');

string $file = std::env::join('chulak-dir', 'gate.txt');
string $sub = std::env::join('chulak-dir', 'south');

usize $n = guard std::io::writefile($file, 'locked');
bool $ms = guard std::io::mkdir($sub);

std::io::dir $d = guard std::io::opendir('chulak-dir');

bool $saw_file = false;
bool $saw_dir = false;

foreach ($d as $entry) {
    if ($entry->name() == 'gate.txt') {
        $saw_file = $entry->is_file();
        echo $entry->path() == $file;   // 1
    }

    if ($entry->name() == 'south') {
        $saw_dir = $entry->is_directory();
    }
}

echo $saw_file;     // 1
echo $saw_dir;      // 1

bool $rm = guard std::io::remove($file);
bool $rs = guard std::io::rmdir($sub);
bool $rd = guard std::io::rmdir('chulak-dir');
```

`is_file()` and `is_directory()` read what the listing already knew. They do not `stat`. A symlink
is `other`. A network filesystem that declines to say is `unknown`: both predicates are false, and
`kind()` is how you tell those two apart. Order is the filesystem's. Do not golden-test the sequence.

A second `foreach` over the same `dir` sees whatever the first one did not consume. A finished loop
leaves nothing. `iterate()` does not rewind.

## mkdir and rmdir

`mkdir` makes one directory. It does not make parents. A path that is already there is
`exists()`, not success.

```echo
bool $made = guard std::io::mkdir('dakar-dir');
echo $made;     // 1

bool $again = guard std::io::mkdir('dakar-dir') else ($e) {
    echo $e->exists();      // 1
    bool $rd = guard std::io::rmdir('dakar-dir');
    return 0;
}

echo 'twice';
```

`rmdir` is empty-only. A directory that still has children fails. `remove` is still unlink-a-file;
point it at a directory and the kernel refuses, the way it always did.

Mode on POSIX is `0777`, and the umask takes its usual cut. That is `open`'s `0666` bargain, for a
directory.

There is no `mkdir_p`, and no `remove_all`. Walk it yourself, or don't.

## When a listing fails after it started

Opening is the fallible step. A `readdir` that fails later stops the loop and leaves the reason on
the handle:

```echo
bool $made = guard std::io::mkdir('error-dir');
std::io::dir $d = guard std::io::opendir('error-dir');

foreach ($d as $entry) {
}

echo $d->error() == null;     // 1

bool $rd = guard std::io::rmdir('error-dir');
```

End of the directory is not an error. `error()` stays null. Check it if the loop ended sooner than
the directory you thought you had.

## The whole surface

| | |
|---|---|
| `opendir` | `result<std::io::dir, ioerror>` |
| `mkdir` / `rmdir` | `result<bool, ioerror>`, `ok(true)` on success |
| `std::io::dir` | class. last handle closes. `foreach` yields `dirent` |
| `std::io::dir::error` | `ioerror?`. null unless a `readdir` failed |
| `std::io::dir::close` | void. safe twice |
| `dirent::name` / `path` | basename, and the joined path |
| `dirent::kind` | `unknown` / `file` / `directory` / `other`, from the listing |
| `dirent::is_file` / `is_directory` | from the listing, not from `stat` |
| `ioerror::not_a_directory` | `ENOTDIR`. opening a file with `opendir` |

## Next

- [Files](/stdlib/io/files) for opening a path and reading its bytes, including `foreach` over lines.
- [Input and Output](/stdlib/io/) for `print`, streams, and the unbuffered stdin line.
- [Iteration](/collections/iteration) for the protocol `foreach` actually knows.
- [Environment](/stdlib/env) for `tmp()`, `cwd()`, `DS`, and `join`.
- [What is missing](/reference/limitations) for the path type, recursive walk, and `mkdir_p`.
