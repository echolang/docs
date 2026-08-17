# Your first program

A file is a program. `echoc run` compiles it in memory and executes it. `echoc build` leaves a binary
behind. Start with the first one.

## Hello

Create a file called `hello.eco`:

```echo
echo "Hello, Echo!";
```

Run it:

```bash
echoc run hello.eco
```

```
Hello, Echo!
```

That's the entire program. No `main`, no class to wrap it in, no imports. Top-level statements are the
program.

Two things about `echo` while we're here. It's a **statement**, not a function, so there are no parentheses.
And it appends a newline for you, which is why the output above is not `Hello, Echo!$`.

## Variables

```echo
string $name = "Echo";

echo "Hello, ";
echo $name;
```

```
Hello, 
Echo
```

Two `echo` statements, two lines, because of that automatic newline. Interpolation is how you put both on
one: `"Hello, {$name}"`.

The type goes in front of the name. You can leave it out when it's obvious:

```echo
$name = "Echo";     // string, inferred from the literal
$count = 3;         // int32
$ratio = 0.5;       // float64
```

Here is the catch: **the type is decided once, at the declaration, and it never changes.**

```echo
$name = "Echo";
$name = 42;         // error: cannot assign 'int32' to 'string'
```

That's not a runtime check. Nothing was compiled at all.

[Variables](/language/variables) has the rest of it.

## Functions

```echo
function greet(string $who) : void
{
    echo "Hello, {$who}!";
}

greet('Echo');
```

```
Hello, Echo!
```

**The return type is required, always.** A function that returns nothing still has to say `: void`. Leave
it off and the parser will tell you it wanted a colon.

I know that's a little verbose for a function that just prints. I prefer it to the alternative, where you
have to read the whole body to find out whether something comes back.

That `{$who}` is **string interpolation**, and it only happens in a double-quoted string. A `'` string is
verbatim. Any expression goes in a hole, and `{$x:.2f}` asks for a particular format.
[Strings](/collections/strings#interpolation) has the whole of it.

One other thing you'll meet immediately: Echo uses `->` for **every** member access. Properties, methods,
pointers. There is no `.`, and there is no `::` for instance members. One arrow, everywhere.

## Arrays

An Echo array is a container of exactly one type:

```echo
array<string> $people = ["Mario", "Ray", "Ronon"];

foreach ($people as $person) {
    greet($person);
}

echo $people->count();
```

```
Hello, Mario!
Hello, Ray!
Hello, Ronon!
3
```

```echo
$people[] = 42;     // will not compile
```

Because arrays are objects, the things you know from a standard library live on the array itself:
`count()`, `push()`, `pop()`, `clear()` and a good few more. [Arrays](/collections/arrays) has the full
surface.

## A binary

`run` compiles in memory and executes immediately. That's the loop you want while writing code, but it
doesn't leave anything behind. To get an actual executable:

```bash
echoc build -o hello hello.eco
./hello
```

```
Hello, Mario!
Hello, Ray!
Hello, Ronon!
3
```

`hello` is a native binary. Copy it to another machine of the same platform and it runs, with no Echo
installed there.

### run and build are not the same build

This one trips people up. The two commands have different defaults:

| | `echoc run` | `echoc build` |
|---|---|---|
| Default mode | `--debug` | `--release` |
| `assert` calls | kept | dropped |
| Compiler runtime checks | kept | dropped |
| Optimizer | on, per module | on, per module |
| Output | nothing on disk | the binary you asked for |
| Needs `clang` | no | yes |

So a program that trips an `assert` under `run` can sail straight past it under `build`. That's the intended
behaviour, not a bug, but you should know it's happening. You can always ask for the other one:

```bash
echoc run --release hello.eco
echoc build --debug -o hello hello.eco
```

[The echoc CLI](/projects/cli) covers the rest of the flags.

## More than one file

Once a program outgrows one file, you give it a directory and a manifest instead. Create `module.eco`:

```echo
#[module: "greeter"]
#[version: "0.1.0"]

#[sources: "src/*.eco"]
```

Put your `.eco` files in `src/`, then run it with no arguments at all:

```bash
echoc run
```

`echoc` finds the `module.eco` in your working directory and builds the whole thing.

One rule to know now: the files of a module are processed **in filename order**, so top-level statements in
`src/a_setup.eco` run before those in `src/b_main.eco`. Declarations don't care about order at all. Only
top-level statements do. Most projects end up with exactly one file that has statements in it, which
sidesteps the question entirely.

[Modules](/projects/modules) is the full story.

## Where to go next

- [A tour of Echo](/guide/tour) is the whirlwind version of everything else: structs, classes, generics,
  ownership, nullability. Read this one next.
- [Coming from PHP](/guide/coming-from-php) if you want the differences listed out bluntly.
- [Variables](/language/variables) if you'd rather go slowly and in order.
