# Time

You want to wait a bit, or you want to know how long something took, or you want the wall clock as
seconds since 1970. That is the whole of `std::time`. Two clocks and a length. There is no calendar,
no timezone, and no `strftime`. Those are a later layer, and pretending a Unix number is a date is
how you keep a bad format forever.

```echo
use std::time;

time::instant $start = time::instant::now();
time::sleep(.millis(1));
echo $start->elapsed() >= time::duration::zero();        // 1
```

`instant` is the monotonic clock. Subtract two of them and you get a `duration`. `timestamp` is the
wall clock, a signed duration since 1970-01-01T00:00:00Z. Use the first one to measure. Use the
second one to talk to the rest of the world.

## Durations are a length, not a moment

A `duration` is how long something is. Factories, not suffixes: there is no `5s` or `250ms`. The
leading-dot shorthand fills the type in from the destination, which is why `sleep(.millis(50))`
reads as a sentence.

```echo
use std::time;

time::duration $d = time::duration::millis(1500);
echo $d->as_secs();          // 1
echo $d->subsec_nanos();     // 500000000
echo $d->as_millis();        // 1500

std::time::sleep(.millis(1));
```

`secs`, `millis`, `micros`, `nanos`, `mins`, `hours`, and `zero`. All take `int64`. Arithmetic and
comparison are ordinary operators, operands by value (16 bytes, trivially copyable):

```echo
use std::time;

time::duration $a = time::duration::secs(2);
time::duration $b = time::duration::millis(500);

echo ($a + $b)->as_millis();     // 2500
echo ($a - $b)->as_millis();     // 1500
echo ($b * 4)->as_millis();      // 2000
echo ($a / 2)->as_millis();      // 1000
echo $a > $b;                    // 1
```

`*` and `/` on the right are `int64`. Division truncates toward zero in whole nanoseconds. Both are
only meaningful within about plus or minus 292 years, the same bound as `as_nanos()`. Past that the
nanosecond count wraps, because it is an `int64`.

## Negative durations floor, they do not truncate toward zero

Here is the catch, and it is the whole representation paying off. A duration is two words, matching
C's `timespec`: `$secs` and `$nanos`. `$nanos` is always in `[0, 999999999]`. `$secs` carries the
sign. `-1.5s` is stored as `{secs: -2, nanos: 500000000}`, never as a negative nanosecond field.

So the accessors that look like they just read a field are floor-correct for negatives, and
`as_float_secs()` / `abs()` are the ones you reach for when you wanted the signed magnitude:

```echo
use std::time;

time::duration $d = time::duration::millis(-1500);
echo $d->as_secs();              // -2, not -1
echo $d->subsec_nanos();         // 500000000
echo $d->as_millis();            // -1500
echo $d->as_float_secs();        // -1.500000
echo $d->abs()->as_millis();     // 1500
echo $d->is_negative();          // 1
```

`as_secs()` of `-1.5s` is `-2` because that is what floor means, and because it is also what
`timespec` means. I would rather that be surprising once, in this paragraph, than have comparison
grow a sign arm and `nanosleep` grow a conversion.

The constructor normalises. `duration(0, 1500000000)` is 1 second and 500000000 nanoseconds.
`duration(1, -1500000000)` is `-1s` plus 500000000 ns. Writing it also deletes the implicit
memberwise constructor, and `$secs` / `$nanos` are `internal const`, so nothing outside the type can
skip the invariant by writing the fields.

## `"{$d}"` is Go-style

`str::from(duration)` is spec-less on purpose. `"{$d:>8}"` fails by name. What you get is the same
shape Go prints:

