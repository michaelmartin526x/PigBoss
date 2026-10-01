# Verification — v0.21.2, 30 September 2026

20 automated tests pass. Actual browser: 24 canvas reel slots, complete spins, 16 active landed Spine cells, no captured warnings/errors. Side-by-side original/candidate replay inspected at 1066.67 ms, 1083.33 ms and 1833.33 ms. This does not prove elimination of every intermittent display glitch.

## Historical v0.21.1 checks (insufficient to establish the reported bug was fixed)

# Verification — v0.21.1, 30 September 2026

## Landing correction

- All 18 animated symbols match their sharp reel sprite exactly at the first
  rendered frame in the real Three.js/Spine browser comparison (165×145 pixels).
- The comparison includes a 50 ms update before the first render to reproduce
  the previous skipped-pose problem. The corrected controller holds time zero.
- Subsequent updates advance all 17 symbols with changing land/background poses;
  W's authored land pose is static. Landing animation has not been disabled.
- Five additional lifecycle tests cover delayed rendering, waiting before win
  dispatch, stale hide removal, late loading, and missing matching-pose fallback.
- Normal reel motion, original art/Spine files, maths and win effects are unchanged
  from v0.21.0. Cash/W sharp movement images are derived once at runtime.

## Reference cleanup checks retained from v0.21.0

- 13 automated tests pass, including 20,000 sampled comparisons against the
  original payout evaluator across base and feature results.
- Syntax checks pass for all JavaScript modules and test/tool scripts.
- SHA-256 comparisons confirm every supplied art/audio/Spine asset and reels.json
  is byte-for-byte unchanged in the updated build.
- A seeded simulation of 1,000,000 paid spins and 76,200 resulting free spins
  observed 96.91275% RTP. See simulation-20260929.json for sampling uncertainty.
- Browser checks: start screen, paid spins, 18 registered Spine symbols, forced
  four-scatter anticipation, full 15-free-spin run, cash collection/return, feature
  completion and return to base, settings and mute controls.
- The forced feature completed with a displayed 181.50 award and preserved the
  pre-feature 999.00 balance and one-paid-spin session totals, as intended.
- After the landing handoff correction, browser inspection confirmed 24 recycled
  PNG images, 16 hidden behind the 16 active landed Spine symbols, and zero-second
  opacity transitions. No warning/error logs were captured in these browser checks.

The original 35 ms PNG opacity fade overlapped the landed Spine pose. Removing it
eliminates that overlap; brief visual artifacts reported by a player can still
require further observation on their particular browser/display. This is not a
frame-by-frame GPU/performance certification or a proof of theoretical RTP.

The supplied v0.20.7 reference is preserved. The updated game retains the same
external pinned library imports; offline and failed-CDN startup are not covered.
