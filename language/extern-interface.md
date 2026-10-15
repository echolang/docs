---
description: 'An extern interface is a plugin contract. Both sides compile against it. The host binds a table.'
---

# Extern interfaces

A plugin and a host have to agree on more than a function name. They agree on a type. An
`extern interface` is that type: a list of C-callable requirements, and a fingerprint so a rebuilt
plugin with a different contract cannot be loaded as if nothing changed.

```echo
public extern interface greeter {
    function add(int32 $a, int32 $b) : int32;
    function answer() : int32;
}

#[export]
public struct English : greeter {
    static function add(int32 $a, int32 $b) : int32 {
        return $a + $b;
    }

    static function answer() : int32 {
        return 42;
    }
}

echo abi::slot_count<greeter>();    // 2
```

The conformer is a `struct`. Each requirement is a **static** on that struct with the same C
signature. `#[export]` on the type emits the table the host binds.

A class and an enum cannot answer an extern interface. A wasm lib cannot export this table yet;
per-function `#[export]` still works.

## What a requirement may say

The signature has to be something C can call: scalars, pointers to bytes or POD,
`extern function<...>` callbacks. A `string` by value is refused. So is a class handle, a generic
requirement, a static, an associated type.

The C name defaults to the Echo name. Rename it when the other side already picked:

```echo
public extern interface sqlite {
    function sqlite3_open as open(ptr<uint8> $path) : int32;
}

echo abi::slot_count<sqlite>();    // 1
```

`open` is what Echo calls. `sqlite3_open` is what `dlsym` looks up if you bind by name.

## The host binds a table

`dynlib::load<T>` opens the image and binds the table. `$g->add(2, 3)` is then an ordinary method
call. A value of the interface keeps the image loaded. `greeter $x;` without a binding is refused.
`greeter?` is allowed.

<!-- verify: skip -->
```echo
use std::dynlib;

greeter $g = guard dynlib::load<greeter>($dir, 'english') else ($e) {
    die($e->message());
};
echo $g->add(2, 3);
```

How you get the handle, and what `bind_symbols` does for a C library that never heard of Echo,
lives on [Dynamic libraries](/stdlib/dynlib).
[Libraries and plugins](/projects/libraries) is the host recipe.
