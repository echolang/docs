# What is Echo?

Echo is a statically typed, natively compiled, general-purpose programming language with PHP-flavoured
syntax.

That sentence does a lot of work, so let me unpack it backwards.

**PHP-flavoured syntax.** Variables start with `$`. Blocks use braces. `echo` prints things. Functions look
like functions and classes look like classes. If you have written PHP, or Java, or honestly any C-descended
language, you can read Echo without a tutorial.

**Natively compiled.** Echo goes through LLVM and comes out the other side as a real executable. There is no
interpreter, no bytecode, no runtime to install alongside your program. You ship one file.

**Statically typed.** Every variable has exactly one type, and the compiler knows it before your program
runs. No dynamic typing. No union types. No `mixed`.

Put those together and you get the pitch: my highly opinionated and far from production-ready version of PHP
that goes brrrr.

## It will not run your PHP

To be completely clear, because this is the first question everybody asks: **Echo does not run PHP code, and
it never will.**

It borrows PHP's syntax because that syntax is comfortable and widely known, not because it is trying to be
compatible with it. Underneath, Echo is much closer to Swift, Rust or C++ than to PHP. It has:

- static types with no escape hatch
- value types with a single owner, and moves
- reference counted heap objects
- raw pointers, if you insist
- generics, interfaces, operator overloading
- manual control over allocation when you want it

So a PHP file is not a head start. It is a list of things to rewrite, and the compiler will read it back to
you one line at a time.

## Who it is for

At the start, Echo is for me. I wanted a language that felt more like PHP than C++, and more like C++ than
PHP. Something I actually enjoyed writing.

If you want a pitch: Echo is for people who write in a high-level dynamic language, are comfortable there,
and occasionally want the thing they wrote to be fast without learning an entirely new set of ideas at the
same time as an entirely new syntax.

The syntax is the bridge. The type system, ownership and memory model are what you actually have to learn,
and the documentation is arranged so you meet them one at a time rather than all at once.

## What running code looks like

Two commands, and they do genuinely different things.

```bash
echoc run hello.eco             # compile in memory, execute immediately
echoc build -o hello hello.eco  # compile and link a native binary
```

`run` is the fast feedback loop. Nothing is written next to your source, nothing is linked, and the program
starts more or less instantly. It defaults to a debug build, so `assert` and the runtime checks stay in.

`build` is the real thing. It produces an executable you can copy to another machine. It defaults to a
release build, so the checks are dropped and the optimizer runs.

## Let's be honest for a moment

Echo is a hobby. It is not production ready and I am not pretending otherwise.

Plenty is missing. The type system has holes, the standard library is small, and the compiler has bugs. None
of that is hidden. I would rather you bounce off this page than off a compiler error six hours in.

Still here? [Install it](/guide/installation).
