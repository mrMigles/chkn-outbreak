# Iteration 6 verification — 2026-10-02

Reported fixes: NPC gait/idle, busier floor seven and stronger root, Castor siege/Елена/pass, lingering mutation graphics, inconsistent barrels, missing death panel and current-floor retry.

## Passed

- Production TypeScript/Vite build.
- Six-scene Chromium/WebGL smoke loaded arena, office, office7, lab, factory and boss without page/console errors.
- `check:polish`: distance-based gait at 30/60/120 FPS, stationary/jitter/teleport idle, five-follower settling, barrel top/base shots, chained explosions and no inert red hazard props.
- `check:coop`: 18 authoritative support, mutation, betrayal, death and key scenarios. `check:combat`: 10 hitbox/AI/support/weapon/reach scenarios.
- `check:levels`: all six maps, story paths, doors, triggers, people and pickups. Art check: 46 actor layers, 126 props.
- `check:campaign`: siege/locked rescue, Елена handover mutation and pass drop, real door interaction, five rescues, root charge hurting a player, trophy/escort/lab, blackout corridor waves, four buffs and exact version-two disk replay/timers on all six maps.
- `check:progress`: actual team wipe waits without auto-restart; host retry at current-floor entrance; living room disposal and server restart resume position/inventory; version-one save migrates to current-floor entrance; invalid path rejected.
- `check:polish-ui`: real keyboard walking, NPC idle pose, mutation-warning disappearance, actual solo death/retry, room death/reconnect/host retry and host departure during defeat. No page errors. See [ui-report.json](ui-report.json), [mutation-cleared.png](mutation-cleared.png), [solo-death.png](solo-death.png), [room-death.png](room-death.png).
- SDK networking: room membership/capacity, movement/appearance, authoritative support, disconnect/reconnection and host transfer. Telegram checks: five passed, including signed launch links.
- Browser campaign: complete floor seven in 223 seconds, 141 player kills, five friends escorted, root trophy collected, transition to lab. No deaths/retries or page errors; one transient autopilot navigation nudge. See [campaign report](campaign-fixed/report.json) and [completed floor](campaign-fixed/office7-done.png).

The first browser attempt found siege enemies distracted by protected idle NPCs and an objective fixed at an empty doorway. Waiting story NPCs are now excluded from enemy targets and the siege guide follows remaining tagged attackers; the next run completed the route.

## Limits

The browser campaign used god mode to verify the entire objective route while shooting enemies normally with the pistol; it is not a normal-damage difficulty measurement. Damage/charge and death recovery are covered separately. No new real-phone or four-human internet playthrough was performed. Software WebGL smoke timing is not a hardware performance benchmark.
