# Debugging

Two tools, and the small one first. `dprint` prints a value with its whole structure and needs nothing from
the build; a debugger steps through your `.eco` file line by line and needs `-g`. Most of the time the print
is the faster answer, so start there and reach for the debugger when it stops being enough.

## `dprint`, for when a debugger is more than you need

`dprint` is a builtin that prints any value with its structure and its types, recursively:

```echo
struct Point
{
    float64 $x;
    float64 $y;
}

struct Line
{
    Point $a;
    Point $b;
}

Line $l = Line(Point(0.0, 0.0), Point(3.0, 4.0));

dprint($l);
```

```
[Line] {
  [Point] $a = {
    [float64] $x = 0
    [float64] $y = 0
  }
  [Point] $b = {
    [float64] $x = 3
    [float64] $y = 4
  }
}
```

It is a compile-time expansion rather than a runtime walk, so the whole shape is known and a static one costs
a single `printf`. It needs no `-g` and works under `run`.

The catch is the one the debugger has too: `dprint` shows a container's internals, because it has no
library-specific knowledge either.

```echo
array<int32> $nums = [1, 2, 3];
dprint($nums);
```

```
[array<int32>] {
  [mem::buffer<int32>] $storage = {
    [ptr<int32>] $data = 0x130fb38b0
    [usize] $cap = 4
  }
  [usize] $len = 3
}
```

