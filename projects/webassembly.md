---
description: 'A WASI lib is a reactor. The page instantiates it, calls _initialize, then calls you.'
---

# WebAssembly

`echoc build --target-os wasi` already cross-compiles to `wasm32-unknown-wasip1`. That used to mean
one thing: a **command**. `_start` runs the file's top-level statements and exits. Fine for a CLI.
Useless for a page that wants to call into Echo, or for Echo that wants to call the page.

A **lib** target is the other shape. No entry. The surface is the functions you export. The page
instantiates the module, calls `_initialize`, then calls you.

## A lib, not a command

<!-- verify: skip -->
```echo
#[module: "plot"]
#[sources: "src/*.eco"]
#[target: lib { name: "plot" }]
```

`echoc build --target-os wasi` writes `ecobuild/plot.wasm`. `run` refuses it: there is nothing to
start. On the host the same `#[target: lib]` is a `.dylib` / `.so` / `.dll`. That recipe lives on
[Libraries and plugins](/projects/libraries). This page is the wasm one: a reactor, `_initialize`,
then the exports.

`name` is required. `entry` is refused. Top-level statements in every file are refused. Put work in
functions. Statics still initialize on first use.

What a reactor does not do: static teardown, and the `--track-allocations` report. There is no
`main` to hang them off. `std::env::argc()` is 0. `echo` of a number still prints. `die` still
calls `exit(1)` in the host.

## `#[export]`

The function's symbol is its own unqualified name, unmangled, C ABI. On wasm it is also in the
module's export section.

```echo
#[export]
function add(int32 $a, int32 $b) : int32
{
    return $a + $b;
}

echo add(2, 3);     // 5
```

`#[export: "name"]` picks a different symbol. Same function, different thing the host looks up.

What may cross is the C ABI, the same rule [C interop](/projects/c-interop) already uses: scalars
and `ptr<T>`. `int64` and `uint64` are i64 in the wasm type. JavaScript sees them as `BigInt`.
`int32` stays a Number.

A `#[export]` on a dependency is in the final module's export section. If `dep` exports `helper`
and your lib calls it, `instance.exports.helper` is there next to your own exports.

Two exports of one name are a compile error. So is exporting as `main` or `__main_argc_argv`.

## `#[wasm: import "env"]`

The other direction. An `extern` function whose body lives in the host. The value is the wasm
**module** name. The import name is the extern's C symbol, including `as`.

<!-- verify: skip -->
```echo
#[wasm: import "env"]
extern {
    function host_now_ms() : float64;
}

echo host_now_ms() > 0.0;
```

That is legal only on an `extern`. A function with a body is exported with `#[export]`.

The attribute on the block applies to every function in it. A function's own `#[wasm: import]` of
the same name wins.

A misspelled libc extern is still a link error. The explicit import module is what lets
`env.host_now_ms` through without `--allow-undefined`.

## `#[wasm: export "memory"]`

Linear memory is a wasm object, not an Echo function. This is how a page reads the bytes a
`ptr<uint8>` return names.

<!-- verify: skip -->
```echo
#[wasm: export "memory"]

#[export]
function pixels() : ptr<uint8>
{
    return null;
}
```

It sits at file scope. Written above a function, it does not attach to that function. The payload
is closed: `memory`. A function is still `#[export]`.

A WASI toolchain may export memory anyway; the attribute is how Echo asks.

## Calling it from a page

The working example is `examples/mandelbulb_web/`. Build it with `echoc build --target-os wasi`,
then serve the directory (`python3 -m http.server`). Browsers refuse `fetch` of a `.wasm` from
`file://`.

JS has to re-wrap `memory.buffer` after every call. `memory.grow` detaches the old `ArrayBuffer`,
and an `ImageData` built from the detached one is a blank canvas and a quiet bug.

And one export call is one uninterrupted stretch of the page's main thread. A frame that takes a
few hundred milliseconds, asked for in one call, freezes the page for that long. Asked for a few
rows at a time, it doesn't.

## Features

`--target-features` is the last word: a list you pass *replaces* the wasm baseline, it does not add
to it. The baseline is `+simd128`, so `--target-features +bulk-memory` compiles without SIMD and
LLVM scalarizes every `simd<T, N>`. Write both when you want both:
`--target-features +simd128,+bulk-memory`.

## Next

- [Libraries and plugins](/projects/libraries) for the same `#[target: lib]` on the host.
- [C interop](/projects/c-interop) for `extern` and the types that may cross.
- [Modules](/projects/modules) for `#[target:]`.
- [Attributes](/reference/attributes) for `export` and `import`.
