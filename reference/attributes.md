# Attributes

An attribute is `#[name: value]` written above the thing it describes. **The set of names is closed**, so a
typo is a compile error rather than a decoration nobody reads:

```echo
#[inline]
function double(int32 $n) : int32
{
    return $n * 2;
}

echo double(21);        // 42
```

Eighteen names in total: eight on a declaration, ten that only mean something in a `module.eco`
manifest. A namespaced name (`#[web::js_name:]`, `#[epm::license:]`) is not on that list. echoc
carries it on the declaration and ignores it during codegen. `echoc::` is reserved for the compiler
and its standard library. The four conditional directives look like attributes and are not on that
list at all. There's a reason, and it gets its own section.

## The value grammar

One grammar, used by every attribute:

```
value   := tag atom | atom
tag     := name | string
atom    := string | int | float | bool | name | list | record
list    := '[' ( value ( ',' value )* ','? )? ']'
record  := '{' ( name ':' value ( ',' name ':' value )* ','? )? '}'
```

Seven shapes, and one example of each drawn from the standard library or the test corpus:

| Shape | Example |
|---|---|
| string | `#[echoc::intrinsic: "llvm.sin"]` |
| int | `#[cc: define { ECO_SHIM_BASE: 40 }]` |
| float | `1.5`, accepted by the grammar. No attribute reads one today |
| bool | `#[cc: define { DEBUG: true }]` |
| name | `#[echoc::core: array]` |
| list | `#[sources: ["src/*.eco", "extra/*.eco"]]` |
| record | `#[depends: git { url: "...", rev: "v1.2.0" }]` |
| tagged | `#[link: framework "OpenGL"]`, or `#[requires: "libcurl" { ... }]` with a string tag |

One rule holds the whole thing together: **a bare name means itself.** It is never a constant, never a type
and never a variable. That's why a closed vocabulary is written bare (`array`, `lib`, `size_of`) and free
text is quoted. `#[echoc::core: array]` names the string `array`, and there is no way for it to accidentally pick up
a struct called `array` that happens to be in scope.

A trailing comma is legal in both a list and a record. Record keys keep the order you wrote them in.

### Anywhere one value is accepted, a list of them is

These three say the same thing:

```
#[sources: "src/*.eco"]
#[sources: "extra/*.eco"]
```
```
#[sources: ["src/*.eco", "extra/*.eco"]]
```

A list is peeled only when it is untagged, which is what keeps `#[link: lib ["GL", "GLU"]]` meaning one
scheme with two libraries rather than two schemes.

## Declaration attributes

Eight names (`wasm` has two forms):

| Attribute | Value | What it does |
|---|---|---|
| `#[inline]` | none | asks for the function to be emitted into every unit that calls it, so it can be inlined without a whole-program build |
| `#[implicit]` | none | on a method, declares that its owner converts to the method's return type at an argument position. on a static of the destination, declares the reverse: a type the library does not own converts *to* this one |
| `#[unique]` | none | on a struct, says exactly one value may name this storage. The type is moved, never copied |
| `#[atomic]` | none | on a class, says the reference count is an atomic RMW, so a handle may be retained and released on more than one thread. The contents are not covered |
| `#[group: "..."]` | string | on a `test`, names the group a test run can select on |
| `#[tests: expects death]` | tagged name | on a `test`, inverts the pass condition: the child must exit non-zero |
| `#[export]` / `#[export: "name"]` | none, or a string | this function's symbol is `name` (default: its own unqualified name), unmangled, C ABI. on wasm it is also in the module's export section |
| `#[wasm: import "<module>"]` | tagged string | this `extern` function is a host import from that wasm module. the import name is the extern's C symbol |
| `#[wasm: export "memory"]` | tagged string | export the wasm linear memory. a closed object list; a function is `#[export]` |

### #[inline]

`#[inline]` is a request about *emission*, not a hint to the optimizer. Without it, an ordinary module symbol
can't be inlined across a module boundary unless you build with `--optimize whole`. With it, the definition
travels into every unit that references it.

It is not validated at all. On a declaration with no body of ours it is meaningless rather than wrong, which
is a deliberate choice: refusing it would mean the attribute knows about declaration shapes it has no
business knowing about.

### #[implicit]

`#[implicit]` is how a library type says "I can stand in for that one". The conversion is found by the
attribute, never by the method's name:

