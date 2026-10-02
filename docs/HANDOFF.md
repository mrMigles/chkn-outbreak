# HANDOFF

_Last updated: 2026-10-02_

## Iteration 4 (2026-10-02, Claude) — hands, guide arrow, destructibles, Telegram, Docker, e2e

User report (9 items), decisions D34–D42 in [DECISIONS.md](DECISIONS.md):
- **Gun in the fists** (D35): the armed pose is LPC thrust frame 4 (frame 3 was the wind-up with the elbow back); the gun sits behind the body in side views so the fists close over the grip. `node tools/qa-gun.mjs` for close-ups.
- **Developer mode** (D38): `?dev=1` or 5 taps on the logo → any level, god mode, full arsenal; F6–F9 in solo.
- **Readable mutation** (D34): 3 s with a progress bar, warning, ring, toasts and feather bursts.
- **Objective arrow** (D37) instead of a minimap: path-following arrow at the feet + direction/distance in the objective panel.
- **Kitchen weapon** (D41): items on furniture are picked up from its edge; `check:levels` checks real pickup reach and that every door is walkable.
- **Destructible props** (D36): crates, plants, lamps, TVs, coolers, printers, vending machines; loot from crates/vending.
- **Telegram** (D39): `/play` in a chat or the Mini App → everyone from that chat lands in one room under their Telegram names.
- **Docker/compose/CI** (D40): `Dockerfile`, `docker-compose.yml`, `.github/workflows/docker.yml` (tests → GHCR).
- **E2E play** (D41, D42 + below): `tools/qa-campaign.mjs` (autopilot through the real UI), `tools/qa-mobile.mjs`, `tools/check-telegram-ui.mjs`.

Problems found by playing and fixed: the arrow cut corners into walls and could path through a wall next to a door; the office objective ping-ponged between the server room and the guard room; a dropped key card was not the objective; the «Синергия» TV closed a door; the lab rescue of Омлетов could stall forever (idle chickens nearby blocked it); the lab objective could go stale depending on event order; a tutorial card stayed on top of the game-over panel; on phones the tutorial/radio covered the player, the weapon panel covered the switch button and the toast filled the screen.

## Iteration 3 (2026-10-02, Claude) — combat feel and companions

User report (8 items), decisions D28–D33 in [DECISIONS.md](DECISIONS.md):
- **Headshots** (D28): hit boxes are the drawn bodies (`shared/sim/hitbox.ts`), the head is the top 30 % → ×2 damage, «В ГОЛОВУ!» pop. Mouse aim goes from the hand through the pointer.
- **Gun in both hands** (D29): LPC `thrust` pose for the upper body over walking legs (`a<dir>_<f>` frames), grip at the pose's hands.
- **Plumage** (D33): white / yellow / speckled chicken-people.
- **Companions** (D31): always follow (E never toggles them, doors/buttons next to them work), spread out; armed NPCs actually shoot now.
- **No spawns in view** (D32), **gentler office** (D30).

Checks run: `npm run build`, new `npm run check:combat` (7 PASS: headshot/body/miss, N/S heads, body behind shooter, NPC fire while following, companion spread + E, off-screen waves incl. fallback, office balance), `check:coop` (18 PASS), `check:levels` (5 PASS), `check:art`, `smoke` (5 levels, no page errors), browser auto-aim at heads in the arena (23 headshots in 10 s), `qa-play office` (p99 16.8 ms). Not run: `check:network` / `check:network-ui` (need the debug server), a human playthrough of the new office balance, a real phone.

Rough edges: armed-walk frames can show a 1-px leftover of the swinging hand at the hip in a few frames; facing north the gun is hidden behind the body.

## Iteration 2 (2026-10-02, Claude) — whole game in 2.5D

User report addressed (13 items); decisions D20–D27 in [DECISIONS.md](DECISIONS.md), sources in [ASSETS.md](ASSETS.md), screenshots in `docs/qa/v2/`.

