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

## D50 — NPC gait follows distance; idle means idle (2026-10-02)

- User reported frantic legs and walking in place. Human rigs advance one walking pose per 28 world units, using the same cycle for body and gun, instead of eleven poses per second regardless of speed. Settling jitter and teleports do not advance the cycle. Verified at 30/60/120 FPS.
- Followers stop at their formation distance and resume only when the gap grows by another 18 units. This hysteresis prevents separation and following from continually pushing against each other. Five companions settle beside a stationary player; browser checks verify an unchanged idle frame and real keyboard walking.

## D51 — Castor siege and Елена's last pass

- Supersedes the direct Castor rescue in D43. Андрей and Серёга remain behind an actual locked door. Six workers mutate outside it and sixteen more enemies arrive. Clear the tagged siege, visit office administrator Елена, and interact to ask for the pass.
- She visibly mutates during the handover, becomes a 320-HP spitter and brings twelve attackers. Only her defeat drops a permanent pass; pick it up and open Castor. The two friends cannot be recruited through the wall or before unlocking. The guide follows each stage, including a moving last siege enemy and a dropped pass.
- Waiting protected floor-7 characters are excluded from chicken targets: otherwise immortal administrators and inaccessible friends attracted enemies indefinitely. Recruited companions remain targets. Friendly rescue requires actual line of sight. Door hints display «Елены» instead of the internal key name.
- Added an SMG beside the shotgun near the entrance. The new enclosure and pass route pass structural reachability checks; the first floor's layout/balance is unchanged.

## D52 — More floor-seven action and a dangerous root manager

- Supersedes D43's patrol and manager tuning. Patrols begin at ten seconds, bring eight enemies every twelve seconds, then twelve every nine seconds after all friends are found. Spawn batches are gated at 65 active enemies. Patrols stop at the manager encounter.
- Root manager has 2200 solo HP, +40% per extra player, faster pursuit, heavier/faster melee and a telegraphed charge (0.6-second warning, then 460 units/second). He targets players instead of spending the fight attacking protected friends. Charge damage and actual player targeting are tested.
- The ambush opens with 28 attackers and calls eight more every nine seconds while root lives, gated by 48 tagged attackers. Killing him stops new support, leaving a finite wave to clear before the trophy and evacuation. He remains an enhanced regular enemy, not the final boss.

## D53 — Mutation graphics and all red barrels

- Red rings/bars left at a transformed human's previous position were the NPC's warning graphics. The hidden/gone branch now clears and hides them before returning. A browser check observes the warning during mutation and its disappearance afterward.
- Explosive barrel bullet bounds now cover the actual 52×68 sprite at its rendered vertical offset, so its visible top/base can be shot. Red `hazard_barrel` decorations in lab/factory/boss are now real explosive barrels; no visually identical inert red barrels remain. Bullets and chained explosions are tested.

## D54 — Death screen and retry from the current floor

- Explicitly supersedes D48's recovery at the death position. Solo death opens its screen immediately and stops the scene. If all room players die, the room enters a persistent `defeat` phase, displays the death screen and waits for the host's retry button; there is no automatic restart.
- Retry restores the entrance of the current floor with its entry loadout/story state. The entry checkpoint is rebuilt/rebound even when the room originally resumed mid-floor with new connection IDs. A wipe saves this entrance checkpoint, so leaving/restarting after defeat also cannot restore the death spot.
- Normal saving while alive still preserves actual progress by room code. Reconnecting while defeated restores the panel. Client guards prevent a stale `playing` patch from reopening gameplay over the result screen.
- If the host leaves while the death panel is open, the promoted host receives the retry button immediately; the room cannot be stranded waiting for a departed host.
- Save format is version 2 because movement, targeting and floor-seven replay rules changed. Version-one saves retain the room code, current floor and entry loadout, but discard obsolete input frames and begin that floor. Tests cover disk replay for all six maps, actual server restart, host retry, migration and browser death/reconnection flows.

## D55 — Mobile-first HUD, continue buttons, controls help, heavier server reboot (2026-10-02)

- Main menu: «Одиночная игра» and «С коллегами» each have **Продолжить** (with «Этап N/5 · floor title» or «Комната ABCD · …») and **Новая игра**; both buttons are always visible, Continue is disabled without a save. Solo saves the current floor and its entry loadout in `chkn-solo-save` (`src/client/progress.ts`) on every floor start/completion; death keeps it, victory clears it. A new solo game over an existing save needs a second tap. Room Continue rejoins the last code through `/api/rooms/resume`.
- HUD is one top grid (HP+supplies | objective/boss/incident | score; alerts/tips/buffs below the corners) and one bottom-centre stack (radio, support, toast, hint) — panels push each other instead of overlapping. Phones (`.hud.touch`): pause in the top-right corner, weapon panel bottom-right **is** the switch-weapon button (⇄ badge; the separate ⇄ button is gone), ⟳ above it, the action button beside ⟳ with a short label; the centre hint line shows only notes. Portrait stacks the objective under the HP/score row; the camera shows ~11 tiles across. `tools/qa-phone.mjs` checks Galaxy S25 sizes (384×740, 832×330, 832×384) with every slot filled: no overlaps, nothing over the player.
- «Как управлять» popup (drawn touch scheme or keyboard map) opens once before the first fight (pauses solo), from the pause menu and from the main menu. The portrait «rotate» hint appears for 4.5 s at most once per 20 minutes.
- Pause menu: Продолжить / Настройки / Управление / В главное меню; settings are a full sub-page (two columns on short landscape screens).
- Floor 6 server reboot: opening rush of 9, then every 5 s a growing wave, a second direction from 15 s, fat managers from 20 s; live cap 18. A team that keeps shooting meets ~60 attackers in 40 s instead of ~13 (`check:campaign`).

