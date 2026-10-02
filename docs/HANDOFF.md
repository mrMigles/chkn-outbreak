# HANDOFF

_Last updated: 2026-10-02_

## Next iteration — handoff to multiple agents

The agreed redesign is recorded in [PLAN-2.5D.md](PLAN-2.5D.md). Assign work using [TASKS-2.5D.md](TASKS-2.5D.md): packages, shared-file ownership, dependency graph and acceptance checks are included. Sources and adaptation requirements are in [ASSETS.md](ASSETS.md), and the unchanged [reference image](references/chkn-2.5d-reference.png) is stored in this repo.

First implementation is saved on local branch `codex/office-25d-coop`: public LPC office/actors, contextual support, human spectators/rally, staged NPC mutation with appearance/drop metadata, random companion betrayal and automatic client reconnection. Weapon/enemy combat data and movement speed are unchanged. P00/P06/P10/P16 are accepted; art/UI/network acceptance is partial. [QA report](qa/office-iteration.md) records evidence and remaining limits. P15's new wave controller and P17–P23 full campaign work remain pending.

Historical baseline exploration on 2026-10-02 found revive through walls and missing automatic client reconnect. Both now have implementation fixes; authority/SDK regressions pass. Current build, art, 18 authority scenarios, SDK clients, two browser app pages (keyboard revival + automatic reconnect), controlled office fight and five HUD sizes pass. Five-scene smoke has no browser errors. These checks do not establish full campaign completion, four-human internet play or hardware/mobile performance.

The original source is tracked at `d5e7ea8`; this iteration, including vendor/art/QA/reference files, is saved on `codex/office-25d-coop`. Start future worktrees from that branch, not just `d5e7ea8`. Check for newer local changes before dispatch: ordinary worktree creation does not copy uncommitted or untracked files. One Codex owned all packages in this iteration; no other agents or worktrees were created. No remote push was performed.

## State
Existing campaign structure is retained. New 2.5D campaign acceptance is incomplete:

| Part | Status |
|---|---|
| Art | Office: selected public LPC layers/furniture/floors + adapted bird heads; all other scenes and some office weapons/props/FX retain legacy art (`npm run assets`) |
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
