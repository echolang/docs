# Attribute discovery

You are writing a router. Handlers live all over the program. You don't want a central list
that someone forgets to update.

Tag the handlers. `attr::of` walks the program at compile time and hands you a slice of a
constant table.

```echo
public struct Route
{
    public string $path;
    public function<int32()> $call;
}

#[http::get: "/users"]
public function listUsers() : int32
{
    return 1;
}

#[http::get: "/health"]
public function health() : int32
{
    return 2;
}

foreach (attr::of<Route>("http::get") as const &$row) {
    echo $row->path;
}
```

```
/users
/health
```

`#[http::get: ...]` is a tool attribute. echoc carries it and otherwise ignores it. `attr::of`
is the thing that reads those tags. The set is closed when you compile. Add a handler and skip
the rebuild, and it is not in the table.

## The row

`attr::of<Route>("http::get")` needs `Route` to have **exactly one target field**. That field
is what the tagged declaration becomes.

A `function<R(P...)>` collects free functions, static methods, and constructors, stored as
Echo callables. That is the router above: `$row->call()` is `listUsers`.

An `extern function<R(P...)>` collects the same functions as C function pointers, when you
need them on the other side of a plugin table.

A `type_id` collects structs, classes, and enums. Compare it with `type_id<Alpha>()` if you
want to know which one you got:

```echo
public struct Tagged
{
    public type_id $id;
}

#[http::component]
public struct Alpha
{
    public int32 $n;
}

int32 $n = 0;
foreach (attr::of<Tagged>("http::component") as const &$row) {
    if ($row->id == type_id<Alpha>()) {
        $n = 1;
    }
}
echo $n;                    // 1
```

Tagging a type when the field is a callable is a mistake: that attribute collects functions,
not types. So, what about constructing the value? Tag the constructor. The field is a callable
that returns it:

```echo
public struct Box
{
    public int32 $n;

    #[http::get]
    public constructor()
    {
        $this->n = 7;
    }
}

public struct Route
{
    public function<Box()> $call;
}

foreach (attr::of<Route>("http::get") as const &$row) {
    Box $b = $row->call();
    echo $b->n;             // 7
}
```

A static method is the same idea when the function is not a constructor.

## Payload

Every other field is filled from the value you wrote on the tag. The opening example's `$path`
comes from `"/users"`. A record fills fields by name:

```echo
public struct Route
{
    public string $path;
    public int32 $n;
    public function<int32()> $call;
}

#[http::get: { path: "/a", n: 10 }]
public function a() : int32
{
    return 1;
}

echo attr::of<Route>("http::get")[0]->n;     // 10
echo attr::of<Route>("http::get")[0]->path;  // /a
```

A list `[ "GET", "HEAD" ]` fills a `slice<E>` or a `E[N]`. A nested record fills a nested
struct. Extra keys and missing keys are compile errors, at the tagged declaration.

A collected list cannot fill an `array<T>`: that type owns a heap buffer. A collected record
cannot fill a `map<K, V>`.

## Unique keys

A second argument names a field that has to be unique across the table:

```echo
public struct Route
{
    public string $path;
    public function<int32()> $call;
}

#[http::get: "/users"]
public function listUsers() : int32
{
    return 1;
}

#[http::get: "/health"]
public function health() : int32
{
    return 2;
}

foreach (attr::of<Route>("http::get", "path") as const &$row) {
    echo $row->path;
}
```

Two handlers with the same path then refuse to compile. I would rather find that at compile
time than ship two routes to the same URL.

## Visibility

Public declarations in the whole program. Internal ones in the module that called `attr::of`.
Private never. A tagged private function is an error once something collects that name, so a
route does not vanish in silence.

Generics, methods with a receiver, tests, and compiler-generated members are out.

## Compile time

Collection is compile time. Using the table is runtime: `foreach`, `$row->call()`,
`$row->path`. The backing storage is a constant. There is no registration API and no heap
walk.

A library can call `attr::of`. The table still belongs to the program that compiled it, so two
apps with different routes still share one compiled library.

## Next

- [Attributes](/reference/attributes) for the value grammar and tool attributes
- [Slices](/collections/slices) for the window `attr::of` returns
- [Functions](/language/functions) for `function<R(P...)>` values