For a container, `foreach` and `echo` will tell you more. The debugger's answer to the same problem is
[the formatters](#containers-need-the-formatters), further down.

## Stepping through your own source

`echoc build -g` puts real DWARF in the object, which means **a debugger steps through your `.eco` file**, one
line at a time, with your own variable names. Not the IR, not the generated assembly. The file you wrote.

```bash
echoc build -g -o plot plot.eco
lldb ./plot
```

On macOS echoc runs `dsymutil` for you afterwards, because the linker leaves the DWARF behind in the objects
and lldb would otherwise find nothing. That is why a `-g` build leaves a `plot.dSYM` beside the binary.

## A session, start to finish

Take a small program:

```echo
struct Point
{
    float64 $x;
    float64 $y;
}

function scale(Point& $p, float64 $by) : float64
{
    float64 $sum = $p->x * $by;
    return $sum + $p->y;
}

Point $origin = Point(3.0, 4.0);

echo scale(&$origin, 10.0);     // 34.000000
```

Build it with `-g`, break on line 10, and look around:

```
(lldb) breakpoint set --file plot.eco --line 10
Breakpoint 1: where = plot`_scaleZZMRBMLC5PointZMLPd + 32 at plot.eco:10:5, address = 0x000000010000248c

(lldb) run
Process 60743 stopped
* thread #1, stop reason = breakpoint 1.1
    frame #0: plot`_scaleZZMRBMLC5PointZMLPd(p=0x000000016fdfde60, by=10) at plot.eco:10:5
   7   	function scale(Point& $p, float64 $by) : float64
   8   	{
   9   	    float64 $sum = $p->x * $by;
-> 10  	    return $sum + $p->y;
   11  	}

(lldb) bt
  * frame #0: plot`_scaleZZMRBMLC5PointZMLPd(p=0x000000016fdfde60, by=10) at plot.eco:10:5
    frame #1: plot`main at plot.eco:15:1

(lldb) frame variable
(Point *) p = 0x000000016fdfde60
(double) by = 10
(double) sum = 30

(lldb) p *p
(Point) {
  x = 3
  y = 4
}
```

Everything you would want is there: the breakpoint resolved to a real address, the backtrace shows your
function and its caller with your line numbers, a parameter and a local read their actual values, and members
are reachable through the borrow.

## `-g` is not `--debug`

These get confused constantly and they are genuinely orthogonal.

`--debug` and `--release` decide what checks your **program** carries: `assert`, bounds checks, narrowing
checks. `-g` decides what your **object** tells a debugger.

So all four combinations exist and three of them are useful:

```bash
echoc build -g -o plot plot.eco             # release semantics, fully debuggable
echoc build -g --debug -o plot plot.eco     # assertions on, fully debuggable
```

The first one looks odd and is the one you want more often than you would guess. A crash that only happens
with assertions compiled out is exactly the crash you need a debugger for, and turning them back on can make
it go away.

## `-g` turns the optimizer off, unless you say otherwise

`-g` sets `--optimize none` unless you passed `--optimize` yourself. A line table over optimized output
describes a program nobody wrote, where locals live nowhere, statements execute in an order you did not put
them in, and stepping is a good way to lose an afternoon.

If you genuinely need to debug an optimized build, ask for it and accept what you get:

```bash
echoc build -g --optimize module -o plot plot.eco
```

## Containers need the formatters

Here is the part that decides whether debugging Echo is pleasant. Out of the box, an `array<T>` reads as its
internals:

```
(lldb) frame variable
(array<string>) names = {
  storage = {
    data = 0x0000000125e05ec0
    cap = 4
  }
  len = 2
}
(map<string,int32>) ages = {
  hashes = 0x0000000125e05e40
  keys = 0x0000000125e06090
  values = 0x0000000125e05560
  len = 1
  tombs = 0
  cap = 8
}
(string) part = {
  window = (bytes = "Alice", size = 3)
  owner = nullptr
}
```

Import the standard library's formatters and the same frame reads like the program you wrote:

```
(lldb) command script import tools/echo_lldb.py
(lldb) frame variable
(array<string>) names = ["Alice", "Bob"]
(map<string,int32>) ages = {"Alice": 30}
(string) s = "Alice"
(string) part = "Ali"
(int32?) maybe = 7
(int32?) missing = null
(Node *) n = 0x0000000134704200 Node(id = 9)
```

Indexing works, and so does asking for a class's own fields:

```
(lldb) v names[1]
(string) names[1] = "Bob"

(lldb) v -P1 n
(Node *) n = 0x0000000134704200 Node(id = 9) {
  id = 9
  [refcount] = 1
}
```

Note `part = "Ali"` in the formatted view against `bytes = "Alice"` in the raw one. A substring shares its
owner's buffer, so reading to the NUL would print the owner's whole text. The formatter reads the window's
length instead, which is the sort of thing a rendering layer can know and DWARF cannot.

The reference counts on a class are gathered under `[refcount]` rather than shown as three fields in front of
your own. They are how a class is *stored*, and you should not have to look past them to find `id`.

**This is not a gap in the debug info and could not be fixed by emitting more of it.** DWARF describes
layout. It has no way to say "the length is in `len` and the elements are at `storage.data[0..len)`", and
nothing at all for a hash table's occupancy rule. Every language solves this one layer up: libc++, Rust and
Swift all ship formatters, and this is Echo's.

Everything registers into an `echo` type category, so `type category disable echo` gives the raw view back
when you want to see what is really in memory.

In VS Code, use CodeLLDB rather than the C/C++ extension and import the script in `initCommands`. The C/C++
extension drives lldb through `lldb-mi`, where `command script import` is not a command, so stepping works
and the containers stay raw.

## What you will not see yet

Three honest gaps, all on [the list](/reference/limitations).

**A `weak<T>` in a `-g` build currently crashes the compiler.** Not a rendering problem, a real bug: the same
program builds and runs fine without `-g`. If you hit a segfault from `echoc build -g`, this is the first
thing to check.

**An interface value shows two raw pointers**, because the formatter cannot yet resolve the vtable back to a
concrete type:

```
(Named) erased = {
  __object = 0x0000000152e05560
  __vtable = 0x0000000100004168
}
```

**A `mem::buffer<T>` shows a capacity and no elements**, which is arguably correct (a buffer does not know how
many of its slots are live) and still unhelpful when you are the one who knows.

## `run` cannot honour `-g`

```bash
echoc run -g plot.eco
```

```
[warning] Debug Info Ignored

  '-g' produces no artifact a debugger can open on 'run': the JIT emits no object file. Use 'echoc build -g' and open the resulting executable instead.
```

A warning rather than a silent no-op, and a warning rather than a refusal: your program still runs. There is
just nothing on disk for a debugger to attach to.

## Next

- [The echoc CLI](/projects/cli) for `-g` next to `--debug` and `--optimize`.
- [Errors and panics](/language/errors-and-panics) for what fires before you reach a debugger.
- [Limitations](/reference/limitations) for what is still missing here.
