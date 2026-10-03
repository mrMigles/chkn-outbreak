# HANDOFF

_Last updated: 2026-10-03_

## Iteration 13 (2026-10-03, Claude) — feedback round (D71)

Lab doors never lock (co-op), phone weapon button (tap = next, hold = picker grid), street «прыгуны» (leaping chickens), minigun at the helicopter and laser from Омлетов (limited ammo), the final boss is a wingless mega rooster (8000 HP solo), browser/PWA back needs two presses (first one pauses), finale with fanfare/confetti and a victory screen listing the run's achievements, a 3-s non-blocking intro (camera to the objective) on every floor, Неля stays with a team and explains, more floor-8 horror, companions unstick around corners. Rules version 6. Details: [DECISIONS.md](DECISIONS.md) D71.

Checks: all sim checks, `check:chapters` (+5 scenarios), build, `qa-d71` screenshots, autopilot matrix (solo 4 runs / duo 3 / quad 2 over the whole campaign: no floor needed more than one retry except one 3-retry floor-7 solo run; the final boss 0 retries solo, near-death in teams), browser autopilot: floor 8 alone, then street 1 → street 2 → factory → lab → boss in one chain (one death on street 1, none after, the finale ends the run); the back button (first press pauses and warns, second leaves) checked in Chromium; check:lobby, check:lobby-ui.

## Iteration 12 (2026-10-03, Claude) — three chapters: floors 8, 11, 12, the city; balance by autopilot

User request (10 items), decisions D68–D70, story/level design in [design/chapters.md](design/chapters.md).

- **Chat lobby** has «🎮 Одиночный режим» (back to the main menu). **Root manager** halved (rules 5).
- **Campaign:** Глава 1 «Офис» 6 → 7 → **8 «Тёмная тема»** → **11 «Начальство»** → **12 кафе**; Глава 2 «Город» **улица 1** (вертолёт) → **улица 2** (рынок, проходная); Глава 3 «Провансаль» завод → лаборатория → ангар. Chapter line on title cards, chapter banners + achievements on the last floors.
- **Floor 8:** darkness, sleeping red-eyed chickens (stealth: flashlight/closeness wakes them, sleepers take ×2.5), two safety releases (split up, or Неля helps a lone player), four scares, Валера's call «Артём, не слышно тебя!», breaker → elite «Петух Тёмной Темы» (hit-and-run, hates flashlights), light returns.
- **Floor 11:** Жанна's three visas (finance / HR forms + Ирина mutates / escorting the lawyer), 75-s board meeting, executive director elite (charge, egg «delegation»), private lift.
- **Floor 12:** lunch heals, the chicken joke, a helicopter falls past the panoramic windows (camera cutscene), Капитан Крылов on the radio. Chapter 1 complete.
- **Street 1:** avenue, park (grandma + flock), shawarma kiosk, courier; 60-s helicopter defence; epicentre «Провансаль». **Street 2:** market back gate after Тётя Валя's eggs hatch, blogger Стёпа (may turn on stream), Семёныч's pass from chicken-Толик, 40-s gate. Chapter 2 complete.
- **Engine:** elite chickens (`ELITES`, boss bar name, larger bodies with matching hit boxes), scripted light (`setLight`), scares/cutscene events, red eyes, path-following NPC `goto`, NPC talk `reach`, tall props fade over the player, 15 achievements, 4 floor bonuses, new sounds. Art: Skorpio cars/streets/facades, [LPC] Trees, LPC fountain/brick/fence/phones/paintings, hand-made helicopter/kiosk/stall/bus stop/breaker/food/windows ([ASSETS.md](ASSETS.md), credits page).
- **Bugs found by playing (bots + browser):** floor 6 objective stepping back to the locked lifts (twice: late open-space clear, fast team before 7 s); lab co-op lock-out behind the decontamination doors; E on a cowering armed survivor (Омлетов) skipped his rescue and froze the lab objective; Неля stuck on a wide door; a corridor plant wedging NPCs; the escorted lawyer falling behind. Final boss was nearly impossible for the bot even with every gun → rules 5: 7500 HP solo, softer claw/charge/ring, smaller reinforcements (×1.5 per player), a trade-union medkit every ~24 s.

**Balance matrix** (`npm run sim:play`, whole campaign chained with carried loadouts; average game-overs per floor / typical lowest HP):

| Floor | Solo (5 runs) | Duo (4 runs) | Quad (3 runs) |
|---|---|---|---|
| 6 | 0 / 70–100 | 0 / 77–92 | 0 / 92–100 |
| 7 | 0.6 / 2–57 | 0 / 19–41 | 0 / 23–81 |
| 8 Тёмная тема | 0 / 9–85 | 0 / 62–92 | 0 / 68–81 |
| 11 Начальство (director 2300 after the matrix) | 0–0.25 / 1–80 | 0 / 35–84 | 0 / 37–60 |
| 12 кафе | 0 | 0 | 0 |
| Улица 1 (defence retuned after the matrix: 5 solo runs 0.4 / 4–63) | 0 / 69–88 | 0 / 76–96 | 0 / 90–96 |
| Улица 2 (gate eased after the browser autopilot died in the booth 5×: 35 s, smaller waves) | 0 / 59–84 | 0 / 64–67 | 0 / 27–71 |
| Завод | 0 / 55–80 | 0 / 7–90 | 0 / 35–80 |
| Лаборатория | 1.75 / 0–27 (runs 5, 0, 0, 2; one stuck run → bug fixed) | 0 / 39–51 | 0 / 45–62 |
| Ангар (босс) | 1.25 / 1–43 | 2 + one run that lost all 6 tries | 0.7 / 3–52 |

