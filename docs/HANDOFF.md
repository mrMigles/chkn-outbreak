# HANDOFF

_Last updated: 2026-10-02_

## State
Playable end-to-end, solo and 1–4 player co-op:

| Part | Status |
|---|---|
| Art | Kenney Top-down Shooter (CC0) + generated chickens/boss/weapons/props/FX (`npm run assets`) |
| Levels | `office` → `lab` (dark) → `factory` → `boss`, plus `arena` (weapon sandbox, «Полигон» in menu) |
| Combat | 7 weapons, 6 enemy types + chicks + boss, juicy FX, procedural audio, hit-stop (solo), crosshair/hitmarker |
| NPCs | coworkers that transform, rescues (cower → rescued), armed followers (Петрович, Омлетов, Михалыч), carry-over between levels |
| Lighting | darkness overlay, flashlight with wall shadows, lamps/emergency/alarm lights, muzzle/explosion lights |
| Multiplayer | Colyseus room with 4-letter code, ready/start, snapshots+events, own-shot prediction, revive, chicken PvPvE, antidote cures |
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
- Sim benchmark (Node): ~0.3 ms per 30 Hz step with 150 chickens + 4 machine-gunners; snapshot ≈ 5 KB.
- Server debug (only `--debug`): `room.send('debug', {cmd:'down'|'bleed'})` downs / bleeds out yourself.

## Known gaps / next steps
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
