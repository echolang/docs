# Embedding files

A string literal already lives in the binary: static bytes, a length, a null owner. `std::embed` is
that same thing, for a file you would rather not paste into the source.

`std::io` reads the file when the program runs, and the file has to still be there. This reads it
when the program is compiled. After that the bytes are in the image. You can ship a help page, a
shader, a license, a font, without a data directory walking next to the binary.

<!-- verify: skip -->
```echo
const string HELP = std::embed::text("help.txt");
echo HELP;
```

The path is a string literal, relative to the source file that wrote the call. A runtime string
will not compile: the compiler has to know which file to open.

<!-- verify: skip -->
```echo
const PATH = "help.txt";
echo std::embed::text(PATH);     // fine: a constant already is the literal

string $p = "help.txt";
echo std::embed::text($p);       // error: the path is decided when the program is compiled
```

## text and bytes

Two functions, because `string` promises UTF-8 and a font does not.

<!-- verify: skip -->
```echo
string $help = std::embed::text("help.txt");
echo $help->size();

string::view $font = std::embed::bytes("font.ttf");
echo $font->size;
```

`text` is UTF-8 and answers a `string`, the same value a `'hello'` literal is. Invalid UTF-8 is a
compile error, and the diagnostic tells you to use `bytes`.

`bytes` is any file, interior NULs included, and answers a `string::view` over the static bytes.
The window is valid for the life of the program. I did not return `slice<const uint8>` from the
builtin: `string::view` is already the two-word window over bytes nobody owns, and making the
compiler mint a slice would have taught it a type it has no business naming.

Empty files are legal. Bytes are raw: a CRLF file stays CRLF.

## The path cannot walk out

Relative to this source file, `/` only. Absolute paths are refused. `..` that would leave the
module directory is refused. A directory is refused: this reads one file.

A loose `.eco` with no `module.eco` jails to the file's own directory. A module jails to the
directory that holds the manifest, so `src/ui/window.eco` can embed `assets/icon.png` as
`../assets/icon.png` and cannot walk out of the project.

Changing the file rebuilds. An unchanged `.eco` with a changed `help.txt` is still a miss.

## One copy, or one per use

A constant is substitution. Two uses of `HELP` are two names for the same static bytes inside one
module, and a copy per consumer if you exported the constant from a library.

If you want one copy in the library's object, wrap it in a function:

<!-- verify: skip -->
```echo
public function license() : string
{
    return std::embed::text("LICENSE");
}
```

Callers get a `string` with a null owner, pointing at the library's rodata. Same cost as returning
`'MIT'`.
