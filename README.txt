PIG BOSS BONANZA — THREE.JS PROTOTYPE v0.11

Run locally from this folder:
  python -m http.server 8080
Then open:
  http://localhost:8080

v0.11 — COMPLETE GAME LOOP
- New splash/start screen using supplied WIP CharacterArt + PressAnywhere assets.
- Press/click anywhere or Space to enter the base game.
- Base game retains v0.9 result evaluator and locked v0.8 reel motion.
- Tight 115ms reel settle/wobble retained.
- 3 scatters -> 10 Free Spins entry panel.
- 4 scatters -> 15 Free Spins entry panel.
- Feature uses revised PigBoss FA/FB/FC/FD 80-stop reel strips, selected 25% each per free spin.
- Free spins autoplay through the awarded 10/15 spins.
- Feature W collector uses visible W count as x1/x2/x3/x4 multiplier on visible gem values.
- Gems then transform to C for normal line evaluation, matching the revised script flow.
- No feature retriggers: revised feature strips contain no X1.
- Feature HUD shows spins remaining and accumulated feature win.
- Feature complete screen uses supplied Win_FreeSpins_Panel and displays total win.
- Click/Space returns to base game after feature complete.
- Result Inspector remains available for auditing.

WIP presentation assets are intentionally kept separate from game logic so they can be replaced later without changing the feature engine.

v0.12 — UI Cleanup / Diagnostic RTP / Anticipation Tell Fix
- Added supplied Settings and Autoplay button artwork.
- Spin button moved slightly lower; prototype version moved to unobtrusive top edge.
- Player status is GOOD LUCK! / SPINNING... / WINNER!!!; reel-set info remains diagnostic only.
- Diagnostic area now shows theoretical RTP 96.651%, live session RTP, paid spins, total staked and total returned.
- Scatter anticipation now activates only after two scatters have physically landed; all reels begin with identical normal timing.


v0.17 anticipation choreography:
- Sequential reel 3 then reel 4 anticipation.
- No anticipation speed-up: intercepted reels preserve current speed.
- Reel 4 is held in continuous motion while reel 3 teases.
- Reel 4 receives its own longer tease after reel 3 lands.


v0.19.1 hotfix: Spine presentation is fire-and-forget. Reel/gameplay completion is committed before Spine notification. Per-cell and runtime failures restore PNG fallback and cannot block the game loop.


v0.19.5 Spine hotfix: removed incompatible skeleton.setToSetupPose() calls from Spine 4.3 cell creation and win playback. No reel/math/anticipation/accountancy changes.


v0.19.5: Genuine line-win, collector, and scatter result cells are explicitly routed to Spine WIN. Added per-source routing diagnostics. Reel engine/maths unchanged.

v0.19.8
- Built from the preferred v0.19.6 baseline.
- Replaced game Background.png with the new supplied background.
- Replaced Spine symbol package with Symbols(4).zip.
- Added fx_anticipation as a presentation-only reel overlay tied to ANTICIPATING state.
- Preserved v0.19.6 win layering and 60% non-winner dimming; v0.19.7 foreground-win layering was NOT carried forward.


v0.20.0: Updated splash artwork/layout and Free Spins background from art update package. Gameplay/Spine/reel logic retained from v0.19.8.