```echo
use std::time;

time::duration $z = time::duration::zero();
echo "{$z}";             // 0s

time::duration $ns = time::duration::nanos(100);
echo "{$ns}";            // 100ns

time::duration $us = time::duration::nanos(1500);
echo "{$us}";            // 1.5us

time::duration $ms = time::duration::millis(250);
echo "{$ms}";            // 250ms

time::duration $s = time::duration::secs(1) + time::duration::millis(500);
echo "{$s}";             // 1.5s

time::duration $m = time::duration::mins(1) + time::duration::secs(30);
echo "{$m}";             // 1m30s

time::duration $h = time::duration::hours(1) + time::duration::mins(2) + time::duration::secs(3) + time::duration::millis(500);
echo "{$h}";             // 1h2m3.5s

time::duration $h0 = time::duration::hours(1) + time::duration::secs(3);
echo "{$h0}";            // 1h0m3s

time::duration $neg = time::duration::millis(-1500);
echo "{$neg}";           // -1.5s

time::duration $long = time::duration::hours(26);
echo "{$long}";          // 26h0m0s
```

Zero is `0s`. Below one second, one unit with a nonzero integer part (`100ns`, `1.5us`, `250ms`).
From one second up, `[{h}h][{m}m]{s}[.{frac}]s`: hours unbounded, minutes printed whenever hours
print or the minutes are nonzero, seconds always. Trailing zeros on the fraction are stripped.

There is no `str::from(instant)` and no `str::from(timestamp)`. An instant's origin is opaque. A
timestamp's human form is a calendar, which this module does not have.

## Measuring: `instant`, not `timestamp`

`instant::now()` is the monotonic clock. It never steps. NTP may slew it. Subtract two, or ask
`elapsed()`, and you have a duration:

```echo
use std::time;

time::instant $t1 = time::instant::now();
time::instant $t2 = time::instant::now();
echo $t2 >= $t1;                                 // 1
echo ($t2 - $t1) >= time::duration::zero();      // 1
echo $t1->elapsed() >= time::duration::zero();   // 1
```

You can add a duration to an instant, or subtract one. Comparison is the duration's comparison of
the raw values.

Do not benchmark against `timestamp`. The wall clock jumps when the user sets it, when NTP steps
it, when a VM is restored. The number will look like a duration and be a lie. `instant` is the one
that only goes forward.

## The wall clock is a Unix number

`timestamp` is a signed duration since 1970-01-01T00:00:00Z. `now()` reads the realtime clock.
`from_unix_secs` / `from_unix_millis` build one. `unix_secs` / `unix_millis` / `unix_nanos` read it
back. `unix_secs` floors, so a time before 1970 rounds down.

```echo
use std::time;

time::timestamp $epoch = time::timestamp::from_unix_secs(0);
echo $epoch->unix_secs();            // 0
echo $epoch->unix_millis();          // 0

time::timestamp $t = time::timestamp::from_unix_millis(1700000000500);
echo $t->unix_secs();                // 1700000000
echo $t->unix_millis();              // 1700000000500
echo ($t + time::duration::secs(1)) - $t == time::duration::secs(1);    // 1
```

`unix_nanos()` wraps in 2262. Same `int64` nanosecond bound as `as_nanos()`. If you are storing a
deadline that far out, store seconds.

`timestamp::now()` is "what time is it". It is not "how long did this take".

## Sleeping

`std::time::sleep` takes a duration. A non-positive duration returns immediately; a negative sleep
is a no-op, matching Rust and Go. `std::thread::sleep($ms)` is the same call, in milliseconds, kept
because it was already public.

```echo
use std::time;

time::sleep(.millis(1));
std::thread::sleep(1);
```

EINTR is handled inside the call. You do not bind errno, you do not retry. A long sleep is not
chopped into 500 ms pieces; that was `usleep`'s portability limit, and `usleep` is gone.

## Platform notes

Unix is `clock_gettime` and `nanosleep`. `CLOCK_MONOTONIC` rather than `_RAW`: slew-corrected,
never steps. Darwin's monotonic id is 6, Linux's is 1.

Windows is `QueryPerformanceCounter` for the monotonic clock, `GetSystemTimePreciseAsFileTime` for
the wall clock, and `Sleep` for waiting. The rest of the module still calls `c_clock_gettime` and
`c_nanosleep`; the shims keep those names so a clock read has no `#[if:]` in it. Windows rounds a
sleep up to the next millisecond and chunks at the `uint32` boundary, so a short sleep is never
shorter than you asked.

None of this needs a platform conditional in your code.
