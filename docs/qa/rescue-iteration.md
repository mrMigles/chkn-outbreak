# Rescue / persistent rooms — 2026-10-02

The branch was rebased onto `origin/main` at `891b054` before final verification. User references guide office geometry/colours; existing docs are design context, not an instruction to implement unrelated planned packages.

## Automated checks

| Check | Result |
|---|---|
| `npm run build` | TypeScript + production Vite build pass; 74 modules, ~435 KB gzip main bundle |
| `check:coop` | 18 scenarios, including more frequent, staggered non-story betrayals |
| `check:combat` | 10 scenarios, headshots/companions/pickups/first-office balance |
| `check:levels` | All six maps; story goals, five friends, pickups, doors and reachable spawners |
| `check:art` | 46 pinned LPC layers, atlas bounds, 126 furniture frames, all map props supported |
| `check:campaign` | Four buffs including empty-ammo firing, grenade damage and expiry; five rescues, manager, trophy, actual escort; generator corridor waves; exact saved-world replay and pending timers on all six maps |
| `check:progress` | Real isolated server: team wipe returns to the last position with ≥60 HP; disposal + server restart + original room code preserve floor/position/inventory; invalid code rejected |
| `check:network` | Two/four SDK clients, readiness, appearance, revival, reconnect, mutation, late join, player cap and host transfer |
| `check:network-ui` | Two real app pages: lobby, real held E revival to 45 HP, progress display and automatic reconnect with same inventory |
| `npm run smoke` | Production build, all six scenes, no browser errors (software rendering) |
| `check:telegram` | Four chat-room/name/lobby checks pass; signed game-link checks skipped in this local run without SESSION_SECRET (CI configures it) |

## Browser evidence

- [Full floor-7 story report](rescue-verified/report.json): production build, real menus/guide/combat/next-level UI; all five friends, manager, trophy, lift and lab transition completed in 81 seconds, zero retries, zero stuck periods, 18 player kills, no browser errors. God mode isolates story navigation from damage balance.
- [Normal-damage run](rescue-normal/report.json): same complete floor with the starting pistol and actual pickups, no god mode or full arsenal; 79 seconds, zero deaths/retries/stuck periods, minimum HP 80.8 at the level-end event, 15 player kills, no browser errors. The old report's top-level `minHp` resets on entering the lab; use the `LEVEL DONE` log for that run. The QA recorder now captures health before changing levels.
- [Office palette / escort](rescue-verified/office7-004.png), [manager battle](rescue-verified/office7-010.png), [completed rescue](rescue-verified/office7-done.png).
- [Armed animation contact sheet](armed-fixed_sheet.png): eight directions, idle and walking.
- Mobile emulation: 915×412, 412×915, 740×360; screenshots include simultaneous four buffs and trophy. [Landscape](rescue-mobile-land-game.png), [portrait](rescue-mobile-port-game.png), [small landscape](rescue-mobile-small-game.png). These are browser emulation, not a physical phone.
- [Two-player support](coop-ui-support.png), [reconnected player](coop-ui-rejoined.png).

Hardware WebGL short boss fight (Intel UHD / ANGLE D3D11): 661 measured frames, p50 16.7 ms, p95/p99 16.8 ms, two frames >50 ms, maximum 433.3 ms around boss arrival. This short sample does not establish frame stability during every large wave. Subsequent loading now also precomposes the new comic enemy looks before gameplay.

Room checkpoints are recordings for this simulation version; future rules/map changes must preserve replay compatibility or increment the version. Full manual campaign completion, real-phone performance and four people over the internet were not tested.
