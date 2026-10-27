# Processes

Sooner or later a program has to run another program. A build tool calls `git`, a test harness runs
the thing it is testing. `std::process` is how: you describe the command, then you ask it to run.

<!-- verify: skip -->
```echo
std::process::output $o = guard std::process::command('git', ['status', '--short'])->output() else ($e) {
    die("git: {$e}");
}

std::io::print($o->stdout);
echo "git said: {$o->status}";        // git said: exit 0
```

A `command` is a description. Program, arguments, environment, working directory, where the three
standard streams go. Nothing starts until `status()`, `output()`, or `spawn()`. There is no shell
in between, so no quoting to get wrong and no `$HOME` expanding behind your back. The arguments are
a list, and the child gets that list.

WASI has no processes to start, and iOS will not let you start one. A program that needs
`std::process` fails to compile there, rather than failing at the first spawn.

## Three ways to run it

`status()` inherits all three streams, so the child prints on your terminal, and waits:

<!-- verify: skip -->
```echo
std::process::exit_status $s = guard std::process::command('make', ['-j8'])->status() else ($e) {
    die("make: {$e}");
}

if (!$s->success()) {
    die("make failed: {$s}");
}
```

`output()` captures stdout and stderr, waits, and hands you both along with the status. That is the
first example on this page.

`spawn()` starts it and gives you a `child` right away. You talk to it, wait, or kill it yourself:

<!-- verify: skip -->
```echo
std::process::child $server = guard std::process::command('./server', ['--port', '8080'])->spawn() else ($e) {
    die("server: {$e}");
}

guard $server->kill() else ($e) { die("kill: {$e}"); }
std::process::exit_status $s = guard $server->wait() else ($e) { die("wait: {$e}"); }
```

Every one of them answers `result<..., std::io::ioerror>`, the same type a file open gives you. A
program that is not there is `$e->missing()`. One you are not allowed to run is `$e->denied()`.

## The name is looked up on the child's PATH

A bare name like `git` is searched on the `PATH` **the child will have**. That is the inherited one,
unless you set a different one with `env('PATH', ...)`. The current directory is never searched.

<!-- verify: skip -->
```echo
std::process::command $c = std::process::command('tool');
$c->env('PATH', '/opt/tools/bin');

std::process::exit_status $s = guard $c->status() else ($e) { die("tool: {$e}"); }
```

A name with a path separator in it is a path, used as written. A relative one is made absolute
against **this** process's working directory, so `dir()` decides where the child runs and never
which program it is. `./build/tool` with `dir('/tmp')` is still your `./build/tool`.

On Windows a bare name without an extension gets `.exe`, so `command('git')` finds `git.exe`.

## Arguments are a list

You never quote anything. `'two words'` arrives as one argument, `''` as an empty one, a `"` is
just a character:

<!-- verify: skip -->
```echo
std::process::output $o = guard std::process::command('printf', ['%s|', 'two words', '', 'a"b'])->output() else ($e) {
    die("printf: {$e}");
}

echo $o->stdout;        // two words||a"b|
```

Here is the catch, and it is a Windows one. A `.bat` or `.cmd` file is run by cmd.exe, and cmd.exe
parses that string a second time, where `&` starts a new command and `%PATH%` expands. So a batch
file's arguments are escaped for cmd as well, and one that cannot be carried through safely (a
newline, a `"` in the script's own path) is refused with `EINVAL` rather than passed on half-escaped.
An argument that came from a user cannot turn into a second command.

A NUL anywhere in the program, an argument, an environment key or value, or the directory, is
refused the same way. A C string would end at it.

## Environment and directory

The child starts with this process's environment, edited:

<!-- verify: skip -->
```echo
std::process::command $c = std::process::command('env');
$c->env('LANG', 'C');
$c->env_remove('DEBUG');
$c->dir('/tmp');

std::process::output $o = guard $c->output() else ($e) { die("env: {$e}"); }
```

The last edit to a key wins. `env_clear()` starts from empty, and the `env()` calls after it are
all the child gets. A key that is empty or holds `=` is refused: it would come back out as a
different variable. On Windows, keys are case-insensitive, so `env('path', ...)` replaces `Path`.

`env_clear()` with no `PATH` of its own still searches this process's PATH for a bare name. Clearing
the environment does not make every name disappear. `env('PATH', '')` does: that is an empty PATH.

## Where the streams go

Each of `stdin()`, `stdout()` and `stderr()` takes its own type, so a case that does not belong
there does not compile. `.merge` is only on `stderr`. `.pipe($r)` is only on `stdin`.

| | |
|---|---|
| `.inherit` | the same stream this process has. Default for `status()` and `spawn()` |
| `.piped` | a pipe to this process. Default for stdout and stderr in `output()` |
| `.discard` | the null device |
| `.merge` | stderr only: wherever stdout went |
| `.file($f)` | an open `std::io::file` |
| `.pipe($r)` | stdin only: another child's piped stdout |

