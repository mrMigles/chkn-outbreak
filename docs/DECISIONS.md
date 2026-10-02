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

## D16 — Agreed 2.5D redesign (2026-10-02; implementation in progress)

- Source of intent: user-approved choices and [PLAN-2.5D.md](PLAN-2.5D.md), with [reference image](references/chkn-2.5d-reference.png).
- Keep Phaser 3, the shared pure-TS simulation, Colyseus and orthogonal gameplay coordinates. Target a three-quarter view with detailed pixel art, directed bodies, separate weapons and floor-based depth sorting.
- Use free asset libraries, primarily LPC with adapted lab/factory/FX packs. Record actual source files and licenses in [ASSETS.md](ASSETS.md). Generation is a last resort.
- Campaign remains office → lab → factory → boss, with short transitions and wave arenas. Support uses one contextual button: revive, heal and share a universal ammunition package. Players remain cooperative humans; NPCs may betray the team through a readable mutation.
- This direction supersedes D1's exclusive-pack and strict top-down requirements and D2's visual wall recipe for new work. D15's player-chicken/antidote behavior is historical; runtime players now remain cooperative humans. Other architectural decisions remain applicable unless explicitly revised.
- Implementation and integration are split into P00–P23 in [TASKS-2.5D.md](TASKS-2.5D.md), with one owner per shared file and a visual office acceptance gate before the full campaign art pass.
- First iteration implements the office prototype, contextual support, staged NPC mutation, random betrayal and client reconnection. Full campaign art/arenas remain pending; [QA report](qa/office-iteration.md) separates verified behavior from acceptance gaps.

## D17 — Preserve arcade pace while changing the presentation

- User requirement: keep the current game's drive. Existing weapon data, enemy combat parameters, speed, recoil, combo and synthesized sounds are retained. New body directions and free weapon aim change rendering, not logical movement coordinates.
- LPC bodies use four directions/nine walking frames, feet anchored at native y=62 and integer ×2 scaling. Gun muzzle/tracers render 40 units above the floor. Picking an office enemy's visible body converts the pointer back to its ground position, so aiming at a tall sprite still hits its logical target. Projectile/flashlight alignment remains an acceptance item for P05.
- New art is limited to the office until P09 acceptance. Public sources are saved with credits and reproducible adaptation; no AI images used. Current shared body silhouettes are prototypes, not the final professional cast.

## D18 — Contextual support and human teammates

- E tap/release shares one current-weapon magazine into finite reserve; hold heals +40 after 1.2 s (one medkit) or revives to 45 HP after 2.6 s (no cost). Carry one of each supply. No nearby teammate permits self-heal. Downed target has priority; target locks for one press and requires distance ≤80 plus clear line.
- Moving, firing, leaving range, changing state, a new wall or disconnect cancels without spending. Edge queues retain quick taps between 30 Hz ticks. One helper owns progress; a target version invalidates concurrent old holds after completion so two helpers cannot chain two heals from one action.
- Bleedout enters spectator state. Existing combat-clear transition returns connected human teammates with their loadout; P15 will connect this to formal arena intermissions. No living connected player means defeat; friendly fire stays off.

## D19 — Readable NPC mutation and betrayal

- Mutation is authoritative, 2.2 s: twitch → feathers at 0.7 → silhouette at 1.5 → hostile. Friendly NPC firing stops; clothing/name survive through appearance metadata. Weapon and mandatory story keys drop once. Pending mutation counts toward relevant script enemy tags.
- Recruited/rescued allies roll 25% once; server RNG owns the result and a 35–90 s countdown. At least 20 s of aid, two random betrayals per level, one active mutation at a time and 30 s between random starts. Carry preserves the decision/countdown. Fixed seed supports reproducible checks; ordinary sessions choose a fresh seed.
- Client automatically retries reconnect for 24 s within server's 25 s window, closes late successful handshakes after cancellation/deadline and restores playing/between/over UI. SDK and two app browser pages verify identity/supply retention and resumed snapshots. Deadline/cancellation, level-boundary UI and artificial latency remain pending P13/P14.

## D20 — Freeze fix: no RenderTextures in the frame loop (2026-10-02)