```echo
struct Meters
{
    float64 $value;
}

struct Feet
{
    float64 $value;

    #[implicit]
    const function to_meters() : Meters
    {
        return Meters($this->value * 0.3048);
    }
}

function show(Meters $m) : void
{
    echo $m->value;
}

show(Feet(10.0));       // 3.048000
```

A declared conversion ranks below every built-in one, so an overload taking `Feet` still wins outright over
this.

**It fires through a borrow too**, which matters more than it sounds. Library code takes its parameters as
`const T&`. Without this, every helper wanting the converted type would have to be called with the
conversion written out from anywhere that had been handed one.

```echo
struct Meters
{
    float64 $value;
}

struct Feet
{
    float64 $value;

    #[implicit]
    const function to_meters() : Meters
    {
        return Meters($this->value * 0.3048);
    }
}

function show(Meters $m) : void
{
    echo $m->value;
}

function forward(const Feet& $f) : void
{
    show($f);           // the conversion is found through the borrow
}

forward(Feet(10.0));    // 3.048000
```

A `const` borrow only reaches a conversion declared `const function`. One declared without it would be
writing through a value the caller said was read-only, so it is not considered.

**The other direction is a static of the destination.** A library can't add a method to `int32`. What it
can do is say that an `int32` can stand in for a type it *does* own:

```echo
struct Quantity
{
    int64 $n;

    #[implicit]
    static function from(int32 $n) : Quantity
    {
        return Quantity($n);
    }
}

function put(Quantity $q) : void
{
    echo $q->n;
}

put(7);                 // 7
```

A written `$x as T` finds the same conversion. [Casts](/language/casts) is the spelling.

Same rank as the outbound form. An overload that already takes `int32` still wins. The conversion still
has to return a declared type, and for inbound that type has to be the owner.

A class that allocates is allowed here: inbound *constructs* the destination. It does not sneak a retain
into an argument list the way an outbound window would.

Wrong arity, a return that is not the owner, a second inbound from the same source: those are located
errors at the declaration, same as the outbound refusals.

Seven shapes are refused at the declaration rather than at the call site, so the slot only ever holds
something valid. The one you are most likely to meet on the outbound side: the return type has to be a
declared type.

```echo
struct Celsius
{
    float64 $degrees;

    #[implicit]
    const function to_float() : float64      // error: An implicit conversion must return a declared
    {                                        //        type - 'float64' is not one.
        return $this->degrees;
    }
}
```

### #[group:]

Names the group a `test` belongs to, so a test run can select on it:

<!-- verify: test -->
```echo
#[group: "arithmetic"]
test adds_up
{
    assert(1 + 1 == 2);
}
```

The compiler reads nothing else out of it. It is a tag for `echoc test --filter group:arithmetic`, and it is
the only attribute here whose value is free text checked against nothing. Written on something that is not a
test it does nothing at all, per the section below on placement.

[Testing](/projects/testing) is the whole of what it is for.

### #[tests:]

Inverts the pass condition of a `test`. The tag vocabulary is closed at `expects` and the value
vocabulary is closed at `death`, the same tagged-value shape as `#[link: lib "GL"]`. A future knob is
a new tag, not a new attribute name.

<!-- verify: test -->
```echo
#[tests: expects death]
test an_unloaded_call_dies
{
    die('not loaded');
}
```

The child has to exit non-zero. A hang is still a timeout. `die` and a failed `assert` both count: they
are the same abort. This is not the `tests` *condition* (`#[if: tests]`), which is a directive value; this
is an attribute name.

Written on something that is not a test it does nothing at all, per the section below on placement.

[Testing](/projects/testing) owns the runner.

### #[unique]

`#[unique]` closes the accidental half of duplication. A unique struct has no implicit copy at all, so the
only thing you can do with one is move it:

```echo
#[unique]
struct Handle
{
    int32 $fd;
}

Handle $h = Handle(3);
echo $h->fd;            // 3
```

It is refused on a `class` and on an `interface`, where it would mean nothing. `mem::buffer<T>` is the type
it exists for, and it needs `private` properties alongside it to close the deliberate half.

### #[atomic]

`#[atomic]` is the other mark a type can carry, and it is only a class that has a count to mark. An unmarked
class keeps today's retain (a load, an add and a store), so a program that never shares a handle across
threads pays nothing. Mark it when a handle will be copied onto another thread with no lock held:

```echo
#[atomic]
class SharedCounter
{
    int32 $hits;
}
```

