# Keywords

Echo reserves thirty-one words, and the thing worth noticing is **how short that list is**. There is no
`public`, no `static`, no `new`, no `this`, no `import`, no `use`, no `switch`, no `try`, no `throw` and no
`sizeof`.

```echo
function greet(string $name) : void
{
    echo $name;
}

greet("Echo");      // Echo
```

Six words in that program and two of them are reserved. The rest of this page is the full list, plus the
words that look reserved and are not, plus every token that means something on its own.

## The reserved words

Reserved means the lexer takes the word before anything else gets a look at it, so it cannot be a function
name, a struct name or a member name. Variables are safe either way, because a variable always carries a `$`.

Matching is whole-word. `forward`, `classify`, `enumerate`, `nullable` and `constructor` are all ordinary
identifiers, and nothing about them collides with `for`, `class`, `enum`, `null` or `const`.

### Declarations

| Word | What it does | Covered in |
|---|---|---|
| `function` | declares a function, a method or a constructor | [Functions](/language/functions) |
| `return` | leaves a function with a value | [Functions](/language/functions) |
| `struct` | declares a value type | [Structs](/language/structs) |
| `class` | declares a reference-counted heap type | [Classes](/language/classes) |
| `interface` | declares a set of requirements a type can answer | [Interfaces](/language/interfaces) |
| `destructor` | declares the method that runs when a value dies | [Structs](/language/structs) |
| `operator` | declares an operator, infix, prefix or `[]` | [Operators](/language/operators) |
| `namespace` | puts the rest of the file in a namespace | [Namespaces](/language/namespaces) |
| `extern` | opens a block of C declarations bound by raw symbol name | [C interop](/projects/c-interop) |
| `const` | a read-only variable, a constant, or a `const if` | [Constants](/language/constants) |
| `private` | hides a property from outside its own type | [Structs](/language/structs) |
| `enum` | nothing. See below | [What is missing](/reference/limitations) |

### Control flow

| Word | What it does | Covered in |
|---|---|---|
| `if` / `else` | the ordinary branch | [Control flow](/language/control-flow) |
| `while` | loop while a condition holds | [Control flow](/language/control-flow) |
| `for` | initializer, condition, step | [Control flow](/language/control-flow) |
| `foreach` | walk anything iterable, with `as` | [Iteration](/collections/iteration) |
| `as` | the binding half of a `foreach` | [Iteration](/collections/iteration) |
| `break` / `continue` | leave the loop, or jump to its next step | [Control flow](/language/control-flow) |
| `guard` | bind a nullable value or leave the scope | [Nullability](/memory/nullability) |

### Values

| Word | What it does | Covered in |
|---|---|---|
| `true` / `false` | the two `bool` literals | [Types](/language/types) |
| `null` | the absent value, only where a `T?` admits one | [Nullability](/memory/nullability) |
| `mv` | move out of a variable, or declare a parameter that takes ownership | [Ownership](/memory/ownership) |
| `strong` | turn a `weak<T>` back into a handle, if the object is still there | [Ownership](/memory/ownership) |
| `instanceof` | ask whether an interface value holds a particular type | [Interfaces](/language/interfaces) |

### Types

| Word | What it does | Covered in |
|---|---|---|
| `ptr` | the raw pointer type `ptr<T>`, and the `ptr(...)` conversion | [Pointers](/memory/pointers) |
| `weak` | the non-owning class handle `weak<T>` | [Ownership](/memory/ownership) |

### Statements

| Word | What it does | Covered in |
|---|---|---|
| `echo` | print one value and a newline. A statement, not a function | [Your first program](/guide/first-program) |
| `unsafe` | open a block where raw storage may be promoted to a typed borrow | [Unsafe](/memory/unsafe) |

## enum is reserved and does nothing

`enum` is in the lexer and nowhere else. No parser accepts it, so writing one gets you a confused message
about the token after it rather than "enums are not implemented":

```echo
enum Color { RED }      // error: Unexpected token 'identifier' found
```

The word is reserved so that adding the feature later does not break your code. Today it is a hole, and it
is on [the list](/reference/limitations).

## Words that look reserved and are not

`die`, `assert`, `dprint` and `exit` read like keywords and are ordinary functions. They are declared in
Echo, in the standard library, and the compiler answers them at the call site instead of emitting a call:

```echo
assert(1 + 1 == 2);
echo "still here";      // still here
```

The full set of names the compiler answers this way: `size_of`, `align_of`, `is_trivially_copyable`,
`needs_destruction`, `take`, `init`, `die`, `assert`, `ref_count`, `weak_count`, `dprint`, `alloc_bytes`,
`realloc_bytes`, `free_bytes`, `live_allocations`, `process_argc`, `process_argv`, `process_envp` and `exit`.
Nothing reserves them, so you can declare a function called `assert` and shadow it. I would not.

There is no `print`. `echo` is the only output statement in the language.

`constructor` is the other one, and its asymmetry with `destructor` is deliberate rather than an oversight:

