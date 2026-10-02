# CHKN OUTBREAK

Arcade shooter in the spirit of *Alien Shooter* — but your coworkers are turning into chicken-people. Three-quarter-view 2.5D on every level.
Phaser 3 · TypeScript · Vite · Tiled · Colyseus · HTML/CSS menus. Works in desktop and mobile browsers and inside Telegram, 1–4 players.

## Quick start
```bash
npm install
npm run dev          # client on http://localhost:5280
npm run server       # Colyseus server on ws://localhost:2580 (multiplayer / Telegram only)
```
Solo play needs only the client (the simulation runs in the browser).

## Developer mode
Open `http://localhost:5280/?dev=1` (or tap the logo five times; `?dev=0` turns it off). The main menu gets a DEV box:
any level, «Бессмертие», «Всё оружие»; «Создать комнату» starts multiplayer from the chosen level. In a solo game:
F6 god mode · F7 every weapon · F8 kill all enemies · F9 complete the level. `?level=<id>` still jumps straight into a level.

## Server and Docker
One image runs the game server and serves the built client on the same origin (port 2580).
```bash
docker compose up -d                 # image from GitHub Container Registry (built by CI)
docker compose up -d --build         # or build locally
```
Health check: `GET /healthz`. CI (`.github/workflows/docker.yml`) runs the typecheck, the headless checks, a production build,
the network/Telegram checks against a real server, then builds and pushes `ghcr.io/<owner>/chkn-outbreak` (`latest` on `main`, short SHA, tags).

Room progress is saved under its code every five seconds and when the room closes. If everyone dies, the death screen waits for the host to restart the current floor from its entrance and entry loadout. Leaving a living room or restarting the server still preserves its actual progress. Use «Продолжить последнюю комнату» or enter the original code, then start from the lobby. Saves include the current floor, inventory, companions, enemies and story events. Docker keeps them in the `chkn-progress` volume; outside Docker the default is `data/rooms` (`CHKN_SAVE_DIR` overrides it). Victory clears the room save. Older version-one saves retain their code, floor and entry loadout, but restart that floor because their input recording uses obsolete rules.

**Lobby and seats (D58–D59).** The lobby looks like the main menu: your card (name, «Изменить внешность»), your colleagues' portraits, achievement counts and readiness. The host is whoever joined first; when the host leaves or drops, the next connected player leads at once. The host chooses **Продолжить** (the saved floor) or **Новая игра**; readiness is only a hint. Colleagues can join a running floor as fresh employees. Every browser profile (or Telegram user) has a persistent player id: closing the tab, crashing or reopening the game later goes straight back to the same seat, position and loadout (the seat stays reserved for the whole floor; only «Выйти» gives it up). Opening the game in a second window/browser moves the seat there and tells the old window. Coming back to a character that died waits for the next floor.