Reading: chapter 1–2 floors are tense but rarely lost for a decent player; the lab and the final boss stay the hardest (as a finale should). The bot never suffers the dark, so floor 8 is harder for humans than the table says.

**Checks:** build; check:coop, combat, campaign (new order, all 11 levels round-trip), progress, floor6, engagement, polish, art, levels (5 new story paths), **check:chapters** (new, CI: two bots finish each new floor inside a room recording; saves every 20 s replay exactly; snapshot fields), **check:chapters-net** (new, debug server: a room plays office8 → … → factory), check:lobby (14), check:lobby-ui (+«Одиночный режим»), check:network, check:network-ui; `node tools/qa-chapters.mjs` screenshots in `docs/qa/chapters/`; browser autopilot `qa-campaign` through floors 8, 11, 12 and both streets, all done without game over (`docs/qa/chapters-e2e/`). Not tried: a real phone on the new floors, humans in the dark, four humans online.

New tools: `tools/sim-play.ts` (balance autopilot), `tools/check-chapters.ts`, `tools/check-chapters-net.ts`, `tools/qa-chapters.mjs`, `tools/art/city.mjs`.

## Iteration 11 (2026-10-03, Claude) — fixes from online play, floor 6, battery

D66: no traces after online mutations; own shots no longer vanish after a gun pickup online (event/snapshot order) and sound voices cannot get stuck; downed teammates have a 15 s ring, alert, arrow and a 110 pick-up radius; dead players spectate; floor 6 has corridor mutations, strays, bigger waves and a comic lift-hall meeting (rules version 4; older saves replay unchanged). D67: battery — change-only HUD writes, sleeping renderer in menus, 60 FPS cap. New checks: `check:floor6` (CI), `check:mp-ui`, `qa:battery`, `node tools/qa-floor6.mjs` (screenshots). Cover art in `docs/cover.webp`, link preview `public/og.jpg`.

## Iteration 10 (2026-10-02, Claude) — phone shooting, phone texts, performance

D63: right stick aims inside the circle and fires at the edge, regardless of targets. D64: on phones all pop-up texts (incident, alerts, radio, tips) live in one small feed in the free corner (portrait bottom-left, landscape top-right), smaller, one pop-up at a time. D65: `qa:perf` found no leaks and steady 60 FPS; start-up made faster (brotli, immutable versioned assets, Phaser chunk, music after first touch): 4G cold start 5.8 → 4.0 s, half the bytes.

## Iteration 9 (2026-10-02, Claude) — lobby, seats that survive closed tabs, PWA, Telegram summon

User report (11 items), decisions D58–D62. Lobby = main menu with the team (portraits, look/name changes, host by join order with instant transfer, «Продолжить / Новая игра», readiness only a hint). Seats belong to a persistent player id: a closed tab or crash comes back to the same seat/position (reserved for the whole floor), a second window takes the seat over, a dead character stays benched until the next floor, newcomers drop into the running floor. Telegram chat: straight to the lobby, «Призвать чат», rare achievements → chat, «Открыть в браузере» on computers keeps the seat. PWA with `/?install=1` and `/install`. Freezes: delta snapshots (−40 % traffic), incremental async room saves (9 ms → 0.1 ms on the event loop), 100 ms snapshot interpolation on clients.

Checks: build, all sim checks, check:progress, check:network, check:telegram, new **check:lobby** (14, own server + fake Telegram API, in CI), new **check:lobby-ui** (8, real browsers on the production build; screenshots in `docs/qa/lobby/`), network-ui, polish-ui, telegram-ui, engagement-ui, qa-phone, smoke. Not tried: a real Telegram desktop client (the hand-over is tested with a signed game link in Chromium), real iOS/Android install prompts, internet latency.

## Iteration 8 (2026-10-02, Claude) — floor bonuses, nudges, threat arrows

D57: an optional «★ Бонус этажа» per floor (sim-side, one payout, 5 new achievements + 2 skill achievements), situational alerts/quips/companion jokes (`ui/Coach.ts`), off-screen threat arrows, ghost stick hints, left-handed mode, vibration, HUD size, release of stuck touches, one-popup-at-a-time in portrait. Builds on Codex's `docs/design/engagement.md`. All checks + `qa-phone` (5 viewports incl. large HUD) pass. Not tried on a real phone.

