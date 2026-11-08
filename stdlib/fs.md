# Filesystem

A path is a spelling, not the inode. Two names for one file compare unequal. `std::fs::path` holds
that spelling. You join it, you split it, you hand it to a verb. A `string` at a path parameter
converts. The other way is `string()`.

```echo
std::fs::path $p = std::env::tmp() / 'gate.txt';
usize $n = guard std::fs::writefile($p, "chevron seven\nlocked");
string $text = guard std::fs::readfile($p);
echo $text;     // chevron seven
                // locked
bool $ok = guard std::fs::remove($p);
```

`'gate.txt'` works too: it converts. `'foo' / 'bar'` is `foo/bar` on unix and `foo\bar` on Windows.

## Joining

`/` is `join`. An absolute right-hand side replaces. An empty name is this spelling.

```echo
echo ('dir' / 'gate.txt')->string();     // dir/gate.txt
echo ('/a' / '/b')->string();            // /b
echo ('foo' / '')->string();             // foo
```

A missing separator copies the last one already in the spelling, or `std::fs::DS`. A slash in the
right-hand side is a separator too, rewritten to that same one: `'vendor' / 'echolang/libcurl'` is
one nested path. `concat` glues a tail with no extra separator: `file` then `.eco` is `file.eco`.

`hash::of` takes a path, so `map<std::fs::path, V>` works. Equality is the spelling.

## Pieces

`dirname`, `basename`, `stem`, and `extension` split what you wrote. They do not ask the disk.

```echo
std::fs::path $p = 'ships/daedalus.eco';
echo $p->dirname()->string();     // ships
echo $p->basename();              // daedalus.eco
echo $p->stem();                  // daedalus
echo $p->extension();             // .eco
```

A leading-dot name (`.env`) has no extension. No separator at all, and `dirname` is `.`.
`relative($base)` is the tail under `$base`, or null. `file_url()` is a `file://` string for an
absolute path, and null for a relative one.

## Clean

`clean()` is lexical: drop `.`, collapse separators, drop `name/..` except above the root. It does
not touch the disk, and two spellings still compare unequal until you clean both.

```echo
std::fs::path $p = 'a/./b/../c';
echo $p->clean()->string();     // a/c
```

`abs($p)` joins [`cwd()`](/stdlib/env) when `$p` is relative, then cleans. Asking `cwd` can fail, so
`abs` is a `result` too.

## Whole files

`writefile` creates or truncates. `readfile` is the whole contents. Both answer a
[`result`](/stdlib/result), because a missing path is a correct program, not a bug. Leave the
`else` off when a failure should stop. Write one when you want the reason.

`replace` writes through a unique tempfile beside the destination, then renames over it. A crash
in the middle leaves the old file.

`exists` is `result<bool, ioerror>`. Missing is `ok(false)`. Denied is not "no": `EACCES` is a
file that is there, and you are not allowed to see it.

`remove` unlinks a file. `rename` is the other name. Point `remove` at a directory and the kernel
refuses. `remove_all` deletes a tree and does not follow a symlink. A missing path is success.

[Directories](/stdlib/io/directories) is `mkdir`, `rmdir`, and `foreach` over a listing.
`mkdir($p, recursive: true)` creates every missing parent and treats an existing directory as
success.

`writefile` and `mkdir` take `perms:` when you care. The default is 0666 / 0777 before the umask.

## What is there

`info` follows a symlink. `linkinfo` does not, which is how you see `filekind::symlink`.

```echo
std::fs::path $p = std::env::tmp() / 'gate-info.txt';
usize $n = guard std::fs::writefile($p, 'chevron seven');
std::fs::fileinfo $i = guard std::fs::info($p);

echo $i->size;                                  // 13
echo $i->kind == std::fs::filekind::file;       // 1

bool $ok = guard std::fs::remove($p);
```

A `fileinfo` is facts, not a handle. They are true as of the call. `$kind` is `.file`,
`.directory`, `.symlink`, `.other`, or `.unknown`. `$size` is bytes, as an `int64`. `$modified`
and `$accessed` are timestamps. `$created` is a `timestamp?`, and null where nobody kept one.
`$accessed` is whatever the filesystem bothered to write down.

