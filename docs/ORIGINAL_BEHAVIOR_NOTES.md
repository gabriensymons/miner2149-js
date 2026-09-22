# Original Behavior Compatibility Notes

Miner2149 JS uses Michael Baker’s Palm OS release as a behavioral reference for this personal browser reimplementation. These notes record compatibility decisions that are easy to lose when translating Pocket C behavior into JavaScript. They describe observable behavior and independently authored tests; they are not a copy of the original implementation or embedded assets.

## Random numbers

Pocket C’s `random(n)` uses a half-open range: zero through `n - 1`. Source-derived gameplay now uses a separately named exclusive helper. The older inclusive `randomNum(min, max)` remains available only for existing browser-port behavior that has not been mapped to a source `random(n)` call.

Ordinary colony events are evaluated once for every positive Advance action, including during the mother-ship period. Their state changes happen before the core colony update. Advancing seven or fourteen days still performs one event roll, not one roll per simulated day.

## Disaster trigger

The original disaster condition has malformed parentheses. Its surrounding code and intended denominator indicate a normal probability of:

```text
1 / [20 × (6 - asteroid difficulty)]
```

The browser port adopts that intended behavior after day 21 and then chooses uniformly among the seven disasters. This is an explicit port decision rather than a claim that the malformed expression executed that way.

The Palm Page Down hard-button path is treated as historical playtesting infrastructure. It is not a player-facing production shortcut. Deterministic forcing belongs in pure tests and the planned production-excluded developer console.

## Integer conversion and report safety

Pocket C integer destinations are modeled with truncation toward zero. This matters when intermediate values can be negative; JavaScript `Math.floor()` is not an equivalent conversion in those cases.

Report calculations return raw values, display strings, and alert flags as complete view models. The browser adapter does not retain prior alert state. Where the original would divide by an unavailable capacity, the port deliberately displays a safe unavailable or zero-capacity value instead of exposing `NaN` or `Infinity`.

The source’s `< 21` power condition is preserved: days before 21 receive mother-ship power support, while day 21 uses colony generation.

The market keeps a floating selling-price accumulator across turns and truncates only when assigning the displayed integer price. Legacy local saves seed that accumulator from their stored displayed price.

## Turn and ending order

A positive Advance follows this gameplay order:

1. select and apply an ordinary random event;
2. update colony simulation values;
3. evaluate and resolve a disaster;
4. evaluate mission endings.

Animated meteor defense occupies the disaster stage and must finish before ending evaluation resumes. Earlier queued messages are shown before the meteor scene.

Ending precedence is worker revolt, then insolvency or credit extension, then completion of the two-year term. Worker revolt uses an exclusive eleven-value roll. Terminal cleanup runs once and clears only the active autosave; manual save slots are retained.

At day 730, the final score is current credits plus remaining processed diridium multiplied by its selling price. Eligible normal asteroid sessions can update a local best score that records the run’s difficulty. Developer or sandbox sessions remain unranked.

## Meteor-defense compatibility decisions

Meteor storms preserve sequential arrivals, source-derived spawn and movement ranges, seven-unit laser power cost, cooldown-gated held-pointer fire, efficiency consequences, and surface-only damage.

The source’s `missed - 1` surface-damage-attempt quirk is intentionally preserved and tested. Repeated random selections may target the same cell. Valid JavaScript surface cells use indices zero through 99 rather than reproducing ambiguous legacy array indexing.

The scene uses independently authored monochrome PixiJS primitives. No original bitmap or audio payload was copied into the implementation.

## Verification approach

Pure simulation, random-event, disaster, meteor, ending, and report modules are exercised with Node’s built-in test runner. PixiJS remains a thin rendering/input adapter and is covered separately with fake-renderer unit tests and browser smoke tests. This keeps behavioral parity tests deterministic and avoids exposing mutable game state as a browser global.

## Mother-ship grace period, extended to two random events (port divergence)

The source gates disasters on `day <= 21` and takes a simplified morale path
while `day < 21`, both because the mother ship supports the colony for its first
21 days. Random events carried no such gate: `selectRandomEvent` draws
`random(700)` on every advance from day 0.

