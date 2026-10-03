# CHKN OUTBREAK — рабочая памятка для агентов
<!-- Та же памятка лежит в AGENTS.md для других агентов. Меняете одно — обновите и другое. -->

2.5D кооп-шутер (Phaser 3 + Colyseus, TypeScript). Офис → город → завод «Провансаль», петухи-мутанты.
Пользователь пишет по-русски — **отвечать по-русски**. Решения принимать самостоятельно и **каждое записывать** в `docs/DECISIONS.md`.

## Где что лежит

| Что | Где |
|---|---|
| Журнал решений (D1…D72, новые — в конец, `## D73 — …`) | `docs/DECISIONS.md` |
| Передача контекста по итерациям (новая — сверху: `## Iteration N`) | `docs/HANDOFF.md` |
| Сюжет и уровни по главам | `docs/design/chapters.md`, `docs/design/engagement.md` |
| Источники и лицензии графики | `docs/ASSETS.md`, `public/credits.html`, `vendor/*/` |
| Скриншоты QA (по итерациям) | `docs/qa/<итерация>/` |
| Симуляция (авторитетная, детерминированная) | `src/shared/sim/World.ts`, `enemyAI.ts`, `npcAI.ts`, `types.ts`, `Checkpoint.ts`, `support.ts` |
| Сценарии уровней (скрипты) | `src/shared/levels/<id>.ts`, порядок — поле `next`, список — `levels/index.ts` |
| Карты уровней (исходник) | `tools/levels/<id>.ts` (Painter: ASCII-сетка + объекты) → `public/assets/maps/<id>.tmj` |
| Враги / оружие / пропсы / ачивки | `src/shared/enemies.ts`, `weapons.ts`, `props.ts`, `achievements.ts`, хитбоксы `sim/hitbox.ts` |
| Внешность персонажей | `src/shared/look.ts` (пресеты), `src/client/render/compose.ts` (сборка слоёв, мутанты) |
| Сеть | `src/shared/protocol.ts` (снапшоты), `server/GameRoom.ts`, `src/client/net/NetSession.ts` |
| Клиент | `src/client/scenes/GameScene.ts`, `render/Actors.ts`, `render/Fx.ts`, `ui/App.ts`, `ui/Hud.ts`, `styles.css`, `audio/Sfx.ts` (процедурные звуки) |
| Арт-пайплайн | `tools/build-assets.mjs`, `tools/art/*.mjs` |
| Боты, проверки, QA | `tools/` (см. ниже) |

## Обязательные правила при изменениях

1. **Детерминизм и версии правил.** Комнаты сохраняются как запись входов и переигрываются. Любое изменение поведения в `World`/AI, которое трогает старые сохранения, прячь за `w.rules >= N` и подними `RULES` в `src/shared/sim/support.ts` (с комментарием, что изменилось). В симуляции нельзя `Math.random()`, только `w.rng`.
2. **Перестроил карту или сюжет уровня** → подними `rev` в `LevelScript` этого уровня. Тогда старые сохранения комнат на нём начнут этаж заново с входным снаряжением, а не будут переигрываться на другой карте.
3. Позиции в `tools/levels/*.ts` указываются **в тайлах**, а в скриптах (`addPickup`, `spawnEnemy`, `x/y`) — **в пикселях**: тайл = 64.
4. Настенный декор (`wall: true` в арте) ставь на строку **сразу под стеной** (`y = стена + 1.1`), иначе фасад стены его перекроет.
5. Объекты из карты доступны в скрипте через `w.object(name)` и `w.objects(type, name)`. Персонажи — через `w.npc(id)`. Цель с указателем задаётся `w.setObjective(текст, цель)`.
6. После правок кода — **тесты и скриншоты** (ниже), потом коммит. Пуш в `main` — только если пользователь просит. Рабочая ветка — `codex/office-25d-coop`. `main` обновляется перемоткой: `git push origin HEAD:main`.
7. Если в окружении есть Bash: большие правки через heredoc ломаются на кавычках. Скрипт или патч сначала пиши в scratchpad через Write и запускай оттуда.

## Сборка и запуск

```bash
npm run dev          # клиент Vite на :5280 (HMR)
npm run server       # сервер Colyseus на :2580 (--debug, watch)
npm run maps         # tools/levels/*.ts -> public/assets/maps/*.tmj (после правки карт)
npm run assets       # атласы и метаданные (после правки арта или пресетов-слоёв)
npm run build        # typecheck + vite build
```

- После правки `server/` или `src/shared` сервер без watch нужно перезапустить. Сетевые проверки на старом процессе дадут ложные результаты.
- Первый запуск Vite оптимизирует зависимости и перезагружает страницу. Из-за этого первый e2e-прогон может выдать ложное «поражение», запусти ещё раз.
- Встроенный браузер панели часто не поднимает WebGL (`Framebuffer incomplete`). Для визуальных проверок используй Playwright со swiftshader.

### URL-параметры и хуки для тестов

