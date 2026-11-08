# Coverage

You ran the suite. It is green. The question left is whether those tests actually walked the code you
think they did.

```bash
echoc test --coverage
```

That instruments the tests and prints one line after the last one finishes:

```
coverage 81.2% lines, 64.0% branches -> ecobuild/coverage
```

A compile without the flag is unchanged. `run` and `build` do not take it: covering a binary with no
test id is a different product.

## What is counted

Functions the tests call. Not the test bodies themselves, not helpers that live only in a
`#[target: test]` source list, and not the standard library unless you pass `--coverage-stdlib`.

Line coverage is "did this source line run". Branch coverage is which way control went: `then` / `else`,
a loop body, a `guard` else, a `match` arm, the right side of `&&` / `||`, the fallback of `??`.

A generic body is compiled once per instance, but it is still one piece of source. The summary counts
a line, and a branch edge at its column, as covered when any instance ran it, so `List<string>` never
being shown does not mark `show` as missed when `List<int32>` was. `map.json` keeps the counters per
instance for anyone who wants that split.

Only what can run is counted. `while (true)` has no edge out of the loop, and code after a loop that
only `return` leaves gets no counter, so a function like that can still reach 100%.

A child that `assert`s still leaves its counts.

## The files

`ecobuild/coverage/map.json` names the counters. `coverage/tests/*.ecocov` is one file per test.
The summary merges them. Keep the per-test files if you want to know which test hit which line.

## Next

[Testing](/projects/testing)
