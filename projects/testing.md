# Testing

A test is a block you write in the file it is about, and the catch is that **every invocation of `echoc`
except `echoc test` drops it before it is parsed.**

<!-- verify: test -->
```echo
test adds_up
{
    $a = 22;
    $b = 20;
    assert($a + $b == 42);
}
```

```bash
echoc test
```

No framework to install, no separate test directory, no `main` to wire up. And nothing to strip out later:
not compiled and discarded, never seen. A test costs your release build exactly nothing, and it cannot end
up in a binary by accident.

## A test is a function with an unspellable name

`test <name> { ... }` is a function of no arguments that returns nothing. Structurally that is all it is, so
it gets the same type checking, the same ownership rules, the same destructor calls and the same diagnostics
as any other body, because it *is* one:

<!-- verify: test -->
```echo
struct Point
{
    int32 $x;
    int32 $y;
}

test a_point_holds_what_it_was_given
{
    Point $p = Point(3, 4);

    assert($p->x == 3);
    assert($p->y == 4);
}
```

It sits at file scope, beside your functions and types. You cannot write one inside a function, and you
cannot mark it `public` or `private`: nothing in the language can name a test, so there is nobody for a
visibility modifier to describe.

The body is its own scope in both directions. What you declare inside stays inside:

<!-- verify: test -->
```echo
test uses_a_fixture
{
    struct Fixture
    {
        int32 $seed;
    }

    Fixture $f = Fixture(7);
    assert($f->seed == 7);
}
```

And nothing outside leaks in, in the one way that might catch you out. A variable at file scope belongs to
the program's own frame, so a test cannot read it, exactly as no other function can:

```echo
$outer = 1;

function reads_it() : int32
{
    // error: a function body cannot reach it
    return $outer;
}
```

Put shared setup in a function and call it from each test. That is the whole pattern, and there is no
`setUp` hook coming.

## assert is the only way to fail

There is no `expect`, no `should`, no matcher library, and no way to catch a failure.

<!-- verify: test -->
<!-- verify: dies -->
```echo
test overflows
{
    $a = 1;
    assert($a == 2, 'one is not two');
}
```

```
FAIL 1/1  main/overflows.eco::overflows  (exited 1)
1 test, 1 failed

x main/overflows.eco::overflows  exited 1
    assertion failed: one is not two
      at overflows.eco:5
```

That is not minimalism for its own sake. Echo has no exceptions and nothing in it can unwind, so a failed
`assert` ends the process it is in. So does `die`, and so does a segfault in whatever you are testing. A
process boundary is the only thing that can survive any of those. See
[Errors and panics](/language/errors-and-panics) for the wider picture.

Which is exactly what you get: **each test runs in a process of its own.** `echoc test` forks before every
one, so a test that aborts, exits or crashes takes nothing with it and the run carries on:

<!-- verify: test -->
<!-- verify: dies -->
```echo
test fails_first
{
    assert(1 == 2, 'nope');
}

test still_runs
{
    assert(true);
}
```

```
FAIL 1/2  main/two.eco::fails_first  (exited 1)
ok   2/2  main/two.eco::still_runs
2 tests, 1 failed
```

Once you have that, you do not need anything else. A matcher library would be a nicer sentence in the
failure output, and that is all it would be.

Note: `assert` is a debug-build thing. `echoc test` defaults to `--debug` for exactly this reason, and
`echoc test --release` runs your suite with every assertion elided, which is a run that cannot fail. Try not
to do that by accident.

## A test is tagged by where it is, plus a group you choose

The file and the module come for free. The group is yours:

<!-- verify: test -->
```echo
#[group: "arithmetic"]
test adds_up
{
    assert(1 + 1 == 2);
}

#[group: "arithmetic"]
test subtracts
{
    assert(2 - 1 == 1);
}

test ungrouped
{
    assert(true);
}
```

The compiler reads nothing out of a group. It exists so that you can run some of your tests instead of all
of them, which is the next section.

## Filters pick which tests run

`--filter`, repeatable:

```bash
echoc test --filter adds_up              # by name
echoc test --filter group:arithmetic     # by group
echoc test --filter file:src/math.eco    # by file
echoc test --filter module:mylib         # by module
```

A bare word is a test's name, because that is the case you want shortest. Everything else is tagged, and a
tag you misspell is refused rather than quietly read as a name:

```
error: 'grup' is not a test filter, expected one of: name, group, file, module.
```

Written more than once, filters **add up**. Two `group:` words run both groups rather than intersecting to
nothing.

A filter that matches no test at all is an error, not a green run of nothing:

```
[error] No Tests Selected

  nothing this run compiled matches those filters. It declares 3 tests: ...
```

A `file:` matches any path ending in what you wrote, at a path boundary, so `file:math.eco` finds
`src/math.eco` and leaves `src/mymath.eco` alone. Write as much of the path as you need to be unambiguous
and no more.