`$perms` is the mode bits. Every question you ask it is a bit test. There is no octal literal, so
`0644` is `0x1a4`. `owner_`, `group_` and `other_` each come with `readable()`, `writable()` and
`executable()`. `is_readonly()` is "nobody may write it". Windows has one permission, read-only:
`chmod` there only reads whether the owner may write.

`copy` replaces whatever was at the destination and gives it the source's permission bits. Times
are not copied. Regular files only: a directory is `EISDIR`. A symlink is followed. Copying a file
onto itself is refused. A tree copy is `opendir` and a loop.

`realpath` asks the filesystem. The path has to exist, every symlink, `.` and `..` gets resolved,
and the answer is absolute.

```echo
std::fs::path $p = std::env::tmp() / 'gate-copy.txt';
std::fs::path $b = std::env::tmp() / 'gate-backup.txt';
usize $n = guard std::fs::writefile($p, 'chevron seven');
bool $copied = guard std::fs::copy($p, $b);
string $text = guard std::fs::readfile($b);
echo $text;     // chevron seven

std::fs::path $full = guard std::fs::realpath($b);
echo $full->is_absolute();       // 1

bool $a = guard std::fs::remove($p);
bool $c = guard std::fs::remove($b);
```

`symlink($target, $link)` stores `$target` as the spelling. `readlink` hands that spelling back.
`hard_link` is a second name for the same inode.

`truncate($p, $n)` sets the size. Growing fills with zeros.

## Temporary names

`tempfile()` / `tempdir()` mint an exclusive name under [`tmp()`](/stdlib/env). Pass a directory
to put them somewhere else. The file comes back closed; open it if you want the stream.

## Opening a stream

`open` / `create` / `append` / `create_new` give you a [`std::io::file`](/stdlib/io/files).
`create` truncates. `create_new` fails if the path is already there. That page is the handle:
`foreach` over lines, seek, flush.

## Surface

| | |
|---|---|
| `path` | a spelling. `string()` / `view()` / `cstr()` the other way. `is_absolute()`, `clean()` |
| `/` / `join` / `concat` | join with a separator, or glue a tail |
| `dirname` / `basename` / `stem` / `extension` | split the spelling |
| `relative` / `file_url` | nullable. tail under a base, or a `file://` string |
| `DS` | `/` on unix, `\` on Windows |
| `abs` | `result<path, ioerror>`. `cwd` then `clean` |
| `readfile` / `writefile` / `replace` | the whole contents. `writefile` takes `perms:` |
| `exists` | `result<bool, ioerror>`. missing is `ok(false)` |
| `remove` / `rename` | `result<bool, ioerror>`, `ok(true)` on success |
| `remove_all` | `status<ioerror>`. a tree. a missing path is success |
| `info` / `linkinfo` | `result<fileinfo, ioerror>`. `info` follows a symlink |
| `chmod` | `result<bool, ioerror>`, sets a `fileperms` |
| `copy` | `result<bool, ioerror>`. one regular file |
| `realpath` | `result<path, ioerror>`. absolute, every link resolved |
| `symlink` / `readlink` / `hard_link` | a link, its spelling, a second name for the inode |
| `truncate` | `status<ioerror>`, of a path |
| `tempfile` / `tempdir` | exclusive names under `tmp()`, or under a directory you pass |
| `open` / `create` / `append` / `create_new` | `result<std::io::file, ioerror>` |
| `fileinfo` | `$kind`, `$size`, `$perms`, `$modified`, `$accessed`, `$created` (nullable) |
| `fileperms` | `mode()`, `owner_` / `group_` / `other_` each with readable / writable / executable, `is_readonly()` |

## Next

[Files](/stdlib/io/files) is the stream: `foreach` over lines, seek, flush.
[Directories](/stdlib/io/directories) is `opendir`, `mkdir`, `dirent`.
[Environment](/stdlib/env) is `cwd`, `tmp`, `home`, `chdir`.