That let two events reach past a shield the game explicitly promises the player.
The electromagnetic time shift advances the day counter by 5 to 95 days without
running those days, so a day-1 roll can consume the entire supported period with
no counterplay; the walkout removes a percentage of the twenty mother-ship
workers before the player has any way to recruit more.

Both effects are now suppressed while `day <= 21`, matching the disaster gate.

Two details of the implementation matter:

- **The effect is gated, not the draw.** `selectRandomEvent` still consumes
  `random(700)` and `random(90)+5` exactly as before, so the random sequence is
  unchanged and a future recorded trace against the original still lines up.
- **Only the harmful pair is gated.** Of the seven events the alien artifact and
  the processor boost are no-ops this early — they set morale and efficiency to
  100, where both already start — while the geologic survey and the rich vein
  are useful and the engineer is a choice. Suppressing all seven would remove
  the opening's only good luck to prevent harm caused by two of them.

**Verified against the original.** `Miner30Source.txt:2498-2557` draws
`b=random(700)` immediately after the construction loop and tests `b` against 0
through 6 with no reference to `mday` in any branch, so v3.0 fires every random
event from day 0. The guards the source does carry are on other state --
`(b==2)&&(eff<100)`, `(b==5)&&(credits>30000)&&(meff<100)` -- and the port
reproduces those. The day gate is the port's own, and deliberate.

## Sell-dialog quantity ladder (confirmed against the v3.0 source)

The Select Quantity arrows move by three size bands, applied as **sequential
`if`s rather than a chain**. `Sell()` in `Miner30Source.txt` writes them exactly
this way:

```c
if (a>=10000) a=a+10000;
if ((a<=10000)&&(a>1000)) a=a+1000;
if (a<=1000) a=a+100;
```

```c
if (a>=20000) a=a-10000;
if ((a<=20000)&&(a>1000)) a=a-1000;
if (a<=1000) a=a-100;
```

The consequence is asymmetric and is **original behaviour, not a port defect**.
Increasing never cascades, because each band clears the next band's ceiling.
Decreasing does: for any amount from **20,000 through 30,000 inclusive**, the
first band subtracts 10,000 and the remainder still satisfies the second band,
which takes another 1,000 — so one press drops **11,000**, not 10,000. Above
30,000 the remainder clears the ceiling and the step returns to 10,000, which
produces a visible discontinuity: 30,001 steps down to 20,001, and the next
press drops to 9,001.

Rewriting these as `else if` would restore a uniform step across a 10,001-wide
range and silently break parity. `scripts/economy-rules.js` preserves the
sequential form and `test/economy-rules.test.js` pins both edges.

The port's ceiling is computed the same way by a different route. The original
resolves one ceiling `c` when the dialog opens — the whole store, or 700 when
there is no space port — and clamps against it. The port clamps against the
store and then applies the 700 rule separately. The results agree, including
when the colony holds fewer than 700 tons.

## Wage arrows (port-only affordance, with one preserved defect)

The original has **no arming condition on the wage arrows, and no press state to
hold one**. `Pentime()` polls the pen position; a hit inside the arrow's
rectangle flashes and acts in a single step, clamping afterwards:

```c
wage=wage+50; if (wage>90000) wage=90000;
wage=wage-50; if (wage<0) wage=0;
```

The port's two-stage buttons are therefore its own addition, with no original to
be faithful to. In `buildSpriteButton`, the pointer-down callback's return value
decides both whether the control swaps to its pressed sprite and whether the
release runs the action at all, so each arrow's gate has to agree with the bound
its action enforces.

Its upper arrow arms on `wage < wageMax`, which is what that affordance is for.
**Its lower arrow arms on `wage <= wageMax`, which is almost always true and is
preserved here as a known defect**: the arrow shows its pressed state at a wage
of 0 and then declines to act, because the floor is guarded separately in
`lowerWage()`. `canLowerWage` in `economy-rules.js` pins the current behaviour
rather than the intended one, so fixing it is a deliberate edit to a failing test
rather than a silent change.

The port also rejects a press at the maximum where the original accepts it and
clamps. These agree for every reachable wage: the colony starts at 400 and moves
in steps of 50, and 90,000 is an exact multiple of that walk.