- **Freezes fixed** (D20): WebGL RenderTexture stamping (decals) and the RT darkness overlay stalled the GPU 100–2000 ms. Decals are pooled sprites, darkness is a CPU-lit quad grid, hit-stop only on the boss kill, GPU warm-up at level start. Hardware WebGL (Intel UHD): office/lab p99 16.8 ms, no frame > 50 ms in 25–40 s auto-fights.
- **Characters** (D21–D23): runtime LPC compositor (`render/compose.ts`, `render/Looks.ts`, `shared/look.ts`); male/female/big bodies, story NPC presets (Галина is a woman), player customization in the menu, synced over the network (`look`). Mutants are chicken-people made from the same person (feathers, comb, beak, claws, tail, clothes kept); every enemy type uses the new art; boss is a winged rooster; chicks are LPC chickens. Corpses use the LPC collapse frames.
- **Gun in the hand** (D24), **2.5D on every level + rebuilt interiors** (D25), **adaptive CC0 music** (D26), **tutorial cards, smaller bubbles above heads, passability check** (D27).

Checks run this iteration: `npm run build`, `npm run check:coop` (18 PASS), `npm run check:network` (incl. new look sync PASS), `npm run check:art`, `npm run check:levels` (5 PASS after moving 2 spawners), `npm run smoke` (5 levels, no page errors), `node tools/qa-play.mjs <level>` hardware-WebGL auto-fights on office/lab/factory/boss/arena, `node tools/qa-menu.mjs` (editor at 1280×720 and 390×844).

Not verified: real phone, 4 humans over the internet, a full manual playthrough by a human (the level check is structural + scripted keys, the auto-fights are short). Known rough edges: side doors (vertical walls) are simple jambs; corpses of mutants read mostly as a white feathered head; light edges in dark levels are soft (24-unit grid); legacy Kenney art remains only in FX, pickup icons and flat floor details.

New tools: `tools/qa-play.mjs` (auto-fight + frame stats, `QA_PROF=1` for function timings), `tools/qa-trace.mjs` (Chrome trace of long frames), `tools/qa-probe.mjs` (frame cost of single actions), `tools/qa-menu.mjs`, `tools/check-levels.ts`, `tools/art/lpc-fetch.mjs`, `tools/art/look-preview.ts` (contact sheet of looks), `tools/art/peek.mjs` (grid view of a source sheet for picking crops).

## Next iteration — handoff to multiple agents

The agreed redesign is recorded in [PLAN-2.5D.md](PLAN-2.5D.md). Assign work using [TASKS-2.5D.md](TASKS-2.5D.md): packages, shared-file ownership, dependency graph and acceptance checks are included. Sources and adaptation requirements are in [ASSETS.md](ASSETS.md), and the unchanged [reference image](references/chkn-2.5d-reference.png) is stored in this repo.

First implementation is saved on local branch `codex/office-25d-coop`: public LPC office/actors, contextual support, human spectators/rally, staged NPC mutation with appearance/drop metadata, random companion betrayal and automatic client reconnection. Weapon/enemy combat data and movement speed are unchanged. P00/P06/P10/P16 are accepted; art/UI/network acceptance is partial. [QA report](qa/office-iteration.md) records evidence and remaining limits. P15's new wave controller and P17–P23 full campaign work remain pending.

Historical baseline exploration on 2026-10-02 found revive through walls and missing automatic client reconnect. Both now have implementation fixes; authority/SDK regressions pass. Current build, art, 18 authority scenarios, SDK clients, two browser app pages (keyboard revival + automatic reconnect), controlled office fight and five HUD sizes pass. Five-scene smoke has no browser errors. These checks do not establish full campaign completion, four-human internet play or hardware/mobile performance.

The original source is tracked at `d5e7ea8`; this iteration, including vendor/art/QA/reference files, is saved on `codex/office-25d-coop`. Start future worktrees from that branch, not just `d5e7ea8`. Check for newer local changes before dispatch: ordinary worktree creation does not copy uncommitted or untracked files. One Codex owned all packages in this iteration; no other agents or worktrees were created. No remote push was performed.

## State
Existing campaign structure is retained. New 2.5D campaign acceptance is incomplete:

| Part | Status |
|---|---|
| Art | All levels 2.5D: runtime LPC characters/mutants, LPC + Skorpio furniture, hand-made pixel guns/props, LPC floors; legacy only for FX/pickup icons/floor details (`npm run assets`) |
| Levels | `office` → `lab` (dark) → `factory` → `boss`, plus `arena` (weapon sandbox, «Полигон» in menu) |
| Combat | 7 weapons, 6 enemy types + chicks + boss, juicy FX, procedural audio, hit-stop (solo), crosshair/hitmarker |
| NPCs | 2.2 s authoritative mutation, clothes/name retained, safe mandatory key/weapon drops; rescued/armed followers may betray after helping; decision/timer carry between levels |
| Lighting | darkness overlay, flashlight with wall shadows, lamps/emergency/alarm lights, muzzle/explosion lights |
| Multiplayer | 4-letter code, readiness, prediction/snapshots/events; E tap shares ammo, hold heals/revives; players stay human, bleedout spectates until combat clear; automatic reconnect within 25 s server window |
| Mobile | twin sticks, auto-fire with aim assist, context button, compact HUD, landscape hint |

