# Pig Boss Bonanza v0.21.2 — synchronous reel artwork

Moving reel slots now use persistent canvases painted from decoded, retained
images. Symbol changes no longer replace an HTML image source during a spin.
This removes asynchronous image replacement from the moving-to-landing path.
Cached cash/W starting poses and the first-render handoff from v0.21.1 remain.
Original assets, win effects, payout rules and reel timing are preserved.

20 automated tests pass, including sprite replacement, caching, missing-art
fallback, landing lifecycle, anticipation and 20,000 payout parity samples.
Browser checks included complete spins and a deterministic side-by-side replay
against v0.20.7. These checks do not establish that every intermittent visual
artifact on the user's display has been eliminated.

## Previous change: v0.21.1

The user reported that v0.21.1 did not resolve the visible glitch. Its pixel
comparison below checks the handoff pose only, not the whole spin sequence.
This patch addresses the visible PNG-to-Spine change at reel landing reported
after v0.21.0. Win effects and authored animation data have not been changed.

- New Spine cells hold their exact authored time-zero pose until their first
  completed render. The PNG hides only after that render, then animation advances.
- Cash and W get cached sharp reel sprites rasterized from that same starting
  pose during asset preparation. The supplied regular-symbol PNGs already match
  their initial Spine pose and remain in use. Original source assets are intact.
- Asset readiness and the selected sharp artwork are fixed for the duration of
  each spin, so late loading cannot change appearance halfway through a spin.
- Win/collector dispatch waits for the last reel's first landing frame rather
  than replacing its pose before it has appeared.

The browser rendering test at `/tests/landing-visual.html` compares all 18 symbols
at their native 165×145 size. All 18 first-frame comparisons have zero pixel
difference, including a 50 ms delay before the first render. Authored landing
animation continues after handoff. Results are in `landing-pixel-results.json`.

The checks below now include 18 automated tests. v0.21.0 and the original reference
remain preserved in their separate folders and ZIPs.

## Earlier reference cleanup

This is a separate update of the supplied v0.20.7 prototype. The supplied ZIP and
extracted reference are unchanged. Pig Boss art, reel strips, paytable, feature
rules, normal-spin durations, and travel distances are retained.

## Play locally

With Node.js installed, open a terminal in this folder and run:

```text
npm start
```

Open http://127.0.0.1:8080 in a browser. Internet access is still needed for the
same pinned Three.js 0.180.0 and Spine 4.3.13 imports used by the reference.
Alternatively, serve this folder using an existing local web server.
Opening index.html directly as a file is not supported.

Space/click enters the game. Spin and Space use the same guarded spin action.
Autoplay stops after its current spin and stops when entering a feature.
Settings now opens music volume and mute controls.

The developer inspector and forced feature button are available at
http://127.0.0.1:8080/?debug=1. Add `&seed=123` for a repeatable development run.
Forced features and their free spins are excluded from balance and session RTP.
Reloading starts a new in-memory session; this prototype does not persist credit.

## What changed

- Results are selected and evaluated before animation. A dedicated state and
  account controller settles each result exactly once in integer minor units.
- Free-spin awards are now credited as each spin resolves, rather than waiting
  for dismissal of the feature-complete panel. The displayed result is revealed
  after presentation. No payout amounts or feature probabilities changed.
- Spin input stays locked during the entire 900 ms feature-entry transition.
- Audio fades have independent track tokens. Volume and mute apply during fades.
- A missing or invalid optional Spine skeleton no longer disables all symbols.
  A missing atlas retains the PNG presentation. A missing cash backing keeps the
  complete cash PNG rather than an incomplete foreground animation.
- PNGs are hidden only after the matching visible Spine mesh has rendered.
  Stale hide requests are cleared. The old 35 ms opacity fade was removed to
  prevent overlapping PNG/Spine poses when symbols land.
- Anticipation lands using the correct index in its temporary presentation strip.
  The final approach joins the incoming velocity continuously and remains forward.
- Debug controls are separate from the player-facing Settings button.
- Account text scales with the portrait game width to avoid overlap in short windows.

## Structure

| File | Responsibility |
| --- | --- |
| engine/config.js | Pig Boss symbols, paytable, paylines, layout, motion settings |
| engine/rules.js | Pure result selection and payout evaluation |
| engine/game-engine.js | Spin lifecycle, input gates, integer account ledger |
| engine/random.js | Repeatable development RNG |
| presentation/reels.js | Reference reel choreography |
| presentation/motion.js | Testable anticipation coordinates and easing |
| presentation/spine.js | Landed symbols, effects, collection, fallback lifecycle |
| presentation/load-skeletons.js | Independent optional asset loading |
| presentation/audio.js | Music, fades, volume and mute |
| game.js | Browser scene, UI, and result-presentation coordination |

This remains a 4×4 Pig Boss reference, not a fully generic grid engine. Paylines,
scatter anticipation, CSS proportions, and several diagnostics still express that
layout. The new game's script should drive further generalization.

## Verification

```text
npm test
npm run simulate -- 1000000 20260929
```

Tests cover reference payout parity, deterministic replay, feature transition
locking, duplicate completions, debug account exclusion, ordinary feature credit,
insufficient funds, crossfades, partial asset failure, and actual reel landing
windows with a simulated animation clock.

`tests/reference-v0207.mjs` is a frozen extraction of the supplied payout evaluator
for comparison. It is not used by the playable game.

The included million-paid-spin simulation observed 96.91275% RTP, with an
approximate 95% interval of 95.50153%–98.32397%. The sample includes completed
triggered features. This is a Monte Carlo estimate, not proof of theoretical RTP.
The supplied 96.651% value remains clearly labelled as an unverified declaration.

## Scope

The RNG remains a browser prototype RNG in normal play; seeded RNG is only for
development. Accounts live in memory. Shared-library download failure and lack of
WebGL can still prevent startup. No backend, persistence, production deployment,
or formal maths certification is included in this update.