- Symptom (user report #1): the game froze on shots and chicken explosions. Profiling on Intel UHD (ANGLE/D3D11) showed JS frames under 5 ms but GPU command-buffer flushes of 100–700 ms whenever something was stamped into a WebGL RenderTexture, and 2+ s per frame in dark levels (darkness overlay RT).
- Decals (blood, feathers, casings, corpses, scorch) are now pooled plain images in the sprite batch, capped at 1400 and recycled oldest-first (`DecalLayer`, `Particles.ts`). Old floor history fades out by recycling instead of accumulating forever.
- Darkness is a CPU-lit grid of quads with per-vertex alpha in one Graphics object (`Lighting.ts`, 24-unit cells). Lamps, muzzle flashes, explosions and flashlights are accumulated per vertex; flashlights are still clipped by a 36-ray fan so walls cast shadows. Light edges are softer than before — accepted.
- Hit-stop removed from explosions and ordinary kills (it read as "freezing"); only the boss kill keeps 160 ms.
- First use of a blend mode / tint-fill / gradient program and first upload of composed textures happen during a 3-frame warm-up at level start.
- Result (`tools/qa-play.mjs`, hardware WebGL, 25–40 s auto-fights): office and lab p50/p95/p99 = 16.7 ms, no frame over 50 ms inside the measured window (previously 13–26 such frames per 40 s, max 700 ms; lab 2000 ms per frame).

## D21 — Runtime character compositor and customization

- Characters are no longer pre-baked per "kind". `src/client/render/compose.ts` stacks 46 Universal LPC layer strips (walk 4×9 + hurt 6) recoloured at runtime into one texture per look; `src/shared/look.ts` encodes a look as a short string (`body.skin.hair.hairColor.top.topColor.legs.legsColor.acc`).
- Bodies: male, female, big (muscular, used for «менеджер» and the boss); old heads for elderly NPCs. 14 hairstyles, 10 hair colours, 4 skin tones, 9 tops, 3 bottoms, glasses/beard/mustache.
- Players choose their look in «Изменить внешность» (main menu); it is stored in settings, sent on join (`look` join option → `LobbyPlayer.look` → `Player.look` → snapshots) and validated by the server with `decodeLook`. Empty look = slot preset `p0..p3`.
- Story NPCs have named presets (Галина — woman at reception, Петрович — elderly guard, etc.); levels may override with a `look` property. Legacy Kenney kind names map to presets.
- Random enemies use `enemyLook(type, seed)` with 5 looks per type (bounded texture count, all composed during level warm-up).

## D22 — Humans become chicken-people, not "a chicken head on a human"

- The mutant sheet is the same person with surgery applied in the compositor: skin and head recoloured to feathers (shading kept), hair removed, eyes red, comb/beak/wattle drawn per direction relative to the detected head box, feather tufts at the collar, a tail fan behind the hips, shoes turned into orange claws, clothes slightly grimier. Clothing and name survive, so the former coworker stays recognisable.
- NPC mutation flickers between the human and chicken-person sheets (twitch → feathers), then a dark silhouette, then the enemy.
- Enemy silhouettes: fat = big body ×2.35, fast = ×1.85 in bright T-shirts, spitter = glasses + green, armored = plate armour, exploder = apron + green pulsing tint, boss = big rooster with red feathers and LPC feathered wings ×3.4. Chicks are real LPC chickens recoloured yellow.
- Every enemy type now uses this art, so the old top-down Kenney chickens (which could not be hit reliably in the 3/4 view) are gone; pointer aiming maps any visible body to its feet for all types.

## D23 — Corpses from the LPC collapse animation

- Deaths play the LPC `hurt` frames (0.42 s, sliding along the hit) and leave the last frame as a floor decal. Gibs (explosions, heavy hits) leave blood/feathers only. Downed players show the collapse pose; cowering NPCs crouch.

## D24 — Gun in the hand

- Guns are hand-made pixel art (`GUNS` in `tools/art/lpc.mjs`), drawn at hand height (36 units above the feet) in front of the body toward the aim, with a small skin-coloured hand; behind the body when facing north. Muzzle flashes, tracers and casings start from the barrel tip (`muzzleOf`). Skorpio's LPC weapon overlays were considered but only fit his own male body.

## D25 — 2.5D for every level, interiors rebuilt

- All levels now use the 2.5D renderer (previously only the office). Floors come from `tiles25.png` (Kenney layout, every used index replaced with LPC floors), wall facades per theme (office paint/panelling, lab blue panels from Skorpio, factory riveted steel), doors as facades / side jambs with a red lamp when locked.
- Furniture for all maps: LPC office/object kits (desks, dining chairs in four facings, sofas, tables, kitchen counters, sink, TV), Skorpio (vending machines, server racks, terminals, barrels, posters, lab bench, elevator doors). Missing pieces are drawn in code in the LPC palette (pods, crates, pallets, forklift → stacked pallets, machines, generator, conveyor, aquarium, whiteboard, signs). Only flat floor details keep the legacy art. `npm run check:art` fails if any standing map prop lacks 2.5D art.

## D26 — Adaptive music

- Four CC0 tracks by Juhani Junkala (Chiptune Adventures): calm (menu/exploration), tense (1–6 aggressive enemies near), wave (7+ or alarm), boss. Crossfades in `audio/Music.ts`; calmer moods wait 5–7 s to avoid flip-flopping. Separate «Музыка» volume in the menu.

## D27 — Tutorial cards and level passability check

- One-time contextual cards (`ui/Tutorial.ts`): controls, objective, first enemy and each special enemy type, mutation, reload, weapon switch, NPCs, pickups, medkit, locked doors, explosive barrels, darkness, downed friend. Remembered in settings; «Подсказки» toggle and reset in the menu. Cards sit bottom-left (top on phones), never block input.
- `npm run check:levels` flood-fills each map with the player radius, unlocking doors in story order, and checks the goal, all triggers/usables/NPCs/pickups/barrels and spawner/spawn placement. It found two spawners inside solids (lab `gen`, factory `hall`); both were moved. All five maps pass.
- Speech bubbles are smaller (12 px), sit above the name label instead of over the body, and scale up when the camera zooms out on phones.

## D28 — 2.5D hit boxes and headshots (2026-10-02)

- User report: a bullet visibly flew through a chicken's head without a hit. Hits were tested against a circle at the feet; the pointer→feet mapping only caught part of the sprite.
- A shot is now a ray at hand height. In screen terms it starts at the hand and passes through the pointer, so the sim tests it from the shooter's feet against vertical boxes shifted down by `HAND_H` (`shared/sim/hitbox.ts`, shared by server, solo sim and the client's predicted tracers). Each body is a box of its drawn size; the top 30 % is the head.
- Headshot = ×2 damage (boss ×1.4), `hs` flag on `hit`/`kill` events, a «В ГОЛОВУ!» pop and a ding for the shooter. Bodies standing behind the shooter cannot catch the shot. Mouse aim always goes from the hand through the pointer (the old snap-to-feet is removed); touch aim assist still targets the feet, which also lies inside the box.