```echo
struct Point
{
    int32 $x;

    constructor(int32 $x) { $this->x = $x; }
    destructor() { }
}

echo Point(3)->x;       // 3
```

`destructor` is a real keyword so that no member can be named `destructor` and collide with the mangled name
of the actual one. `constructor` is an ordinary identifier the type parser recognises by value, which means a
struct is free to have a property called `constructor` and nothing breaks.

Four more words are contextual in the same way, recognised only in one position and ordinary identifiers
everywhere else:

- `type`, inside an interface body, declaring an associated type.
- `self`, in `self::NAME`, reaching a constant on the enclosing type.
- `left` and `right`, inside an `operator(45, left)` precedence clause.
- `numeric`, `integer`, `signed`, `unsigned` and `floating`, as generic constraint aliases.

## Primitive type names are not keywords either

`int32`, `usize`, `bool` and the rest are plain identifiers that the type parser matches by string. That is
why they can never be shadowed (the primitive is checked first) and also why they do not appear in the tables
above. [Primitive types](/reference/primitive-types) has the full list.

`string`, `array`, `map`, `slice` and `range` are not even that. They are structs in `stdlib/core/`, and with
`--no-stdlib` they simply do not exist.

## The tokens

| Token | Means | Covered in |
|---|---|---|
| `::` | namespace separator, nested type, `self::NAME` | [Namespaces](/language/namespaces) |
| `->` | member and method access | [Structs](/language/structs) |
| `?->` | member access that stops at a `null` | [Nullability](/memory/nullability) |
| `??` | value on the left, or the right if it is absent | [Nullability](/memory/nullability) |
| `?` | nullable suffix on a type, as in `int32?` | [Nullability](/memory/nullability) |
| `=>` | the key half of `foreach ($m as $k => $v)` | [Maps](/collections/maps) |
| `:` | return type, attribute value, generic constraint | [Functions](/language/functions) |
| `:$` | reach the pointer itself rather than what it points at | [Pointers](/memory/pointers) |
| `&` | a reference, or bitwise and. Whitespace decides, see below | [Pointers](/memory/pointers) |
| `!` | negation, and the presence test on a nullable | [Expressions](/language/expressions) |
| `**` | exponentiation | [Expressions](/language/expressions) |
| `<<` `>>` | shift left, shift right | [Expressions](/language/expressions) |
| `&&` `\|\|` | logical and, logical or | [Expressions](/language/expressions) |
| `\|` `^` | bitwise or, bitwise xor | [Expressions](/language/expressions) |
| `<` `>` | comparison, and the brackets around type arguments | [Generics](/language/generics) |
| `#` `[` `]` | an attribute is `#` followed by a bracketed value | [Attributes](/reference/attributes) |
| `//` `/* */` | comments. No doc-comment form | |

Three things are missing from that table on purpose.

**There is no ternary operator.** `?` is the nullable suffix and nothing else. `??` covers the case people
usually reach for a ternary to write.

**There is no cast operator.** `(int32)$x` does not parse. Conversion happens by assigning to a typed
destination. See [Types](/language/types).

**`..` and `..=` are not tokens.** They are ordinary operator declarations in `stdlib/core/range.eco`:

```echo
foreach (0 .. 3 as $i) {
    echo $i;        // 0, then 1, then 2
}
```

`0 .. 3` lexes as an integer, a dot, a dot and an integer, and the parser puts them back together the same
way it does for any symbol a user declares. That is not a trick played for ranges. Declare `<=>` yourself and
it goes through the identical path.

## & is the one place whitespace changes meaning

`&` glued to what follows is a reference. `&` with a space after it is the bitwise operator:

```echo
uint32 $h = 12;
uint32 $mask = 7;

echo $h & $mask;    // 4, bitwise and
```

The rule is exact rather than a matter of taste: `&` is a reference when the very next character is `$` or
any of `A-Z`, `a-z`, `0-9`, `_`. Otherwise it is bitwise and.

The consequence to remember is that a digit counts. `$mask &1` is not "bitwise-and one", it is a reference to
something starting with `1`, and the message you get will be about the wrong thing entirely. Put spaces
around a binary `&`.

Unpicking this would be a lexer change, not a parser one, and it would change what `&$a[$i]` means
everywhere. I would rather write the space.

## Two more places spacing matters

**A binary `-` needs spaces**, because `-` glues to a following digit and becomes part of the literal:

```echo
echo 1 - 2;         // -1
```

Written `1-2` that is two integer literals in a row, and the compiler says
`unexpected '-2' - two expressions with no operator between them.` Which is technically accurate and takes a
moment to read.

**`#[name: $value]` needs the space after the colon**, because `:$` is a single token that will eat both
characters. `#[cache:$ttl]` loses its value silently. This one is a deliberate decision rather than an
accident: `:$` is worth more than the compact attribute spelling.

## Next

- [Primitive types](/reference/primitive-types) for the type names that are not keywords.
- [Attributes](/reference/attributes) for what goes inside `#[ ]`.
- [What is missing](/reference/limitations) for `enum` and the rest of the holes.
