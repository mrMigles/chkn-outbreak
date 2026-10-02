# TASKS

Status: `[x]` done · `[~]` in progress · `[ ]` todo. Work top-down, one task at a time.
After each task update this file, `docs/DECISIONS.md`, `docs/HANDOFF.md`.

## Phase 0 — Foundation
- [x] T01 Choose asset pack, fix the style (`docs/STYLE.md`, D1/D2)
- [x] T02 Asset pipeline `tools/build-assets.mjs` (walls autotiles, chickens, weapons, FX, props atlases)
- [x] T03 Project scaffold: Vite + TS + Phaser 3 client, Colyseus server, shared sim folder
- [x] T04 Architecture: shared sim (map, collision, entities, weapons, events), LocalSession

## Phase 1 — Combat loop (quality bar: shooting into a crowd is fun)
- [x] T05 Test arena map + player movement/aim (desktop + mobile twin-stick)
- [x] T06 7 weapons with distinct stats & handling
- [x] T07 Enemy AI (flow field + separation), 6 enemy types
- [x] T08 Combat juice: muzzle flash, light flash, tracers, sparks, hit flash, blood, feathers, casings,
         shake, recoil, decals, explosions, smoke, fire
- [x] T09 Procedural punchy audio per weapon
- [x] T10 HUD (HTML): HP, ammo, weapon bar, objective, combo
- [x] T11 Feel pass: play test, tune, screenshot review

## Phase 2 — Levels & story
- [x] T12 Map compiler (ASCII → Tiled .tmj) + loader (client + server)
- [x] T13 Level 1 Office: open space, meeting rooms, kitchen, server room, reception, security; NPCs, humour
- [x] T14 NPCs: rescue, escort, armed follower, dialog lines
- [x] T15 Lighting system (darkness, flashlight, muzzle/explosion lights, emergency lights)
- [x] T16 Level 2 Dark lab (blackouts, ambushes)
- [x] T17 Level 3 Industrial complex
- [x] T18 Boss arena + boss fight
- [x] T19 Menus (HTML/CSS): title, settings, level complete, game over

## Phase 3 — Multiplayer
- [x] T20 Colyseus room: create / code / join / ready / start
- [x] T21 Snapshot + event sync, interpolation, prediction
- [x] T22 Downed / revive
- [x] T23 Player chicken PvPvE (respawn, weapon, cure at level end)

## Phase 4 — Polish
- [~] T24 Mobile pass (performance, UI scale, auto-fire)
- [x] T25 Final QA, build, deploy notes (`npm run smoke`, `npm run build`, `npm start`)

## Backlog (next iterations)
- [ ] Real-device mobile pass (touch sticks feel, aim-assist strength, performance on mid phones)
- [ ] Network: delta-compressed enemy snapshots, client-side reconciliation for knockback
- [ ] More enemy variety per level (palette swaps: lab coats in the lab, overalls at the factory)
- [ ] Destructible office props (monitors, water cooler) + paper explosions
- [ ] Music (procedural or CC0), per-level ambience
- [ ] Difficulty selector & co-op scaling of waves by player count
- [ ] Achievements / end-of-run stats screen with funny titles («Лучший сотрудник месяца»)
