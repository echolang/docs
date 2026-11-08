# Directories

You have a path and you want the names inside it. That is `std::fs::opendir`, then `foreach`. The
path is [`std::fs::path`](/stdlib/fs). A string literal still converts.

```echo
bool $made = guard std::fs::mkdir('gate-dir');

std::fs::path $path = 'gate-dir' / 'dial.txt';

usize $n = guard std::fs::writefile($path, 'seven chevrons');

std::fs::dir $d = guard std::fs::opendir('gate-dir');

foreach ($d as $entry) {
    echo $entry->name();        // dial.txt
    echo $entry->is_file();     // 1
}

bool $rm = guard std::fs::remove($path);
bool $rd = guard std::fs::rmdir('gate-dir');
```

`opendir` answers a [`result`](/stdlib/result), because a missing directory is a correct program, not
a bug. The loop itself yields values. `.` and `..` are not in the stream. I skipped them on purpose:
Python does, Rust does, and a loop that has to filter the two names every directory on earth contains
is a loop I did not want to write.

Leave the `else` off when a failure should stop the program. Write one when you want the reason.

There is no recursive walk. One directory, its children, and if you want a tree you recurse. That is
a different type and it is not this one.

## Missing

```echo
std::fs::dir $d = guard std::fs::opendir('definitely-missing-echo-docs-dir-xyz') else ($e) {
    echo $e->missing();     // 1
    return 0;
}

echo 'opened';
```

Same questions [`ioerror`](/stdlib/io/files) already answers on a file. Opening a file as a
directory is not `missing()`. It fails, and `not_a_directory()` is true.

## name, path, and kind

Each turn of the loop is a `dirent`. `name()` is the basename. `path()` is
the opened directory joined with the name. It is not canonical, and it is
not absolute just because you asked: `opendir('foo')` yields `foo/bar`.

```echo
bool $made = guard std::fs::mkdir('chulak-dir');

std::fs::path $file = 'chulak-dir' / 'gate.txt';
std::fs::path $sub = 'chulak-dir' / 'south';

usize $n = guard std::fs::writefile($file, 'locked');
bool $ms = guard std::fs::mkdir($sub);

std::fs::dir $d = guard std::fs::opendir('chulak-dir');

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

bool $rm = guard std::fs::remove($file);
bool $rs = guard std::fs::rmdir($sub);
bool $rd = guard std::fs::rmdir('chulak-dir');
```

`is_file()` and `is_directory()` read what the listing already knew. They do not `stat`. `kind()` is a
`std::fs::filekind`, the same enum [`info`](/stdlib/fs) answers with. A symlink is
`.symlink`, the link itself and not what it points at. `std::fs::info($ent->path())` follows it. A network
filesystem that declines to say is `.unknown`: both predicates are false, and `kind()` is how you tell that
from a socket or a device, which are `.other`. Order is the filesystem's. Do not golden-test the sequence.

A second `foreach` over the same `dir` sees whatever the first one did not consume. A finished loop
leaves nothing. `iterate()` does not rewind.

## mkdir and rmdir

`mkdir` makes one directory. `mkdir($p, recursive: true)` makes every missing parent and treats
an existing directory as success. A path that is already a file is `exists()` on the error.

```echo
bool $made = guard std::fs::mkdir('dakar-dir');
echo $made;     // 1

bool $again = guard std::fs::mkdir('dakar-dir') else ($e) {
    echo $e->exists();      // 1
    bool $rd = guard std::fs::rmdir('dakar-dir');
    return 0;
}

echo 'twice';
```

```echo
bool $tree = guard std::fs::mkdir('dakar-tree' / 'south', recursive: true);
echo $tree;     // 1
guard std::fs::remove_all('dakar-tree');
```

`rmdir` is empty-only. A directory that still has children fails. `remove` is still unlink-a-file;
point it at a directory and the kernel refuses, the way it always did.

Mode on POSIX is `0777`, and the umask takes its usual cut. That is `open`'s `0666` bargain, for a
directory. `mkdir` takes `perms:` when you care.

A tree delete is [`remove_all`](/stdlib/fs) on Filesystem. A symlink is unlinked, never followed.

## Listing failures

Opening is the fallible step. A `readdir` that fails later stops the loop and leaves the reason on
the handle:

```echo
bool $made = guard std::fs::mkdir('error-dir');
std::fs::dir $d = guard std::fs::opendir('error-dir');

foreach ($d as $entry) {
}

echo $d->error() == null;     // 1

bool $rd = guard std::fs::rmdir('error-dir');
```

End of the directory is not an error. `error()` stays null. Check it if the loop ended sooner than
the directory you thought you had.

## Surface

| | |
|---|---|
| `opendir` | `result<std::fs::dir, ioerror>` |
| `mkdir` / `rmdir` | `result<bool, ioerror>`, `ok(true)` on success. `mkdir($p, recursive: true)` makes parents |
| `std::fs::dir` | class. last handle closes. `foreach` yields `dirent` |
| `std::fs::dir::error` | `ioerror?`. null unless a `readdir` failed |
| `std::fs::dir::close` | void. safe twice |
| `dirent::name` / `path` | basename, and the joined path |
| `dirent::kind` | a `filekind`: `unknown` / `file` / `directory` / `symlink` / `other`, from the listing |
| `dirent::is_file` / `is_directory` | from the listing, not from `stat` |
| `ioerror::not_a_directory` | `ENOTDIR`. opening a file with `opendir` |

## Next

- [Filesystem](/stdlib/fs) for `path`, `remove_all`, `info`.
- [Files](/stdlib/io/files) for opening a path and reading its bytes, including `foreach` over lines.
- [Input and Output](/stdlib/io/) for `print`, streams, and the unbuffered stdin line.
- [Iteration](/collections/iteration) for the protocol `foreach` actually knows.
- [Environment](/stdlib/env) for `tmp()`, `cwd()`, `home()`.