## D56 — No stale builds after deploys

- Each build has an id (`BUILD_ID` or a timestamp) compiled into the client and written to `dist/version.json`. The server sends `index.html`/`version.json` with `no-store`, content-hashed bundles as immutable, everything else `no-cache` + ETag (304 on revalidation). Atlases, maps, LPC data and music are requested with `?v=<build>`.
- On start, and when a menu tab becomes visible again, the client compares its id with `version.json`; on mismatch it reloads once with `?v=<new>` (sessionStorage guard against loops). Covers browser heuristics, Telegram WebView and proxies. Never reloads mid-game or inside a room.

## D57 — Small reasons to play better: floor bonuses, nudges, threat arrows, phone comfort (2026-10-02)

Design pass with the game-director / gameplay-systems / game-UI checklists (`~/.agents/skills/threejs-*`), building on Codex's engagement brief (`docs/design/engagement.md`: alarms, coffee, caches, achievements, preferences — kept as is).

**Brief.** The fantasy stays «вытащить коллег из корпоративного курятника». Gaps found by the fun-factor tests: a good player was not rewarded for *how* they play (headshots, combos, explosions were invisible past the score), phones lost threats outside the narrower view, the invisible floating sticks had no affordance, and quiet stretches had no voice. Non-goals: no new mandatory steps, no changes to story order, floor-6 geometry or difficulty multipliers.

**Floor bonus (`shared/sim/Bonus.ts`).** One optional skill goal per floor, always shown as a quiet line under the objective (`★ … n/goal`, hides 6 s after success), never blocks or punishes. Each teaches one mechanic the floor already has:
| Floor | Goal | Teaches |
| --- | --- | --- |
| 6 office | 25 kills during the server reboot | holding the server room (D55 waves) |
| 7 | 20 headshot kills | aiming at heads (×2) |
| lab | 10 kills by explosions | barrels and chemists |
| factory | combo ×30 | keeping momentum on the conveyor |
| boss | 15 head hits on the director | precision under pressure |
Payout once: +300 KPI to every player, +1 medkit and +1 ammo supply to the living (capped at 3), an achievement. Only player-caused progress counts. Driven by sim events → identical in solo, rooms and checkpoint replay; sent in snapshots (`bn`). Tutorial card «★ Бонус этажа» explains it the first time.

**Achievements** (15 total): the five floor bonuses + «Эффективный менеджер» (combo ×50 anywhere) + «На волоске» (survive a hit at ≤10 HP).

**Nudges (`client/ui/Coach.ts`, client-only flavour, never rules).** «ОКРУЖАЮТ!» alert when ≥6 attackers are within ~4 m (40 s cooldown) with advice to retreat into a corridor; first headshot kill explains ×2; low HP with a medkit tells how to heal (touch vs keyboard wording); an emptied non-pistol weapon points to the infinite pistol; combo banners ×10/×25/×40; hero quips (combo, fat manager, low HP, reload, being surrounded, boss) and companion office jokes after 12 s of calm — all behind «Шутки над петушками», with cooldowns. Phones vibrate on damage/going down (setting «Вибрация»).

**Threat arrows (`client/render/Threats.ts`).** Up to six edge arrows toward attacking chickens outside the view within ~23 m; red and pulsing when close. Setting «Стрелки угроз».

**Phone comfort.** Dashed «БЕГ / ПРИЦЕЛ» ghost circles show where the invisible sticks live for the first three levels (fade on first use or after 14 s). «Левша» swaps the halves. Sticks and the action button release on app switch/blur/touchcancel (no stuck input). «Размер HUD» (compact/normal/large) zooms HUD and buttons; HUD widths are zoom-aware. In portrait only one popup at a time: a tutorial card yields to an alert and returns after it.

**Verification.** `check:campaign` (bonuses: tagged/headshot/combo progress, single payout, achievements, snapshot), all sim checks, engagement/polish/network UI, `tools/qa-phone.mjs` now also runs large-HUD portrait/landscape and asserts a threat arrow and the bonus line are visible without overlaps.

## D58 — The lobby is the main menu with the team on it (2026-10-02)