## Run
```bash
npm install
npm run dev        # client http://localhost:5280
npm run server     # multiplayer server ws://localhost:2580 (with QA debug messages)
```
Production: `npm run build` then `npm start` → server on :2580 also serves `dist/` (same origin websocket).

## QA tooling
- `?level=<id>` jumps into a level; `?loop=timeout` keeps ticking in hidden tabs.
- `window.__input = { fire, mx, my, aimX, aimY, slot, interact }` drives the local player.
- `npm run shot -- "<url>" out.png [waitMs] [js]` — headless Chromium **WebGL** screenshot (Playwright).
- `npm run bot -- <CODE> [name]` — headless co-op bot that joins a room and shoots chickens.
- `npm run smoke` — loads every level in headless WebGL, auto-fights, fails on any page error (needs `npm run dev`).
- `npm run check:coop` — 18 support/mutation/betrayal/death authority scenarios.
- `npm run check:network` — real SDK clients, debug server required; readiness, revive, rejoin, mutation late join, four-player cap, host transfer.
- `npm run check:network-ui` — two browser app menus, keyboard E revival and automatic reconnect; debug server required.
- `npm run check:art` — source/archives SHA256, atlas bounds and all directed walking/mutant frames.
- `npm run check:combat` — hit boxes/headshots, NPC fire, companion spacing, off-screen spawns, office balance.
- `npm run check:levels` — story-order flood fill of every map (goal, triggers, NPCs, pickups, spawners).
- `node tools/qa-play.mjs <level> <outPrefix> [secs] [gpu]` — auto-fight with frame-time stats and screenshots.
- `npm run check:office` — controlled fight and support HUD, screenshots at five sizes; not a natural room playthrough.
- Browser checks use `SMOKE_URL` (default :5280); SDK checks use `TEST_SERVER` (default ws://localhost:2580). During this iteration a separate preview was started at :5281; normal startup remains :5280.
- Sim benchmark (Node): ~0.3 ms per 30 Hz step with 150 chickens + 4 machine-gunners; snapshot ≈ 5 KB.
- Server debug (only `--debug`): `room.send('debug', {cmd:'down'|'bleed'})` downs / bleeds out yourself.

## Known gaps / next steps
- Finish P01–P05: doors/weapons/character silhouettes, feet vs. physical footprint, high furniture parts, projectile/flashlight alignment. Accept P09 before spreading the art to the campaign.
- P15: formal three-wave arenas, cap/queue of 120, intermissions and wave HUD. Current script waves remain unchanged; human rally uses the existing combat-clear transition.
- P13/P14: final reconnect deadline/cancellation and level-boundary browser tests, artificial 100–200 ms latency. SDK tests are not a substitute for these.
- P17–P23: complete public art, campaign arenas, boss, real phone, hardware performance and full solo/co-op playthrough. Prototype office currently mixes old weapon/FX/props with new sprites.
- T24: real-device mobile tuning (stick dead zones, aim-assist cone 0.32 rad, perf on low-end GPUs).
- Snapshot size grows with enemy count (~4 KB @150 chickens, 20 Hz). Delta compression is a backlog item.
- Remote players are smoothed, not interpolated on a timeline; knockback on own player is client-side only.
- Level balance was tuned with bots, not humans — expect to adjust wave sizes / HP.

## Gotchas
- Never set `render.maxLights: 0` (Light2D shader compile error).
- Don't `resize()` RenderTextures in WebGL (see D14) — recreate them.
- In-app browser pane: rAF pauses when hidden; WebGL can die after many HMR reloads (HMR now forces a reload).
- Map object coords: Tiled rect `x,y` = top-left, `cx,cy` = centre (GameMap). Props carry a `rot` property.
- Port 2567 may be taken by another local Colyseus app — this project uses 2580.