## D29 — Gun held in both hands (armed pose)

- User report: the pistol still floated next to the body. LPC walk frames have hanging arms, so a gun drawn in front never touched a hand.
- Every LPC layer now also ships `thrust` (all 46 layers have it). Frame 3 per direction (hands together in front) is stored as row 5 of each layer strip (576×384). Human sheets get rows 6–9 «armed walk»: upper body from the armed pose over the walking legs (seam at row 48; walk-hand pixels below the seam outside the leg columns are dropped). Armed characters (players, armed NPCs) use frames `a<dir>_<f>`; the gun grip is placed at the pose's hands per facing (`GRIP` in `Actors.ts`), the separate drawn hand is gone.

## D30 — Gentler first level

- User: the office was too hard. Level scripts may set `enemyHp` / `enemyDamage` multipliers; office uses 0.85 / 0.65. Waves are about half (kitchen 4, cafeteria 10, lobby 9; blackout: a wave every 7 s of 2–3 instead of every 4 s of 3–7), no fat/armored in the office waves; the opening fat mutant (Аркадий) is now a normal one, the «Синергия» room lost its spitter.

## D31 — Companions always follow; armed NPCs shoot

- No «wait here»: followers ignore E entirely, so doors/terminals/the reboot button next to them stay usable. If their leader goes down or leaves, they switch to another living teammate.
- Followers keep individual distances (64–106) and push apart from each other (46) and from players (40), so a group spreads instead of stacking.
- Armed NPCs never fired: the aim test compared unwrapped angles (`|angle − a|` could be ≈2π), the walk direction overwrote the aim every tick while following, and the nearest enemy behind a wall blocked shooting at visible ones. Now: nearest *visible* chicken, wrapped angle check, facing is kept on the target while walking; slightly higher NPC damage/rate (0.7 / 0.6).

