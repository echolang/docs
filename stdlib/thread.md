# Threads

`std::thread` is an ordinary library. `spawn` starts an OS thread, a `handle` joins it, a
`mutex<T>` sleeps, `once` runs a function once. There is no type named `future` and no function
named `async`. A value comes back through a `mutex` or a `task<T>`.

```echo
use std::thread;

#[atomic]
class Counter
{
    atomic<int32> $hits;

    constructor()
    {
        $this->hits = atomic<int32>(0);
    }

    function bump() : void
    {
        $this->hits->add(1);
    }

    function get() : int32
    {
        return $this->hits->load();
    }
}

Counter $c = Counter();

thread::handle $w = guard thread::spawn(function() : void {
    $c->bump();
}) else ($e) {
    die($e->message());
}

$c->bump();
$w->join();
echo $c->get();        // 2
```

`spawn` takes `function<void()>` and returns `result<handle, error>`. `guard` it, or you have not
started a thread. The class is marked [`#[atomic]`](/memory/atomics), and the field is an
`atomic<int32>`, because the handle is copied onto another thread and both sides write the same
word. An unmarked class with a plain `int32` would compile. It would also be a data race.

`use std::thread;` binds the prefix, so you write `thread::spawn`. Same shape as `use std::math;`
and `math::sqrt`.

## Join is the default

Last drop of the handle joins. Forgetting the handle is still a join, not a leak of a running
thread:

```echo
use std::thread;

#[atomic]
class Flag
{
    atomic<int32> $done;

    constructor()
    {
        $this->done = atomic<int32>(0);
    }
}

Flag $f = Flag();

{
    thread::handle $w = guard thread::spawn(function() : void {
        $f->done->store(1);
    }) else ($e) {
        die($e->message());
    }
}

echo $f->done->load();        // 1
```

`$w` dropped at the inner brace, so the `echo` cannot run until the worker has stored. `join()`
is what you write when you want that moment named.

`detach()` is how you decline. After it, dropping the handle does nothing, and nobody waits:

```echo
use std::thread;

thread::handle $w = guard thread::spawn(function() : void {
}) else ($e) {
    die($e->message());
}

$w->detach();
```

A second `join` or `detach` on the same handle is a no-op. The first one wins.

## A value comes back as a task

`spawn(function<T()>)` is the other overload. It returns `result<task<T>, error>`. `wait()` joins,
then copies the slot:

```echo
use std::thread;

thread::task<int32> $t = guard thread::spawn(function() : int32 {
    return 40 + 2;
}) else ($e) {
    die($e->message());
}

echo $t->wait();        // 42
```

There is no `task<void>`. That is a `handle`. Failure of `spawn` is "the thread never started".
What `$work` itself returns is `T`. A failing computation is a `T` that is itself a
[`result`](/stdlib/result), not a second error channel here.

`&name` dest-types as `function<R(P...)>`, so a named function needs no wrapper:

```echo
use std::thread;

function answer() : int32
{
    return 40 + 2;
}

thread::task<int32> $t = guard thread::spawn(&answer) else ($e) {
    die($e->message());
}

echo $t->wait();        // 42
```

Dropping a task you never `wait()`ed still waits. The destructor joins before the slot dies, so an
owning `T` the worker is still writing cannot race that drop:

```echo
use std::thread;

thread::task<string> $t = guard thread::spawn(function() : string {
    thread::sleep(20);
    return 'owned';
}) else ($e) {
    die($e->message());
}
```

That program prints nothing and still joins. The string is destroyed after the worker has seated
it, not while it is being written.

## The value lives inside the lock

`mutex<T>` keeps `T` inside the object. There is no way to name it without going through `lock()`.
`$held->value` is a place:

```echo
use std::thread;

thread::mutex<int32> $m = thread::mutex<int32>(0);

{
    thread::locked<int32> $g = $m->lock();
    $g->value = 7;
}

thread::locked<int32> $g = $m->lock();
echo $g->value;        // 7
```

