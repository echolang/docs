# contract

`contract::` holds interfaces and nothing else. Six of them matter, and they split into two protocols:
four for iteration, two for unwrapping. **`foreach` uses the first four and nothing else, and `guard` uses
the other two and nothing else.** `array<T>` gets no special treatment from either, and neither does
anything else in the library.

```echo
array<string> $gates = ["Abydos", "Chulak"];

foreach ($gates as $name) {
    echo $name;
}
```

That loop resolved against an interface `array<T>` declares in ordinary Echo. A type of your own conforms
exactly the same way and loops exactly as well. The rest of this page is how.

## The iteration interfaces, in full

<!-- verify: skip -->
```echo
namespace contract;

interface iterator<V>
{
    function advance() : bool;
    function current() : V&;
}

interface iterable<V>
{
    type Iter : iterator<V>;

    function iterate() : Iter;
}

interface const_iterable<V>
{
    type Iter : iterator<V>;

    const function iterate() : Iter;
}

interface keyed<K>
{
    function key() : K;
}
```

That is all of them. No properties, no bodies, no default implementations. An interface in Echo describes a
capability and has no storage and no behaviour of its own, which is what keeps conformance from being
inheritance. See [Interfaces](/language/interfaces).

## advance() first, current() after, and that ordering is the contract

An `iterator<V>` is a cursor. It knows how to step, and it knows what it is looking at:

<!-- verify: skip -->
```echo
function advance() : bool;      // step. false when there are none left
function current() : V&;        // the element. only valid after advance() answered true
```

`foreach` calls `advance()` first and gates the loop on its answer, so `current()` is only ever reached
after a `true`. That is the whole promise, and it is worth more than it looks: it means `current()` can skip
a bounds check that `advance()` has already performed. A cursor that tried to be safe to call in any order
would pay for that on every element.

`current()` returns `V&`, a borrow, so a loop over an owning element type copies nothing.

## `Iter` is an associated type, and you never write it

`iterable<V>` is anything that can hand you a fresh cursor:

<!-- verify: skip -->
```echo
interface iterable<V>
{
    type Iter : iterator<V>;

    function iterate() : Iter;
}
```

`Iter` is chosen by the implementor, and the interface only constrains it. You do not declare it, bind it,
or name it anywhere: **the compiler reads it off the return type of your `iterate()`.** If that return type
does not conform to `iterator<V>`, the conformance is refused at your declaration rather than at the loop.

## Writing a cursor of your own, end to end

Two types. The cursor holds the state, and the thing being iterated hands one out:

```echo
struct dial_cursor : contract::iterator<int32>, contract::keyed<usize>
{
    int32 $chevron;
    usize $step;

    constructor(int32 $from)
    {
        $this->chevron = $from;
        $this->step = 0;
    }

    function advance() : bool
    {
        if ($this->chevron >= 7) {
            return false;
        }

        $this->chevron = $this->chevron + 1;
        $this->step = $this->step + 1;
        return true;
    }

    function current() : int32&
    {
        return &$this->chevron;
    }

    function key() : usize
    {
        return $this->step - 1;
    }
}

struct Dial : contract::iterable<int32>
{
    int32 $from;

    // Iter is inferred to be dial_cursor, from this return type
    function iterate() : dial_cursor
    {
        return dial_cursor($this->from);
    }
}

$d = Dial(4);

foreach ($d as $i => $chevron) {
    echo $chevron;      // 5, 6, 7
}
```

Note that `advance()` moves *and* reports. The cursor starts positioned before the first element, so the
first `advance()` is what makes element zero current. Getting that off by one is the usual mistake, and it
shows up as a missing first element or a phantom last one.

## `const_iterable` is a second interface, not an overload

A container declares both:

<!-- verify: skip -->
```echo
struct array<T> : contract::iterable<T>, contract::const_iterable<const T>
```

Which is why this works, over a value the function promised only to read:

```echo
function total(const array<int32>& $power) : int32
{
    int32 $sum = 0;

    foreach ($power as $level) {
        $sum = $sum + $level;
    }

    return $sum;
}

array<int32> $power = [1, 2, 3];
echo total($power);         // 6
```

The reason it is a separate interface rather than a second `iterate()` overload is that **a requirement's
receiver is part of the requirement.** An interface is answered by a method making exactly the promise it
asked for, compared in both directions, so a `const function iterate()` cannot answer `iterable<V>` and a
plain one cannot answer `const_iterable<V>`. Two interfaces, two answers, and no ranking to depend on.

`V` means the same thing in both: **what the loop yields.** So a container declares the const one over its
const element type, `const_iterable<const T>`, and a const receiver hands out a cursor over storage it may
not write. `foreach` picks between the two by whether the value it was given is const, and the const-ness
travels all the way to the loop variable.

## `keyed<K>` is orthogonal on purpose