## D32 — No enemies appearing in view

- Wave spawns pick a spawner of the group that is not on any player's screen (generous rect around each player: ±820 × −560…+480). If all of them are visible, the closest hidden spawner of any group with a path to the players (flow distance 900–2600) is used; only after ~3 s with no hidden option at all does the group's own spawner fire. Story mutations, pods and boss eggs still happen in view on purpose.

## D33 — Plumage variety

- Chicken-people come in three plumages chosen deterministically from the look: white, yellow and «рябая» (grey-brown with dark/light flecks); the boss keeps red. Tail and collar tufts follow the plumage (`PLUMAGES`, `plumageOf` in `compose.ts`).

## D34 — Readable NPC mutation (2026-10-02, iteration 4)

- User: when NPCs turn it is not clear what happens. Mutation now lasts 3 s (`MUTATION` in `sim/types.ts`: twitch < 1.0 s, feathers < 2.0 s, silhouette < 3.0 s).
- Over the NPC: «⚠ <имя> ПРЕВРАЩАЕТСЯ!» blinking, a progress bar yellow → orange → red, a pulsing red ring on the floor. HUD toast at the start and «<имя> стал курицей!» at the end; feather bursts and a light flash per stage, a big feather explosion + squawk + small shake when the enemy appears.

## D35 — Armed pose, corrected (supersedes the frame choice in D29)

- User: hands still moved separately from the gun. LPC `thrust` frame 3 is the wind-up (elbow pulled back) for every body; frame 4 has both fists forward at the waist. Layer strips now store frame 4; grips sit in the fists (side views ±26, −36 world units).
- Side views draw the gun behind the body so the fists (part of the body frame) close over the grip; facing away it is hidden, facing the camera it is held in front. `tools/qa-gun.mjs` renders 8 directions idle + walking for any look.

## D36 — Destructible props

- `PropDef.hp/mat/h/drop`: crates (55–80), plants (18), bins, lamps, TVs, water coolers, printers, speakers, vending machines (140). Hard props are found by the bullet raycast (`wall.id`), soft ones are bullet victims with a body box; explosions damage both.
- Breaking removes the collider (flow field rebuilt), emits `propbreak`, drops loot (crates: 30 % ammo / 12 % health, vending: 60 % health) and makes noise. Destroyed ids travel in snapshots (`bk`) so late joiners and the client collision map agree; the client leaves a darkened wreck decal and debris by material.

## D37 — Objective arrow (instead of a minimap)

- User asked for a minimap or just a direction. Level scripts give objectives a target (`setObjective(text, target)`: map object/NPC names or a point; synced as `ot`). The client computes a flow field from the target (locked doors block; if the target is behind a locked door the arrow leads to that door) and points a yellow arrow at the player's feet along the walkable path: the farthest path point reachable in a straight line with the body's width («string pulling»), so it never points into a wall corner. A bouncing marker shows the target when it is on screen; the objective panel shows the direction and distance in metres. Defend/survive objectives have no target.

## D38 — Developer mode

- `?dev=1` (or five taps on the logo) persists `settings.dev`. Menu: any level, god mode, full arsenal; hosting starts the room from the chosen level. Solo hotkeys F6 god, F7 arsenal, F8 kill all, F9 complete. A small DEV line shows the state. Multiplayer gets only the level choice (the server stays authoritative).

## D39 — Telegram: the chat is the room