A stream you set yourself is never overridden. `output()` only fills in the ones you left alone.

<!-- verify: skip -->
```echo
std::process::command $c = std::process::command('make', ['all']);
$c->stderr(.merge);

std::process::output $o = guard $c->output() else ($e) { die("make: {$e}"); }
std::io::print($o->stdout);
```

`.file($f)` hands the child the file at the position your program sees it. Unflushed writes go out
first, unread bytes come back first. A file that cannot seek and still holds read-ahead is `EINVAL`.

`.pipe($r)` joins two children. The first one's output goes straight into the second, without
passing through your program:

<!-- verify: skip -->
```echo
std::process::command $ls = std::process::command('ls', ['-1']);
$ls->stdout(.piped);
std::process::child $a = guard $ls->spawn() else ($e) { die("ls: {$e}"); }

std::process::command $sort = std::process::command('sort', ['-r']);
$sort->stdin(.pipe($a->stdout() ?? die('stdout was piped')));

std::process::output $sorted = guard $sort->output() else ($e) { die("sort: {$e}"); }
std::process::exit_status $first = guard $a->wait() else ($e) { die("ls: {$e}"); }
```

After the spawn, your copy of that reader is closed. That is what lets `sort` see the end of its
input when `ls` finishes.

## Talking to a child

Pipe stdin and stdout, and the `child` hands you a `std::io::pipe_writer` and a
`std::io::pipe_reader`. They are owned like a `file`: the last handle closes them. **`close()` on
the writer is how the child sees the end of its input**, which a program like `sort` is waiting
for:

<!-- verify: skip -->
```echo
std::process::command $c = std::process::command('sort');
$c->stdin(.piped);
$c->stdout(.piped);
std::process::child $child = guard $c->spawn() else ($e) { die("sort: {$e}"); }

std::io::pipe_writer $in = $child->stdin() ?? die('stdin was piped');
usize $pear = guard $in->writeline('pear') else ($e) { die("write: {$e}"); }
usize $apple = guard $in->writeline('apple') else ($e) { die("write: {$e}"); }
$in->close();

std::io::pipe_reader $out = $child->stdout() ?? die('stdout was piped');
string $sorted = guard $out->readall() else ($e) { die("read: {$e}"); }
std::process::exit_status $s = guard $child->wait() else ($e) { die("wait: {$e}"); }

std::io::print($sorted);        // apple, then pear
```

When all you want is to feed it something and read the answer, `output($input)` does the whole
dance. The input is written **while** stdout and stderr are being read. A pipe holds a few dozen
kilobytes. A child that answers as it reads would fill its stdout, stop, and wait for you, while
you are stuck writing input it no longer reads.

`wait()` closes piped stdin first, for the same reason: otherwise you wait for a child that is
waiting for you.

## Dropping a child does nothing

The process keeps running. Nobody waits for it. That is deliberate: a handle going out of scope
should not block on a server that runs for an hour, and it should not kill one either. If you care
how a child ended, wait for it. On POSIX a child nobody waits for stays in the process table until
your program exits.

`kill()` stops it at once (`SIGKILL` / `TerminateProcess`). Killing a child that already ended is
not an error. You still wait afterwards to collect the status. `try_wait()` never blocks, and
answers `null` while the child is still running.

<!-- verify: skip -->
```echo
std::process::exit_status $s = guard std::process::command('sh', ['-c', 'exit 3'])->status() else ($e) {
    die("sh: {$e}");
}

echo "{$s->success()}";    // false
echo $s->code() ?? -1;     // 3
echo "{$s}";               // exit 3
```

`code()` is `null` when a signal stopped the child, and then `signal()` says which one. Windows has
no signals, so there `signal()` is always `null`.

## A pipe whose reader went away

A child you started with `.piped` can close its end. `pipe_writer::write` then fails with `EPIPE`
as an ordinary `ioerror`, and you handle it.

The child's own SIGPIPE is a different question. An ignored signal stays ignored across `exec`, so
if your program ignored it, `yes | head` started from here would never stop. A child gets SIGPIPE
back at its default.

Your own stdout is the other case.
[Input and Output](/stdlib/io/#a-closed-stdout-ends-the-program) owns that: a failed write to
stdout or stderr ends the program with status 141.

Windows has no SIGPIPE. A write there just fails. A library leaves SIGPIPE alone too: it runs
inside somebody else's process.

## Next

- [Input and Output](/stdlib/io/) for the streams, and [Readers and writers](/stdlib/io/buffering)
  for the pipe ends
- [Environment](/stdlib/env) for this process's own arguments, environment and `exit`
- [Threads](/stdlib/thread) when you want work done concurrently without a second program
