# Decisions log

Each entry: what was decided, why, and consequences. Newest at the bottom.

## D1 — Visual base: Kenney "Top-down Shooter" (CC0)
- Source: https://kenney.nl/assets/top-down-shooter (CC0, vendored in `vendor/kenney-topdown-shooter`).
- Why: true 90° top-down (works with 360° aiming, unlike 3/4 RPG packs), one consistent style,
  covers floors (wood / tile / concrete / asphalt), wall rims in 3 colour themes, furniture,
  kitchen, crates/barrels, plants and armed human characters. CC0 = no licence risk.
- Style is flat colours + darker same-hue outline + soft round shadow ("Kenney flat"), not strict pixel art.
- Everything missing (chicken-people, boss, weapons, server racks, lab gear, machines, FX) is generated
  by `tools/art/*.mjs` in the same palette/outline rules — see `docs/STYLE.md`.
- No other asset packs may be mixed in.

## D2 — Walls are generated autotiles, not Kenney wall tiles
- Kenney's thick-wall tiles are a hand-assembled set that is hard to autotile. We regenerate the exact
  look (dark top `#4a4a4a` + 2px dark rim + 8px colour rim + 5px bevel) as a 47-tile blob autotile per theme
  (`office` = wood rim, `lab` = blue-grey rim, `industrial` = orange rim). Visual parity with the pack.

## D3 — Maps: Tiled JSON (.tmj) generated from readable level sources
- No Tiled GUI in the dev loop, so levels are authored as ASCII layouts + object lists in `tools/levels/*`
  and compiled by `tools/build-maps.ts` into real Tiled maps (`public/assets/maps/*.tmj`).
  The output opens and edits in Tiled; tile layers = floor/decor/walls, object layers = props, spawns, triggers.
- Props are Tiled objects with `type` = prop frame name (rendered from the `props` atlas).

## D4 — One shared simulation for solo and multiplayer
- `src/shared/sim` is a pure-TS, Phaser-free game simulation (players, enemies, NPCs, weapons, damage,
  pickups, objectives, scripted events). It emits events (`shot`, `hit`, `kill`, `explode`, `say`…).
- Solo: runs inside the browser (`LocalSession`) → playable offline, no server needed.
- Multiplayer: the same sim runs inside a Colyseus room (server authoritative for HP, damage, ammo,
  enemies, objectives, pickups, death). Client only renders + plays FX from events.

## D5 — Colyseus 0.16 (not 0.18)
- 0.16 API is stable and well known (`@colyseus/core`, `@colyseus/ws-transport`, `@colyseus/schema@3`,
  `colyseus.js@0.16`). Room schema holds lobby/meta state; high-frequency world state is sent as compact
  snapshot messages at 20 Hz, events batched per tick. Room id = 4-letter join code.

## D6 — Movement is client-predicted, combat is server-side
- Own player movement is simulated on the client (shared collision code) and sent with inputs;
  the server validates speed. Shots: client renders own muzzle flash/tracer instantly; damage, blood,
  kills come from the server. This keeps shooting feeling instant even with latency.

## D7 — Procedural audio
- All sounds are synthesized at boot with WebAudio (layered noise + low thump + clicks, per-weapon
  recipes, compressor on master). No audio files to license, every gun can be tuned to be punchy.

## D8 — Phaser 3.90 (latest v3), canvas size = CSS size, camera zoom adapts to screen
- Mobile gets a wider view (zoom ~0.65–0.8) so you can see hordes coming.

## D9 — Flow field heap sized 9× cells
- Each nav cell can be pushed once per neighbour; an undersized typed-array heap silently dropped entries and
  left half the map "unreachable". Heap is now `w*h*9`.

## D10 — Doors: unlocked = passable for chickens' navigation
- Closed-but-unlocked doors are ignored by the nav grid (they open when an aggro chicken is near);
  locked doors block. Keeps hordes flowing through the office without per-door logic.

## D11 — Staged rescues
- NPCs in `cower` mode are not targeted (neither by AI nor by the flow field) until a player is within 420 px,
  so rescue scenes can't resolve before the player arrives.
- Script-placed enemies can be `dormant` (ignore sight until noise/damage/script).

## D12 — Level content as data + script
- Map layout & object placement in `tools/levels/<id>.ts` (Painter carves rooms; compiled to .tmj),
  story/flow in `src/shared/levels/<id>.ts` hooks (onTrigger/onUse/onRescue/onKill/onBoss…).
- Follower NPCs and player weapons carry over between levels (`World.carryOut()`).

## D13 — Renderer: Phaser.AUTO (WebGL, Canvas fallback)
- The in-app test browser lost WebGL after HMR leaks; the game must still run. Canvas fallback renders
  everything except tint-fill flashes; text resolution is 1 on Canvas. HMR now forces a full reload.

## D14 — Darkness RenderTexture is recreated, never resized
- Phaser 3.90 WebGL: after `RenderTexture.resize()` the texture still accepts `fill()` but silently ignores
  `draw()`/`erase()`. Lighting now destroys and recreates the RT when the view grows. Verified with
  headless Chromium WebGL (`tools/shot.mjs`).
- Flashlights: cone texture erased from the darkness, then shadow quads (36 raycasts per light) re-darken
  everything behind walls/crates; static & dynamic lights are erased afterwards.

## D15 — Multiplayer protocol
- Room id = 4-letter code (no I/O to avoid confusion). Schema state: code, phase, level, players (name, slot,
  ready, host, connected). Host starts when everyone is ready; 25 s reconnection window; drop-in joins spawn
  as fresh employees.
- World ticks at 30 Hz on the server; `snap` (20 Hz, compact arrays for enemies/projectiles/pickups) and
  `ev` (event batches) messages. Clients smooth remote entities, predict their own movement and their own
  shots (muzzle/tracer/sound instantly; damage, blood and kills come from the server).
- Level end → `end` message with stats → next level after 5 s (weapons & follower NPCs carry over).
  Game over (everyone chicken/down) → retry the level after 6 s with the loadout from the level start.
- Antidote moments (factory synthesis, level end) cure chicken players.
