/**
 * The power-plant overload as the source plays it: `Pexplode()`, source lines
 * 172-197, as a timeline the scene reads by elapsed time.
 *
 * The original is a blocking loop of bitmaps and `sleep()` calls. The port's
 * scenes are ticker-driven, so every `sleep()` here becomes a span of elapsed
 * milliseconds, and the scene asks what is on screen at a given moment rather
 * than being walked through it.
 *
 * In the source the damage is rolled before this plays -- `Blast(13,1)` runs,
 * then `Pexplode()`, then the alert -- so nothing here decides an outcome. It is
 * presentation in the original's own timings.
 *
 *   text(80,40,"\"Red line on four!\"");
 *   rect(1,100,55,101,130,0);
 *   for(a=1;a<10;a=a+1){
 *     bitmap(95,135,<pulse A>);
 *     if (a==5) text(80,40,"\"It's going to blow!\"");
 *     sleep(300);
 *     bitmap(95,135,<pulse B>);
 *     sleep(300);
 *   }
 *   bitmap(94,133,<blast 1>); sleep(400);
 *   bitmap(93,131,<blast 2>); sleep(400);
 *   bitmap(92,129,<blast 3>); sleep(400);
 *   bitmap(91,127,<blast 4>); sleep(600);
 */

export const CAPTIONS = Object.freeze({
  // SRCMSG at source line 179, and the one that replaces it at line 183. The
  // quotation marks are the source's own, escaped in its strings.
  redLine: '"Red line on four!"',
  goingToBlow: '"It\'s going to blow!"',
});

// Each pulse is two bitmaps, 300 ms apiece; the loop runs a = 1..9.
export const PULSE_FRAME_MS = 300;
export const PULSES = 9;
// `if (a==5)`: the caption changes as the fifth pulse's first bitmap is drawn.
const CAPTION_CHANGE_PULSE = 5;
const PULSES_MS = PULSES * 2 * PULSE_FRAME_MS;

// The four blast bitmaps and how long each is held before the next.
export const BLAST_FRAME_MS = Object.freeze([400, 400, 400, 600]);
export const DURATION_MS = PULSES_MS + BLAST_FRAME_MS.reduce((sum, ms) => sum + ms, 0);

/**
 * What the scene shows `elapsed` milliseconds in.
 *
 * `pulse` is which of the two pulse bitmaps was drawn last, 'a' or 'b'. It
 * stays set through the blast: the source never erases it, the blast is drawn
 * over it. `blastFrames` is how many blast bitmaps have been drawn, 0-4, and
 * they accumulate for the same reason -- each is drawn over the last without
 * clearing it. `complete` is true once the last one's 600 ms have passed.
 */
export function overloadFrameAt(elapsed) {
  const time = Math.max(0, elapsed);
  const frameIndex = Math.min(Math.floor(time / PULSE_FRAME_MS), PULSES * 2 - 1);
  const pulseNumber = Math.floor(frameIndex / 2) + 1;
  const pulse = frameIndex % 2 === 0 ? 'a' : 'b';
  const caption = pulseNumber >= CAPTION_CHANGE_PULSE ? CAPTIONS.goingToBlow : CAPTIONS.redLine;

  let blastFrames = 0;
  if (time >= PULSES_MS) {
    let start = PULSES_MS;
    for (const held of BLAST_FRAME_MS) {
      if (time < start) break;
      blastFrames += 1;
      start += held;
    }
  }

  return { pulse, caption, blastFrames, complete: time >= DURATION_MS };
}