The count is then an atomic RMW. The fields are not: two threads writing `$hits` still race. It is refused
on a `struct` and on an `interface`, where there is no count. [Atomics](/memory/atomics) is the
chapter; [Threads](/stdlib/thread) is why you would mark one.

### #[export]

The function's symbol is its own unqualified name, unmangled, C ABI. On wasm it is also in the module's
export section. On a host it is the name `dlsym` looks up.

```echo
#[export]
function add(int32 $a, int32 $b) : int32
{
    return $a + $b;
}

echo add(20, 22);       // 42
```

`#[export: "name"]` picks a different symbol. Scalars and `ptr<T>` may cross. A `string`, a struct by
value, a method, a generic, and `#[inline]` will not.

On a **type**, a bare `#[export]` is legal when that struct answers an `extern interface`. It emits
the ABI table. `#[export: "name"]` on a type is refused: the table is named from the interface.
[Extern interfaces](/language/extern-interface) is the chapter.

### #[wasm]

Two wasm things that are not Echo functions: which module an extern is imported from, and the linear
memory a page reads. The C ABI export of a function is still `#[export]`.

<!-- verify: skip -->
```echo
#[wasm: export "memory"]

#[wasm: import "env"]
extern {
    function host_now_ms() : float64;
}

echo host_now_ms() > -1.0;
```

`import` is legal only on an `extern`. `export "memory"` sits at file scope: written above a
function, it does not attach to that function. The payload is closed: `memory`.
[WebAssembly](/projects/webassembly) is the chapter.

### `echoc::` is reserved

The standard library talks to the compiler through three names a program cannot write:
`#[echoc::core: array]`, `#[echoc::builtin: size_of]`, `#[echoc::intrinsic: "llvm.sin"]`. They bind
a type the compiler has to name, mark a function the compiler answers at the call site, or lower a
bodyless declaration to an LLVM intrinsic. You will see them in `stdlib/`. Writing one in your own
file is a reserved-namespace error. `--no-stdlib` is the escape, because then those names have to
come from the program.

A bodyless declaration you *can* write is an `extern { }` block. That is the whole of the user-facing
story; [Functions](/language/functions) has the rest.

## Manifest attributes

Ten names, legal in a `module.eco` and refused in a source file. [Modules](/projects/modules) is the chapter;
this is the value shapes.

| Attribute | Value | Repeats | Notes |
|---|---|---|---|
| `#[module: "name"]` | string | no | required. No spaces, no quotes inside the name |
| `#[version: "0.1.0"]` | string | no | recorded, folded into the build fingerprint, resolves against nothing |
| `#[sources: "src/*.eco"]` | string or list | yes | relative to the manifest. A pattern matching nothing is an error |
| `#[depends: ...]` | string, `path "..."`, `git { }`, or a list | yes | a path to a manifest that is already on disk |
| `#[requires: "name" { }]` | string-tagged record, or a list | yes | a package. Fields: `version` and `source` required, `rev` optional. `source` is a tagged locator (`git "..."`). Resolves to `vendor/<name>`; `name` may be `echolang/libcurl`. See [Packages](/projects/packages) |
| `#[target: <tag> { }]` | tagged record, a bare tag, or a list | yes | tags: `exe`, `test`, `lib`. An `exe` wants `name` and `entry`, both required, and `entry` must be one of this module's own `sources`. `public: true` offers it as a tool, `install: true` marks it for `echoc install`. A `test` takes `name`, `groups` and `files`, all optional, and is refused for writing an `entry`; `#[target: test]` on its own is the whole selection. A `lib` wants `name` and refuses `entry`; on the host that is a `.dylib` / `.so` / `.dll`, on wasi a reactor |
| `#[link: <tag> "..."]` | tagged | yes | tags: `lib`, `framework`, `search`, `object` |
| `#[cc: <tag> ...]` | tagged | yes | tags: `sources`, `include`, `define`, `flag` |
| `#[build_dir: "target"]` | string | no | where artifacts go. Refused if it names the manifest's own directory or an ancestor |
| `#[hook: before_build { run: ... }]` | tagged record | yes | a dependency's tool to run before the build. See [Tools and hooks](/projects/tools) |

Declaring one of the three no-repeat attributes twice gets you `'module' is declared twice.` and the same
sentence for `version` and `build_dir`.

### A target's scope

`#[target: ...]` and `#[hook: ...]` may each be followed by a `{ ... }`. What is inside a target's
scope belongs to that target rather than to the module, and takes effect only for a program that
builds it:

```
#[target: test] {
    #[sources: "tests/*.eco"]
    #[depends: "../mocklib"]
    #[requires: "libhello" { version: "^1", source: git "https://x" }]
    #[link: lib "check"]
    #[cc: sources "c/stubs/*.c"]
}
```

Those five are the whole vocabulary, and each means inside a scope exactly what it means outside one. A
scoped `#[sources:]` is expanded by the same expander, with the same "a pattern matching nothing is an
error" rule. A scoped `#[cc:]` is refused for options with no `sources:` in the same words.

A hook's `{ ... }` holds `#[requires:]` and `#[depends:]` only. [Tools and hooks](/projects/tools) is
that chapter.

The four refusals:

| Written | |
|---|---|
| a scope on anything but `#[target:]` or `#[hook:]` | `'sources' cannot carry a '{ ... }' scope - only a '#[target: ...]' or a '#[hook: ...]' can, a scope being what one of them says for itself.` |
| a `#[target:]` or `#[hook:]` inside a scope | `'target' cannot be written inside a '{ ... }' scope - scopes do not nest, so a target or a hook is declared at file scope.` |
| `#[module:]`, `#[version:]` or `#[build_dir:]` inside one | `'version' describes the module, not one of its targets - write it at file scope.` |
| a scope on a `#[target: [ ... ]]` declaring several | `a '{ ... }' scope belongs to one target, and this '#[target: ...]' declares 2 - write each of them its own.` |

A scope on a target is the one thing in a manifest that changes a module's cache key per target, and it does
so for the module that declares it and for no other module in the build.

### #[cc:] in full, because nothing else tabulates it

| Tag | Value | Means |
|---|---|---|
| `sources` | string or list of patterns | C translation units to compile beside the Echo |
| `include` | string or list | include directories, resolved against the manifest |
| `define` | record | preprocessor macros. The one place a record's keys are the payload rather than a vocabulary |
| `flag` | string or list | passed to the C compiler as written |

```
#[cc: sources "c/*.c"]
#[cc: include "c/include"]
#[cc: define { ECO_SHIM_BASE: 40, GLAD_GL_IMPLEMENTATION: 1 }]
```

None of this reaches Echo's front end. A `#[cc: define]` macro is visible to the C and nowhere else, and
`#[cc:]` contributes object files and nothing more.

`flag` is safe as untyped free text where a link flag would not be, because it reaches one known tool and is
never read again. [Linking](/projects/linking) has the `#[link:]` half and the reasoning behind the tag.

## The medium is part of the name

A declaration name belongs in a `.eco` file. A manifest name belongs in a `module.eco`. Writing
`#[depends:]` on a function used to compile and do nothing. It is now an error:

```
'depends' is a manifest attribute; it belongs in a module.eco.
```

The other direction was already an error. `#[inline]` in a `module.eco` names the ten names a
manifest accepts.

A namespaced name is the escape on both sides: `#[epm::license:]` in a manifest, `#[web::js_name: "add"]`
on a function. echoc does not own the namespace, so it carries the attribute rather than refusing it.
`-p manifest` emits the manifest ones. `-p decls` emits the source ones. `echoc::` is reserved in
both files. [Packages](/projects/packages) is why the manifest grew this first.

## When the name is wrong

```
unknown attribute 'bultin', expected one of: inline, implicit, unique, atomic, group, tests, export, wasm
```

The attribute is then skipped and the declaration after it still parses, which is the point: the error you
actually needed usually follows immediately.

A bare `builtin` is that same unknown, with a note that it belongs to the standard library, spelled
`echoc::builtin`. A program cannot write it.

```
'mystery(int32)' was declared but never given a body - write one, or say where its implementation comes from with an 'extern' block.
```

A manifest says it differently, because its list is different:

```
module.eco:4: unknown manifest attribute 'source', expected one of: module, version, depends, sources, target, link, cc, build_dir, requires, hook
```

## When the shape is wrong

A consumer says which shape it wanted, in nouns rather than grammar terms:

```
the 'core' attribute wants a name here, not a string.
```

The nouns are `a string`, `a number`, `true or false`, `a name`, `a list` and `a record`. The rest of the
shape refusals:

