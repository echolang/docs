---
description: 'Install the Echo compiler. Prebuilts for macOS Apple Silicon, Linux x86_64 and Windows x86_64. One command, two binaries, no runtime afterwards.'
---

# Installation

A released Echo is two binaries: `echoc` is the compiler, `epm` is the package manager. There is no runtime
to install beside them, and no standard library to put somewhere on disk. A released `echoc` carries the
stdlib inside itself, so installing Echo means putting those two files on your `PATH`.

## The one-liner

macOS and Linux. Windows is the next section.

```bash
curl -fsSL https://raw.githubusercontent.com/echolang/echo/master/install.sh | bash
```

That downloads the latest release for your platform and drops it in `/usr/local/bin`. It only reaches for
`sudo` if that directory isn't writable by you.

Want it somewhere else? Set `ECHO_INSTALL_DIR`:

```bash
curl -fsSL https://raw.githubusercontent.com/echolang/echo/master/install.sh | ECHO_INSTALL_DIR="$HOME/.local/bin" bash
```

Then check it worked:

```bash
echoc --version
epm --version
```

If those print version numbers, you're done.

## Windows

```powershell
irm https://raw.githubusercontent.com/echolang/echo/master/install.ps1 | iex
```

That drops `echoc` and `epm` under `%LOCALAPPDATA%\echo\bin`, and puts `bin` on your user PATH. Open a
new terminal before `echoc --version`. The shell you already have will not see it.

The archive is a toolchain, not two files. clang, lld-link and a sysroot sit next to `echoc`, so
`echoc build` does not need a separate LLVM install. x86_64 only. ARM Windows is told to build from
source.

Or download `echo-windows-x86_64-setup.exe` from the
[latest release](https://github.com/echolang/echo/releases/latest) and run the wizard. The zip is
there if you want to unpack it yourself.

## Supported platforms

Three prebuilt archives. macOS and Linux are `.tar.gz` holding `echoc` and `epm`. Windows is a `.zip`
with `bin`, `lib` and `sysroot`.

| Platform | Asset |
|---|---|
| macOS on Apple Silicon | `echo-macos-arm64` |
| Linux on x86_64 | `echo-linux-x86_64` |
| Windows on x86_64 | `echo-windows-x86_64` |

That's the whole list. **No Intel Mac, no Linux on ARM, no Windows on ARM.** The install script
doesn't guess. It tells you there is no build for your machine and stops. On those machines you
build from source, which is a real option but not a five-second one.

## One extra thing for native builds

`echoc run` needs nothing but `echoc`. It compiles in memory and executes. No linker involved.

`echoc build` shells out to `clang` to link the final executable.

On macOS that means the Xcode command line tools:

```bash
xcode-select --install
```

On Linux, install `clang` from your package manager.

On Windows, skip this. A release already has clang sitting next to `echoc`. A source build is the
case that still needs LLVM on the machine, and that is the next section.

Skip the linker and `run` keeps working. `build` fails with a message about not finding it, which
is a confusing error if you don't know to look here.

## epm needs git

`epm` itself is self-contained, the same way `echoc` is. Adding or installing a package checks the
tree out with `git`, so `git` has to be on your `PATH`. macOS already has one once the Xcode tools
are there. On Linux, install it from the distro. On Windows, Git for Windows is the usual one. `epm`
shells out to `git` the same way.

## Building from source

If you're on an unsupported platform, or you want to hack on the compiler itself, you build it with CMake.

You will need:

- CMake 3.20 or newer
- a C++20 compiler
- **LLVM 20** (Echo is built against 20.1.4 and uses opaque pointers, so older LLVM will not do)
- `libzstd` development headers

```bash
git clone https://github.com/echolang/echo.git
cd echo
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --target echoc -j8
```

The binary lands at `build/echoc`. Copy it onto your `PATH` or just call it by path.

A source build does **not** embed the standard library. It reads the stdlib from the checkout it was built
in, so keep the repository around. Or configure with `-DECO_EMBED_STDLIB=ON` to get a self-contained binary
like the released one.

## Editor support

`echoc lsp` is the language server: diagnostics, hover, go-to-definition, the outline, find-references,
workspace symbols and signature help. Completion is not in v1. Point an LSP client at it, or install the [VS Code extension](https://github.com/echolang/echolang-vscode)
and set `echo.echocPath` at a source build's `build/echoc` if `echoc` is not on your `PATH`.

Setting your editor to treat `.eco` as PHP still works if you only want colour. The official grammar is
derived from the compiler's own token list, so `mv`, `guard` and `:$` colour as themselves.

## Next

[Write your first program.](/guide/first-program)