Names only have to be unique **within a file**. Two files may each declare a `test adds_up`, which is why
the runner reports `module/file::name` rather than just the name.

## --verbose shows you the ones that passed

A plain run reports a line per test and then its failures, which is what you want from a suite you expect to
pass. When you want the transcript instead, ask for it:

```bash
echoc test --verbose
```

```
mylib/io.eco
  + reads_a_line                                        0 ms
  1 test, 0 ms

mylib/math.eco
  + adds_up                                             0 ms  (unit)
  + subtracts                                           0 ms
  x divides                                             1 ms  exited 1
      assertion failed: nope
        at math.eco:16
  3 tests, 1 ms

4 tests, 1 failed

x mylib/math.eco::divides  exited 1
    assertion failed: nope
      at math.eco:16
```

Every test that ran, under the file it is written in, with its group, what it cost, and a total per file.
The listing replaces the per-test lines rather than decorating them, so what you read on a terminal is what
a pipe and a CI log record.

The other thing it buys you is **a passing test's own output**. Every test's streams are captured whichever
way you run, and normally a green one's are thrown away, so a `dprint` you left in a test that works has no
way of reaching you. Under `--verbose` it is quoted under that test's line.

## A test target is a saved filter

If you find yourself typing the same filters, name them in the manifest:

<!-- verify: skip -->
```echo
#[module: "mylib"]
#[version: "0.1.0"]

#[sources: "src/*.eco"]

#[target: test]
#[target: test { name: "quick", groups: ["unit"] }]
#[target: test { name: "io", files: ["src/io.eco"] }]
```

```bash
echoc test --target quick
```

`groups:` and `files:` say exactly what `--filter group:` and `--filter file:` say. What makes a test target
unlike `#[target: exe]` rather than another flavour of it is that it produces no binary and names no entry
file, so `echoc build` never builds one and `echoc build --target quick` is refused.

One thing worth knowing: **a bare `echoc test` runs every test the module has, whatever targets it
declares.** A target narrows only when you name it. So `#[target: test]` on its own buys you the word
`tests` to pass to `--target` and nothing else.

[Modules](/projects/modules) covers the rest of the manifest.

## Only the modules you pointed at

```bash
echoc test              # this project's tests
echoc test -m lib       # that library's tests
echoc test math.eco     # the tests of a loose file, the same way `run` takes one
```

A library you depend on keeps its own tests to itself. They are not parsed, not type checked and not run,
which is also why adding a dependency does not slow your test runs down. Running them is a matter of
pointing at it instead.

## Code that only exists while testing

Sometimes a test needs a helper that has no business existing in your release build. `#[if: tests]` is a
condition like any other, true exactly when the current invocation is compiling tests:

<!-- verify: test -->
```echo
#[if: tests]
function fixture() : int32
{
    return 42;
}
#[end]

test uses_the_fixture
{
    assert(fixture() == 42);
}
```

Outside `echoc test` that function does not exist.
[Conditional compilation](/projects/conditional-compilation) is the rest of that mechanism.

You cannot set `tests` yourself with `--define`. Whatever compiles your test blocks has to be the same thing
that runs them, or you would have a build carrying tests nothing ever calls.

### A whole directory of it

Once the helpers outnumber the `#[if: tests]` lines around them, give the test target a scope and put them
in a directory of their own:

<!-- verify: skip -->
```echo
#[module: "mylib"]

#[sources: "src/*.eco"]

#[target: test] {
    #[sources: "tests/*.eco"]
}
```

`tests/` is now part of `mylib` when `echoc test` builds it, so its files see everything in `src/` without a
`public` anywhere, the default visibility being the module's own. Any other invocation does not compile the
directory at all, and there is no catch below either: a file a build never reads does not have to lex.

[Modules](/projects/modules#a-target-can-have-things-of-its-own) covers what else a scope may say, including
a `#[depends:]` only your tests need.

## The catch

A dropped test body still has to be **lexable**. The filter drops tokens, so your body has to have produced
some. A body that does not *parse* is invisible to a normal build:

```echo
test never_compiled_here
{
    $a = no_such_function(no_such_argument);
}

echo 'compiles fine';
```

An unterminated string or a character the lexer does not know is a different story, and still fails every
build, because lexing happens first.

In practice this means a test body is only checked when you run `echoc test`, which is the same deal an
`#[if:]` region for another platform gives you. So run your tests.

Two more limits, both on [the list](/reference/limitations): there is no timeout, so a test that hangs hangs
the run, and running a suite needs `echoc`, because there is no standalone test binary yet.

## Next

- [The echoc CLI](/projects/cli) for how `test` relates to `run` and `build`.
- [Modules](/projects/modules#a-target-can-have-things-of-its-own) for giving the test target sources of its
  own.
- [Errors and panics](/language/errors-and-panics) for why a failure ends a process rather than unwinding.