| Written | Message |
|---|---|
| `#[cc: define { "WIDTH": 40 }]` | `a record key has to be a name, written 'key: value'.` |
| the same key twice in one record | `'WIDTH' is written twice in this record.` |
| a record with no `}` | `this record is missing its '}' - the '{' is on line 3.` |
| an unknown tag | `'framwork' is not a kind of link requirement, expected one of: lib, framework, search, object.` |
| `#[depends: svn { }]` | `'svn' is not a kind of dependency, expected one of: path, git.` |
| `#[depends: git { }]` | `git dependencies are not resolved yet - write '#[requires: "name" { version: "...", source: git "..." }]' and run \`epm install\`, or vendor the module and name it with a path.` |

Recovery is the balanced `[ ... ]`, not the next statement, so one broken attribute costs you one error and
the file keeps parsing.

## The conditional directives are not attributes

`#[if:]`, `#[elif:]`, `#[else]` and `#[end]` are missing from the known-attribute list on purpose. They are
consumed by a token filter that runs between lexing and the first parse pass, so by the time the attribute
parser exists they are gone.

That's also what makes them work everywhere: at file scope, inside a struct body, inside a function body,
around an `extern` block, around a `namespace`. No pass had to be taught about them.

[Conditional compilation](/projects/conditional-compilation) is the chapter. What follows is the grammar and
the message lookup.

### The condition grammar

```
or    := and ( '||' and )*
and   := unary ( '&&' unary )*
unary := '!' unary | '(' or ')' | axis '==' name | axis '!=' name | name
```

`&&` binds tighter than `||`, as you would expect. A condition is not an Echo expression and shares no code
with one.

### What a condition can see

| Axis | Values |
|---|---|
| `os` | `darwin`, `linux`, `windows`, `ios`, `android`, `wasi` |
| `family` | `darwin`, `linux`, `windows`, `wasi`. Derived from `os` (`ios` is `darwin`, `android` is `linux`, `wasi` is `wasi`). Never set on its own |
| `arch` | `arm64`, `x86_64`, `wasm32` |

Plus one flag the compiler sets itself, and any bare name you pass with `--define`:

| Flag | True when |
|---|---|
| `tests` | this invocation is compiling the module's `test` blocks, which is `echoc test` and nothing else |

`tests` is reserved: `--define tests` is refused, because whatever compiles your test blocks has to be the
thing that also runs them. [Testing](/projects/testing) is where that matters.

An axis and a flag behave in opposite ways, deliberately:

- **An axis vocabulary is closed.** `os == darwn` is an error, because otherwise it is a block that vanishes
  in silence.
- **A flag is open and false when undefined.** If an undefined flag were an error, `#[if: TRACE]` could never
  take its `#[else]` arm.

An unrecognised host leaves the axis empty rather than failing, so `os == darwin` on an unknown platform is
simply false and the `#[else]` arm runs.

Note: the condition is evaluated even inside a region that is being skipped, so a typo in another platform's
arm is still caught on your machine.

### Every conditional error

| Case | Message |
|---|---|
| unknown value | `unknown os 'darwn', expected one of: darwin, linux, windows, ios, android, wasi` |
| unknown axis | `unknown condition axis 'cpu', expected one of: os, arch, family` |
| never closed | `'#[if: ...]' is never closed - add '#[end]'` |
| axis with no comparison | ``'os' is a condition axis and needs a comparison - write `os == <value>` `` |
| compared to a literal | `'os' is compared against a bare name, not a literal` |
| not a testable name | `'42' is not a name a condition can test` |
| condition ends early | `a condition ended where a name was expected` |
| trailing tokens | `unexpected 'foo' after the condition` |
| unbalanced parens | `a '(' in a condition is missing its ')'` |
| no condition at all | `'#[if: ...]' needs a condition` |
| missing `]` | `'#[if' is missing its closing ']'` |
| orphan directive | `'#[end]' has no open '#[if: ...]'` |
| arm after `#[else]` | `'#[elif]' comes after the '#[else]' of the '#[if: ...]' on line 12` |
| axis passed to `--define` | ``'os' is a condition axis, not a flag - write `#[if: os == <value>]` rather than defining it`` |

All of them are prefixed with `line N:` and reported under an `[error] Conditional Compilation Failed`
header, because the filter runs before there is a parsed file to point into.

## Next

- [Modules](/projects/modules) for what a manifest is and how a dependency resolves.
- [Tools and hooks](/projects/tools) for `#[hook:]` and `public: true`.
- [Linking](/projects/linking) for `#[link:]` and `#[cc:]` in use against a real native library.
- [Conditional compilation](/projects/conditional-compilation) for why the directives are a token filter.
