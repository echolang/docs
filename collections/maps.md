# Maps

<!-- STUB -->

::: warning Not written yet
This page is an outline. The feature it describes works; the documentation for it does not.
:::

Planned sections:

- Two types, two promises: `map<K, V>` is unordered, `ordered_map<K, V>` remembers insertion order
- What a key type owes: a `hash::of` overload and an `operator ==`, and why that is not an interface
- The bracket operator, and why the read form does not insert
- The surface: `count`, `has`, `get`, `at`, `set`, `remove`, `take`, `keys`, `values`, `clear`, `reserve`
- Growth, rehashing, and the borrows that invalidates
- Ownership of keys and of values
- Iterating a map, and the order you get
- Teaching a map about your own type
- What has no spelling yet: a map literal, an optional lookup, a lazy `keys()`, choosing the hasher
