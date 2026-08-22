# Generics

Write a function once and it works for every type that makes sense:

```echo
function largest<T : numeric>(T $a, T $b) : T
{
    if ($a > $b) {
        return $a;
    }
    return $b;
}

echo largest(3, 7);         // 7
echo largest(1.5, 0.5);     // 1.500000
```

`<T>` after the name declares a type parameter. Inside the body `T` is an ordinary type you can write
anywhere: a parameter, a local, a return type.

Here's the thing that actually matters: **Echo monomorphizes.** Each set of type arguments you actually use
produces a separate, fully concrete copy of the function. `largest(3, 7)` compiles down to a function taking
two `int32`s. There is no boxing, no type erasure and no runtime cost for the generality.

## Inference at the call site

You normally don't write the type arguments. The compiler works them out from what you passed:

```echo
function identity<T>(T $value) : T
{
    return $value;
}

echo identity(42);      // 42, T is int32
echo identity(1.5);     // 1.500000, T is float64
```

When there is nothing to infer from, say it yourself in angle brackets:

```echo
function zero<T>() : T
{
    return 0;
}

echo zero<int32>();     // 0
```

`T` appears only in the return type there, and a return type is not something the compiler can read
backwards from the call. Write it out.

A prefix is enough when some parameters are named and the rest sit in the arguments:

```echo
function make<T, A>(A $arg) : T
{
    return T($arg);
}

class Handle
{
    int32 $n;

    constructor(int32 $n)
    {
        $this->n = $n;
    }
}

echo make<Handle>(7)->n;     // 7, A is int32
```

`make<Handle>(7)` names `T`. `A` comes from `7`. Writing a second type argument is still allowed;
writing a third, when there are only two, is not.

## Generic types

A struct or class can take type parameters too:

```echo
struct CargoBay<T>
{
    T $contents;

    const function manifest() : T
    {
        return $this->contents;
    }
}

CargoBay<int32> $hold = CargoBay<int32>(42);
echo $hold->manifest();     // 42
```

For a type, the arguments are written at construction. `CargoBay<int32>` and `CargoBay<string>` are two
unrelated types that happen to share a template. A bay rigged for naquadah is not a bay rigged for crates.

Methods can have their own type parameters on top of the type's:

```echo
struct CargoBay<T>
{
    T $contents;

    function log<U>(U $note) : T
    {
        echo $note;
        return $this->contents;
    }
}

CargoBay<int32> $hold = CargoBay<int32>(42);
echo $hold->log(1.5);
```

## Multiple type parameters

Separate them with commas. Each is inferred independently:

```echo
function pair<K, V>(K $key, V $value) : K
{
    echo $value;
    return $key;
}

echo pair(1, 2.5);      // prints 2.5 then 1
```

## Constraints

An unconstrained `T` can hold anything, which means the body can do almost nothing with it. A constraint
says what `T` must be able to do.

### The built-in shorthands

Five names cover the numeric cases, and they are not interfaces, just built-in vocabulary:

| Constraint | Accepts |
|---|---|
| `numeric` | any integer or float |
| `integer` | any integer type |
| `signed` | signed integers |
| `unsigned` | unsigned integers |
| `floating` | `float32` and `float64` |
| `class` | any class, including a generic instantiation such as `Box<int32>` |

```echo
function double<T : numeric>(T $value) : T
{
    return $value * 2;
}

echo double(21);        // 42
echo double(1.5);       // 3.000000
```

Break one and the compiler names the parameter, the constraint and what you actually passed:

```echo
function halve<T : integer>(T $value) : T
{
    return $value / 2;
}

echo halve(1.5);
// error: Type parameter 'T' of 'halve' is constrained to 'integer' but was given 'float64'
```

`class` is the one of these that is not a closed list. There is no finite set of classes to expand, so it
asks "is this a class" — a `Box<int32>` counts, a `struct` does not. A struct that wants in is wrapped in a
class, not admitted as itself.

```echo
class Handle
{
    int32 $n;
}

function id<T : class>(T $value) : T
{
    return $value;
}

echo id(Handle(7))->n;      // 7
echo id(1);
// error: Type parameter 'T' of 'id' is constrained to 'class' but was given 'int32'
```

## Constructing through a type parameter

Inside a generic body, `T` is a type. You can construct it, and you can call a static on it, the same
way you would if you had written the bound type by name:

```echo
class Handle
{
    int32 $n;

    constructor(int32 $n)
    {
        $this->n = $n;
    }

    static function from(int32 $n) : Handle
    {
        return Handle($n);
    }
}

function make<T : class>(int32 $n) : T
{
    return T($n);
}

function spawn<T : class>(int32 $n) : T
{
    return T::from($n);
}

echo make<Handle>(7)->n;     // 7
echo spawn<Handle>(3)->n;    // 3
```

Nothing here is a new kind of call. `T::from(...)` is a static whose owner is not concrete yet, so
resolution waits until monomorphization names `Handle`. `T(...)` is a constructor call on that same
wait: constructors live under the type's name, and once `T` is `Handle` the overload set is
`Handle`'s.

There are no Echo variadics. Two arities are two overloads of `make`, distinguished by argument
count the same way any other pair of functions is. A prefix of type arguments is enough:
`make<Handle>(7)` names `T` and infers `A` from `7`. Writing more than the function has is still
an error.

A struct is not a class, so `make<YetAnotherOne>(3.14)` is refused at the call. Wrap it. `rc<T>`
is that wrapper, in the standard library:

```echo
struct YetAnotherOne
{
    float64 $n;
}

function make<T : class, A>(A $arg) : T
{
    return T($arg);
}

$c = make<rc<YetAnotherOne>>(3.14);
echo $c->value->n;           // 3.140000
```

`rc<T>` has a seating constructor for a ready `T`, and forwarding constructors that call `T(...)`
with the arguments you passed. `rc<YetAnotherOne>` is a class. The key, if you put it in a map, is
`type_id<rc<YetAnotherOne>>()`, distinct from any other `rc<U>`. [Classes](/language/classes) is
that wrapper.

## Type identity, and a map of instances

`type_id<T>()` is a value: the identity of `T`, something you can store, hash and compare. It is
not reflection. It does not name constructors or fields. Two calls with the same `T` are the same
id, including across modules.

```echo
echo type_id<int32>() == type_id<int32>();     // 1
echo type_id<int32>() == type_id<int64>();     // 0
```

A class's id is the same word `instanceof` already compares. `rc<int32>` and `rc<string>` are two
ids, because they are two types.

That makes a map of instances possible, keyed by the type you put in:

```echo
map<type_id, int32> $sizes = map<type_id, int32>();
$sizes[type_id<int32>()] = 4;
echo $sizes->get(type_id<int32>());            // 4
```

The map's value still has to be one type. For objects that is `erased`: an owning class handle with
no interface the service has to implement. `erased::from($obj)` retains. `assume<T>($held)` is the
reverse, a promise that the slot is a `T`, and it is refused outside `unsafe`. Wrong `T` is the
same kind of bug as promoting the wrong address. [Unsafe](/memory/unsafe) is that chapter.

```echo
class Handle
{
    int32 $n;
}

Handle $h = Handle(7);
erased $held = erased::from($h);

unsafe {
    Handle $back = assume<Handle>($held);
    echo $back->n;                             // 7
}
```

A struct has no handle to erase. `erased::from` carries `T : class`, so the compiler refuses it at
the call, the same wording as `make<YetAnotherOne>` against `T : class`. Wrap the struct.

Putting those together is a container you write, not something the language ships:

```echo
class Handle
{
    int32 $n;

    constructor(int32 $n)
    {
        $this->n = $n;
    }
}

class Container
{
    map<type_id, erased> $instances;

    function make<T : class, A>(A $arg) : T
    {
        type_id $id = type_id<T>();

        if ($this->instances->has($id)) {
            erased $held = $this->instances->get($id);
            unsafe {
                return assume<T>($held);
            }
        }

        T $fresh = T($arg);
        $this->instances[$id] = erased::from($fresh);
        return $fresh;
    }
}

Container $container = Container(map<type_id, erased>());
Handle $first = $container->make<Handle>(7);
Handle $again = $container->make<Handle>(99);
echo $first->n;                                // 7
echo $again->n;                                // 7, same object
```

The `99` is ignored because the slot is already filled. There is no `Service` interface. The
container promises the slot is `T` because it is the only writer of that key.

### Interface constraints

For anything else, constrain by an interface you declared:

```echo
interface Powered
{
    const function draw() : float64;
}

struct ZPM : Powered
{
    float64 $output;

    const function draw() : float64
    {
        return $this->output;
    }
}

function report<T : Powered>(const T& $unit) : void
{
    echo $unit->draw();
}

report(ZPM(2.5));       // 2.500000
```