- Same scheme as the bunker project: Telegram Games (`/play` → game card; the bot answers «Играть» with a signed link `?tg=`) and Mini App (`initData` checked with the bot token). The chat key (`chat_instance`, else chat id, else start parameter, else the user) gives a fixed code `T???`; the server pre-creates that room (`matchMaker.createRoom` with a per-code lock), the client joins it directly with the Telegram name. Ordinary 4-letter rooms keep working; chat rooms show «КОМНАТА ЧАТА» and the chat title in the lobby.
- In Telegram: fullscreen + orientation lock on phones (Bot API 8.0+), no swipe-to-close, header «Назад» pauses the game / leaves the lobby, haptics on damage and when downed. Bot: long polling (no webhook), `/play`, `/app` (Mini App link with the chat as start parameter), inline mode.

## D40 — Docker, compose, CI

- Modelled on the bunker repo: multi-stage `node:24-alpine` image (musl avoids the clone3/seccomp crash on old Docker), runtime = production dependencies only (Colyseus + tsx, 29 MB; Phaser and colyseus.js moved to devDependencies because the client is bundled at build time), `dist/`, server sources and level maps; non-root user, `HEALTHCHECK /healthz`, `init: true` in compose, graceful shutdown on SIGTERM.
- GitHub Actions: typecheck, headless checks, build, a real server with network + Telegram checks, then buildx push to GHCR with `latest`/SHA/tag and GHA layer cache; PRs build and smoke-run the image without pushing. Docker itself was not available locally; the runtime layout was verified by installing production dependencies into a copy and running the server + network/Telegram checks against it.

## D41 — Pickups on furniture; doors must be walkable

- User: a weapon in the kitchen could not be taken — it lay in the middle of a long table, beyond the 34-unit pickup radius from the feet. Items lying on a solid prop are now picked up within 84 (`pickupReach`). `check:levels` checks pickups against the real reach (the old rule flags exactly that SMG).
- The campaign autopilot found the «Синергия» TV standing in front of the room's north door (14 px gap). The TV moved; `check:levels` now path-finds through every door inside a 2-tile window and fails if furniture closes it.

## D42 — Office objective chain

- The server-room and guard-room triggers kept overwriting each other («ключ у охраны» ↔ «синий пропуск») every time the player crossed them. The objective never steps back now (`needBlue`), the hint line is said once. Dropped key cards become the objective («Подобрать синий пропуск», lab «Подобрать пропуск в оружейную») and picking them up moves the objective on, so the arrow cannot lead away from a card the player still needs.

## D43 — Floors 6 and 7; rescue before the laboratory (2026-10-02)

- The first office retains its geometry and gentler balance; it is floor 6. Its lift now goes to `office7`, then the campaign continues to lab → factory → boss.
- Floor 7 adapts the supplied plan: grey floors and walls, light wooden desks, western Phoenix/table tennis, central desks, northeastern kitchen, eastern Castor, southern rooms and lift lobby, stepped curved perimeter. Art uses the existing LPC pipeline; the references guide geometry and colour, not the rendering style.
- The request says four people but names five. All five are rescued: Андрей and Серёга by the red mark, Влад in the kitchen, Стас and Паша playing table tennis. The HUD counts 0/5. These story friends cannot randomly betray or die and block the mission; non-story survivors remain vulnerable. Андрей provides covering fire.
- Workers mutate visibly on approach. Rescue patrols arrive every 24 seconds (15 after gathering everyone), then stop when the manager ambush begins. Its finite wave keeps evacuation achievable.
- Returning with all five triggers the bald manager's mutation into an armored, enlarged enemy with 850 HP in solo, scaling with party size. He is not the final boss. Killing him drops the physical, permanent «Рутовый петушок» trophy; collecting it awards the whole room. The guide targets the manager, remaining attackers, trophy and finally lifts in order.
- Evacuation requires the friends to physically reach the lift and all living players to enter it. Earlier followers also evacuate. Nobody follows into the lab: a mislabeled pilot drink links the outbreak to project ЯЙЦО on floor −3; Омлетов confirms the source and need for an antidote.

## D44 — More frequent non-story mutations

