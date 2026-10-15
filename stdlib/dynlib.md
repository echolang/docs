---
description: 'std::dynlib opens a .dylib, .so, or .dll and looks up a C symbol.'
---

# Dynamic libraries

`std::dynlib` opens a loadable library and binds an `extern interface`. It is how a compiled Echo
app loads a `#[target: lib]` it did not have at link time.

```echo
use std::dynlib;

echo dynlib::file_name('greeter');
```

On Darwin that prints `libgreeter.dylib`. On Linux `libgreeter.so`. On Windows `greeter.dll`.
WASI does not compile this namespace: there is no `dlopen` there.

The contract is [Extern interfaces](/language/extern-interface). The host recipe is
[Libraries and plugins](/projects/libraries). This page is the surface.

## `library::open`

<!-- verify: skip -->
```echo
use std::dynlib;

dynlib::library $plug = guard dynlib::library::open($path) else ($e) {
    echo $e->message();
    return 1;
};
```

The path is the path. No `lib` prefix, no suffix invented. A missing file is
`dynerror::not_found`. A `dlopen` failure is `load_failed`.

The class owns the handle. Dropping the last binding unloads the image. There is no `close()`.

## `bind` and `load`

<!-- verify: skip -->
```echo
greeter $g = guard dynlib::load<greeter>($dir, 'english') else ($e) {
    die($e->message());
};
echo $g->add(2, 3);
```

`load` is `open(path_of($dir, $name))` then `bind<T>()`. Missing table is `missing_interface`. A
header that does not match is `abi_mismatch`. `bind_symbols<T>()` fills slots by each requirement's
link name instead.

## `address`

<!-- verify: skip -->
```echo
string $name = 'add';
ptr<uint8> $raw = guard $plug->address($name) else {
    die('missing export');
};

unsafe {
    extern function<int32(int32, int32)> $add =
        $raw:$ as extern function<int32(int32, int32)>;
    echo $add(2, 3);
}
```

A missing name is `null`. The recast is your promise, and it is `unsafe`. Bind the name to a local
first: passing `'add'` straight into `address` will not compile.

## `file_name` and `path_of`

```echo
use std::dynlib;

echo dynlib::file_name('greeter');
```

`path_of($dir, $stem)` joins them with a slash. `load` uses that.

## Next

- [Extern interfaces](/language/extern-interface)
- [Libraries and plugins](/projects/libraries)
- [C interop](/projects/c-interop) for `extern function<...>`