- `?level=<id>` — сразу одиночная игра на уровне (`office, office7, office8, office11, cafe12, street1, street2, factory, lab, boss, arena`).
- `?loop=timeout` — игра тикает и в скрытой вкладке (обязательно для Playwright).
- `?nobackguard` — отключает перехват кнопки «Назад».
- `?help` — показывать стартовую справку и под webdriver.
- `localStorage['chkn-settings'] = {"tutorials":false,"seenTips":["controls","move"],"dev":true,"devGod":true}` — без туториалов, DEV-режим, бессмертие. В соло в DEV-режиме: F6 бессмертие, F7 всё оружие, F8 убить всех, F9 пройти уровень.
- `window.__game.scene.getScene('game').session.world` — живой `World` в соло: можно телепортировать (`p.x = p.input.x = …; p.tp++`), вызывать `w.script.onUse(w, id, p)`, `onTrigger`, `spawnEnemy`, `killEnemy`, `completeLevel`, `setLight`.
- Чтобы пропустить вступительную кат-сцену уровня: `sc.introState = 'done'; sc.cineFocus = null`.
- `window.__input = { fire, mx, my, aimX, aimY, slot }` — ввод из теста. Прицел задавай через `aimX`/`aimY` в мировых координатах; `p.input.aim` клиент перезапишет на следующем кадре.
- Касания на телефоне — только через CDP (`Input.dispatchTouchEvent`), а контекст создавай с `devices['Pixel 7'], hasTouch: true`. Пример в `tools/qa-d72.mjs`.

## Тестирование

### Быстрые проверки без браузера (как в CI, `.github/workflows`)

```bash
npm run typecheck
npm run check:combat
npm run check:campaign
npm run check:polish
npm run check:engagement
npm run check:progress
npm run check:coop
npm run check:levels
npm run check:floor6
npm run check:chapters
npm run check:art
npm run build
npm run check:lobby
```

- `check:levels` проверяет проходимость сюжета на каждой карте. Новая запертая дверь или проход описывается в `STORY` в `tools/check-levels.ts`: кто открывает какой замок. Пролом в пропсах задаётся как `lock: 'prop:<имя>'`.
- `check:campaign` проверяет сюжет 7 этажа, порядок кампании и переигрывание сохранений всех уровней.
- `check:chapters` — два бота проходят новые этажи в записи комнаты (сохранения переигрываются точно), плюс точечные сценарии по итерациям D71/D72. Новые сценарии добавляй в конец файла. `SKIP_BOTS=1` пропускает долгую часть с ботами.

### С сервером (`npx tsx server/index.ts --debug` на :2580)

```bash
npm run check:network
npm run check:telegram
npm run check:chapters-net
```

### С клиентом и сервером (Playwright)

```bash
npm run check:lobby-ui
npm run check:network-ui
```

### Баланс: автопилот в симуляции (быстрее реального времени)

```bash
npx tsx tools/sim-play.ts office,office7,office8,office11,cafe12,street1,street2,factory,lab,boss 1 5 1
```

Аргументы: `<уровни через запятую> <игроков 1-4> <прогонов> <seed>`. Уровни проходятся цепочкой с переносом снаряжения.

- `LOADOUT=smg,shotgun` — стартовое оружие, когда уровень проверяется отдельно.
- `RULES=6` — сравнение со старыми правилами.
- `LOG=1` — таймлайн целей; `TRACE=1` — позиции ботов каждые 5 с.

В выводе по каждому уровню: WIN/FAIL, время, retries (поражения в соло), minHp, stuck. Матрицу «соло 5 / дуэт 4 / квартет 3» гоняй в фоне параллельно и сводку клади в HANDOFF. Если бот застрял навсегда, сначала проверь, баг ли это игры (карман у стены, зависшая цель), а не только бота.

### E2E в настоящем браузере (Playwright, нужен `npm run dev`)

Перед этим запусти `npx playwright install chromium`, если браузера нет.

```bash
node tools/qa-campaign.mjs docs/qa/<итерация>-e2e office7,office8,office11 0 8 arsenal
```

Аргументы: `<папка> <уровни> <mobile 0|1> <минут на уровень> <god: 0|1|arsenal>`.

Автопилот играет через реальный интерфейс: идёт по стрелке, стреляет, жмёт E, нажимает «Дальше». В `report.json` — `done`, `retries`, `minHp` и лог по уровням, плюс скриншоты каждые 3 с и при поражениях. Перед коммитом лишние скриншоты проредить.

### Визуальный QA новой итерации

Скопируй `tools/qa-d72.mjs` в `tools/qa-dNN.mjs`. Там есть готовые хелперы:

- `open(level, ctxOpts)`;
- `tp(page, x, y)` — телепорт в тайлах, заодно пропускает интро;
- `aimAt(page, x, y)`;
- `shot(page, name)`.

Снимай каждую новую сцену, затем **открывай PNG и смотри глазами** (Read). Подписи в UI могут быть в верхнем регистре через CSS: регулярки в проверках пиши с флагом `/i`.