This is the compile-time job of an interface, and it is the only way a **struct** can participate in one.
The call to `draw()` is direct, not dispatched. See [Interfaces](/language/interfaces).

## What monomorphization means for you

Two consequences, one good and one to keep an eye on.

**Speed.** A generic function is exactly as fast as the one you would have written by hand for that type.
The compiler knows the concrete type, so it can inline, unroll and vectorize normally.

**Code size.** Every distinct set of type arguments produces another copy in the binary. Ten types through
one large generic function means ten copies of that function.

You can see what got generated:

```bash
echoc run -p instances program.eco
```

That prints every instance the compiler minted and what each type parameter was bound to, which is the first
thing to reach for when a generic call doesn't resolve the way you expected.

## Asking about a type parameter

Inside a generic body, `T` is concrete by the time code is generated, so the compiler can answer questions
about it:

```echo
function describe<T>() : usize
{
    return mem::size<T>();
}

echo describe<int32>();     // 4
echo describe<int64>();     // 8
```

Three of these come up constantly when writing containers:

| Query | Answers |
|---|---|
| `mem::size<T>()` | the size in bytes |
| `mem::is_trivially_copyable<T>()` | whether copying is just copying the bytes |
| `mem::needs_destruction<T>()` | whether `T` owns something that has to be given back |

## Branching on the answer

The queries get genuinely useful next to `const if`, which picks an arm at compile time and discards the
other one before it is even type checked:

```echo
function explain<T>() : void
{
    const if (mem::needs_destruction<T>()) {
        echo "owns something, needs care";
    } else {
        echo "plain data, copy the bytes";
    }
}

explain<int32>();           // plain data, copy the bytes
explain<array<int32>>();    // owns something, needs care
```

This is how `array<T>` is written. Its copy, its destructor and its `clear()` all branch on these three
questions, which is why an owning element type works correctly with **no arm anywhere in the compiler that
knows what a container is**.

One catch: `mem::size` and `mem::align` can't decide a `const if`. They are
answered from the target's layout, which the compiler only knows once it is emitting code, and the branch
has to be picked earlier than that. The two AST questions above can. See
[Control flow](/language/control-flow).

## Generic operators and methods

Operators can be generic too. The type parameters go right after the keyword:

```echo
struct CargoBay<T>
{
    T $forward;
    T $aft;
}

operator<T> (CargoBay<T>& $bay)[usize $slot] : T&
{
    if ($slot == 0) {
        return &$bay->forward;
    }
    return &$bay->aft;
}

CargoBay<int32> $hold = CargoBay<int32>(11, 22);
echo $hold[0];      // 11
echo $hold[1];      // 22
```

`T` is inferred from the operands, exactly as it is for a call. This is how `array<T>` and `map<K, V>`
declare their brackets.

Here's a gap. Declaring a **generic** overload of a symbol that already has a
built-in meaning is currently refused, even though the concrete version is fine:

```echo
struct CargoBay<T>
{
    T $forward;
    T $aft;
}

operator<T> (CargoBay<T> $a) + (CargoBay<T> $b) : CargoBay<T>
{
    return CargoBay<T>($a->forward + $b->forward, $a->aft + $b->aft);
}
// error: operator '+' is built in for these operand types, so this declaration would never be used -
//        where the language spells a meaning, the built-in one wins.
```

Inside the template the operands are still `T`, and the compiler answers "that might be a primitive" rather
than waiting to find out. Writing the operator for the concrete instantiation works:

```echo
struct CargoBay<T>
{
    T $forward;
    T $aft;
}

operator (CargoBay<int32> $a) + (CargoBay<int32> $b) : CargoBay<int32>
{
    return CargoBay<int32>($a->forward + $b->forward, $a->aft + $b->aft);
}

CargoBay<int32> $combined = CargoBay<int32>(1, 2) + CargoBay<int32>(10, 20);
echo $combined->forward;    // 11
```

Custom symbols such as `..` don't hit this, because nothing is built in for them. See
[Operators](/language/operators).

## Next

- [Interfaces](/language/interfaces) for constraints beyond the numeric shorthands, and associated types.
- [Control flow](/language/control-flow) for `const if`.
- [Memory](/stdlib/mem) for the full list of type queries.