It is what makes the two-variable form spellable:

```echo
map<string, int32> $power = map<string, int32>();
$power["naquadah"] = 3;

foreach ($power as $key => $level) {
    echo $key;          // naquadah
    echo $level;        // 3
}
```

`keyed<K>` sits beside `iterator<V>` rather than being folded into it, and that is what lets the capability
set grow. A future `reversible` or `random_access<V>` is another interface next to these, and a cursor
declares the ones it can honour. A cursor that cannot say where it is simply does not declare `keyed<K>`,
and the `$k => $v` form is then refused for it.

## When a conformance does not hold, you hear about it at the declaration

```echo
struct bad_cursor : contract::iterator<int32>
{
    int32 $v;

    function current() : int32&
    {
        return &$this->v;
    }
}
// error: 'bad_cursor' says it conforms to 'contract::iterator<int32>' but does not satisfy
//        'advance() : bool' - it declares no 'advance'.
```

The error is on line one of the struct, not at some far-away `foreach`. That is the payoff for conformance
being declared rather than inferred: the type either says it can do this or it does not, and the compiler
checks the claim where the claim is made.

## unwrappable and failable

The other two are what `guard` resolves against. Same idea as iteration: no special case anywhere, the
library's own [`result<T, E>`](/stdlib/result) declares them and so can you.

<!-- verify: skip -->
```echo
namespace contract;

interface unwrappable<V>
{
    const function has_value() : bool;
    function unwrap() : V&;
}

interface failable<E>
{
    function failure() : E&;
}
```

`has_value()` is asked first and its answer gates `unwrap()`, exactly the way `advance()` gates `current()`.
So `unwrap()` never has to re-check anything, and it is allowed to stop the program when called on a value
that has none.

Declare `unwrappable<V>` and `guard` works:

```echo
struct maybe_port : contract::unwrappable<int32>
{
    bool $present;
    int32 $port;

    const function has_value() : bool
    {
        return $this->present;
    }

    function unwrap() : int32&
    {
        return &$this->port;
    }
}

maybe_port $p = maybe_port(true, 8080);

int32 $port = guard $p else { die('no port'); }

echo $port;    // 8080
```

### failable is separate on purpose

`failable<E>` is what makes `else ($e)` spellable, and it is a **second** interface rather than a second
method on the first. That is not tidiness. A type that means "maybe a value" often has nothing to say about
why, and a `T?` is exactly that: it records that a value is absent and nothing at all about the reason. So a
subject that does not declare `failable<E>` has no reason to bind, and writing `else ($e)` against one is a
compile error at the `$e` rather than a hole in the protocol.

Declare both and the `else` block can name the reason. [Nullability](/memory/nullability#your-own-types-can-be-guarded-too)
walks a full worked example, and [`result<T, E>`](/stdlib/result) is the one the library ships.

Note: `T?` does not conform to `unwrappable<V>` and cannot. Over a pointer or a class handle it is a
per-level flag with no declaration anywhere, and the tagged form is a layout the compiler interns. The
compiler answers for `T?` directly, before these interfaces are consulted at all, which is why `guard` over a
`T?` still works with `--no-stdlib`.

## The protocol is genuinely open

Your own type loops as well as `array<T>` does, and that is not generosity. It is because `array<T>` never
had a shortcut available to it either: it declares these interfaces, and so do you. Anything the library can
iterate, you can build.

The other side of that is what [`--no-stdlib`](/stdlib/) takes away. These interfaces are library code, so a
program compiled without the library has no iteration protocol and `foreach` says so.

## The whole surface

| Interface | Requirement | Answered by |
|---|---|---|
| `contract::iterator<V>` | `advance() : bool` | a cursor, stepping and reporting whether it moved |
| | `current() : V&` | a cursor, valid only after `advance()` said true |
| `contract::iterable<V>` | `type Iter : iterator<V>` | inferred from your `iterate()`, never written |
| | `iterate() : Iter` | a fresh cursor, positioned before the first element |
| `contract::const_iterable<V>` | `type Iter : iterator<V>` | as above |
| | `const function iterate() : Iter` | the const receiver's cursor, usually over `const T` |
| `contract::keyed<K>` | `key() : K` | where the cursor is, valid after `advance()` said true |
| `contract::unwrappable<V>` | `const function has_value() : bool` | is there a value. Asked first, and it gates the next one |
| | `unwrap() : V&` | the value, valid only after `has_value()` said true |
| `contract::failable<E>` | `failure() : E&` | why there is no value, valid only after `has_value()` said false |

## Next

- [Iteration](/collections/iteration) for `foreach` itself, including the `$k => $v` form.
- [Interfaces](/language/interfaces) for conformance, associated types and the two jobs an interface does.
- [Generics](/language/generics) for the type parameters these interfaces constrain.