**Install as an app (D61).** The game is a PWA: «📲 Установить игру» in the menu, or share `https://<host>/?install=1` (the bot's `/install` posts it). The service worker caches nothing but an offline notice, so installs never run stale builds.

Options go into `.env` next to `docker-compose.yml`:

| variable | default | |
|---|---|---|
| `CHKN_PORT` | `2580` | published port |
| `TELEGRAM_BOT_TOKEN` | — | bot token from @BotFather. Enables the bot and checks the signature of Telegram `initData` (without it initData is trusted — development only) |
| `TELEGRAM_GAME` | `chkn` | short name of the HTML5 game from @BotFather `/newgame` |
| `PUBLIC_URL` | — | public **https** address of the game (the game button opens it) |
| `TELEGRAM_APP_URL` | — | Mini App direct link `https://t.me/<bot>/<app>` from @BotFather `/newapp`; enables `/app` |
| `SESSION_SECRET` | bot token | signs game links; keep it stable across restarts |

### Telegram: the chat is the room
Add the bot to a group and write `/play`: the bot posts the game card «Играть». Everyone in the chat who presses it lands in
**that chat's room** under their Telegram name (the room code is derived from the chat, so it is always the same room). The same works
for the Mini App: opened from a chat (`/app` link with the chat as start parameter, attachment menu or the bot's menu button) it joins
the chat room straight away. Opened outside a chat, the player gets a personal room. Inside Telegram the game goes fullscreen,
the header «Назад» pauses / leaves the lobby, and taking damage vibrates.

Everyone from the chat lands straight in its lobby (or in the running floor). In the lobby **«📣 Призвать чат»** makes the bot post an
invitation with a play button (once a minute). Rare achievements (marked «редкое») can be told to the chat from the result screen
after a floor. On a computer Telegram opens a small window: a banner offers **«Открыть в браузере»** — the browser tab gets the same
Telegram identity and seat, the small window steps aside. The bot learns which chat a room belongs to from the game button or a
Mini App opened in the chat; `/play` once in the chat is enough. Commands: `/play`, `/app`, `/install`.

BotFather setup: `/newbot` → token; `/newgame` → short name (= `TELEGRAM_GAME`) with the game URL = `PUBLIC_URL`;
optionally `/newapp` (Mini App, URL = `PUBLIC_URL`) → `TELEGRAM_APP_URL`; `/setinline` to offer the game in any chat via `@bot`.

## Scripts
| command | what |
|---|---|
| `npm run dev` | Vite dev server (client) |
| `npm run server` | Colyseus game server (tsx watch, QA debug messages) |
| `npm run build` | typecheck + production build to `dist/` |
| `npm start` | production server: Colyseus + serves `dist/` on :2580 |
| `npm run assets` | regenerate all textures/atlases from `vendor/` + `tools/art` |
| `npm run maps` | compile `tools/levels/*.ts` → Tiled maps in `public/assets/maps` |
| `npm run check:combat` | hit boxes/headshots, NPC fire, companions, off-screen spawns, destructibles, table pickups |
| `npm run check:coop` | authoritative support/mutation/death regressions |
| `npm run check:campaign` | all five rescues, manager/trophy/escort, buffs, generator waves and exact room replay on six maps |
| `npm run check:progress` | team wipe, empty-room disposal and real server restart preserve progress |
| `npm run check:polish` | distance-based gait, stationary followers and explosive barrel hitboxes/chains |
| `npm run check:polish-ui` | real-browser idle/walk, mutation cleanup and solo/room death panels; debug server required |
| `npm run check:levels` | story-order flood fill, pickups within reach, every door walkable |
| `npm run check:art` | source hashes, atlas bounds, direction/frame completeness |
| `npm run check:network` | real Colyseus clients; requires `npm run server` |
| `npm run check:telegram` | chat rooms via the Telegram endpoints; requires a server (`SESSION_SECRET` for the game-link part) |
| `npm run check:network-ui` | two app browser pages: menus, keyboard E revival and automatic reconnect |
| `npm run check:lobby` | self-contained (own server + fake Telegram API): host election, profiles, continue/new, closed-tab seat recovery, window takeover, dead seats, mid-floor join, summon, achievement sharing, `/install`, delta snapshots, PWA files |
| `npm run check:lobby-ui` | real browsers on the production build (own server): lobby portraits, look change, reopen-to-seat, pause achievements, Telegram desktop → browser hand-over, install page/service worker, phone lobby |
| `npm run bench:net -- office7 10` | snapshot traffic full vs delta and room-save cost on a long floor |
| `npm run icons` | PWA icons from the LPC chicken-person |
| `npm run smoke` | short fights in all six scenes |
| `node tools/qa-campaign.mjs <dir> [levels] [mobile]` | E2E autopilot through the campaign via the real UI (objective arrow, E, «Дальше») |
| `node tools/qa-gun.mjs <prefix> [look]` | close-ups of the armed pose in 8 directions |

Browser QA accepts `SMOKE_URL`, e.g. `http://localhost:5281`. Network QA accepts `TEST_SERVER` (default `ws://localhost:2580`).

## Layout
```
src/shared/      Phaser-free simulation used by browser (solo) and server (multiplayer)
  sim/           World (authoritative game state), enemy AI, NPC AI, hit boxes, event types
  levels/        level scripts (story, triggers, waves, objective targets)
  map.ts nav.ts  Tiled map parsing, collision, raycasts, flow-field pathfinding
  weapons.ts enemies.ts props.ts   gameplay data
src/client/      Phaser game: rendering, FX, lighting, audio, input, HUD, menus, Telegram
server/          Colyseus room, Telegram endpoints and bot
tools/           asset generator (tools/art), map compiler (tools/levels → .tmj), checks and QA
vendor/          Kenney legacy art + public LPC sources and selected credits
docs/            DECISIONS, HANDOFF, ASSETS, plans
```

## Controls
- Desktop: WASD move · mouse aim (heads take double damage) · LMB fire · R reload · E interact / tap to share ammo, hold to heal or revive · wheel / 1–7 weapons · Esc pause
- Mobile: left stick move · right stick aim (auto-fire when a chicken is in the sights) · context button
- The yellow arrow at your feet and the objective panel point along the path to the current goal.

## Levels
Office «Курникс Групп», floor 6 → floor 7 (clear the siege outside locked Castor; office administrator Елена mutates before handing over its pass; defeat her and unlock Андрей/Серёга, gather Влад, Стас and Паша, escort everyone past the charging bald manager and collect «Рутовый петушок») → dark lab of project «ЯЙЦО» → «Курникс-Агро» plant → hangar boss «Генеральный Петух». The separate `arena` remains the weapon sandbox.
Strong enemies sometimes drop ten-second invincibility, triple damage, infinite ammunition or sprint buffs. Non-story companions can turn more frequently; the named floor-7 friends safely evacuate before the lab.
Maps are Tiled JSON (`public/assets/maps/*.tmj`, editable in Tiled) compiled from `tools/levels`.

## Testing hooks
- `?loop=timeout` keeps the game loop running in a hidden/background tab.
- `window.__input = { fire, mx, my, aimX, aimY, slot, interact }` overrides input (automation).
- `window.__game`, `window.__app` debug handles.

## Credits
Public LPC office/object/structure packs, Universal LPC character layers (walk, hurt, thrust) and Chicken Rework, adapted by this repo's tools. Sources and chosen licenses are recorded in [ASSETS](docs/ASSETS.md); [in-game credits](public/credits.html) are linked from the menu. Music: CC0 tracks by Juhani Junkala. No AI-generated images were used.
