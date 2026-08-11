# Linking

Real programs eventually need something that is not written in Echo: libm, SQLite, a graphics API, a vendor
SDK. You say so in the manifest of the module that needs it, and then the useful part happens: **a link
requirement travels with the module that declares it**, so whoever depends on that module writes
`#[depends:]` and nothing else.

<!-- verify: skip -->
```echo
#[module: "geometry"]
#[version: "0.1.0"]

#[link: lib "palette"]

#[sources: "src/*.eco"]
```

That is a module that knows it needs `libpalette`. Nothing downstream of it has to know.

## Four kinds, and the tag is not optional

<!-- verify: skip -->
```echo
#[link: lib "palette"]           // a library, by name
#[link: framework "OpenGL"]      // a Darwin framework
#[link: search "../vendor"]      // a directory to look in
#[link: object "build/shim.o"]   // an object file, linked straight in
```

The tag in front of the string is part of the grammar, and leaving it out or misspelling it is a located
error:

```
module.eco:2: 'framwork' is not a link scheme, expected one of: lib, framework, search, object.
```

I want to defend that, because a bare string would obviously be shorter. Without the tag,
`framwork "OpenGL"` means "a library called framwork" and "a string OpenGL that nobody read", and the first
sign of trouble is `ld` complaining about something nobody wrote. With the tag, the misspelling is caught at
the line it is on.

The other reason is that a tagged value can grow fields later without a second grammar appearing inside the
string. `lib { name: "palette", linkage: static }` is a shape this already supports; `lib:palette:static`
is a parser hiding in a string literal.

Paths in a `search` or an `object` resolve against the manifest's own directory, so a library can be depended
on from anywhere. Both are checked when the manifest is read, rather than much later:

```
module.eco:2: the search path '/no/such/dir' resolves to '/no/such/dir', which is not a directory.
```

## The consumer says nothing

Two modules. `geometry` needs `libpalette` and says so. `plotter` uses `geometry`:

<!-- verify: skip -->
```echo
#[module: "plotter"]
#[version: "0.1.0"]

#[depends: "../geometry"]

#[sources: "src/*.eco"]
```

No `#[link:]` here, and none needed, however many modules sit between the declaration and the program. Build
it and the library is on the link line:

```bash
cd plotter
echoc build -o plot
./plot
```

```
16
```

This is the property the whole design exists for. If you have ever propagated `-lfoo` up through three
makefiles by hand you already know what it is worth.

## Where a library lives is a fact about your machine

There is a split here that is worth being deliberate about. **What** a module needs belongs in the manifest.
**Where** it happens to be installed on this particular computer usually does not:

```bash
echoc build -o plot --link search:../vendor
echoc build -o plot --link lib:sqlite3 --link search:/opt/homebrew/lib
```

On the command line the tag is spelled with a colon, because an argv word cannot carry a quoted payload
without a shell quoting it first. Same four kinds, same meanings.

`--link` is repeatable and merges *after* every manifest's requirements, so a declaration wins and a search
path you pass is consulted last. That ordering is the point: the flag adds, it does not override.

If a search path genuinely is a property of the project rather than of the machine, a vendored directory
checked into the repository being the usual case, then put it in the manifest and be done:

<!-- verify: skip -->
```echo
#[link: lib "palette"]
#[link: search "../vendor"]
```

## `framework` is Darwin only, and is refused at the manifest

```
module.eco:2: 'framework "OpenGL"' is a Darwin framework and this build targets linux. Gate it with '#[if: os == darwin]' and name the platform's own library in the other arm.
```

Refused rather than dropped, and the message tells you the fix because the fix is always the same shape:

<!-- verify: skip -->
```echo
#[if: os == darwin]
#[link: framework "OpenGL"]
#[elif: os == linux]
#[link: lib "GL"]
#[end]
```

Silently ignoring the declaration would leave the build failing on exactly the symbols it was there to
provide, with nothing anywhere saying the line was never applied. [Conditional
compilation](/projects/conditional-compilation) is the mechanism, and a manifest is Echo, so it works here
with no manifest-specific syntax.

## What `run` can open, and what it cannot

`echoc run` has no linker. The JIT resolves symbols out of the running process and `dlopen`s what it needs
first, so `lib` and `search` and `framework` all work under `run` exactly as they do under `build`:

```bash
echoc run --link search:../vendor
```

```
16
```

An `object` is the one that cannot, and it is a refusal with a sentence rather than a silent difference:

```
[error] Cannot Run This Program

  'object "/tmp/extra.o"' cannot be loaded by 'echoc run': the JIT resolves symbols out of the running process and an object file is not something it can open. Use 'echoc build' for this program, or ship the object as a library.
```

This is the concrete reason link requirements are typed rather than a string of flags passed through to the
linker. A `-lpalette` passthrough can be linked and can never be `dlopen`ed, and `-framework OpenGL` is two
argv words meaning one thing. A passthrough design does not make `run` inelegant, it makes it
unimplementable.

## When the linker says no

Two failures worth recognising, because they look similar and are not.

The library was not found at all:

```
ld: library 'palette' not found

[error] Linking Failed

  the linker rejected this program.
    'lib "palette"' was asked for by module 'geometry'
```

Or it was found, and a symbol was still missing, which usually means a `#[link:]` line nobody wrote:

```
ld: symbol(s) not found for architecture arm64

[error] Linking Failed

  the linker rejected this program.
    'search:/home/you/demo/vendor' was asked for by the command line
```

Either way echoc lists every requirement that went into the link and says who asked for each one, which is
the question you actually have in that moment.

## What is not here yet

Two gaps worth knowing before you plan around this. There is no pkg-config integration, so a library whose
flags come out of `pkg-config --libs` has to be spelled out by hand. And there is no way to ask for static
rather than dynamic linkage for a particular dependency: you get the platform linker's default. Both are on
[the list](/reference/limitations).

Link requirements are also, deliberately, **not** part of a module's cache key. They change no compiled
object, only the link step, so changing one does not invalidate anything.

## Next

- [C interop](/projects/c-interop) for the `extern` declarations that make a linked symbol callable.
- [Modules](/projects/modules) for how a requirement reaches a consumer in the first place.
- [Conditional compilation](/projects/conditional-compilation) for gating a platform's libraries.
