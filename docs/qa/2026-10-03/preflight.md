# Preflight QA — 2026-10-03

## База и изоляция

- origin/main после fetch: 613843a81b454a4bb2faba894b63bbffa599c54b. Master отсутствует, default main.
- Текущий новый локальный commit: 5f0276c, отдельно checkout codex/qa-20261003, rebase origin/main: already up to date.
- TypeScript + production build: Pass, build qa-5f0276c.
- Сервер: отдельный 2597, собственный qa-results/rooms, без Telegram bot token. Общий checkout и его серверы не изменены.
- Таймер qa-chkn после пробуждения выключен (PAUSED).

## Что выполнено

205 сценариев в 23 областях (в том числе каждый campaign level и 3 optional incidents), stable IDs, десять требуемых полей. Сценарии опубликованы в issue #1, исходные состояния Not Run. Проверка duplicate ID и неполных строк прошла.

Проверки симуляции: check:levels — все 11 карт доступны для сюжетных объектов; check:coop — 18 authority regressions прошли. Это не E2E acceptance и не подтверждение баланса.

Реальный браузер Codex IAB на http://127.0.0.1:2597, desktop input, 1280×720; дополнительно viewport 390×844 без touch emulation. Выполнен короткий предварительный UI-прогон, а не все сценарии:

| Проверка | Наблюдение | Доказательство |
|---|---|---|
| Меню без сохранения | Две отдельные группы solo/co-op, Continue отключены, DEV не показан | start-1280x720.jpg |
| Main controls + возврат | Окно доступно, кнопка Понятно возвращает в меню | help-1280x720.jpg |
| Узкий viewport | Main и настройки доступны, main без горизонтального overflow | menu-390x844.jpg |
| New solo | office, HP100, ПМ12/∞, один HUD, controls перед боем | office-start-1280x720.jpg |
| Клавиатурное движение | Серия D сдвигает игрока; natural objective и mutation стартуют | mutation-office.jpg (состояние после превращения) |
| Смерть | При бездействии во время чтения враги убили игрока, экран KO и restart доступны | death-1280x720.jpg |
| Restart | Возврат office: HP100, ПМ12/∞, objective начальный | наблюдение accessibility, снимок help после restart |
| Esc и controls в pause | Пауза открывается, controls доступны; старый диапазон 1–7 повторяется | pause-help-1280x720.jpg |

Из-за пауз между действиями и ограниченного количества вводов этот прогон не оценивает combat feel/баланс. Нельзя считать смерть доказательством слишком высокой сложности. Не были пройдены бой, rescue, support UI, all-guns UI, campaign, two-client E2E, reconnect UI, real-phone/touch gameplay, Telegram, boss и performance. Никакие такие сценарии не отмечены Pass.

## Findings

UX Improvement: справка в main и pause показывает 1–7, код WEAPON_ORDER содержит 9 видов, Input.ts подписан на ONE–NINE. Предложение: синхронизировать показанную раскладку с текущими слотами, добавить Q если он поддерживается. Сценарий WEAPON-SWITCH-001 / TUTORIAL-WEAPON-003; severity Minor. Само использование 8/9 в бою не проверялось; вывод о handlers основан на чтении кода.

Снимки проверены визуально. Gameplay implementation не менялась. Файлы suite/manifest/screenshots сохранены отдельно как QA-доказательства. После предварительного прогона свой сервер остановлен.
