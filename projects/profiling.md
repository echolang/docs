# Profiling

A program is slower than it should be, or it still holds memory you thought you had given back.
`echoc run --profile` records a real run and tells you which functions took the time, which paths
allocated, and which still hold memory when the program exits.

```bash
echoc run --profile app.eco
```

That writes an `.ecoprof` file and prints a short summary. A build without `--profile` is
unchanged. The profiled build is otherwise a release build: same optimization, plus enough DWARF
and frame pointers that a sample can be named.

```echo
function work() : void
{
    array<int32> $n;
    for (int32 $i = 0; $i < 1000; $i = $i + 1) {
        $n[] = $i;
    }
}

work();
```

You will see allocation paths through `work` and `array<int32>::push`. On a terminal the heading is
a `PROFILE` chip. In a pipe it is `[profile]` plus the path.

## What the summary is telling you

Three parts, each a handful of rows.

**Time** is sampled (1000 Hz). Self-time is where the CPU is. Inclusive time is that function plus
everything it called. The hottest paths are the stacks that showed up most. Allocator thunks fold
into the first user-visible frame, so you see `main -> work -> array::push` rather than `__eco_alloc`.

**Allocations** are counted, not sampled: allocs, reallocs, frees, the top paths by count and by
bytes. **Live at exit** is the leak column. A path that still holds memory after the program is done
is a path you did not free.

**Copies** split into bytewise and constructor. A type with a destructor that is being copied in a
loop shows up here.

`echoc profile --text app.ecoprof` is the same report with more rows. The file is already
symbolized: names and file:line, inlined frames included. Later tools need neither the binary nor
the dSYM.

```bash
echoc profile app.ecoprof
echoc profile --text app.ecoprof
echoc profile --folded time app.ecoprof
```

`--folded` writes collapsed stacks for speedscope or flamegraph.pl. `time`, `self`, `allocs`,
`alloc-bytes`, `live-bytes`, `copies`, `copy-bytes`, `calls`.

A loose `.eco` writes `./<stem>.ecoprof`. A project writes `<build dir>/profile/<stem>.ecoprof`.

## Exact calls

Time is statistical unless you ask:

```bash
echoc run --profile-calls app.eco
```

That instruments function entry and exit. `--profile-stdlib` includes the standard library. Both
imply `--profile`. Use it when a sampled stack is too coarse, not as the default: it is slower to
compile and heavier to run.

External tools (samply, perf, Instruments) remain first-class. Profiled builds carry frame pointers
and line-table DWARF, so they work with those too.

## What it will not do

Time is sampled unless `--profile-calls` is given. A C library without frame pointers truncates the
stack there. Threads still running at exit are read racily. `echoc test`, a foreign `--target-os`,
wasi, iOS and Windows are refused: on Windows, use the external tools. `--check-refcounts` poisons
class boxes and never frees them, so they show as live at exit.

## Next

- [Debugging](/projects/debugging) for `-g` and `dprint`.
- [CLI reference](/reference/cli-reference) for the flags.
