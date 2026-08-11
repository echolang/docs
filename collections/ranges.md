# Ranges

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- `..` and `..=` are ordinary declared operators, not syntax
- What they return: a `range<T>` that conforms to `contract::iterable<T>`
- Exclusive versus inclusive
- Ranges over types other than `int32`
- The literal-argument trap that decides the index type in `foreach (0 .. $a->count() as $i)`
- Why the compiler being ignorant of ranges is the point