## Iteration 7 (2026-10-02, Claude) — phones first, continue, controls, cache

Decisions D55–D56. Menu has Continue/New game for solo and rooms with the floor caption; solo resumes the floor where you died. HUD rebuilt as a top grid + bottom stack; on phones everything sits in the corners (weapon panel = switch weapon), checked at Galaxy S25 portrait/landscape by `node tools/qa-phone.mjs` (screens in `docs/qa/phone/`). First-run «Как управлять» popup, also in pause and menu; pause has Settings/Controls pages; rotate hint only occasionally. Server reboot on floor 6 is a much bigger defence. Deploys can no longer leave a stale cached page (build id, cache headers, one-time auto reload).

Checks: build, check:campaign (+ reboot waves), coop, combat, levels, engagement, progress, polish, engagement-ui, polish-ui, network-ui, qa-phone. Not tested on a real S25 device.

## Iteration 6 (2026-10-02, Codex) — Castor siege and six reported fixes

Decisions D50–D54 supersede iteration 5 where applicable. Floor seven now starts with an actual locked Castor and a 22-enemy siege, then Елена mutates during the pass handover. Her defeat drops the key; unlock Андрей/Серёга and continue the five-friend evacuation. Patrols arrive more often. Root has 2200 solo HP, a telegraphed player-targeting charge, stronger melee, 28 initial attackers and support until his death.

NPC walking is distance-based, followers settle with hysteresis, mutation warnings clear when the human disappears, and all red hazard barrels are explosive with sprite-matched hitboxes. Waiting protected NPCs no longer strand waves at inaccessible or immortal targets.

After a team wipe the death panel waits for the host to retry **from the current floor entrance**. Living-room progress still saves normally. Version 2 checkpoints preserve the new deterministic simulation; old version-one rooms migrate to their current floor's entry. Death panels, idle/walk, mutation cleanup, actual room retry/reconnection and disk/server recovery have executable regressions. See [polish/report.md](qa/polish/report.md) for the final verification evidence and limits.

## Iteration 5 (2026-10-02, Codex) — floor 7, room saves, buffs and larger encounters

Current campaign: `office` (floor 6, original layout/balance) → `office7` → `lab` → `factory` → `boss`; `arena` remains separate. Decisions D43–D49 in [DECISIONS.md](DECISIONS.md) supersede historical notes below where applicable.

- Floor 7 follows the user's grey/light-wood office reference in the existing LPC style. All five named friends are physically escorted to lifts. Workers mutate; the returning group triggers a bald manager's large non-boss mutation and finite wave. His trophy awards «Рутовый петушок» to the room. Friends evacuate and the drink's lab address / Омлетов's radio call explain the trip to floor −3.
- Non-story followers mutate more often; protected story characters do not. Armed body/gun gait is unified and lower-body alpha masking removes leftover hands. Stationary followers no longer walk in place.
- Generator blackout lasts 35 seconds with more corridor-only attackers and a second approach. Boss phases, summons and recurring reinforcements have more enemies; victory clears pending waves/projectiles and protects the team.
- Four ten-second buffs drop from stronger chickens. HUD timers and the trophy persist through snapshots; narrow-screen placement keeps effects clear of objectives. Occasional odd coworkers and office jokes use the existing presentation.
- `server/checkpoints.ts` and `shared/sim/Checkpoint.ts` persist each room by code. Seeded authoritative input replay restores simulation and timers exactly; after a wipe the last living position recovers with ≥60 HP and three seconds of protection. Browser menu remembers the room code, and the server can recreate it after restart. Docker's `chkn-progress` volume retains saves.
- `check:campaign` and `check:progress` are included in CI. The container repository is now `ghcr.io/mrmigles/chkn-outbreak`.

Verification and screenshots: [rescue-iteration.md](qa/rescue-iteration.md). Build, 18 coop scenarios, 10 combat scenarios, all six maps, art, deterministic replay/buffs/story, actual server restart, SDK networking, six-scene smoke and two-browser keyboard support/reconnection passed. Full floor-7 browser story runs completed in 81 seconds with god mode and 79 seconds with normal damage, no retries/stuck periods/errors; the normal run reached a minimum of 80.8 HP. Real phone and four-human internet play remain untested. Historical multiplayer/performance notes below are not new measurements for this iteration.

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
| Levels | Глава 1: `office` → `office7` → `office8` (dark, stealth) → `office11` → `cafe12`; Глава 2: `street1` → `street2`; Глава 3: `factory` → `lab` (dark) → `boss`; plus `arena` (weapon sandbox) |
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
- `npm run sim:play -- <levels> <players> <runs> <seed>` — balance autopilot in the simulation (D70); `LOADOUT=smg,shotgun` for a single floor, `LOG=1` timelines, `TRACE=1` positions.
- `npm run check:chapters` / `check:chapters-net` — new floors finished by bots with exact save replay / network floor order (debug server).
- `node tools/qa-chapters.mjs [out] [levels]` — screenshots of the new floors with scripted beats (breaker, meeting, lunch + helicopter).
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