The inner block unlocks when `$g` drops. Unlock is the destructor. `locked<T>` is
[`#[unique]`](/memory/copying#unique-for-a-type-only-one-value-may-ever-name) so it cannot be
copied: that would unlock twice.

Copying the address out of `$held->value` and reading it after the guard dies is the same class of
rule as a slice outliving its array. The type will not stop you. The lock will not be held.

Sharing the mutex across threads is the point. `mutex` is itself `#[atomic]`, so the handle can
cross:

```echo
use std::thread;

thread::mutex<int32> $m = thread::mutex<int32>(0);

thread::handle $w = guard thread::spawn(function() : void {
    thread::locked<int32> $g = $m->lock();
    $g->value = $g->value + 1;
}) else ($e) {
    die($e->message());
}

{
    thread::locked<int32> $g = $m->lock();
    $g->value = $g->value + 1;
}

$w->join();

thread::locked<int32> $done = $m->lock();
echo $done->value;        // 2
```

`try_lock` answers `locked<T>?`. `null` means busy. Anything else from the platform is a `die`,
the same as `lock()` failing:

```echo
use std::thread;

thread::mutex<int32> $m = thread::mutex<int32>(1);
thread::locked<int32> $held = $m->lock();

thread::locked<int32>? $again = $m->try_lock();
echo $again == null;        // 1
```

## once runs the function once

Every caller waits, losers included. `$work` runs with the gate dropped, so it may take other
locks:

```echo
use std::thread;

#[atomic]
class Cell
{
    int32 $n;

    constructor()
    {
        $this->n = 0;
    }

    function bump() : void
    {
        $this->n = $this->n + 1;
    }
}

Cell $cell = Cell();
thread::once $o = thread::once();
$o->run(function() : void { $cell->bump(); });
$o->run(function() : void { $cell->bump(); });
echo $cell->n;        // 1
```

It must not call `run` on this same `once`. That waits for itself. There is no condition variable
yet, so there is no other way to wait.

## What is safe to share

- A class handle that crosses a thread without a lock must be `#[atomic]`. That is the count, not
  the fields. [Atomics](/memory/atomics) is the chapter.
- A string copy is fine. `str::buf` is already marked.
- A closure environment is minted marked, which is why a captured local can be spawned at all. A
  [`#[unique]`](/language/closures) capture is still refused: there is nothing to copy.
- An unmarked class handle copied onto another thread is a data race. Echo will not stop you.
  There is no race detector.

`atomic<T>` cannot be captured by copy, because it is unique. Put the word on a marked class, as
the first example does, and capture the handle.

## The rest of the namespace

`thread::id` is an identifier, not a handle. You cannot join yourself. `current()` is this
thread. `==` compares two:

```echo
use std::thread;

thread::id $here = thread::current();
echo $here == thread::current();        // 1
```

`yield()` asks the scheduler to run someone else. `sleep($ms)` sleeps, chopped into pieces of at
most 500 milliseconds so a long sleep is still interruptible by the platform's `usleep` limit.
`concurrency()` is how many processors the platform reports, and 1 when it declines:

```echo
use std::thread;

thread::yield();
thread::sleep(1);
echo thread::concurrency() >= 1;        // 1
```

`error` is why a thread could not be started: an errno and the sentence you print.
`exhausted()` is `EAGAIN`, the platform saying it will not give you another one.

```echo
use std::thread;

function start() : result<thread::handle, thread::error>
{
    return thread::spawn(function() : void {});
}

thread::handle $w = guard start() else ($e) {
    die($e->message());
}

$w->join();
```

## What this is not

No async. No `future`. No channels. No condition variable. No `rwlock`. No `thread_local`.
[What is missing](/reference/limitations) keeps the list.

This is OS threads and a sleeping lock. That is the whole of it, and it is enough to write the
programs that need a second core.

## Next

- [Atomics](/memory/atomics) for `#[atomic]` and `atomic<T>`.
- [Closures](/language/closures) for what a `function<void()>` actually captures.
- [Results](/stdlib/result) for `guard` and `result<T, E>`.
- [What is missing](/reference/limitations) for the rest of the concurrency surface.