## Новые персонажи, враги и арт

### Персонаж (NPC)

1. Добавь пресет в `LOOK_PRESETS` в `src/shared/look.ts`: `L(тело 'm'|'f'|'big'|'mo', кожа 0-3, причёска, цвет, верх, цвет, низ, цвет, аксессуар, мутация?)`.
   - Причёски: `HAIR`; верх: `TOPS` (включая `tank`); низ: `LEGS` (включая `shorts`); аксессуары: `glasses`, `beard`, `mustache`.
   - Мутация влияет только на вид в образе петуха: `'plant'` (ботва), `'gmo'` (ГМО), `'fat'` (жёлтый толстый босс).
2. На карте: `o('npc', '<id>', x, y, { title, mode: 'idle'|'cower', hp, story: true, essential: true, untargetable: true, reach, lines: 'реплика|реплика' })`.
   - `id` совпадает с ключом пресета, и внешность подхватится автоматически. Иначе укажи `kind: '<пресет>'`.
3. Если нужного слоя одежды нет, найди его в Universal LPC той же ревизии (`ULPC_REVISION`) через GitHub API. Затем:
   - добавь слой в `tools/art/lpc-layers.mjs`;
   - запусти `npm run art:fetch` (скачает его и обновит credits);
   - обработай новый тип одежды в `layersOf` в `compose.ts`;
   - скопируй `vendor/lpc-characters/SELECTED-CREDITS.csv` в `public/assets/credits/lpc-characters.csv`;
   - запусти `npm run assets`.

### Превращение и минибосс

- Превращение NPC: `w.infect(npc, 'тип', 'tag')`. Через ~3 с появляется враг с `appearance.npcId = id NPC`.
- Минибосс («элита»): запись в `ELITES` в `src/shared/sim/enemyAI.ts` (урон, рывок, яйца, `blink`, `bottles`, …), размер — в `ELITE_SCALE` в `hitbox.ts`.
- В скрипте уровня при первом появлении врага задай HP с учётом числа игроков и вызови `w.setBoss(e, 'Имя · подпись')`, чтобы появилась полоса здоровья.

### Новый тип врага

Нужно обновить все места:

- `EnemyType` и `ENEMIES` в `src/shared/enemies.ts`;
- `ENEMY_SCALE` в `hitbox.ts`;
- `ETYPES` в `protocol.ts` — **только дописывать в конец**;
- `enemyLook` в `look.ts`;
- словарь `odd` в `World.spawnEnemy`;
- список `types` в prewarm в `GameScene.ts`.

### Пропсы и графика

- Источники: Skorpio, LPC, [LPC] Trees в `vendor/`. Плюс собственный пиксель-арт в коде: рисуется в нативном размере и масштабируется ×2.
- Новые предметы добавляй в `tools/art/<итерация>.mjs` через `add(имя, canvas, feetY, { foot: [ширина, высота], wall?: true })`.
- Подключи файл в `tools/art/lpc.mjs` после `buildCity`.
- Поведение предмета (твёрдость, разрушаемость) — в `PROP_DEFS` в `src/shared/props.ts`.
- Полы: `floors.push({ index: 515+, canvas })`.
- Затем `npm run assets && npm run maps && npm run check:art`. Источник и лицензию запиши в `docs/ASSETS.md` и в `public/credits.html`.

### Новый уровень или сцена

- Карта — в `tools/levels/<id>.ts`, скрипт — в `src/shared/levels/<id>.ts`.
- Скрипт — объект `LevelScript` с хуками `onStart`, `onTick`, `onTrigger`, `onUse`, `onKill`, `onPickup`, `onNpcUse`, `onRescue`. Полезные поля: `chapter`, `chapterEnd`, `rev`.
- Таймеры только через `w.after`/`w.every` — они детерминированы.
- Смешной момент для итогов главы: `w.moment(playerId, 'текст')`. Ачивка: запись в `achievements.ts` и вызов `w.award(key)`.

## Конец итерации (чек-лист)

1. Все быстрые проверки, а также сетевые и UI, если менялись сеть, лобби или интерфейс.
2. Матрица `sim-play`, браузерный `qa-campaign` по изменённым этажам и визуальный `qa-dNN.mjs` со скриншотами в `docs/qa/dNN/`.
3. Запись `## DNN` в `docs/DECISIONS.md` (что сделано, почему, какие правила, что нашли тесты), `## Iteration N` в `docs/HANDOFF.md` (с таблицей баланса), обновить `docs/design/chapters.md` и `docs/ASSETS.md`.
4. Коммит с подписью `Co-Authored-By`. В сообщении можно писать `Fixes #N` для issues, которые реально исправлены. Пуш в ветку и, если просили, в `main`.
5. Остановить запущенные dev-серверы (порты 5280 и 2580).
6. Отчёт пользователю по-русски по пунктам: что сделано, что нашли тесты, что не проверено (реальный телефон, живые люди по сети).