- Betrayal roll is 65%, with an 18–45 second delay after recruitment. A survivor must help for at least 12 seconds; mutations are spaced at least 12 seconds apart and never overlap. Removed the lifetime limit of two betrayals.
- Story survivors and the five friends are excluded. Plans, remaining delay, story protection and appearance persist when changing levels and restoring rooms.

## D45 — Walking body and weapon move together

- Armed walk keeps the upper body in the existing thrust pose. The lower body is masked by leg/clothing pixels, rather than a broad rectangular crop, removing stray swinging hands below the seam.
- The body and gun share the same integer gait offset. Followers animate walking only when their rendered position actually changes, so stationary survivors no longer shuffle.
- Evidence: `qa/armed-fixed_sheet.png`, eight directions standing and walking; the original first-floor layout is unchanged.

## D46 — Generator blackout attacks from the corridors

- Using the generator immediately starts the blackout and an eight-enemy wave. More waves arrive every 2.5 seconds, increasing from four attackers as the 35-second defense progresses.
- Removed generator-room spawners, added corridor spawners and an eastern entrance. Spawn fallback for this encounter is restricted to marked corridor points; it cannot silently select a point inside the room.

## D47 — Temporary loot buffs

- Fat, armored, spitter and exploder enemies have a 28% chance to drop a buff: invincibility, triple damage, infinite ammunition or ×1.6 running speed. All last 10 seconds; uncollected drops expire after 20 seconds.
- Repeated pickup refreshes the timer instead of stacking duration. Damage includes grenades; infinite ammunition works even with an empty magazine and reserve. Server authority and client movement prediction agree on speed. HUD shows each active timer and the root trophy.

## D48 — Persistent room progress and recovery after death

- Room saves belong to the four-letter code, not a browser or player connection. Save every five seconds and on room disposal; keep the next level immediately when finishing the current one. Empty rooms pause. Winning clears the save.
- A deterministic authoritative input recording rebuilds positions, inventory, keys, NPCs, enemies, destroyed furniture, story flags, RNG and pending callback timers. Recordings restart at each level. Random simulation decisions now use the world's seeded RNG; line-of-sight caches are per world, avoiding interference between rooms and replay.
- Keep the last tick with a living connected teammate. After a team wipe, continue there with at least 60 HP and three seconds of protection instead of restarting the floor. Rejoining after server restart reassigns preserved seats to the new connections.
- Main menu remembers the last code; «Продолжить последнюю комнату» pre-fills it. Joining by code recreates a saved lobby, then the host starts continuation. No client supplies saved game state.
- Files live in `data/rooms` (`CHKN_SAVE_DIR` override), are atomically replaced and excluded from Git. Docker uses a named volume. Random room codes avoid Telegram's reserved T-prefix. Recordings are versioned; future simulation changes must preserve replay compatibility or bump the save version.
- Verified against actual server disposal/restart and team death, plus exact replay and pending timers on all six maps. This is room persistence; solo still uses its existing retry behaviour.

## D49 — Busier final boss and occasional office absurdity

- Final boss receives periodic reinforcements, 14 attackers at phase 2 and 20 at rage, larger summon waves, with periodic spawning gated at 65 active enemies. Death cancels waves/projectiles and protects survivors through the victory scene, including delayed boss attacks.
- Outside the unchanged first floor, 12% of ordinary spawns can have comic coworker looks/names: Ко-коуч, петух-отпускник, директор по корму, служба петушиной безопасности, бухгалтер and DevOops. Their original combat type remains intact. Occasional speech and PA jokes use existing bubbles/radio UI, with an 18–28 second cooldown.
- The ping-pong ball moves until both players are rescued; rescue dialogue, manager dialogue, kitchen label and evacuation plan explain the story with office humour.
- Minor fixes: unchanged objective text no longer emits redundant events, blinks or repeats its sound when only the target moves; floor-7 guide follows moving ambush enemies; grenade damage respects buffs; recreated scenes clear their old ping-pong ball reference. Buff labels are compact and avoid the objective on narrow phones; the portrait weapon panel sits below the objective. New comic looks are precomposed before gameplay. QA reports capture per-floor health before entering the next level. Container image name matches `mrMigles/chkn-outbreak`.
