# CHKN OUTBREAK

Arcade shooter in the spirit of *Alien Shooter* — but your coworkers are turning into chicken-people. The office now has a first three-quarter-view 2.5D prototype.
Phaser 3 · TypeScript · Vite · Tiled · Colyseus · HTML/CSS menus. Works in desktop and mobile browsers, 1–4 players.

## Quick start
```bash
npm install
npm run dev          # client on http://localhost:5280
npm run server       # Colyseus server on ws://localhost:2580 (multiplayer only)
```
Solo play needs only the client (the simulation runs in the browser).

## 2.5D redesign in progress

The office uses public LPC sprites, directed bodies, separate freely aimed weapons, furniture facades and floor-based depth sorting. E now shares ammunition on a tap and heals/revives on a hold. Players stay human; NPCs mutate in stages and armed companions can betray the team. Shooting, movement and weapon balance retain the original pace.

This is the first iteration: other levels still use legacy art, the new arena wave controller is pending, and the office needs further art/occlusion acceptance. See [verification and limitations](docs/qa/office-iteration.md).

- [Implementation plan](docs/PLAN-2.5D.md)
- [Tasks, dependencies and ownership for multiple agents](docs/TASKS-2.5D.md)
- [Asset sources and adaptation register](docs/ASSETS.md)
- [User visual reference](docs/references/chkn-2.5d-reference.png)

## Scripts
| command | what |
|---|---|
| `npm run dev` | Vite dev server (client) |
| `npm run server` | Colyseus game server (tsx watch) |
| `npm run build` | typecheck + production build to `dist/` |
| `npm run assets` | regenerate all textures/atlases from `vendor/` + `tools/art` |
| `npm run maps` | compile `tools/levels/*.ts` → Tiled maps in `public/assets/maps` |
| `npm start` | production server: Colyseus + serves `dist/` on :2580 |
| `npm run shot` | headless WebGL screenshot (QA) |
| `npm run bot` | headless co-op bot joins a room by code (QA) |
| `npm run check:coop` | authoritative support/mutation/death regressions |
| `npm run check:network` | actual Colyseus clients; requires `npm run server` with debug enabled |
| `npm run check:network-ui` | two app browser pages: menus, keyboard E revival and automatic reconnect |
| `npm run check:art` | source hashes, atlas bounds, direction/frame completeness |
| `npm run check:office` | controlled WebGL fight, help HUD and five viewport checks |
| `npm run smoke` | short fights in all five scenes |

Browser QA accepts `SMOKE_URL`, e.g. `http://localhost:5281`. Network QA accepts `TEST_SERVER` (default `ws://localhost:2580`). Controlled QA uses debug inputs and is not a campaign playthrough.

## Layout
```
src/shared/      Phaser-free simulation used by browser (solo) and server (multiplayer)
  sim/           World (authoritative game state), enemy AI, NPC AI, event types
  levels/        level scripts (story, triggers, waves)
  map.ts nav.ts  Tiled map parsing, collision, raycasts, flow-field pathfinding
  weapons.ts enemies.ts props.ts   gameplay data
src/client/      Phaser game: rendering, FX, lighting, audio, input, HUD, menus
server/          Colyseus room running the shared simulation
tools/           asset generator (tools/art), map compiler (tools/levels → .tmj)
vendor/          Kenney legacy art + public LPC sources and selected credits
docs/            DECISIONS, HANDOFF, STYLE
```

## Controls
- Desktop: WASD move · mouse aim · LMB fire · R reload · E tap to share ammo/interact, hold to heal/revive · wheel / 1–7 weapons · Esc pause
- Mobile: left stick move · right stick aim (auto-fire when a chicken is in the sights) · context button

## Levels
Office «Курникс Групп» → dark lab of project «ЯЙЦО» → «Курникс-Агро» plant → hangar boss «Генеральный Петух».
Maps are Tiled JSON (`public/assets/maps/*.tmj`, editable in Tiled) compiled from `tools/levels`.

## Testing hooks
- `?loop=timeout` keeps the game loop running in a hidden/background tab.
- `window.__input = { fire, mx, my, aimX, aimY, slot }` overrides input (automation).
- `window.__game`, `window.__app` debug handles.
- `?level=<id>` starts a level directly (office, lab, factory, boss, arena).

## Credits
Office prototype: public LPC office/object/structure packs, six selected Universal LPC character layers and Chicken Rework, adapted by this repo's tools. Sources and chosen licenses are recorded in [ASSETS](docs/ASSETS.md); [in-game credits](public/credits.html) are linked from the menu. Legacy art includes Kenney Top-down Shooter (CC0) and repo-created weapons/props/FX. Audio remains procedural. No AI-generated images were used in this iteration.
