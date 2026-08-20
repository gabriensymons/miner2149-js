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