- User request: choose/change your character in the lobby, see colleagues' characters, host = first in the lobby or its creator and starts the game; another host if they leave; same in Telegram; continue or new game.
- Lobby screen reuses the menu's look: own card (name, «Изменить внешность» → editor → `profile` message), four colleague cards with LPC portraits (`lookPortrait`, cached per look), slot colour, «★ ведущий / готов / не готов / переподключается», achievement count. Empty slots are shown. Sub-screens (editor, achievements, controls) are not redrawn by state patches; the dynamic parts are diffed so typing a name is never interrupted.
- Host = earliest-joined **connected** player (join order kept per seat, also across take-overs). Leadership moves immediately when the host leaves or drops; a returning player does not take it back.
- Host chooses **Продолжить** (`state.saved`, the saved floor caption) or **Новая игра** (second tap confirms when a save exists). Readiness no longer blocks the start: it is a visible hint, late colleagues join the floor. Defeat → «В лобби» keeps the floor-entrance save so the team can continue or restart.
- «Пригласить» shares `/?room=CODE` (system share sheet or clipboard).

## D59 — Seats belong to people, not connections; less traffic, no save stalls

- Every browser profile has a persistent id (`chkn-pid`); a Telegram user's id is `HMAC(server secret, user id)`, the same in the Mini App, the game window and an external browser. Rooms map connections to these ids.
- Closed tab / crash (non-consented leave): the lobby entry lives 25 s for Colyseus reconnection; after that the **world seat stays reserved for the whole floor**. Joining again with the same id gets the same slot, position, loadout and companions (recorded `resume` → deterministic replay). «Выйти» (consented) frees the seat. The client remembers the active room (6 h) and reopening the game goes straight back without clicks; only «Выйти»/«Не надо» forgets it.
- A second connection with the same id (another tab, phone, the browser after Telegram) takes the seat over; the old one gets `replaced` and a «Игра открыта в другом окне / Играть здесь» panel instead of fighting back with reconnects. The 4-player limit is enforced in `onJoin`; Colyseus' own limit is doubled so a reserved reconnection seat never locks its owner out of a full room.
- Joining a running floor: a new colleague drops in fresh; returning to a **dead** character keeps it dead and `benched` (no rally) until the next floor — reconnecting is never a respawn. Loadouts carry by slot, so a reconnect between floors keeps them. Save files store `pids` (slot → id) to restore seats after a server restart; anonymous connections fall back to names.
- Freezes («петушки застывают»): measured 6.4 KB full snapshots × 20 Hz ≈ 1 Mbit/s per client with 66 enemies on floor 7, and a synchronous JSON + write of the whole input tape every 5 s (9 ms at 10 minutes on a fast desktop; several times that on a small VPS, stalling every room). Now: (1) `SnapshotEncoder` sends sticky player/NPC fields (names, looks, inventories, achievements, follow…) and enemy appearances only when changed, with a keyframe every 2 s and on every join/reconnect → 3.9 KB, −40 %; (2) the recording serializes each frame once and appends (0.1 ms) and files are written asynchronously through a per-room queue where the newest operation wins; (3) clients interpolate remote bodies 100 ms in the past between buffered snapshots (with 120 ms extrapolation, teleport/world-restart resets) instead of chasing the newest packet, so late or bunched packets no longer stop chickens. `npm run bench:net` reproduces the numbers.

## D60 — Telegram on a computer: offer the full browser window

- Mini App platforms `tdesktop/macos/web*/unigram`, or the SDK-less game window with a mouse pointer, count as a computer. The menu and lobby show a dismissible banner «На компьютере удобнее в браузере» → `openLink`/`window.open` of `/?tg=<fresh signed token>` (issued with every Telegram session). The browser tab becomes the same Telegram player (same name, same seat key), joins the chat room and takes the seat over (D59); the small window shows «Игра открыта в другом окне». A copy-link fallback covers clients that block opening.

## D61 — Installable app (PWA)

