---
description: 'A lib target is a loadable library. On the host that is a .dylib, .so, or .dll. std::dynlib opens it.'
---

# Libraries and plugins

You have a compiled app, and you want a second binary to show up later and plug into it. No `main`.
A list of `#[export]` functions. The host looks them up by name.

On the host that file is a `.dylib`, a `.so`, or a `.dll`. `std::dynlib` is how the app opens it.

## A lib, not a command

<!-- verify: skip -->
```echo
#[module: "greeter"]
#[sources: "src/*.eco"]
#[target: lib { name: "greeter" }]
```

`echoc build` writes `ecobuild/libgreeter.dylib` on Darwin, `libgreeter.so` on Linux, `greeter.dll` on
Windows. A Windows build also writes `greeter.lib` next to the DLL, which is what a C linker consumes.
`-o` stays the path you wrote. `run` refuses a lib: there is nothing to start. iOS refuses it too.

A page still wants `--target-os wasi`. That recipe lives on [WebAssembly](/projects/webassembly).

`name` is required. `entry` is refused. Top-level statements in every file are refused. Put work in
functions. Statics still initialize on first use.

## `#[export]` is the surface

The function's symbol is its own unqualified name, unmangled, C ABI. On a host it is the name
`dlsym` / `GetProcAddress` looks up.

```echo
#[export]
function add(int32 $a, int32 $b) : int32
{
    return $a + $b;
}

echo add(2, 3);     // 5
```

`#[export: "name"]` picks a different symbol.

What crosses: scalars and pointers to bytes or POD. A `string` by value will not compile. Neither will
`ptr<string>`, a class handle, a static method, a generic, or `#[inline]`. Same rule `&name` already
uses. [C interop](/projects/c-interop) is the chapter.

The host talks to the plugin in C. Pass a buffer you allocated. Do not free the other side's pointer
unless you agreed that in the protocol.

`die`, `assert`, and a bounds check in a lib call `exit(1)` in the **host process**. An Echo host's
`crash::` hook never sees a plugin abort: the plugin has its own.

Host callbacks go in as arguments. `&host_fn` is an `extern function<...>`. The plugin does not need
to import host symbols.

## Loading one

`std::dynlib` is the loader. The typed path is `load<T>` over an `extern interface`.
[Extern interfaces](/language/extern-interface) is the contract;
[Dynamic libraries](/stdlib/dynlib) is the surface.

<!-- verify: skip -->
```echo
use std::dynlib;

greeter $g = guard dynlib::load<greeter>($dir, 'english') else ($e) {
    die($e->message());
};
echo $g->add(2, 3);        // 5
```

`std::dynlib` is absent on WASI. There is no `dlopen` there. The wasm host is the page.

## Two modules

A plugin is an artifact you did not have at host link time, so it is a second module.
`examples/plugin/` is the working pair: `greeter` is the lib, `host` is the exe, the path comes in
on the command line.

One module can still declare both an `exe` and a `lib`. A file that is the exe's `entry` is exempt
from the lib's top-level-code refusal.

## Next

- [WebAssembly](/projects/webassembly) for the reactor recipe of the same target kind.
- [C interop](/projects/c-interop) for `extern function<...>` and the recast.
- [Modules](/projects/modules) for `#[target:]`.
- [std::dynlib](/stdlib/dynlib)
