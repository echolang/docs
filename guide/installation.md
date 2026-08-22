# Installation

A released Echo is two binaries: `echoc` is the compiler, `epm` is the package manager. There is no runtime
to install beside them, and no standard library to put somewhere on disk. A released `echoc` carries the
stdlib inside itself, so installing Echo means putting those two files on your `PATH`.

## The one-liner

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

## Supported platforms

There are exactly two prebuilt archives, each holding `echoc` and `epm`:

| Platform | Asset |
|---|---|
| macOS on Apple Silicon | `echo-macos-arm64` |
| Linux on x86_64 | `echo-linux-x86_64` |

That's the whole list. **No Windows, no Intel Mac, no Linux on ARM.** The install script doesn't guess. It
tells you there is no build for your machine and stops. On those platforms you have to build from source,
which is a real option but not a five-second one.

## One extra thing for native builds

`echoc run` needs nothing but `echoc`. It compiles in memory and executes. No linker involved.

`echoc build` shells out to `clang` to link the final executable, so `clang` has to be on your `PATH`. On
macOS that means the Xcode command line tools:

```bash
xcode-select --install
```

On Linux, install `clang` from your package manager. Skip this and `run` keeps working fine. `build` fails
with a message about not finding the linker, which is a confusing error to debug if you don't know to look
here.

## epm needs git

`epm` itself is self-contained, the same way `echoc` is. Adding or installing a package checks the tree out
with `git`, so `git` has to be on your `PATH`. macOS already has one once the Xcode tools are there. On Linux,
install it from the distro.

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

There is no language server yet, so no autocomplete and no inline errors. Syntax highlighting for `.eco`
files isn't packaged either. Setting your editor to treat `.eco` as PHP gets you most of the way there, and
it's what I do while writing these docs.

`echoc build --diagnostics=json` emits one JSON object per diagnostic on stderr. That's stable, and it's
what an editor integration would consume. If you want to build one, that's the hook.

## Next

[Write your first program.](/guide/first-program)