- `manifest.webmanifest` (fullscreen, any orientation, 192/512/maskable icons drawn from the game's own LPC chicken-person — `npm run icons`), Apple touch icon/meta. `sw.js` caches only an offline notice for navigations and is served `no-store`: D56's build ids remain the only cache authority, an installed app never runs a stale build. Not registered inside Telegram.
- Install screen: the browser's own prompt when offered (`beforeinstallprompt`), otherwise iOS/Android/desktop instructions; inside Telegram — open in the browser. Shareable link `/?install=1`; the bot's `/install` posts it; menu button «📲 Установить игру» (hidden when already installed).

## D62 — Telegram: summon the chat, share rare achievements, achievements everywhere

- «📣 Призвать чат» (chat rooms with a configured bot): the bot posts «<name> зовёт всех…» with the room state and a play button (Mini App link when `TELEGRAM_APP_URL`, else the game card); once per minute per room. The bot learns code → chat id when Telegram shows both: the game button's callback (chat_instance + message chat), a signed `chat` in Mini App initData, or the `/app` start parameter of a chat where the bot has seen a command. Stored in `<save dir>/_tg-chats.json`. `TELEGRAM_API` can point the bot at a fake API (tests).
- Nine achievements are `rare`. Earning one in a chat room queues a «→ в чат» button on the floor-complete / victory screen and in the lobby; the server shares only achievements the player really has, rare ones, once per player.
- Achievements are viewable in the main menu, the lobby and the pause menu (shared `achievementsMarkup`; rare ones are labelled).

## D63 — Phone shooting: aim inside the circle, fire at its edge (2026-10-02)

- User report: «sometimes it shoots, sometimes not» (auto-fire only fired when the aim cone found a chicken). Now the right stick aims while it stays inside the inner dashed ring and fires as soon as it reaches the edge (deflection ≥ 0.8), in that direction, whether a chicken is there or not. A gentle ±0.12 rad aim assist remains. The stick turns red while firing; the ghost hint, controls help and tutorial say «до края — огонь».

## D64 — Phone texts in the free corner, smaller

- Incident card, alerts, radio and tips form one small feed: bottom-left above the action buttons in portrait, top-right under the score in landscape (where the screenshots showed free space). Smaller type (radio 10.5 px, four lines at most, speaker inline); the feed clips instead of reaching the centre or the buttons; with an alert or radio on screen the incident drops its subtitle (and its card in portrait). The support/toast/hint stack moves to the right in portrait.
- One pop-up at a time on phones in both orientations: a tip waits for the current alert and radio message. `qa-phone` measures both phases (alert + radio, then tip) at all five sizes.

## D65 — Performance pass: no leaks, faster start

- `npm run qa:perf` (production build, own server, hardware WebGL): two minutes of networked fighting with 67 enemies — 60 FPS, p99 16.8 ms; client heap flat (+1.8 MB after GC), DOM nodes constant, server heap +2 MB (the floor's input recording, released with the floor). No leak found.
- Start-up waste found and fixed: the server sent everything uncompressed (game bundle 1.6 MB raw). Text files now go brotli/gzip, compressed once per build on the thread pool and pre-warmed at start (never blocking rooms). Files requested with the deployed `?v=<build>` are immutable (no 15 revalidation round trips per start). Phaser and the network SDK are separate content-hashed chunks, so game updates do not re-download the engine. Music downloads only after the first touch instead of competing with the start.
- 4G-throttled (9 Mbit/s, 85 ms): cold start 5.8 s → 3.9–4.0 s, 3061 KB → 1517 KB; warm start 1.18 s → 0.78 s.

## D66 — Online fixes from play: traces, silent shots, downed friends, spectating; a livelier floor 6 (2026-10-03)

- **Traces after mutations (online only).** A converted survivor leaves the network snapshot (solo keeps it as `gone` and hides it), but its client view — dark silhouette, warning ring and bar — was never removed. Views of NPCs missing from the snapshot are destroyed now.
- **Shots that hit but were invisible and silent.** Online the `pick` event of a gun arrives before the snapshot listing it; the client looked the gun up in the old list, stored −1 as the selected slot and from then on believed another gun was selected, so it never drew or played its own (still authoritative, still damaging) shots until a manual switch. The pick waits for the snapshot (`pendingWeapon`), and an invalid slot falls back to the current gun. Separately, sound voices are now counted by their scheduled end: `onended` never fires for sources started while the audio context is suspended (app in the background), which could silence a sound for good.
- **Downed teammate.** Rules version 4 (`RULES`): pick-up radius 110 (80 was barely a body width on a phone), bleed-out 15 s. A red/orange ring around the wounded empties over the 15 s, a green ring shows revive progress; teammates get an alert «✚ … ранен!» and the guide arrow leads to the nearest downed teammate; the action button reads «Поднять …».
- **Rules versions in saves.** `RoomCheckpoint.rules` records the rules a floor was recorded with; saves made before (no field = 3) replay with the old radius/bleed-out and the old floor 6, so rooms in progress on the server resume exactly.
- **Spectating.** A dead player's camera follows a living teammate; click / tap / E switches; the label «НАБЛЮДЕНИЕ · следим за …» sits low and small.
- **Floor 6, rules 4.** Three corridor coworkers (courier with pizza, accountant, sysadmin) say a line and turn when the team enters the corridor; three strays come down the corridor every 18 s until the reboot (at most five alive); kitchen 4→6, canteen 10→14, entrance 9→12. When the power returns, the lift hall holds a «планёрка в лифте» (coach, two sales people, an intern taking minutes) that turns into chickens after its last agenda item; the lift leaves only once the meeting is dispersed (the trigger re-arms). Gentle damage/HP multipliers stay.

## D67 — Battery

- Measured (`qa:battery`, phone emulation): the HUD rewrote ~15 texts/classes every frame and threat arrows restyled every frame → 122 style recalculations and 120 layouts per second in a fight; menus and lobby drew an empty WebGL scene 60 times a second.
- HUD and action-button writes only happen on real changes (cached queries, rounded widths/angles); threat arrows update 20 times a second; the renderer sleeps while an HTML menu/lobby is shown and wakes for a game; the game is capped at 60 FPS (120 Hz phones drew twice as many frames).
- Result: fight 38 % → ~22–30 % CPU, style recalcs 122 → 53/s, layouts 120 → 20–26/s; menu and lobby ~3 % → 0.2 %, no frames drawn.

## D68 — Chat lobby «Одиночный режим», a fairer root manager (2026-10-03)

- User request: the chat (Telegram) lobby needs a way back to single player. Chat lobbies show «🎮 Одиночный режим» (leaves the room like «Выйти из комнаты» and opens the main menu with «Одиночная игра»). `check:lobby-ui` clicks it.
- «Рутовый петушок» on floor 7 was too long a fight: rules version 5 halves his HP (2200 → 1100 solo, still ×1.4 per extra player). Saves recorded with rules ≤ 4 replay with the old value.

## D69 — Campaign in three chapters; floors 8, 11, 12 and two city streets (2026-10-03)

User request: four office floors, two streets, three «lab» levels, the final boss; floor 8 horror with a light-hating employee, floor 11 bosses with a meeting and the director, a cafe cutscene on 12 with the falling helicopter, the street to the helicopter and to the «Провансаль» factory where the infection began; comic style, achievements, e2e balance checks. Story and level design: [design/chapters.md](design/chapters.md).

**Order** (`next` chain, captions «Этап N/10»): Глава 1 «Офис» — `office` (6) → `office7` → `office8` → `office11` → `cafe12`; Глава 2 «Город» — `street1` → `street2`; Глава 3 «Провансаль» — `factory` → `lab` → `boss`. Floor 7's lift now only goes up (friends still evacuate); the factory is «Провансаль», its freight lift goes down to the lab, the lab's goes up to the hangar. `LevelScript.chapter` adds a chapter line to the title card; `chapterEnd` shows a banner on the result panel (solo and rooms) and awards `chapter_office` / `chapter_city`.

**Floor 8 «Тёмная тема».** Map ambient 0.94, `stealth` and `redEyes` map props. Sleeping chickens (`dormant`) sit still; they wake when a player comes within 120 or holds a flashlight (aim cone ±0.4, 340 units, line of sight) on them; gunfire in the dark only wakes sleepers within ~35 % of the usual noise radius; a sleeping chicken takes ×2.5 damage (stealth kills; floor bonus «Тихий час»: 10). Red eyes are drawn above the darkness (depth 31), dim while asleep, blinking. The den door has two safety releases in opposite wings that must be pulled within 6 s: two or more players split up; a lone player (also when teammates drop out) gets Неля — she walks to the east release along the corridors (NPC `goto` now follows a flow field) and pulls hers right after the player's. Four scares (printer, a ringing phone answered by a chicken, a light flicker that shows what stands in the corridor, a vent) — achievement «Кто здесь?!» for all four. Валера on a call («Артём, Артём, не слышно тебя!») → breaker → lights for 2 s → he bites the cable → pitch dark → «Петух Тёмной Темы», an elite (see below) that bites and retreats into the dark, is slowed and takes ×1.25 damage while a flashlight is on him, and bolts after 1.1 s in a beam. Lights come back on his death (`World.setLight`, snapshot `am`), the service lift opens, Неля joins the team.

**Floor 11 «Начальство».** Жанна at reception wants three visas, collected in any order (teams can split): finance (clear Борис's department), HR (three satisfaction forms for Ирина — then she mutates into an HR elite spitter), legal (escort Пунктович from the archive to reception; the arrow leads back to him if he falls behind). Then a 75-second board meeting in three themed waves (sales / accounting / security; floor bonus «Регламент»: 30 kills), then the executive director: a large elite with a charge and «делегирование» (eggs that hatch into chicks), support waves; his pass opens his private lift to 12.

**Floor 12, cafe.** No enemies. Lunch (E at the table, or sitting by the window) heals everyone and awards «Бизнес-ланч»; the chef's chicken joke; a helicopter falls past the panoramic windows (client cutscene `cine: heli`, the camera looks at the windows); Капитан Крылов on the radio; down by lift — chapter 1 complete.

**Street 1.** Out of the business centre, along the avenue (abandoned cars as cover), the park, the fountain square. Капитан Крылов needs 60 s on the radio: a defence from every side of the square (bonus «Воздушная тревога»: 35). He names the epicentre — «Провансаль», shop 3 — and leaves his rifle. Side scenes: Ашот's shawarma kiosk («не из курицы»; shotgun + achievement), the grandma feeding a flock in the park (shots nearby wake the chicks; pirozhok + achievement), the courier on a car.

**Street 2.** The road is blocked by a mayonnaise lorry crash: through the market. Тётя Валя opens her back gate only after you «buy eggs» — her crates hatch (pods drawn as eggs on this map). Блогер Стёпа streams the apocalypse as a follower; in the park he may turn on stream (seeded coin toss) — bringing him to the gate human is «Подписка оформлена». At the checkpoint Семёныч wants a pass: his relief Толик is a chicken in the garage; the gate then opens for 40 s while the factory guard attacks (bonus «Санэпидстанция»: 30 kills on the market). Chapter 2 complete.

**Elite chickens** (`ELITES` in `enemyAI.ts`, keyed by the survivor they were): the D52 root-manager behaviour generalised — own melee numbers, a telegraphed charge, optional hit-and-run, flashlight blindness, egg delegation. Elites get the boss bar with their own name (`World.setBoss`, snapshot `bnm`) and a larger body (`ELITE_SCALE`, hit boxes match).

**Other rules-5 changes.** Wide doors open for someone at their far end (a 4-tile door used to stay shut for an NPC walking at its edge). The lab locks the decontamination doors only once every living teammate is past them (a lagging colleague used to be shut out for good in co-op). Story NPCs behind counters are talked to from 130–150 units (`reach`).

**Achievements:** 15 new (6 rare): Тихий час, Светлая тема, Кто здесь?!, Два ключа как в кино, Бюрократ, Регламент, Исполнительный лист, Бизнес-ланч, Офисный выживальщик, Воздушная тревога, Шаурма не из курицы, Цыпа-цыпа, Санэпидстанция, Подписка оформлена, Городская легенда.

**Art** ([ASSETS.md](ASSETS.md)): Skorpio's cars (×1.5, repainted), asphalt with markings, sidewalk, glass facade, street lamp, trash can; [LPC] Trees; LPC fountain, brick, fence, flowers, phones, bar stools, paintings, shopping cart; hand-made helicopter (flying and wrecked), kiosk, market stall, bus stop, billboard, bench, cone, hydrant, breaker, roast chicken, panoramic windows, carpets; four new wall themes (dark, exec, street, cafe). Tall outdoor props fade over the player like walls. New sounds: stinger, phone, sparks, breaker, rotor.

## D70 — Balance by autopilot, not by guess (2026-10-03)

- `tools/sim-play.ts` (`npm run sim:play -- <levels> <players> <runs> <seed>`) plays levels in the authoritative simulation with 1–4 bots that act like a decent human: path-finding along the objective (a different target per bot when the objective lists several), reaction time ~0.22 s and aim error, kiting, self-heal (hold/release E), reviving, grabbing medkits, the best gun with ammo, E at objective terminals/doors/NPCs. Chained levels carry loadouts; `LOADOUT=smg,shotgun` gives a typical carry to a single level. Deterministic per seed.
- Calibration on the existing floors (solo, chained): floor 6 ~0 retries, floor 7 ~1 retry on average (the bot dies to the escort waves and the root manager) — the reference for «tense but fair».
- Tuning done with it: floor 8 Валера 1150 → 2000 HP with evasion (pistol-only bots were winning in 13 s; now 25–40 s with real risk), a night-shift patrol until the den opens, Неля's plan announced at 8 s; floor 11 meeting waves 8+3n → 5+3n every 5 s with a lower cap, director 2600 → 2000 HP, slower support, a medkit drop at half health, more pickups in the boardroom; street 2 gained the market back-gate mission (bots ran through it in 77 s at full HP) and a 40-s gate.
- Bugs it found and fixed: floor 6 objective jumped back to the locked lifts when the open space was cleared late (reachable by humans too); lab co-op lock-out (above); a corridor plant that wedged NPCs and bots; Неля stuck at a wide door; the escorted lawyer falling behind while the arrow still pointed at reception.
- The browser autopilot (`qa-campaign`, simpler than the simulation bot) hid in the street-2 guard booth and died there five times: the gate now opens in 35 s with smaller waves, enemy damage ×0.9 on that street, and the message says not to lock yourself in the booth. The final boss got rules-5 relief (7500 HP solo, claw 28, charge 24, ring 9, reinforcements 4+2·phase+1.5·players every 10/7 s, a trade-union medkit every ~24 s) after the bot lost every attempt even with all guns. Floor 11's director ended at 2300 HP, street 1's defence waves every 3.5 s.
- `npm run check:chapters` (CI) plays the five new floors with two bots inside a room recording and checks that saves taken every 20 s replay exactly. Final matrix: HANDOFF, iteration 12.

## D71 — Feedback round: open lab, weapon picker, jumpers, minigun & laser, mega rooster, back button, finale, level intros (2026-10-03)

User report (12 items). Rules version 6; saves recorded earlier replay with their own rules.

- **Lab trap** no longer locks anyone in: the decontamination alarm and vent wave stay, the doors stay open (rules 6). In co-op a lagging teammate was locked out and the fun stopped.
- **Phone weapon button**: bigger (180×66). A tap takes the next gun; holding it ~⅓ s opens a picker grid (3 columns: icon, name, ammo) — slide onto a gun and let go, or tap one; tapping outside closes it.
- **«Прыгун»** (new enemy type `jumper`, streets only): 95 HP, quicker than an office chicken; from 110–380 units it crouches (hop sound, red flash) and leaps (0.55 s arc drawn above its shadow), landing with a heavy peck (×1.6). Packs of 2–3 arrive every 32–48 s from the first half-minute (not during the helicopter radio defence), a «ПРЫГУНЫ!» notice explains them once.
- **Minigun «Вертушка МЧС»** (street 1): appears by the helicopter wreck when the radio defence starts; 280 rounds, no reserve, ammo boxes do not refill it, it is dropped when spent. **Laser «Омлет-3000»** (lab): Омлетов hands it over on rescue; 70 damage, pierces every chicken in a line, 10 + 20 charges, not refilled by boxes. Weapon keys 1–9 on desktop.
- **Final boss** is a mega rooster now: no wings; a tall five-point comb, double wattles, a golden ruff and a dark-green sickle tail on the CEO's suit, same size as before. 8000 HP solo (rules 6) — the new guns made 7500 too short.
- **Browser / PWA «Назад»**: a history entry is pushed after the first touch; the first back press pauses the game (or only warns in menus) with «Нажмите «Назад» ещё раз, чтобы выйти»; leaving takes a second press (the guard re-arms after 3.5 s). `?nobackguard` disables it for tools.
- **Finale**: on the boss's death — fanfare, letterbox, the camera on the fallen rooster, feathers and confetti for ~6 s, a radio line from Капитан Крылов, then «ПОБЕДА!» with stats, every achievement earned in this run and the credits (solo and rooms).
- **Level intro** on every floor: ~3 s letterbox, the camera glides to the first objective target, a caption «ЗАДАЧА …». It never blocks: any movement or shot ends it at once.
- **Order** factory «Провансаль» → lab → boss was already so since D69 (confirmed by `check:campaign`).
- **Неля**: the team is now who is connected (a downed/dead teammate still counts), so with a partner she names who goes west and who goes east, stays at the lift and never walks to a release; a lone player still gets her help (also when the partner really leaves). Floor-8 horror: every 15–24 s red eyes open in the dark ahead of a player and blink out, knocks behind the wall, a phone rings somewhere, creepy radio lines from Неля, light flickers; a heartbeat plays while a sleeping chicken is close in the dark.
- Found by the browser autopilot: a player kept holding an empty laser (0/0) and «fired» it until the end. Spent limited specials (minigun, laser) are now dropped, and the client puts away any gun with no rounds and no reserve for the best one that still shoots. The browser autopilot itself never healed (held E forever) — fixed like the simulation bot. Jumper packs are smaller (≤3 alive, only when fewer than 14 chickens are around, every 42–58 s, a pause after the helicopter defence).
- Found while re-testing: companions pressed against a wall corner (floor 7, Паша at the lift-hall opening) now walk the corridors to their leader after a second of being stuck (rules 6).
- Checks: `check:chapters` gained the lab (no locks), Неля (duo with a dead partner stays / solo walks), minigun drop, laser reserve, jumper leap and the finale event; `node tools/qa-d71.mjs` screenshots intro, mega rooster, finale, jumpers, minigun, laser and the phone picker (`docs/qa/d71/`).

## D72 — Feedback round: «Уединение», room 87, a blinking Валера, scenes on floor 11, the grandma and the getaway car, Толик, GMO roosters, a fat CEO, chapter summaries, shared guns (2026-10-03)

User report (16 items). Rules version 7; rebuilt floors carry a revision (`LevelScript.rev`): a room save made on an older revision of office7/8/11, street1/2, lab or boss restarts that floor with the loadout the team entered it with (its input tape would replay on a different map). Untouched floors (6, cafe, factory) keep replaying exactly.

- **Floor 7.** Паша plays ping-pong with **Лера** (QA, glasses) — she joins when Паша is rescued. Стас is not there: «ушёл с Катей в переговорку «Уединение»… сказал, дебажить». The tiny room off the Phoenix connector opens with a **button (E)**: a heart-shaped bed, a pegboard of «office toys», fluffy cuffs, posters («50 оттенков серого кода»), a pink lamp. Стас: «Это не то, что вы подумали! Мы… дебажили!»; **Катя** (swimsuit: LPC tank top + short shorts, barefoot) turns into a «debug» chicken — «ДЕБАГ! ДЕБАГ!», 650 HP (+40 % per extra player), faster bites and a lunge, a boss bar. Her fall frees Стас (achievement «Режим отладки»). The bald manager now has a **boss bar** too.
- **Floor 8.** The den has Валера's **card reader**; his pass is in **room 87** (south of the west corridor): Вершков grows «Синеглазка-КУКАРЕКС» under red grow lamps. Entering starts the scene: the beds break and **ботвопетухи** (new type `sprout`: half chicken, half potato plant — leaf crown, green plumage) rise from them; Вершков takes root as a mild mini-boss (850 HP, slow, plants «seedlings» = chicks, an occasional lunge). He drops the pass; picking it up opens the den. Неля's line after the releases explains it. Achievement «Урожай».
- **Валера in the dark** is only two red eyes: with no flashlight on him he **blinks** next to his target every 3–5 s and lunges from the side; a beam (or standing right next to him) shows him and stops the blinking. The client draws him at 6 % opacity unless a player looks at him.
- **Floor 11.** The satisfaction forms are **visible pickups** now (a sheet with a glow; they were invisible `use` points). Each has a scene: a headhunter hatching a form like an egg among sleeping candidates (chicks hatch), a karaoke corporate party in the west corridor, a notary chicken reading a form aloud to a jury. More chickens on the floor: bigger finance/legal groups, four more in HR, stragglers every 15 s (was 20) in groups of 3+players.
- **Meeting waves ×2** in packs: each of the three departments arrives as a burst (interval 0.12 s) plus a heavy second burst 4 s later (armored, fat, exploders); the trickle keeps up to 16+5×players; one extra medkit at the table.
- **Chapter summaries.** Each chapter's last floor (cafe 12, street 2, the hangar) ends with a mini summary per player: kills, headshots, downs, help given, best combo, mini-bosses finished off, achievements of the chapter, scripted funny moments («Открыл(а) переговорку «Уединение» без стука», «Съел(а) бабушкин пирожок за минуту до того, как бабушка рассыпалась на курочек»…) and light titles («Санитар леса», «Любимец петухов», «Корпоративная медсестра», «Пацифист квартала»…). Statistics never affect the rules; they ride the carry (`stats.run`/`stats.chap`). **Stored**: the chronicle of a run is in the carry (so a Telegram room keeps it in its save), every client also keeps the summaries it saw in `localStorage` — main menu and lobby «📜 Летопись».
- **Street 1.** Бабушка Зина has 24 chicks in two rings and keeps feeding them (grain, lines). 12 s after her pie (or 45 s in the park) she **crumbles into fierce hens** (5+2×players fast chickens with her face) and the flock wakes. After the helicopter the way south leads to the VIP parking lot «Элит-Авто»: **Литовец** («Всю жизнь мечтал угнать такую!») gets into a yellow sports car, drives through the sleeping flock in the lane (runs it over) and through the **fence** onto the road to the market; the team follows (achievement «Угнать за 60 секунд»). The sim has scripted vehicles now (path, speed, run-over band, people step aside; parked = collider; snapshots carry them).
- **Street 2.** 18 more eggs on the market trays (24 in all), they hatch with Тётя Валя's. **Толик** is a mini-boss (950 HP): keeps a throwing distance and lobs **beer bottles** that fly over heads and shatter where they land (14 damage around, three at once below half HP), a smoke cloud rises from him, «Ик!», «Перекур окончен!»; at half HP he calls the garage mates. Achievement «Трезвый взгляд».
- **Specials from mini-bosses**: an elite chicken (Катя, root manager, Валера, Вершков, director, Ирина, Толик) drops a part-loaded **minigun (140) or laser (10)** with a 60 % chance; it tops up the one you carry or is yours with that much.
- **Lab.** Every incubator slot holds an egg now (32), some hatch **GMO roosters** (new type `gmo`: 380 HP, armour 20 %, 24 damage, lime with violet flecks); the middle and far sections add hatch waves. The generator restart brings GMO packs at 6 s and 22 s. «Без ГМО» for five of them. If Омлетов dies before his rescue, his card and the laser stay and the floor goes on (an old latent freeze, found by the autopilot).
- **Shared guns and ammo in a team (rules 7):** a weapon or ammo box lying on the floor is taken by every player once (a bit mask per pickup, also in snapshots; the client hides what you already took). Bonuses (buffs, medkits, armor) stay first-come.
- **The CEO** is a fattened yellow rooster: yellow plumage, a round belly over the suit, a golden tail, drawn 1.3× wider (hit box to match), radius 66, 10 000 HP solo (8000 in D71; mini-bosses now hand out miniguns and lasers), claw 30, charge 26, ring 10. Tried 11 000 / 32 / 28 first: the browser autopilot (which stands in melee) lost seven times in a row — eased. Achievement «Разгрузочный день». The trade-union medkit finally works (issue #4: its timer was never started).
- **After the victory**: the chapter 3 summary plus **personal statistics for the whole run** (kills, headshots, damage dealt and per shot, damage taken, downs, revives, help, best combo, close calls, barrel kills, floors, time in combat, mini-bosses, moments) and the team in short.
- **New rooms** never offered «Продолжить» (the server gives a fresh code), but the host line said «выбираете, продолжить или начать заново» in a brand-new room — now it says that a new game starts with «Начать». Telegram chat rooms keep their save and always offer «Новая игра» next to «Продолжить».
- **Issue #3 (phone weapon picker)**: its tiles inherited `pointer-events: none` from `.hud *`, so a tap hit the picker, not a tile — the picker closed without selecting. Tiles take touches now and are hit-tested by their rectangles; a tap selects on release. Also #2 (help says 1–9 and Q), #5 (help shows the left-handed layout when it is on), #6 (action/reload sit clear of the 66-px weapon panel).
- Found while testing: the parking flock woke up from the helicopter defence's gunfire and joined it (+14 chickens; the browser autopilot died there five times) — they are deep sleepers (`deaf`: noise never wakes them) until the car; street lamps on the side street's east sidewalk left a pocket against the wall (moved off the wall); the getaway car's run-over band widened after wandering sleepers slipped past it; the level intro caption sits inside the letterbox bar (it covered the radio feed); the mutation toast is gender-neutral («Катя — теперь курица!»).
- Checks: `check:chapters` (+ shared pickups, mini-boss drops, Валера's blink in the dark / none in a beam, Толик's bottles, the getaway car through the fence, chapter summary + carried stats/chronicle, old-revision save restart, floor-11 forms and scenes), `check:campaign` (Катя and Стас), `check:levels` (button door, Валера's pass, forms as pickups, the fence breach), `check:lobby-ui` (a new room has nothing to continue); `node tools/qa-d72.mjs` screenshots in `docs/qa/d72/` and taps the phone picker for real.
