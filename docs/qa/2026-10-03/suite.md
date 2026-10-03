# CHKN Outbreak — QA suite, 2026-10-03

База: локальный коммит 5f0276c, ветка codex/qa-20261003; rebase origin/main (613843a) выполнен, изменений базы не потребовал. Production build qa-5f0276c собран отдельно, общая рабочая копия не редактировалась. Это сценарии и ожидаемые результаты, а не заявление об их прохождении. Все сценарии исходно **Not Run**.

## Фактический scope

Кампания: office → office7 → office8 → office11 → cafe12 → street1 → street2 → factory → lab → boss. Arena — sandbox, не campaign. Есть 9 guns и 9 enemy types (boss отдельно), staged NPC mutation, one-button support, optional incidents/bonuses, solo entry saves и точные room checkpoints. Источники: README, PLAN/TASKS, docs/design/chapters.md, docs/design/engagement.md, docs/qa (старые результаты — только контекст), src/shared/levels/*.ts, weapons.ts, enemies.ts, sim/{World,support,Bonus,Incidents}.ts, client/ui/*, input/Input.ts, progress.ts, net/*, server/*, client/telegram.ts, pwa.ts. При конфликте старого плана и текущего кода проверять реализацию и player-facing contract.

Плановые P15 три формальные волны, cap 120/intermissions и полный арт-комплект не становятся Bug только из-за отсутствия. Старые комментарии о шести картах/старых bleedout или PvPvE не являются oracle. Fresh rules6: помощь 110 units, revive 2.6 с/45 HP, heal 1.2 с/+40, bleedout 15 с; удар сам по себе не обязан отменять help. Mobile fire при deflection ≥0.8, не старое enemy-gated autofire. Solo Continue возвращает вход этажа с loadout; exact position нужна room saves.

## Выполнение и доказательства

Режимы: Desktop 1920×1080 и 1280×720; Portrait 390×844; Landscape 844×390; 640×720 и узкое Telegram окно 480×640. Touch — coarse pointer плюс touch events, не просто узкий viewport. Multiplayer минимум две независимые identity/browser sessions; Telegram требует настоящего Telegram и тестового бота. Эмуляцию Telegram/телефона отмечать отдельно; недоступный real-device/Telegram прогон — Blocked с причиной.

Статусы: Not Run / Pass / Fail / Blocked; отчёт всегда содержит commit+build, устройство/браузер/GPU, viewport, mode, clients и A/B identity, setup cheats (если были), шаги, снимки и фактический результат. Dev/god/setup не подтверждает баланс natural campaign. E2E проходит UI; simulation/protocol checks — отдельные evidence.

Глобально: понятность действия/цели, no soft-lock, input/tap/hold, видимость player state, readable text, отсутствие clipping, доступные touch targets, возврат из popup, сохранение после transitions и отсутствие дублей от spam. Не повторять это в каждом кейсе.

Для каждого кейса сохранять ID-start, ID-action, ID-result с viewport/client в имени; дополнительно ID-anomaly. Во время движения снимок не доказывает input/performance — добавить описание или запись. Сохранить контрольные снимки и для Pass.

Bug: Title, Severity (Blocker/Major/Minor/Cosmetic), Scenario ID, commit/build/environment/viewport, clients и affected player для MP, Preconditions, Steps, Actual, Expected, Screenshot. Создавать только воспроизведённые defects. Improvement отдельно с Current behaviour, Why it hurts, Small suggested change. Все issues — mrMigles/chkn-outbreak.

Порядок: START/TUTORIAL → COMBAT/WEAPON → OBJECTIVE/NPC/MUTATION → SUPPORT → campaign → mobile → MP/reconnect → Telegram/boss → visual/perf. У каждой группы ниже приведён самостоятельный воспроизводимый набор.

## 01 START / Main Menu / New Game (6)

### START-UI-001 — Первый запуск без сохранения

- **Area:** 01 START / Main Menu / New Game
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Чистый профиль на изолированной production-сборке, без dev=1
- **Steps:** 1) Открыть игру; 2) осмотреть основные действия; 3) открыть помощь и вернуться
- **Expected Result:** Solo и co-op различимы, Continue без сохранения отключён
- **Screenshot checkpoints:** Начало: Первый запуск без сохранения → Ключевое действие: Открыть игру → Результат: Solo и co-op различимы, Continue без сохранения отключён
- **Что визуально проверить:** Подписи, контраст кнопок, отсутствие DEV-панели
- **Possible problems:** Случайный вход в co-op, dev-контролы
- **Status:** Not Run

### START-FLOW-002 — Новая solo и быстрые клики

- **Area:** 01 START / Main Menu / New Game
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Чистый профиль на изолированной production-сборке, без dev=1
- **Steps:** 1) Быстро нажать Новая игра дважды; 2) закрыть controls; 3) начать движение
- **Expected Result:** Одна сессия office, один HUD и одно окно помощи
- **Screenshot checkpoints:** Начало: Новая solo и быстрые клики → Ключевое действие: Быстро нажать Новая игра дважды → Результат: Одна сессия office, один HUD и одно окно помощи
- **Что визуально проверить:** Начальный objective и единственный персонаж
- **Possible problems:** Двойные сцены или input listeners
- **Status:** Not Run

### START-SAVE-003 — Продолжить solo

- **Area:** 01 START / Main Menu / New Game
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Есть сохранение входа на office7
- **Steps:** 1) Вернуться в меню; 2) нажать Продолжить; 3) перезагрузить страницу и повторить
- **Expected Result:** Начало сохранённого этажа с его entry loadout, не точная позиция боя
- **Screenshot checkpoints:** Начало: Продолжить solo → Ключевое действие: Вернуться в меню → Результат: Начало сохранённого этажа с его entry loadout, не точная позиция боя
- **Что визуально проверить:** Правильные номер этапа и снаряжение
- **Possible problems:** Ложное ожидание exact solo save, устаревший caption
- **Status:** Not Run

### START-CONFIRM-004 — Защита существующего прогресса

- **Area:** 01 START / Main Menu / New Game
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Есть solo-сохранение
- **Steps:** 1) Нажать Новая игра один раз; 2) отменить возвратом; 3) повторить и подтвердить
- **Expected Result:** Сохранение заменяется только после явного второго действия
- **Screenshot checkpoints:** Начало: Защита существующего прогресса → Ключевое действие: Нажать Новая игра один раз → Результат: Сохранение заменяется только после явного второго действия
- **Что визуально проверить:** Текст подтверждения и доступный возврат
- **Possible problems:** Перезапись одним тапом
- **Status:** Not Run

### START-LOOK-005 — Редактор сотрудника

- **Area:** 01 START / Main Menu / New Game
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Чистый профиль на изолированной production-сборке, без dev=1
- **Steps:** 1) Изменить тело, волосы и одежду; 2) проверить preview мутации; 3) сохранить; 4) вновь открыть
- **Expected Result:** Внешность сохранена, имя и портрет согласованы
- **Screenshot checkpoints:** Начало: Редактор сотрудника → Ключевое действие: Изменить тело, волосы и одежду → Результат: Внешность сохранена, имя и портрет согласованы
- **Что визуально проверить:** Спрайт, preview, controls редактора
- **Possible problems:** Пропавшие части тела, сохранение вместо отмены
- **Status:** Not Run

### START-INSTALL-006 — PWA install и справка

- **Area:** 01 START / Main Menu / New Game
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Браузер с PWA либо без поддержки установки
- **Steps:** 1) Открыть Установить игру; 2) проверить инструкции; 3) вернуться; 4) открыть credits
- **Expected Result:** Понятные инструкции соответствуют браузеру, меню доступно
- **Screenshot checkpoints:** Начало: PWA install и справка → Ключевое действие: Открыть Установить игру → Результат: Понятные инструкции соответствуют браузеру, меню доступно
- **Что визуально проверить:** Текст и кнопки установки
- **Possible problems:** Кнопка обещает недоступное действие
- **Status:** Not Run

## 02 Tutorial / First Minutes (6)

### TUTORIAL-FLOW-001 — Первые 5–10 минут

- **Area:** 02 Tutorial / First Minutes
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Новый профиль, tutorials включены, office без читов
- **Steps:** 1) Начать solo; 2) читать только подсказки игры; 3) двигаться, целиться, стрелять; 4) следовать цели до серверной
- **Expected Result:** Управление, E, reload, цель и стрелка понятны без исходников
- **Screenshot checkpoints:** Начало: Первые 5–10 минут → Ключевое действие: Начать solo → Результат: Управление, E, reload, цель и стрелка понятны без исходников
- **Что визуально проверить:** Порядок подсказок и видимость врага
- **Possible problems:** Слишком ранняя опасность, непонятная цель
- **Status:** Not Run

### TUTORIAL-RELOAD-002 — Первый пустой магазин

- **Area:** 02 Tutorial / First Minutes
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Новый профиль, tutorials включены, office без читов
- **Steps:** 1) Расстрелять пистолет; 2) наблюдать автоперезарядку; 3) выполнить ручной reload
- **Expected Result:** Магазин конечен, запас пистолета бесконечен, правило объяснено
- **Screenshot checkpoints:** Начало: Первый пустой магазин → Ключевое действие: Расстрелять пистолет → Результат: Магазин конечен, запас пистолета бесконечен, правило объяснено
- **Что визуально проверить:** Ammo и подсказка
- **Possible problems:** Обещание бесконечного магазина
- **Status:** Not Run

### TUTORIAL-WEAPON-003 — Получение нового оружия

- **Area:** 02 Tutorial / First Minutes
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Найден первый weapon pickup
- **Steps:** 1) Подобрать оружие; 2) прочитать подсказку; 3) переключить и стрелять
- **Expected Result:** Подсказка позволяет выбрать полученный ствол
- **Screenshot checkpoints:** Начало: Получение нового оружия → Ключевое действие: Подобрать оружие → Результат: Подсказка позволяет выбрать полученный ствол
- **Что визуально проверить:** Оружие в руках и панель
- **Possible problems:** Игрок не понимает смену
- **Status:** Not Run

### TUTORIAL-QUEUE-004 — Подсказки во время опасности

- **Area:** 02 Tutorial / First Minutes
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Новый профиль, tutorials включены, office без читов
- **Steps:** 1) Вызвать бой, objective update и pickup подряд; 2) открыть pause; 3) вернуться
- **Expected Result:** Подсказки идут по очереди, не скрывают обязательные опасности
- **Screenshot checkpoints:** Начало: Подсказки во время опасности → Ключевое действие: Вызвать бой, objective update и pickup подряд → Результат: Подсказки идут по очереди, не скрывают обязательные опасности
- **Что визуально проверить:** Одновременные notice, radio и tip
- **Possible problems:** Наложения и потерянные tips
- **Status:** Not Run

### TUTORIAL-MOBILE-005 — Тест новичка с twin-stick

- **Area:** 02 Tutorial / First Minutes
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Touch-профиль на 390×844
- **Steps:** 1) Начать игру; 2) применить схему controls; 3) прицелиться малым отклонением; 4) довести правый стик до края
- **Expected Result:** Внутри стика только aim, у края fire; обе руки понятны
- **Screenshot checkpoints:** Начало: Тест новичка с twin-stick → Ключевое действие: Начать игру → Результат: Внутри стика только aim, у края fire; обе руки понятны
- **Что визуально проверить:** Ghost sticks и зона действия
- **Possible problems:** Старое обещание autofire по наличию врага
- **Status:** Not Run

### TUTORIAL-RESET-006 — Повторный показ подсказок

- **Area:** 02 Tutorial / First Minutes
- **Priority:** Low
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Профиль уже видел tips
- **Steps:** 1) Отключить tips; 2) играть; 3) включить и сбросить в настройках; 4) начать этаж
- **Expected Result:** Настройка сохраняется, сброс вновь показывает актуальные tips
- **Screenshot checkpoints:** Начало: Повторный показ подсказок → Ключевое действие: Отключить tips → Результат: Настройка сохраняется, сброс вновь показывает актуальные tips
- **Что визуально проверить:** Состояние toggle и текст
- **Possible problems:** Советы навсегда потеряны
- **Status:** Not Run

## 03 Core Combat (10)

### COMBAT-SINGLE-001 — Первый враг и попадания

- **Area:** 03 Core Combat
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Solo office/arena с обычным HP; co-op повторить с двумя клиентами
- **Steps:** 1) Подойти к одному normal; 2) стрелять в тело; 3) повторить в голову
- **Expected Result:** Урон соответствует месту попадания, смерть читается
- **Screenshot checkpoints:** Начало: Первый враг и попадания → Ключевое действие: Подойти к одному normal → Результат: Урон соответствует месту попадания, смерть читается
- **Что визуально проверить:** Hit flash, кровь, headshot feedback
- **Possible problems:** Пули проходят нарисованную цель
- **Status:** Not Run

### COMBAT-CROWD-002 — Стая и стрельба на ходу

- **Area:** 03 Core Combat
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Волна office или factory
- **Steps:** 1) Двигаться боком и назад; 2) удерживать fire; 3) резко сменить направление
- **Expected Result:** Input отзывчив, толпа читаема, движение и огонь одновременны
- **Screenshot checkpoints:** Начало: Стая и стрельба на ходу → Ключевое действие: Двигаться боком и назад → Результат: Input отзывчив, толпа читаема, движение и огонь одновременны
- **Что визуально проверить:** Игрок среди FX, силуэты угроз
- **Possible problems:** Залипание, потеря aim
- **Status:** Not Run

### COMBAT-DOOR-003 — Стрельба через дверь

- **Area:** 03 Core Combat
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Открытая дверь с врагами за ней
- **Steps:** 1) Стрелять через центр проёма; 2) вдоль косяка; 3) затем через закрытую дверь
- **Expected Result:** Открытый проём пропускает выстрел, закрытая преграда блокирует
- **Screenshot checkpoints:** Начало: Стрельба через дверь → Ключевое действие: Стрелять через центр проёма → Результат: Открытый проём пропускает выстрел, закрытая преграда блокирует
- **Что визуально проверить:** Трассер и место попадания
- **Possible problems:** Невидимая коллизия или пробитие стены
- **Status:** Not Run

### COMBAT-WALL-004 — Ближний бой у мебели

- **Area:** 03 Core Combat
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Враг и игрок рядом со столом
- **Steps:** 1) Обойти стол; 2) стрелять в упор сверху и снизу; 3) прижаться к стене
- **Expected Result:** Видимый противник поражается при свободной линии; база мебели ограничивает движение
- **Screenshot checkpoints:** Начало: Ближний бой у мебели → Ключевое действие: Обойти стол → Результат: Видимый противник поражается при свободной линии; база мебели ограничивает движение
- **Что визуально проверить:** Стопы, ствол, foreground
- **Possible problems:** Hitbox смещён относительно спрайта
- **Status:** Not Run

### COMBAT-HEAD-005 — Headshot и вертикальное расположение

- **Area:** 03 Core Combat
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Normal без брони
- **Steps:** 1) Прицелиться в голову сверху, снизу и сбоку; 2) сравнить с телом
- **Expected Result:** Headshot ×2 для соответствующего оружия, визуальная точка совпадает
- **Screenshot checkpoints:** Начало: Headshot и вертикальное расположение → Ключевое действие: Прицелиться в голову сверху, снизу и сбоку → Результат: Headshot ×2 для соответствующего оружия, визуальная точка совпадает
- **Что визуально проверить:** Цифры урона и реальная голова
- **Possible problems:** Headshot требует целиться в пустоту
- **Status:** Not Run

### COMBAT-KNOCK-006 — Отбрасывание в стену

- **Area:** 03 Core Combat
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Shotgun и fat/normal
- **Steps:** 1) Стрелять вблизи; 2) направить knockback к мебели; 3) добить
- **Expected Result:** Отбрасывание различимо и не переносит врага в недоступную область
- **Screenshot checkpoints:** Начало: Отбрасывание в стену → Ключевое действие: Стрелять вблизи → Результат: Отбрасывание различимо и не переносит врага в недоступную область
- **Что визуально проверить:** Контакт стоп и оснований
- **Possible problems:** Враг застревает в стене
- **Status:** Not Run

### COMBAT-RELOAD-007 — Последний патрон и смена во время reload

- **Area:** 03 Core Combat
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Два оружия, малый магазин
- **Steps:** 1) Выстрелить последним патроном; 2) начать reload; 3) сменить оружие; 4) вернуться
- **Expected Result:** Reload отменяется при switching, ammo не дублируется
- **Screenshot checkpoints:** Начало: Последний патрон и смена во время reload → Ключевое действие: Выстрелить последним патроном → Результат: Reload отменяется при switching, ammo не дублируется
- **Что визуально проверить:** Индикатор reload и ammo
- **Possible problems:** Бесплатные патроны, запрет смены
- **Status:** Not Run

### COMBAT-COMBO-008 — Комбо и kill feedback

- **Area:** 03 Core Combat
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Стая обычных врагов
- **Steps:** 1) Убить подряд; 2) сделать паузу в убийствах; 3) продолжить
- **Expected Result:** Combo растёт и истекает по правилам, сообщения не мешают бою
- **Screenshot checkpoints:** Начало: Комбо и kill feedback → Ключевое действие: Убить подряд → Результат: Combo растёт и истекает по правилам, сообщения не мешают бою
- **Что визуально проверить:** Комбо x10/x25/x40 и счёт
- **Possible problems:** Засчитывание одного kill несколько раз
- **Status:** Not Run

### COMBAT-EMPTY-009 — Нет боеприпасов под давлением

- **Area:** 03 Core Combat
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Оружие с конечным запасом
- **Steps:** 1) Израсходовать магазин и резерв; 2) попытаться fire/reload; 3) выбрать пистолет
- **Expected Result:** Нет выстрелов без ресурса, пистолет позволяет продолжить
- **Screenshot checkpoints:** Начало: Нет боеприпасов под давлением → Ключевое действие: Израсходовать магазин и резерв → Результат: Нет выстрелов без ресурса, пистолет позволяет продолжить
- **Что визуально проверить:** Предупреждение dry и выбор оружия
- **Possible problems:** Soft-lock на пустом стволе
- **Status:** Not Run

### COMBAT-FEEL-010 — Оценка темпа и решений

- **Area:** 03 Core Combat
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Обычный бой office и factory без god mode
- **Steps:** 1) Играть по 3 минуты; 2) использовать дистанцию, двери и два оружия; 3) записать причины смены тактики
- **Expected Result:** Зафиксировать время убийства, downtime и реальные решения; subjective findings оформить Improvement
- **Screenshot checkpoints:** Начало: Оценка темпа и решений → Ключевое действие: Играть по 3 минуты → Результат: Зафиксировать время убийства, downtime и реальные решения; subjective findings оформить Improvement
- **Что визуально проверить:** Различимость попаданий и смертей
- **Possible problems:** Монотонность, слабый feedback, чрезмерные popup
- **Status:** Not Run

## 04 Weapons (19)

### WEAPON-PISTOL-001 — ПМ: получение и ресурс

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Pickup pistol, обычный HP
- **Steps:** 1) Подобрать; 2) выбрать; 3) сделать серию; 4) reload; 5) проверить reserve
- **Expected Result:** 12, бесконечный резерв, reload 1 с; ammo HUD и выбранный ствол согласованы
- **Screenshot checkpoints:** Начало: ПМ: получение и ресурс → Ключевое действие: Подобрать → Результат: 12, бесконечный резерв, reload 1 с; ammo HUD и выбранный ствол согласованы
- **Что визуально проверить:** Pickup, спрайт в руках, ammo
- **Possible problems:** Неверный магазин или другой спрайт
- **Status:** Not Run

### WEAPON-PISTOL-002 — ПМ: характер огня

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** pistol и одиночную цель и голову
- **Steps:** 1) Стрелять в одиночную цель и голову; 2) двигаться; 3) сравнить звук и отдачу с ПМ
- **Expected Result:** Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Screenshot checkpoints:** Начало: ПМ: характер огня → Ключевое действие: Стрелять в одиночную цель и голову → Результат: Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Что визуально проверить:** Дуло, звук, отдача и death feedback
- **Possible problems:** Одинаковое ощущение или неверное поражение
- **Status:** Not Run

### WEAPON-SMG-001 — Дедлайн: получение и ресурс

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Pickup smg, обычный HP
- **Steps:** 1) Подобрать; 2) выбрать; 3) сделать серию; 4) reload; 5) проверить reserve
- **Expected Result:** 42, reload 1.35 с, быстрая очередь; ammo HUD и выбранный ствол согласованы
- **Screenshot checkpoints:** Начало: Дедлайн: получение и ресурс → Ключевое действие: Подобрать → Результат: 42, reload 1.35 с, быстрая очередь; ammo HUD и выбранный ствол согласованы
- **Что визуально проверить:** Pickup, спрайт в руках, ammo
- **Possible problems:** Неверный магазин или другой спрайт
- **Status:** Not Run

### WEAPON-SMG-002 — Дедлайн: характер огня

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** smg и движущуюся стаю
- **Steps:** 1) Стрелять в движущуюся стаю; 2) двигаться; 3) сравнить звук и отдачу с ПМ
- **Expected Result:** Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Screenshot checkpoints:** Начало: Дедлайн: характер огня → Ключевое действие: Стрелять в движущуюся стаю → Результат: Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Что визуально проверить:** Дуло, звук, отдача и death feedback
- **Possible problems:** Одинаковое ощущение или неверное поражение
- **Status:** Not Run

### WEAPON-SHOTGUN-001 — Тимбилдинг: получение и ресурс

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Pickup shotgun, обычный HP
- **Steps:** 1) Подобрать; 2) выбрать; 3) сделать серию; 4) reload; 5) проверить reserve
- **Expected Result:** 8, reload 1.9 с, 10 дробин; ammo HUD и выбранный ствол согласованы
- **Screenshot checkpoints:** Начало: Тимбилдинг: получение и ресурс → Ключевое действие: Подобрать → Результат: 8, reload 1.9 с, 10 дробин; ammo HUD и выбранный ствол согласованы
- **Что визуально проверить:** Pickup, спрайт в руках, ammo
- **Possible problems:** Неверный магазин или другой спрайт
- **Status:** Not Run

### WEAPON-SHOTGUN-002 — Тимбилдинг: характер огня

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** shotgun и близкую группу и дальнюю цель
- **Steps:** 1) Стрелять в близкую группу и дальнюю цель; 2) двигаться; 3) сравнить звук и отдачу с ПМ
- **Expected Result:** Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Screenshot checkpoints:** Начало: Тимбилдинг: характер огня → Ключевое действие: Стрелять в близкую группу и дальнюю цель → Результат: Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Что визуально проверить:** Дуло, звук, отдача и death feedback
- **Possible problems:** Одинаковое ощущение или неверное поражение
- **Status:** Not Run

### WEAPON-RIFLE-001 — KPI-47: получение и ресурс

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Pickup rifle, обычный HP
- **Steps:** 1) Подобрать; 2) выбрать; 3) сделать серию; 4) reload; 5) проверить reserve
- **Expected Result:** 30, reload 1.7 с, piercing 1; ammo HUD и выбранный ствол согласованы
- **Screenshot checkpoints:** Начало: KPI-47: получение и ресурс → Ключевое действие: Подобрать → Результат: 30, reload 1.7 с, piercing 1; ammo HUD и выбранный ствол согласованы
- **Что визуально проверить:** Pickup, спрайт в руках, ammo
- **Possible problems:** Неверный магазин или другой спрайт
- **Status:** Not Run

### WEAPON-RIFLE-002 — KPI-47: характер огня

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** rifle и двоих в линии
- **Steps:** 1) Стрелять в двоих в линии; 2) двигаться; 3) сравнить звук и отдачу с ПМ
- **Expected Result:** Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Screenshot checkpoints:** Начало: KPI-47: характер огня → Ключевое действие: Стрелять в двоих в линии → Результат: Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Что визуально проверить:** Дуло, звук, отдача и death feedback
- **Possible problems:** Одинаковое ощущение или неверное поражение
- **Status:** Not Run

### WEAPON-MACHINEGUN-001 — Квартальный отчёт: получение и ресурс

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Pickup machinegun, обычный HP
- **Steps:** 1) Подобрать; 2) выбрать; 3) сделать серию; 4) reload; 5) проверить reserve
- **Expected Result:** 150, reload 3 с, speedMul 0.78; ammo HUD и выбранный ствол согласованы
- **Screenshot checkpoints:** Начало: Квартальный отчёт: получение и ресурс → Ключевое действие: Подобрать → Результат: 150, reload 3 с, speedMul 0.78; ammo HUD и выбранный ствол согласованы
- **Что визуально проверить:** Pickup, спрайт в руках, ammo
- **Possible problems:** Неверный магазин или другой спрайт
- **Status:** Not Run

### WEAPON-MACHINEGUN-002 — Квартальный отчёт: характер огня

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** machinegun и большую стаю и троих в линии
- **Steps:** 1) Стрелять в большую стаю и троих в линии; 2) двигаться; 3) сравнить звук и отдачу с ПМ
- **Expected Result:** Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Screenshot checkpoints:** Начало: Квартальный отчёт: характер огня → Ключевое действие: Стрелять в большую стаю и троих в линии → Результат: Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Что визуально проверить:** Дуло, звук, отдача и death feedback
- **Possible problems:** Одинаковое ощущение или неверное поражение
- **Status:** Not Run

### WEAPON-GRENADE-001 — Оптимизация: получение и ресурс

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Pickup grenade, обычный HP
- **Steps:** 1) Подобрать; 2) выбрать; 3) сделать серию; 4) reload; 5) проверить reserve
- **Expected Result:** 6, reload 2.3 с, splash 150; ammo HUD и выбранный ствол согласованы
- **Screenshot checkpoints:** Начало: Оптимизация: получение и ресурс → Ключевое действие: Подобрать → Результат: 6, reload 2.3 с, splash 150; ammo HUD и выбранный ствол согласованы
- **Что визуально проверить:** Pickup, спрайт в руках, ammo
- **Possible problems:** Неверный магазин или другой спрайт
- **Status:** Not Run

### WEAPON-GRENADE-002 — Оптимизация: характер огня

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** grenade и группу возле стены
- **Steps:** 1) Стрелять в группу возле стены; 2) двигаться; 3) сравнить звук и отдачу с ПМ
- **Expected Result:** Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Screenshot checkpoints:** Начало: Оптимизация: характер огня → Ключевое действие: Стрелять в группу возле стены → Результат: Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Что визуально проверить:** Дуло, звук, отдача и death feedback
- **Possible problems:** Одинаковое ощущение или неверное поражение
- **Status:** Not Run

### WEAPON-FLAME-001 — Выгорание: получение и ресурс

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Pickup flamethrower, обычный HP
- **Steps:** 1) Подобрать; 2) выбрать; 3) сделать серию; 4) reload; 5) проверить reserve
- **Expected Result:** 160, reload 2.2 с, range 260; ammo HUD и выбранный ствол согласованы
- **Screenshot checkpoints:** Начало: Выгорание: получение и ресурс → Ключевое действие: Подобрать → Результат: 160, reload 2.2 с, range 260; ammo HUD и выбранный ствол согласованы
- **Что визуально проверить:** Pickup, спрайт в руках, ammo
- **Possible problems:** Неверный магазин или другой спрайт
- **Status:** Not Run

### WEAPON-FLAME-002 — Выгорание: характер огня

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** flamethrower и группу в пределах и за пределами огня
- **Steps:** 1) Стрелять в группу в пределах и за пределами огня; 2) двигаться; 3) сравнить звук и отдачу с ПМ
- **Expected Result:** Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Screenshot checkpoints:** Начало: Выгорание: характер огня → Ключевое действие: Стрелять в группу в пределах и за пределами огня → Результат: Тип огня и дистанция согласованы с weapons.ts; оружие различимо
- **Что визуально проверить:** Дуло, звук, отдача и death feedback
- **Possible problems:** Одинаковое ощущение или неверное поражение
- **Status:** Not Run

### WEAPON-MINIGUN-001 — Миниган у вертолёта

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Street1, pickup минигана
- **Steps:** 1) Подобрать; 2) удерживать огонь; 3) попытаться reload; 4) взять ammo box
- **Expected Result:** 280 зарядов, резерв 0; ammo box не пополняет специальное оружие
- **Screenshot checkpoints:** Начало: Миниган у вертолёта → Ключевое действие: Подобрать → Результат: 280 зарядов, резерв 0; ammo box не пополняет специальное оружие
- **Что визуально проверить:** Pickup, очередь, ammo bar
- **Possible problems:** Бесконечный миниган
- **Status:** Not Run

### WEAPON-MINIGUN-002 — Исчерпание минигана

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Миниган почти пуст, есть ПМ
- **Steps:** 1) Выстрелить последними зарядами; 2) продолжить удерживать огонь
- **Expected Result:** Пустой миниган удалён из loadout, игра выбирает доступное оружие
- **Screenshot checkpoints:** Начало: Исчерпание минигана → Ключевое действие: Выстрелить последними зарядами → Результат: Пустой миниган удалён из loadout, игра выбирает доступное оружие
- **Что визуально проверить:** Сообщение и выбранный слот
- **Possible problems:** Пустой слот, зависание ввода
- **Status:** Not Run

### WEAPON-LASER-001 — Лазер Омлетова

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Lab, спасён Омлетов
- **Steps:** 1) Подобрать лазер; 2) стрелять в ряд врагов; 3) reload; 4) подобрать ammo
- **Expected Result:** 10/20 при получении, piercing, ограниченные заряды; обычные ammo boxes не добавляют charges
- **Screenshot checkpoints:** Начало: Лазер Омлетова → Ключевое действие: Подобрать лазер → Результат: 10/20 при получении, piercing, ограниченные заряды; обычные ammo boxes не добавляют charges
- **Что визуально проверить:** Бирюзовый луч, попадания по линии
- **Possible problems:** Непонятный остаток или неограниченный ресурс
- **Status:** Not Run

### WEAPON-SWITCH-001 — Все девять видов в picker

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Доступны 9 видов через setup
- **Steps:** 1) На ПК нажать 1–9, Q и wheel; 2) на телефоне открыть picker и выбрать laser/minigun
- **Expected Result:** Все доступные виды выбираются, выбранный слот совпадает с оружием
- **Screenshot checkpoints:** Начало: Все девять видов в picker → Ключевое действие: На ПК нажать 1–9, Q и wheel → Результат: Все доступные виды выбираются, выбранный слот совпадает с оружием
- **Что визуально проверить:** Полнота picker и touch targets
- **Possible problems:** Новые оружия недоступны по UI
- **Status:** Not Run

### WEAPON-SAFE-001 — Огонь возле союзников

- **Area:** 04 Weapons
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape
- **Preconditions:** Co-op 2 клиента или вооружённый NPC
- **Steps:** 1) Стрелять каждым типом возле союзника; 2) проверить HP; 3) отдельно проверить опасную бочку
- **Expected Result:** Дружественный огонь игроков отключён; environmental damage проверять отдельно
- **Screenshot checkpoints:** Начало: Огонь возле союзников → Ключевое действие: Стрелять каждым типом возле союзника → Результат: Дружественный огонь игроков отключён; environmental damage проверять отдельно
- **Что визуально проверить:** HP обоих и источник damage
- **Possible problems:** Смешение friendly fire и barrel damage
- **Status:** Not Run

## 05 Enemy Types (11)

### ENEMY-NORMAL-001 — Офисный кур: угроза и ответ

- **Area:** 05 Enemy Types
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Встреча normal, обычный HP
- **Steps:** 1) Распознать врага до урона; 2) подойти и отступить от melee; 3) добить
- **Expected Result:** Атака соответствует типу, опасность читается до попадания
- **Screenshot checkpoints:** Начало: Офисный кур: угроза и ответ → Ключевое действие: Распознать врага до урона → Результат: Атака соответствует типу, опасность читается до попадания
- **Что визуально проверить:** Силуэт, telegraph, смерть
- **Possible problems:** Неотличимый тип или скрытая атака
- **Status:** Not Run

### ENEMY-FAST-001 — Стажёр: угроза и ответ

- **Area:** 05 Enemy Types
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Встреча fast, обычный HP
- **Steps:** 1) Распознать врага до урона; 2) бежать от быстрой атаки; 3) добить
- **Expected Result:** Атака соответствует типу, опасность читается до попадания
- **Screenshot checkpoints:** Начало: Стажёр: угроза и ответ → Ключевое действие: Распознать врага до урона → Результат: Атака соответствует типу, опасность читается до попадания
- **Что визуально проверить:** Силуэт, telegraph, смерть
- **Possible problems:** Неотличимый тип или скрытая атака
- **Status:** Not Run

### ENEMY-FAT-001 — Менеджер: угроза и ответ

- **Area:** 05 Enemy Types
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Встреча fat, обычный HP
- **Steps:** 1) Распознать врага до урона; 2) сравнить скорость, живучесть и knockback; 3) добить
- **Expected Result:** Атака соответствует типу, опасность читается до попадания
- **Screenshot checkpoints:** Начало: Менеджер: угроза и ответ → Ключевое действие: Распознать врага до урона → Результат: Атака соответствует типу, опасность читается до попадания
- **Что визуально проверить:** Силуэт, telegraph, смерть
- **Possible problems:** Неотличимый тип или скрытая атака
- **Status:** Not Run

### ENEMY-SPITTER-001 — Плевун: угроза и ответ

- **Area:** 05 Enemy Types
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Встреча spitter, обычный HP
- **Steps:** 1) Распознать врага до урона; 2) уклониться от плевка и спрятаться за стеной; 3) добить
- **Expected Result:** Атака соответствует типу, опасность читается до попадания
- **Screenshot checkpoints:** Начало: Плевун: угроза и ответ → Ключевое действие: Распознать врага до урона → Результат: Атака соответствует типу, опасность читается до попадания
- **Что визуально проверить:** Силуэт, telegraph, смерть
- **Possible problems:** Неотличимый тип или скрытая атака
- **Status:** Not Run

### ENEMY-ARMORED-001 — Охранник: угроза и ответ

- **Area:** 05 Enemy Types
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Встреча armored, обычный HP
- **Steps:** 1) Распознать врага до урона; 2) сравнить пули с огнём и взрывом; 3) добить
- **Expected Result:** Атака соответствует типу, опасность читается до попадания
- **Screenshot checkpoints:** Начало: Охранник: угроза и ответ → Ключевое действие: Распознать врага до урона → Результат: Атака соответствует типу, опасность читается до попадания
- **Что визуально проверить:** Силуэт, telegraph, смерть
- **Possible problems:** Неотличимый тип или скрытая атака
- **Status:** Not Run

### ENEMY-EXPLODER-001 — Химик: угроза и ответ

- **Area:** 05 Enemy Types
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Встреча exploder, обычный HP
- **Steps:** 1) Распознать врага до урона; 2) наблюдать fuse, отойти и убить на расстоянии; 3) добить
- **Expected Result:** Атака соответствует типу, опасность читается до попадания
- **Screenshot checkpoints:** Начало: Химик: угроза и ответ → Ключевое действие: Распознать врага до урона → Результат: Атака соответствует типу, опасность читается до попадания
- **Что визуально проверить:** Силуэт, telegraph, смерть
- **Possible problems:** Неотличимый тип или скрытая атака
- **Status:** Not Run

### ENEMY-CHICK-001 — Цыплёнок: угроза и ответ

- **Area:** 05 Enemy Types
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Встреча chick, обычный HP
- **Steps:** 1) Распознать врага до урона; 2) отбиться от небольшой стаи; 3) добить
- **Expected Result:** Атака соответствует типу, опасность читается до попадания
- **Screenshot checkpoints:** Начало: Цыплёнок: угроза и ответ → Ключевое действие: Распознать врага до урона → Результат: Атака соответствует типу, опасность читается до попадания
- **Что визуально проверить:** Силуэт, telegraph, смерть
- **Possible problems:** Неотличимый тип или скрытая атака
- **Status:** Not Run

### ENEMY-JUMPER-001 — Прыгун: угроза и ответ

- **Area:** 05 Enemy Types
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Встреча jumper, обычный HP
- **Steps:** 1) Распознать врага до урона; 2) уклониться от прыжка на улице; 3) добить
- **Expected Result:** Атака соответствует типу, опасность читается до попадания
- **Screenshot checkpoints:** Начало: Прыгун: угроза и ответ → Ключевое действие: Распознать врага до урона → Результат: Атака соответствует типу, опасность читается до попадания
- **Что визуально проверить:** Силуэт, telegraph, смерть
- **Possible problems:** Неотличимый тип или скрытая атака
- **Status:** Not Run

### ENEMY-AI-001 — Пути через двери и мебель

- **Area:** 05 Enemy Types
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Смешанная группа у дверей
- **Steps:** 1) Увести группу вокруг столов; 2) пройти дверной проём; 3) вернуться
- **Expected Result:** Враги достигают игрока по доступному пути, не атакуют сквозь стену
- **Screenshot checkpoints:** Начало: Пути через двери и мебель → Ключевое действие: Увести группу вокруг столов → Результат: Враги достигают игрока по доступному пути, не атакуют сквозь стену
- **Что визуально проверить:** Заторы и атаки у косяков
- **Possible problems:** Недоступный последний враг
- **Status:** Not Run

### ENEMY-SPAWN-002 — Вход новой стаи

- **Area:** 05 Enemy Types
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Scripted wave кампании
- **Steps:** 1) Встать у входа волны; 2) вызвать событие; 3) наблюдать появление
- **Expected Result:** Нет неконтролируемого появления прямо в теле игрока, выход видим
- **Screenshot checkpoints:** Начало: Вход новой стаи → Ключевое действие: Встать у входа волны → Результат: Нет неконтролируемого появления прямо в теле игрока, выход видим
- **Что визуально проверить:** Rise и расстояние spawn
- **Possible problems:** Мгновенный невидимый урон
- **Status:** Not Run

### ENEMY-DEATH-003 — Однократная смерть и drop

- **Area:** 05 Enemy Types
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Враг под перекрёстным огнём
- **Steps:** 1) Добить одновременно несколькими попаданиями; 2) проверить score/drop
- **Expected Result:** Одна смерть и один допустимый drop
- **Screenshot checkpoints:** Начало: Однократная смерть и drop → Ключевое действие: Добить одновременно несколькими попаданиями → Результат: Одна смерть и один допустимый drop
- **Что визуально проверить:** Труп, pickup, счёт
- **Possible problems:** Двойной kill/drop
- **Status:** Not Run

## 06 NPC / Rescue / Escort / Companions (6)

### NPC-RESCUE-001 — Пять друзей на этаже 7

- **Area:** 06 NPC / Rescue / Escort / Companions
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Office7 до открытия Castor
- **Steps:** 1) Победить мутировавшую Елену; 2) взять пропуск; 3) освободить Андрея/Серёгу, Влада, Стаса и Пашу
- **Expected Result:** Все пять спасены, objective отражает реальный прогресс
- **Screenshot checkpoints:** Начало: Пять друзей на этаже 7 → Ключевое действие: Победить мутировавшую Елену → Результат: Все пять спасены, objective отражает реальный прогресс
- **Что визуально проверить:** Имена, counter и follow
- **Possible problems:** Пропуск потерян, неверный rescue count
- **Status:** Not Run

### NPC-ESCORT-002 — Группа в дверном проёме

- **Area:** 06 NPC / Rescue / Escort / Companions
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Несколько following NPC
- **Steps:** 1) Пройти узкую дверь и вокруг мебели; 2) резко развернуться
- **Expected Result:** NPC не блокируют игрока и следуют по пути
- **Screenshot checkpoints:** Начало: Группа в дверном проёме → Ключевое действие: Пройти узкую дверь и вокруг мебели → Результат: NPC не блокируют игрока и следуют по пути
- **Что визуально проверить:** Расстояния и стопы
- **Possible problems:** Колонна застревает
- **Status:** Not Run

### NPC-FOLLOW-003 — Tap и удержание E возле NPC

- **Area:** 06 NPC / Rescue / Escort / Companions
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Следующий NPC рядом
- **Steps:** 1) Нажать E один раз; 2) удерживать; 3) отпустить; 4) повторить tap
- **Expected Result:** World interaction выполняется один раз на нажатие, follow не переключается многократно
- **Screenshot checkpoints:** Начало: Tap и удержание E возле NPC → Ключевое действие: Нажать E один раз → Результат: World interaction выполняется один раз на нажатие, follow не переключается многократно
- **Что визуально проверить:** Реплика и состояние NPC
- **Possible problems:** Дребезг режима
- **Status:** Not Run

### NPC-COMBAT-004 — Вооружённый спутник

- **Area:** 06 NPC / Rescue / Escort / Companions
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Вооружённый companion и враги
- **Steps:** 1) Вступить в бой; 2) отойти за стену; 3) вернуться
- **Expected Result:** NPC стреляет в доступных врагов, не сквозь стены
- **Screenshot checkpoints:** Начало: Вооружённый спутник → Ключевое действие: Вступить в бой → Результат: NPC стреляет в доступных врагов, не сквозь стены
- **Что визуально проверить:** Ствол, линия огня и kill
- **Possible problems:** Прострел мебели или постоянно стреляет в пустоту
- **Status:** Not Run

### NPC-SEPARATE-005 — Потерявшийся спутник

- **Area:** 06 NPC / Rescue / Escort / Companions
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Following NPC
- **Steps:** 1) Убежать далеко; 2) вернуться; 3) пройти несколько комнат
- **Expected Result:** Companion сохраняет follow и может догнать без телепорта в препятствие
- **Screenshot checkpoints:** Начало: Потерявшийся спутник → Ключевое действие: Убежать далеко → Результат: Companion сохраняет follow и может догнать без телепорта в препятствие
- **Что визуально проверить:** Маршрут и marker
- **Possible problems:** Потеря companion без объяснения
- **Status:** Not Run

### NPC-TRANSITION-006 — Эвакуация сюжетных друзей

- **Area:** 06 NPC / Rescue / Escort / Companions
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Все друзья office7 у выхода
- **Steps:** 1) Завершить escort; 2) перейти office8; 3) проверить спутников и реплики
- **Expected Result:** Сюжетная эвакуация согласована с переходом, перенесены только предусмотренные companions
- **Screenshot checkpoints:** Начало: Эвакуация сюжетных друзей → Ключевое действие: Завершить escort → Результат: Сюжетная эвакуация согласована с переходом, перенесены только предусмотренные companions
- **Что визуально проверить:** Result и новые NPC
- **Possible problems:** Дубли NPC, ложное ожидание переноса всех друзей
- **Status:** Not Run

## 07 NPC Mutation (8)

### MUTATION-VISUAL-001 — Предвестник превращения

- **Area:** 07 NPC Mutation
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** NPC перед scheduled mutation
- **Steps:** 1) Наблюдать twitch/перья; 2) не пропускать реплики; 3) дождаться превращения
- **Expected Result:** Понятно, какой союзник превращается; визуальная мутация около 2.2 с
- **Screenshot checkpoints:** Начало: Предвестник превращения → Ключевое действие: Наблюдать twitch/перья → Результат: Понятно, какой союзник превращается; визуальная мутация около 2.2 с
- **Что визуально проверить:** Человек, промежуточная стадия и мутант
- **Possible problems:** Исчезновение и случайный spawn
- **Status:** Not Run

### MUTATION-COMBAT-002 — Прекращение союзного огня

- **Area:** 07 NPC Mutation
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Вооружённый NPC начинает мутацию
- **Steps:** 1) Драться рядом; 2) следить за NPC во время превращения и после
- **Expected Result:** Не стреляет как союзник при mutation, враг не атакует до завершения
- **Screenshot checkpoints:** Начало: Прекращение союзного огня → Ключевое действие: Драться рядом → Результат: Не стреляет как союзник при mutation, враг не атакует до завершения
- **Что визуально проверить:** Оружие, aim и damage
- **Possible problems:** Одновременно союзник и враг
- **Status:** Not Run

### MUTATION-DROP-003 — Ключ и оружие после мутации

- **Area:** 07 NPC Mutation
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Елена или Ирина с сюжетным предметом
- **Steps:** 1) Дождаться мутации; 2) убить; 3) подобрать ключ; 4) пройти gate
- **Expected Result:** Сюжетный предмет доступен ровно один раз, прохождение сохраняется
- **Screenshot checkpoints:** Начало: Ключ и оружие после мутации → Ключевое действие: Дождаться мутации → Результат: Сюжетный предмет доступен ровно один раз, прохождение сохраняется
- **Что визуально проверить:** Ключ и objective
- **Possible problems:** Обязательный drop в стене или исчезает
- **Status:** Not Run

### MUTATION-WALL-004 — Превращение в узком месте

- **Area:** 07 NPC Mutation
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** NPC у двери/мебели
- **Steps:** 1) Дождаться мутации возле стены; 2) уйти и вернуться; 3) добить
- **Expected Result:** Мутант занимает доступную позицию и не остаётся невидимым
- **Screenshot checkpoints:** Начало: Превращение в узком месте → Ключевое действие: Дождаться мутации возле стены → Результат: Мутант занимает доступную позицию и не остаётся невидимым
- **Что визуально проверить:** Feet/depth до и после
- **Possible problems:** Невидимый враг, stale sprite
- **Status:** Not Run

### MUTATION-NETWORK-005 — Одна мутация на двух клиентах

- **Area:** 07 NPC Mutation
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Co-op 2 клиента до мутации
- **Steps:** 1) Наблюдать одновременно; 2) третьим клиентом войти в середине
- **Expected Result:** Все видят одно состояние, один мутант и drop
- **Screenshot checkpoints:** Начало: Одна мутация на двух клиентах → Ключевое действие: Наблюдать одновременно → Результат: Все видят одно состояние, один мутант и drop
- **Что визуально проверить:** Скриншоты A/B/C с timestamp
- **Possible problems:** Двойная сущность или рассинхрон
- **Status:** Not Run

### MUTATION-REJOIN-006 — Возврат во время мутации

- **Area:** 07 NPC Mutation
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Co-op, NPC начинает mutation
- **Steps:** 1) Разорвать соединение A; 2) вернуть после превращения
- **Expected Result:** Стадия не перезапускается, назначение не reroll, drop не повторяется
- **Screenshot checkpoints:** Начало: Возврат во время мутации → Ключевое действие: Разорвать соединение A → Результат: Стадия не перезапускается, назначение не reroll, drop не повторяется
- **Что визуально проверить:** Внешность и pickup после возврата
- **Possible problems:** Reroll или повторная выдача
- **Status:** Not Run

### MUTATION-MULTI-007 — Несколько сюжетных превращений

- **Area:** 07 NPC Mutation
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Этаж с несколькими мутирующими NPC
- **Steps:** 1) Вызвать близкие сюжетные события; 2) наблюдать каждый NPC
- **Expected Result:** Каждая сущность очищена и заменена один раз; ограничения random не применять к scripted
- **Screenshot checkpoints:** Начало: Несколько сюжетных превращений → Ключевое действие: Вызвать близкие сюжетные события → Результат: Каждая сущность очищена и заменена один раз; ограничения random не применять к scripted
- **Что визуально проверить:** Отдельные силуэты и имена
- **Possible problems:** Смешение двух мутаций
- **Status:** Not Run

### MUTATION-TRANSITION-008 — Смена этажа после превращения

- **Area:** 07 NPC Mutation
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Companion мутировал у финальной цели
- **Steps:** 1) Закончить этаж; 2) перейти дальше
- **Expected Result:** Не остаются старые FX, заражение не дублирует companion
- **Screenshot checkpoints:** Начало: Смена этажа после превращения → Ключевое действие: Закончить этаж → Результат: Не остаются старые FX, заражение не дублирует companion
- **Что визуально проверить:** Новая сцена и result
- **Possible problems:** Призрачные следы и двойной companion
- **Status:** Not Run

## 08 Support / One-button Interaction (12)

### SUPPORT-AMMO-001 — Короткий tap передаёт магазин

- **Area:** 08 Support / One-button Interaction
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A имеет ammo supply, B с дефицитом резерва
- **Steps:** 1) Подойти на свободной линии; 2) tap E короче 0.22 с; 3) проверить A/B
- **Expected Result:** A тратит 1 supply, B получает один магазин в reserve до cap
- **Screenshot checkpoints:** Начало: Короткий tap передаёт магазин → Ключевое действие: Подойти на свободной линии → Результат: A тратит 1 supply, B получает один магазин в reserve до cap
- **Что визуально проверить:** Имя цели, ammo и help feedback
- **Possible problems:** Неверное оружие, двойной расход
- **Status:** Not Run

### SUPPORT-HEAL-002 — Лечение союзника удержанием

- **Area:** 08 Support / One-button Interaction
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A имеет аптечку, B ранен
- **Steps:** 1) Удерживать E 1.2 с; 2) продолжить удерживать ещё секунду
- **Expected Result:** B +40 HP до max, одна аптечка списана один раз
- **Screenshot checkpoints:** Начало: Лечение союзника удержанием → Ключевое действие: Удерживать E 1.2 с → Результат: B +40 HP до max, одна аптечка списана один раз
- **Что визуально проверить:** Progress и здоровье
- **Possible problems:** Повтор лечения от удержания
- **Status:** Not Run

### SUPPORT-SELF-003 — Самолечение без друга

- **Area:** 08 Support / One-button Interaction
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Ранен A с аптечкой, рядом нет eligible B
- **Steps:** 1) Удержать E; 2) отпустить; 3) повторить без ресурса
- **Expected Result:** +40 HP один раз, без аптечки эффекта нет
- **Screenshot checkpoints:** Начало: Самолечение без друга → Ключевое действие: Удержать E → Результат: +40 HP один раз, без аптечки эффекта нет
- **Что визуально проверить:** Self target и progress
- **Possible problems:** Self-heal скрыт или бесплатен
- **Status:** Not Run

### SUPPORT-REVIVE-004 — Поднятие раненого

- **Area:** 08 Support / One-button Interaction
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** B downed, A жив
- **Steps:** 1) Подойти; 2) удерживать E 2.6 с
- **Expected Result:** B alive с 45 HP, расходники не нужны
- **Screenshot checkpoints:** Начало: Поднятие раненого → Ключевое действие: Подойти → Результат: B alive с 45 HP, расходники не нужны
- **Что визуально проверить:** Down alert, кольцо, progress, standing pose
- **Possible problems:** Бегущий downed, неправильное HP
- **Status:** Not Run

### SUPPORT-CANCEL-005 — Отмена перед завершением

- **Area:** 08 Support / One-button Interaction
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A помогает B
- **Steps:** 1) Отпустить E на 90%; 2) начать снова
- **Expected Result:** Отменённый progress сброшен, resource не списан
- **Screenshot checkpoints:** Начало: Отмена перед завершением → Ключевое действие: Отпустить E на 90% → Результат: Отменённый progress сброшен, resource не списан
- **Что визуально проверить:** Сброс кольца
- **Possible problems:** Продолжение старого progress
- **Status:** Not Run

### SUPPORT-MOVE-006 — Отмена движением и стрельбой

- **Area:** 08 Support / One-button Interaction
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Идёт hold heal/revive
- **Steps:** 1) Сдвинуться дальше 8 units; 2) повторить и выстрелить
- **Expected Result:** Помощь отменена, ресурс не потрачен
- **Screenshot checkpoints:** Начало: Отмена движением и стрельбой → Ключевое действие: Сдвинуться дальше 8 units → Результат: Помощь отменена, ресурс не потрачен
- **Что визуально проверить:** HUD и отсутствие help completion
- **Possible problems:** Heal при беге или fire
- **Status:** Not Run

### SUPPORT-LOS-007 — Преграда между игроками

- **Area:** 08 Support / One-button Interaction
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A/B близко по разные стороны стены
- **Steps:** 1) Tap/hold E; 2) открыть дверь; 3) повторить
- **Expected Result:** Через стену нет помощи, с открытой линией действие доступно
- **Screenshot checkpoints:** Начало: Преграда между игроками → Ключевое действие: Tap/hold E → Результат: Через стену нет помощи, с открытой линией действие доступно
- **Что визуально проверить:** Target prompt и progress
- **Possible problems:** Поднятие сквозь стену
- **Status:** Not Run

### SUPPORT-RANGE-008 — Граница 110 units

- **Area:** 08 Support / One-button Interaction
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** 2 клиента на свежей rules6 комнате
- **Steps:** 1) Проверить чуть внутри/снаружи 110; 2) отвести B во время hold
- **Expected Result:** Помощь доступна только в радиусе, выход отменяет
- **Screenshot checkpoints:** Начало: Граница 110 units → Ключевое действие: Проверить чуть внутри/снаружи 110 → Результат: Помощь доступна только в радиусе, выход отменяет
- **Что визуально проверить:** Подсказка на границе
- **Possible problems:** Плановые 80 ошибочно считаются current rules
- **Status:** Not Run

### SUPPORT-PRIORITY-009 — Приоритет downed и фиксация цели

- **Area:** 08 Support / One-button Interaction
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A рядом с раненым B и downed C
- **Steps:** 1) Начать E; 2) двигать B ближе; 3) завершить
- **Expected Result:** Выбран C, цель не прыгает во время hold
- **Screenshot checkpoints:** Начало: Приоритет downed и фиксация цели → Ключевое действие: Начать E → Результат: Выбран C, цель не прыгает во время hold
- **Что визуально проверить:** Имя C и progress
- **Possible problems:** Лечится не тот игрок
- **Status:** Not Run

### SUPPORT-TWO-010 — Два помощника одному

- **Area:** 08 Support / One-button Interaction
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A/C с аптечкой, B ранен/downed
- **Steps:** 1) Одновременно hold на B; 2) завершить; 3) проверить всех
- **Expected Result:** Один владелец действия, нет ускорения/двойного расхода
- **Screenshot checkpoints:** Начало: Два помощника одному → Ключевое действие: Одновременно hold на B → Результат: Один владелец действия, нет ускорения/двойного расхода
- **Что визуально проверить:** Progress A/C и B HP
- **Possible problems:** +80 HP или двойной revive
- **Status:** Not Run

### SUPPORT-NONE-011 — Отсутствие расходника и полный reserve

- **Area:** 08 Support / One-button Interaction
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A без supplies или B с полным резервом
- **Steps:** 1) Tap/hold возле B; 2) рядом использовать NPC/пульт
- **Expected Result:** Нет phantom support, world interaction остаётся доступным
- **Screenshot checkpoints:** Начало: Отсутствие расходника и полный reserve → Ключевое действие: Tap/hold возле B → Результат: Нет phantom support, world interaction остаётся доступным
- **Что визуально проверить:** Правильная подпись E
- **Possible problems:** Фальшивое обещание передачи
- **Status:** Not Run

### SUPPORT-HIT-012 — Помощь под атакой

- **Area:** 08 Support / One-button Interaction
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** B downed, враг рядом
- **Steps:** 1) Начать revive; 2) получить урон; 3) завершить либо погибнуть
- **Expected Result:** Результат согласован с фактическими правилами; смерть/утрата valid state отменяет, сам урон не обязан отменять
- **Screenshot checkpoints:** Начало: Помощь под атакой → Ключевое действие: Начать revive → Результат: Результат согласован с фактическими правилами; смерть/утрата valid state отменяет, сам урон не обязан отменять
- **Что визуально проверить:** HP, timer и progress
- **Possible problems:** Ложное требование cancel от любого урона
- **Status:** Not Run

## 09 Objectives and Navigation (5)

### OBJECTIVE-FLOW-001 — Последовательная цель

- **Area:** 09 Objectives and Navigation
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Кампания без знания карты; yellow path guide включён
- **Steps:** 1) Выполнить действие objective; 2) посмотреть следующий текст и стрелку
- **Expected Result:** Текст и target обновляются после действия
- **Screenshot checkpoints:** Начало: Последовательная цель → Ключевое действие: Выполнить действие objective → Результат: Текст и target обновляются после действия
- **Что визуально проверить:** Точный объект новой цели
- **Possible problems:** Старый objective
- **Status:** Not Run

### OBJECTIVE-NAV-002 — Обход стены

- **Area:** 09 Objectives and Navigation
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Цель за стеной и дверным маршрутом
- **Steps:** 1) Следовать yellow guide; 2) обойти мебель и дверь
- **Expected Result:** Стрелка ведёт по доступному маршруту, цель достигается
- **Screenshot checkpoints:** Начало: Обход стены → Ключевое действие: Следовать yellow guide → Результат: Стрелка ведёт по доступному маршруту, цель достигается
- **Что визуально проверить:** Направление у развилок
- **Possible problems:** Указатель сквозь стену
- **Status:** Not Run

### OBJECTIVE-MULTI-003 — Несколько целей

- **Area:** 09 Objectives and Navigation
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Вентили factory или визы office11
- **Steps:** 1) Выбрать одну из целей; 2) выполнить; 3) сменить маршрут
- **Expected Result:** Выполненная цель исключена, остальные доступны
- **Screenshot checkpoints:** Начало: Несколько целей → Ключевое действие: Выбрать одну из целей → Результат: Выполненная цель исключена, остальные доступны
- **Что визуально проверить:** Counter и стабильность guide
- **Possible problems:** Стрелка мечется
- **Status:** Not Run

### OBJECTIVE-KEY-004 — Ключ подобрал другой клиент

- **Area:** 09 Objectives and Navigation
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A/B, key лежит после мутации
- **Steps:** 1) B берёт ключ; 2) A проверяет дверь и objective
- **Expected Result:** Общая сюжетная цель и доступ обновлены на обоих
- **Screenshot checkpoints:** Начало: Ключ подобрал другой клиент → Ключевое действие: B берёт ключ → Результат: Общая сюжетная цель и доступ обновлены на обоих
- **Что визуально проверить:** HUD A/B и дверь
- **Possible problems:** Ключ есть, UI обещает найти снова
- **Status:** Not Run

### OBJECTIVE-UX-005 — Самостоятельный маршрут игрока

- **Area:** 09 Objectives and Navigation
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Кампания без знания карты; yellow path guide включён
- **Steps:** 1) Записать 3 места остановки из-за непонятного маршрута; 2) измерить поиск цели
- **Expected Result:** UX findings содержат конкретное место, время и небольшое предложение
- **Screenshot checkpoints:** Начало: Самостоятельный маршрут игрока → Ключевое действие: Записать 3 места остановки из-за непонятного маршрута → Результат: UX findings содержат конкретное место, время и небольшое предложение
- **Что визуально проверить:** Ориентир, arrow и подсказки
- **Possible problems:** Длительный поиск без решения
- **Status:** Not Run

## 10 Campaign / Locations (33)

### OFFICE-FLOW-001 — Этаж 6 от старта до лифта

- **Area:** 10 Campaign / Locations
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Новая игра office
- **Steps:** 1) Осмотреть офис; 2) открыть сюжетный маршрут; 3) перезагрузить сервер; 4) закончить этаж
- **Expected Result:** Цепочка ведёт в office7 без soft-lock
- **Screenshot checkpoints:** Начало: Этаж 6 от старта до лифта → Ключевое действие: Осмотреть офис → Результат: Цепочка ведёт в office7 без soft-lock
- **Что визуально проверить:** Objective, blackout и лифт
- **Possible problems:** Застрявший последний враг
- **Status:** Not Run

### OFFICE-COMBAT-002 — Коридорные мутации и лифтовая встреча

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Office rules6
- **Steps:** 1) Пройти коридор; 2) дождаться превращений; 3) восстановить электричество
- **Expected Result:** Текущие сюжетные встречи конечны и читаемы
- **Screenshot checkpoints:** Начало: Коридорные мутации и лифтовая встреча → Ключевое действие: Пройти коридор → Результат: Текущие сюжетные встречи конечны и читаемы
- **Что визуально проверить:** NPC до/после, дверь
- **Possible problems:** Недоступный обязательный бой
- **Status:** Not Run

### OFFICE-VISUAL-003 — Передние стены и столы

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Игрок среди офисной мебели
- **Steps:** 1) Обойти стол сверху/снизу; 2) пройти за фасадом
- **Expected Result:** Feet depth корректен, закрывающая стена прозрачна
- **Screenshot checkpoints:** Начало: Передние стены и столы → Ключевое действие: Обойти стол сверху/снизу → Результат: Feet depth корректен, закрывающая стена прозрачна
- **Что визуально проверить:** Игрок и оружие за мебелью
- **Possible problems:** Персонаж полностью потерян
- **Status:** Not Run

### OFFICE7-FLOW-001 — Castor и ключ Елены

- **Area:** 10 Campaign / Locations
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Вход office7
- **Steps:** 1) Снять осаду; 2) встретить Елену; 3) победить мутанта; 4) открыть Castor
- **Expected Result:** Ключ доступен, спасение Андрея/Серёги продолжается
- **Screenshot checkpoints:** Начало: Castor и ключ Елены → Ключевое действие: Снять осаду → Результат: Ключ доступен, спасение Андрея/Серёги продолжается
- **Что визуально проверить:** Пропуск и счёт спасённых
- **Possible problems:** Ключ за препятствием
- **Status:** Not Run

### OFFICE7-ESCORT-002 — Менеджер и Рутовый петушок

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Пять друзей спасены
- **Steps:** 1) Сопроводить к менеджеру; 2) уклоняться от тарана; 3) подобрать трофей; 4) уйти в лифт
- **Expected Result:** Manager и trophy gate завершены, следующий office8
- **Screenshot checkpoints:** Начало: Менеджер и Рутовый петушок → Ключевое действие: Сопроводить к менеджеру → Результат: Manager и trophy gate завершены, следующий office8
- **Что визуально проверить:** Таран, трофей и result
- **Possible problems:** Пропущенный трофей без навигации
- **Status:** Not Run

### OFFICE7-ORDER-003 — Разный порядок спасений

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Office7 новый run
- **Steps:** 1) Спасти Влада/Стаса/Пашу в другом порядке; 2) вернуть группу к выходу
- **Expected Result:** Порядок не ломает counters и unlock
- **Screenshot checkpoints:** Начало: Разный порядок спасений → Ключевое действие: Спасти Влада/Стаса/Пашу в другом порядке → Результат: Порядок не ломает counters и unlock
- **Что визуально проверить:** Objective после каждого rescue
- **Possible problems:** Скрытая зависимость от порядка
- **Status:** Not Run

### OFFICE8-SOLO-001 — Два размыкателя с Нелей

- **Area:** 10 Campaign / Locations
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Office8 solo
- **Steps:** 1) Выслушать Нелю; 2) идти к западному; 3) дождаться готовности; 4) активировать
- **Expected Result:** Неля помогает восточным, дверь открывается без второго человека
- **Screenshot checkpoints:** Начало: Два размыкателя с Нелей → Ключевое действие: Выслушать Нелю → Результат: Неля помогает восточным, дверь открывается без второго человека
- **Что визуально проверить:** Ready сообщение и lock states
- **Possible problems:** Solo soft-lock
- **Status:** Not Run

### OFFICE8-COOP-002 — Окно размыкателей

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Office8 2 живых клиента
- **Steps:** 1) Активировать оба за 6 с; 2) повторить с интервалом больше 6 с
- **Expected Result:** В окне открывается, просроченная попытка сбрасывается и повторима
- **Screenshot checkpoints:** Начало: Окно размыкателей → Ключевое действие: Активировать оба за 6 с → Результат: В окне открывается, просроченная попытка сбрасывается и повторима
- **Что визуально проверить:** Отсчёт и дверь
- **Possible problems:** Невозможный retry
- **Status:** Not Run

### OFFICE8-DROP-003 — Один коллега выбыл

- **Area:** 10 Campaign / Locations
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Office8 2 клиента до открытия
- **Steps:** 1) Отключить или потерять второго; 2) продолжить одним
- **Expected Result:** Неля берёт помощь на себя, этап остаётся проходимым
- **Screenshot checkpoints:** Начало: Один коллега выбыл → Ключевое действие: Отключить или потерять второго → Результат: Неля берёт помощь на себя, этап остаётся проходимым
- **Что визуально проверить:** Objective для solo
- **Possible problems:** Старая двухигроковая задача
- **Status:** Not Run

### OFFICE8-SLEEP-004 — Спящие и фонарь

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Тёмный коридор office8
- **Steps:** 1) Подойти, посветить, стрелять в спящих; 2) наблюдать соседей
- **Expected Result:** Спящие/проснувшиеся различимы, луч влияет по текущей механике
- **Screenshot checkpoints:** Начало: Спящие и фонарь → Ключевое действие: Подойти, посветить, стрелять в спящих → Результат: Спящие/проснувшиеся различимы, луч влияет по текущей механике
- **Что визуально проверить:** Красные глаза, flashlight cone
- **Possible problems:** Невидимые активные враги
- **Status:** Not Run

### OFFICE8-HORROR-005 — Пугалки и Валера

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** До рубильника office8
- **Steps:** 1) Пережить scripted scares; 2) включить рубильник; 3) держать Валеру в луче; 4) победить
- **Expected Result:** Нет spawn внутри непроходимой стены; свет и лифт доступны после победы
- **Screenshot checkpoints:** Начало: Пугалки и Валера → Ключевое действие: Пережить scripted scares → Результат: Нет spawn внутри непроходимой стены; свет и лифт доступны после победы
- **Что визуально проверить:** Telegraph, boss HP и возвращение света
- **Possible problems:** Scare damage без реакции
- **Status:** Not Run

### OFFICE11-VISAS-001 — Три визы в разном порядке

- **Area:** 10 Campaign / Locations
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Office11 до разговора с Жанной
- **Steps:** 1) Получить финансы; 2) собрать 3 анкеты HR; 3) убить Ирину; 4) сопроводить юриста
- **Expected Result:** Все визы доступны, objective 3/3, запись на совещание открыта
- **Screenshot checkpoints:** Начало: Три визы в разном порядке → Ключевое действие: Получить финансы → Результат: Все визы доступны, objective 3/3, запись на совещание открыта
- **Что визуально проверить:** Counter, анкеты, drop HR
- **Possible problems:** Виза теряется
- **Status:** Not Run

### OFFICE11-ESCORT-002 — Юрист до приёмной

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Аркадий следует за игроком
- **Steps:** 1) Провести через двери; 2) уйти и вернуться; 3) доставить
- **Expected Result:** Виза выдаётся в приёмной однократно
- **Screenshot checkpoints:** Начало: Юрист до приёмной → Ключевое действие: Провести через двери → Результат: Виза выдаётся в приёмной однократно
- **Что визуально проверить:** Путь NPC и штамп
- **Possible problems:** NPC застрял у входа
- **Status:** Not Run

### OFFICE11-MEETING-003 — Совещание 75 секунд

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** 3 визы получены
- **Steps:** 1) Начать у Жанны; 2) выдержать 75 с; 3) повторно E; 4) победить директора
- **Expected Result:** Одно совещание, конечные события, пропуск на cafe12
- **Screenshot checkpoints:** Начало: Совещание 75 секунд → Ключевое действие: Начать у Жанны → Результат: Одно совещание, конечные события, пропуск на cafe12
- **Что визуально проверить:** Timer, волны, director telegraph
- **Possible problems:** Двойной timer, бесконечные волны
- **Status:** Not Run

### CAFE12-FLOW-001 — Обед и падение вертолёта

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Вход cafe12, часть команды ранена
- **Steps:** 1) Подойти к окну/обеду; 2) дождаться сцены; 3) войти в лифт
- **Expected Result:** Передышка лечит по реализации, scene заканчивается, next street1
- **Screenshot checkpoints:** Начало: Обед и падение вертолёта → Ключевое действие: Подойти к окну/обеду → Результат: Передышка лечит по реализации, scene заканчивается, next street1
- **Что визуально проверить:** Окно, камера, chapter result
- **Possible problems:** Кат-сцена не отпускает input
- **Status:** Not Run

### CAFE12-TEAM-002 — Команда и lift gate

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Cafe12 2 клиента
- **Steps:** 1) Оставить B у окна; 2) A идти в лифт; 3) затем подвести B
- **Expected Result:** Живых игроков корректно ждут, gate объясним
- **Screenshot checkpoints:** Начало: Команда и lift gate → Ключевое действие: Оставить B у окна → Результат: Живых игроков корректно ждут, gate объясним
- **Что визуально проверить:** Waiting message и положение B
- **Possible problems:** Непонятное ожидание второго
- **Status:** Not Run

### STREET1-DEFENSE-001 — Вертолёт и 60 секунд

- **Area:** 10 Campaign / Locations
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Street1 обычный loadout
- **Steps:** 1) Дойти до Крылова; 2) начать оборону; 3) выжить; 4) пройти выход
- **Expected Result:** Оборона завершается и открывает street2
- **Screenshot checkpoints:** Начало: Вертолёт и 60 секунд → Ключевое действие: Дойти до Крылова → Результат: Оборона завершается и открывает street2
- **Что визуально проверить:** Timer, цель и выход
- **Possible problems:** Неясный старт обороны
- **Status:** Not Run

### STREET1-SIDE-002 — Шаурма и пирожок

- **Area:** 10 Campaign / Locations
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Street1 до optional NPC
- **Steps:** 1) Поговорить с Ашотом и Зиной; 2) собрать награды; 3) повторить
- **Expected Result:** Необязательные награды не дублируются и не блокируют сюжет
- **Screenshot checkpoints:** Начало: Шаурма и пирожок → Ключевое действие: Поговорить с Ашотом и Зиной → Результат: Необязательные награды не дублируются и не блокируют сюжет
- **Что визуально проверить:** Реплика и pickup
- **Possible problems:** Обязательный расход для optional
- **Status:** Not Run

### STREET1-JUMPER-003 — Прыгун среди машин

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Street1 встреча jumper
- **Steps:** 1) Уклоняться возле машины/бордюра; 2) атаковать в прыжке
- **Expected Result:** Атака видима и столкновения согласованы
- **Screenshot checkpoints:** Начало: Прыгун среди машин → Ключевое действие: Уклоняться возле машины/бордюра → Результат: Атака видима и столкновения согласованы
- **Что визуально проверить:** Траектория прыжка
- **Possible problems:** Прыжок сквозь твёрдую машину
- **Status:** Not Run

### STREET2-MARKET-001 — Яйца и конечная ловушка

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Street2 вход рынка
- **Steps:** 1) Поговорить с Валей; 2) активировать событие; 3) пережить волну
- **Expected Result:** Маршрут к заводу остаётся доступным
- **Screenshot checkpoints:** Начало: Яйца и конечная ловушка → Ключевое действие: Поговорить с Валей → Результат: Маршрут к заводу остаётся доступным
- **Что визуально проверить:** Gate, hatch FX и враги
- **Possible problems:** Бесконечный hatch
- **Status:** Not Run

### STREET2-ESCORT-002 — Стёпа и мутация

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Блогер следует
- **Steps:** 1) Провести по скверу; 2) наблюдать scripted mutation; 3) продолжить к проходной
- **Expected Result:** Потеря NPC понятна и не лишает обязательного ключа
- **Screenshot checkpoints:** Начало: Стёпа и мутация → Ключевое действие: Провести по скверу → Результат: Потеря NPC понятна и не лишает обязательного ключа
- **Что визуально проверить:** Стрим-реплика и узнаваемый мутант
- **Possible problems:** Сюжет зависим от исчезнувшего NPC
- **Status:** Not Run

### STREET2-GATE-003 — Толик, пропуск, ворота 40 с

- **Area:** 10 Campaign / Locations
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** У проходной до пропуска
- **Steps:** 1) Победить Толика; 2) подобрать пропуск; 3) включить пульт; 4) пережить 40 с
- **Expected Result:** Одно открытие gate, следующий factory
- **Screenshot checkpoints:** Начало: Толик, пропуск, ворота 40 с → Ключевое действие: Победить Толика → Результат: Одно открытие gate, следующий factory
- **Что визуально проверить:** Timer, reinforcement и chapter result
- **Possible problems:** Повторный E сбрасывает timer
- **Status:** Not Run

### FACTORY-VALVES-001 — Три вентиля и синтез

- **Area:** 10 Campaign / Locations
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Factory до цеха
- **Steps:** 1) Открывать в произвольном порядке; 2) повторить E; 3) выдержать 30 с
- **Expected Result:** Каждый вентиль один раз, синтез один раз, склад/лифт открыты
- **Screenshot checkpoints:** Начало: Три вентиля и синтез → Ключевое действие: Открывать в произвольном порядке → Результат: Каждый вентиль один раз, синтез один раз, склад/лифт открыты
- **Что визуально проверить:** 0/3→3/3 и alarm
- **Possible problems:** Двойная волна от spam
- **Status:** Not Run

### FACTORY-COMBAT-002 — Бочки и тесные проходы

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Двор/склад с большой группой
- **Steps:** 1) Использовать цепной взрыв; 2) отступить между стеллажами
- **Expected Result:** Взрыв читается, проходы остаются доступны
- **Screenshot checkpoints:** Начало: Бочки и тесные проходы → Ключевое действие: Использовать цепной взрыв → Результат: Взрыв читается, проходы остаются доступны
- **Что визуально проверить:** Barrels, blast radius и трупы
- **Possible problems:** FX скрывают угрозы
- **Status:** Not Run

### FACTORY-NPC-003 — Михалыч после обороны

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Warehouse wave
- **Steps:** 1) Закончить tagged wave; 2) проверить follow; 3) пройти exit
- **Expected Result:** Михалыч следует при допустимом состоянии, смерть не блокирует основной сюжет
- **Screenshot checkpoints:** Начало: Михалыч после обороны → Ключевое действие: Закончить tagged wave → Результат: Михалыч следует при допустимом состоянии, смерть не блокирует основной сюжет
- **Что визуально проверить:** NPC и objective
- **Possible problems:** Застрявший враг запрещает rescue
- **Status:** Not Run

### LAB-LIGHTING-001 — Фонарик и капсулы

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Lab без god
- **Steps:** 1) Пройти тёмный атриум; 2) навести фонарь; 3) вызвать hatch
- **Expected Result:** Враги, капсулы и кислота читаются до урона
- **Screenshot checkpoints:** Начало: Фонарик и капсулы → Ключевое действие: Пройти тёмный атриум → Результат: Враги, капсулы и кислота читаются до урона
- **Что визуально проверить:** Луч, emergency lights и силуэты
- **Possible problems:** Чёрный враг на чёрном фоне
- **Status:** Not Run

### LAB-DOORS-002 — Дезинфекция с отстающим другом

- **Area:** 10 Campaign / Locations
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Lab rules6, A впереди B
- **Steps:** 1) A входит в decon; 2) B догоняет позже; 3) пройти назад через arrival
- **Expected Result:** Двери decon/arrival не запираются в rules6, никто не отрезан
- **Screenshot checkpoints:** Начало: Дезинфекция с отстающим другом → Ключевое действие: A входит в decon → Результат: Двери decon/arrival не запираются в rules6, никто не отрезан
- **Что визуально проверить:** Door state на обоих
- **Possible problems:** Применение старого lockBehind
- **Status:** Not Run

### LAB-RESCUE-003 — Омлетов, armory и laser

- **Area:** 10 Campaign / Locations
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Lab до Омлетова
- **Steps:** 1) Спасти; 2) взять lab key и laser; 3) открыть armory; 4) включить generator
- **Expected Result:** Все обязательные действия доступны и ведут к boss
- **Screenshot checkpoints:** Начало: Омлетов, armory и laser → Ключевое действие: Спасти → Результат: Все обязательные действия доступны и ведут к boss
- **Что визуально проверить:** Drops и objective
- **Possible problems:** Pickup недоступен у мебели
- **Status:** Not Run

### LAB-GENERATOR-004 — Последняя волна генератора

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Generator активирован
- **Steps:** 1) Выдержать волны; 2) найти последнего tagged enemy; 3) пойти к freight
- **Expected Result:** Завершение конечное, lift goal соответствует реальному gate
- **Screenshot checkpoints:** Начало: Последняя волна генератора → Ключевое действие: Выдержать волны → Результат: Завершение конечное, lift goal соответствует реальному gate
- **Что визуально проверить:** Остаток врагов и выход
- **Possible problems:** Один застрявший enemy блокирует
- **Status:** Not Run

### BOSS-FLOW-001 — Представление и фазы

- **Area:** 10 Campaign / Locations
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Boss с естественным campaign loadout
- **Steps:** 1) Дождаться introduction; 2) сражаться через все фазы
- **Expected Result:** HP, фаза и атаки читаемы, бой требует ответа на угрозы
- **Screenshot checkpoints:** Начало: Представление и фазы → Ключевое действие: Дождаться introduction → Результат: HP, фаза и атаки читаемы, бой требует ответа на угрозы
- **Что визуально проверить:** Boss pose, HP, charge/attacks
- **Possible problems:** Большой normal без telegraph
- **Status:** Not Run

### BOSS-SUPPLY-002 — Подкрепления и аптечка

- **Area:** 10 Campaign / Locations
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Длительный boss fight rules6
- **Steps:** 1) Удерживать дистанцию; 2) наблюдать reinforcements; 3) проверить центр зала
- **Expected Result:** Припасы и подкрепления ведут себя как код; риск timer проверить фактически
- **Screenshot checkpoints:** Начало: Подкрепления и аптечка → Ключевое действие: Удерживать дистанцию → Результат: Припасы и подкрепления ведут себя как код; риск timer проверить фактически
- **Что визуально проверить:** Health pickup и плотность толпы
- **Possible problems:** Недоступная или вообще не возникающая аптечка
- **Status:** Not Run

### BOSS-VICTORY-003 — Смерть босса и финал

- **Area:** 10 Campaign / Locations
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Boss близок к смерти, A/B
- **Steps:** 1) Добить; 2) не нажимать skip; 3) дождаться victory; 4) вернуться в меню
- **Expected Result:** Все видят finale, враги/снаряды очищены, сохранение победы снято
- **Screenshot checkpoints:** Начало: Смерть босса и финал → Ключевое действие: Добить → Результат: Все видят finale, враги/снаряды очищены, сохранение победы снято
- **Что визуально проверить:** Камера, confetti FX и result
- **Possible problems:** Смерть после победы, зависшая cinematic
- **Status:** Not Run

### ARENA-SANDBOX-001 — Полигон отдельно от кампании

- **Area:** 10 Campaign / Locations
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Меню, есть solo save
- **Steps:** 1) Открыть Полигон; 2) тестировать оружие; 3) вернуться; 4) Continue solo
- **Expected Result:** Arena не заменяет campaign save и не входит в порядок глав
- **Screenshot checkpoints:** Начало: Полигон отдельно от кампании → Ключевое действие: Открыть Полигон → Результат: Arena не заменяет campaign save и не входит в порядок глав
- **Что визуально проверить:** Название и saved caption
- **Possible problems:** Arena записан как этап кампании
- **Status:** Not Run

### INCIDENT-ALARM-001 — Сигналка: обезвредить до/после выстрела

- **Area:** 10 Campaign / Optional incidents
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Office7/lab/factory с authored incident_alarm
- **Steps:** 1) Подойти к пульту; 2) E до выстрела; в новом run выстрелить и E до 3 с; 3) В третьем run дождаться конечной волны, зачистить, повторить E
- **Expected Result:** Отключение однократно; warning 3 с; конечные подкрепления и награда не блокируют основной objective
- **Screenshot checkpoints:** Ready пульт → Warning timer/active wave → Disabled либо done и reward
- **Что визуально проверить:** Красный пульт, main objective и side progress
- **Possible problems:** Бесконечная волна, двойные припасы
- **Status:** Not Run

### INCIDENT-CACHE-002 — Тайник: уйти и вернуться

- **Area:** 10 Campaign / Optional incidents
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Ready cache terminal
- **Steps:** 1) E у терминала; 2) Уйти за радиус/стену, вернуться; 3) Остаться рядом 12 активных секунд, повторить E
- **Expected Result:** Timer paused вне 180 units/LOS, награда один раз, можно стрелять во время загрузки
- **Screenshot checkpoints:** Ready → Paused timer → Done/reward
- **Что визуально проверить:** Подпись паузы и ammo/armor
- **Possible problems:** Таймер идёт через стену, награда дважды
- **Status:** Not Run

### INCIDENT-COFFEE-003 — Кофе: одноразовый ресурс команды

- **Area:** 10 Campaign / Optional incidents
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Живые подключённые A/B ранены, ready coffee
- **Steps:** 1) A нажимает E; 2) Проверить A/B HP и sprint; 3) Повторить E; в новом run разрушить автомат и попытаться E
- **Expected Result:** Команде +15 HP до max и sprint 10 с однократно, разрушенный автомат disabled
- **Screenshot checkpoints:** Автомат → Team heal/sprint → Пустой/разрушенный
- **Что визуально проверить:** Notice и состояние автомата
- **Possible problems:** Бесконечное восстановление
- **Status:** Not Run

## 11 Pickups and Buffs (6)

### PICKUP-AMMO-001 — Патроны и запас

- **Area:** 11 Pickups and Buffs
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Оружие с дефицитом и supply <1
- **Steps:** 1) Пройти по ammo; 2) проверить reserve и supply; 3) повторить при cap
- **Expected Result:** Ресурсы меняются по weapons.ts/World.ts, нет переполнения
- **Screenshot checkpoints:** Начало: Патроны и запас → Ключевое действие: Пройти по ammo → Результат: Ресурсы меняются по weapons.ts/World.ts, нет переполнения
- **Что визуально проверить:** Pickup toast, счётчики
- **Possible problems:** Ресурс исчез без выгоды
- **Status:** Not Run

### PICKUP-HEALTH-002 — Здоровье, броня и аптечка

- **Area:** 11 Pickups and Buffs
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Раненый игрок
- **Steps:** 1) Подобрать health/armor; 2) удержать self heal; 3) проверить max
- **Expected Result:** HP/armor ограничены cap, аптечка выдаётся по текущему коду
- **Screenshot checkpoints:** Начало: Здоровье, броня и аптечка → Ключевое действие: Подобрать health/armor → Результат: HP/armor ограничены cap, аптечка выдаётся по текущему коду
- **Что визуально проверить:** Полоски и supplies
- **Possible problems:** Отрицательный HP или лишнее списание
- **Status:** Not Run

### BUFF-INVINCIBLE-003 — Неуязвимость и окончание

- **Area:** 11 Pickups and Buffs
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** 10-second invincible pickup
- **Steps:** 1) Подобрать; 2) получить удар; 3) дождаться конца; 4) снова получить удар
- **Expected Result:** Во время buff нет damage, после damage возвращается
- **Screenshot checkpoints:** Начало: Неуязвимость и окончание → Ключевое действие: Подобрать → Результат: Во время buff нет damage, после damage возвращается
- **Что визуально проверить:** Аура и timer
- **Possible problems:** Неясная длительность
- **Status:** Not Run

### BUFF-DAMAGE-004 — Тройной урон

- **Area:** 11 Pickups and Buffs
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Damage buff, одинаковые normal враги
- **Steps:** 1) Сравнить попадание до/после; 2) дождаться 10 с; 3) повторить
- **Expected Result:** Урон ×3 только в активное время
- **Screenshot checkpoints:** Начало: Тройной урон → Ключевое действие: Сравнить попадание до/после → Результат: Урон ×3 только в активное время
- **Что визуально проверить:** Damage numbers и icon
- **Possible problems:** Постоянный buff
- **Status:** Not Run

### BUFF-INFINITE-005 — Бесконечные патроны при пустом магазине

- **Area:** 11 Pickups and Buffs
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Empty ammo, infinite pickup
- **Steps:** 1) Подобрать; 2) стрелять; 3) дождаться 10 с; 4) попытаться ещё
- **Expected Result:** Огонь доступен во время buff без расхода, после возвращаются обычные ограничения
- **Screenshot checkpoints:** Начало: Бесконечные патроны при пустом магазине → Ключевое действие: Подобрать → Результат: Огонь доступен во время buff без расхода, после возвращаются обычные ограничения
- **Что визуально проверить:** Ammo и expiration
- **Possible problems:** Бесплатный refill после buff
- **Status:** Not Run

### BUFF-SPRINT-006 — Sprint, повтор и смена уровня

- **Area:** 11 Pickups and Buffs
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Sprint buff
- **Steps:** 1) Бежать с разными guns; 2) подобрать повтор; 3) перейти уровень
- **Expected Result:** Время/перенос сверять с текущим кодом; временный buff не обещает permanent carry
- **Screenshot checkpoints:** Начало: Sprint, повтор и смена уровня → Ключевое действие: Бежать с разными guns → Результат: Время/перенос сверять с текущим кодом; временный buff не обещает permanent carry
- **Что визуально проверить:** Timer и скорость
- **Possible problems:** Суммирование сверх ожидаемого, скрытое окончание
- **Status:** Not Run

## 12 HUD (5)

### HUD-COMBAT-001 — Основная информация в толпе

- **Area:** 12 HUD
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Бой с objective, supplies, bonus и несколькими notices
- **Steps:** 1) Провести интенсивный бой; 2) reload; 3) получить damage; 4) выполнить objective
- **Expected Result:** HP, ammo, weapon и цель читаются без перекрытия игрока
- **Screenshot checkpoints:** Начало: Основная информация в толпе → Ключевое действие: Провести интенсивный бой → Результат: HP, ammo, weapon и цель читаются без перекрытия игрока
- **Что визуально проверить:** Верхний objective и нижний dock
- **Possible problems:** Периферийная информация неразличима
- **Status:** Not Run

### HUD-MOBILE-002 — Телефон и крупный HUD

- **Area:** 12 HUD
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** 390×844 и 844×390, hudScale 1.15
- **Steps:** 1) Играть двумя стиками; 2) открыть weapon picker; 3) проверить длинную цель
- **Expected Result:** Controls и важные counters доступны, мир остаётся видимым
- **Screenshot checkpoints:** Начало: Телефон и крупный HUD → Ключевое действие: Играть двумя стиками → Результат: Controls и важные counters доступны, мир остаётся видимым
- **Что визуально проверить:** Touch regions и text wrap
- **Possible problems:** Dock закрывает половину боя
- **Status:** Not Run

### HUD-TEAM-003 — Состояния команды

- **Area:** 12 HUD
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** 2–4 клиента, один downed/dead
- **Steps:** 1) Ранить одного; 2) дать bleedout; 3) вернуть/поднять другого
- **Expected Result:** Alive/downed/spectating различимы, своё состояние понятно
- **Screenshot checkpoints:** Начало: Состояния команды → Ключевое действие: Ранить одного → Результат: Alive/downed/spectating различимы, своё состояние понятно
- **Что визуально проверить:** Карты команды и down arrow
- **Possible problems:** Ложный статус teammate
- **Status:** Not Run

### HUD-NOTIFICATION-004 — Поток уведомлений

- **Area:** 12 HUD
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Бой с objective, supplies, bonus и несколькими notices
- **Steps:** 1) Pickup, achievement, radio, tip и mutation подряд
- **Expected Result:** Очередь не накапливает бесконечные overlays
- **Screenshot checkpoints:** Начало: Поток уведомлений → Ключевое действие: Pickup, achievement, radio, tip и mutation подряд → Результат: Очередь не накапливает бесконечные overlays
- **Что визуально проверить:** Слои сообщений
- **Possible problems:** Обязательная цель скрыта
- **Status:** Not Run

### HUD-BONUS-005 — Бонус этажа

- **Area:** 12 HUD
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Bonus близок к goal
- **Steps:** 1) Выполнить; 2) выключить отображение; 3) закончить этаж без другого bonus
- **Expected Result:** Бонус однократен и необязателен, +300 KPI и supplies до текущего cap
- **Screenshot checkpoints:** Начало: Бонус этажа → Ключевое действие: Выполнить → Результат: Бонус однократен и необязателен, +300 KPI и supplies до текущего cap
- **Что визуально проверить:** Progress и reward
- **Possible problems:** Bonus блокирует story
- **Status:** Not Run

## 13 Pause / Settings / Menus (4)

### MENU-PAUSE-001 — Пауза и resume

- **Area:** 13 Pause / Settings / Menus
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Solo и co-op в бою; меню доступны
- **Steps:** 1) Нажать Esc в бою; 2) подождать; 3) resume
- **Expected Result:** Solo заморожен, co-op следует фактическому server lifecycle; input восстановлен
- **Screenshot checkpoints:** Начало: Пауза и resume → Ключевое действие: Нажать Esc в бою → Результат: Solo заморожен, co-op следует фактическому server lifecycle; input восстановлен
- **Что визуально проверить:** Overlay и HP
- **Possible problems:** Скрытая смерть в solo pause
- **Status:** Not Run

### MENU-SETTINGS-002 — Сохранение настроек

- **Area:** 13 Pause / Settings / Menus
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Solo и co-op в бою; меню доступны
- **Steps:** 1) Изменить sound/music/shake, flashes, HUD; 2) reload страницы
- **Expected Result:** Настройки сохранены, изменения видны/слышны
- **Screenshot checkpoints:** Начало: Сохранение настроек → Ключевое действие: Изменить sound/music/shake, flashes, HUD → Результат: Настройки сохранены, изменения видны/слышны
- **Что визуально проверить:** Slider и HUD scale
- **Possible problems:** Настройка не применяется
- **Status:** Not Run

### MENU-INPUT-003 — Огонь после popup

- **Area:** 13 Pause / Settings / Menus
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Solo и co-op в бою; меню доступны
- **Steps:** 1) Стрелять; 2) открыть pause; 3) отпустить огонь; 4) закрыть; 5) быстро повторить
- **Expected Result:** Нет продолжающегося fire/held E без нового ввода
- **Screenshot checkpoints:** Начало: Огонь после popup → Ключевое действие: Стрелять → Результат: Нет продолжающегося fire/held E без нового ввода
- **Что визуально проверить:** Muzzle и progress
- **Possible problems:** Залипшая стрельба
- **Status:** Not Run

### MENU-HELP-004 — Help, achievements и Back

- **Area:** 13 Pause / Settings / Menus
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Solo и co-op в бою; меню доступны
- **Steps:** 1) Открыть помощь и профиль из pause; 2) вернуться; 3) нажать browser Back один раз
- **Expected Result:** Игра даёт предусмотренное pause/guard, возврат доступен
- **Screenshot checkpoints:** Начало: Help, achievements и Back → Ключевое действие: Открыть помощь и профиль из pause → Результат: Игра даёт предусмотренное pause/guard, возврат доступен
- **Что визуально проверить:** Navigation и названия
- **Possible problems:** Неожиданный выход с потерей боя
- **Status:** Not Run

## 14 Game Over / Death / Restart (6)

### DEATH-SOLO-001 — Solo смерть и restart

- **Area:** 14 Game Over / Death / Restart
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Solo natural fight
- **Steps:** 1) Погибнуть; 2) нажать restart; 3) повторить
- **Expected Result:** Текущий этаж начинается с entry loadout, старые entities очищены
- **Screenshot checkpoints:** Начало: Solo смерть и restart → Ключевое действие: Погибнуть → Результат: Текущий этаж начинается с entry loadout, старые entities очищены
- **Что визуально проверить:** Death panel и initial HP
- **Possible problems:** Текущие pickups дублируются
- **Status:** Not Run

### DEATH-COOP-002 — Downed и bleedout

- **Area:** 14 Game Over / Death / Restart
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A/B живы
- **Steps:** 1) B погибает; 2) не поднимать 15 с; 3) наблюдать состояние
- **Expected Result:** B переходит в spectating/реализованный return flow, не становится enemy player
- **Screenshot checkpoints:** Начало: Downed и bleedout → Ключевое действие: B погибает → Результат: B переходит в spectating/реализованный return flow, не становится enemy player
- **Что визуально проверить:** Timer и spectating UI
- **Possible problems:** Игрок-мутант вопреки текущим правилам
- **Status:** Not Run

### DEATH-RETURN-003 — Возврат человека

- **Area:** 14 Game Over / Death / Restart
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A жив, B spectating
- **Steps:** 1) Закончить предусмотренный combat-clear/этап; 2) наблюдать B
- **Expected Result:** Возврат соответствует существующему rally/transition, не требовать P15 intermission
- **Screenshot checkpoints:** Начало: Возврат человека → Ключевое действие: Закончить предусмотренный combat-clear/этап → Результат: Возврат соответствует существующему rally/transition, не требовать P15 intermission
- **Что визуально проверить:** Человеческий sprite и HUD
- **Possible problems:** Возврат за стеной
- **Status:** Not Run

### DEATH-WIPE-004 — Вся команда погибла

- **Area:** 14 Game Over / Death / Restart
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** 2 клиента
- **Steps:** 1) Погибнуть обоим; 2) host нажимает restart; 3) guest ждёт
- **Expected Result:** Единый defeat, host управляет новой попыткой
- **Screenshot checkpoints:** Начало: Вся команда погибла → Ключевое действие: Погибнуть обоим → Результат: Единый defeat, host управляет новой попыткой
- **Что визуально проверить:** Панель A/B
- **Possible problems:** Два несогласованных restart
- **Status:** Not Run

### RESTART-STATE-005 — Входное снаряжение новой попытки

- **Area:** 14 Game Over / Death / Restart
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** На этаже потрачены ammo и собраны новые guns
- **Steps:** 1) Вызвать wipe; 2) restart; 3) сравнить с entry loadout
- **Expected Result:** Текущие достижения/снаряжение восстанавливаются по checkpoint rules без dupes
- **Screenshot checkpoints:** Начало: Входное снаряжение новой попытки → Ключевое действие: Вызвать wipe → Результат: Текущие достижения/снаряжение восстанавливаются по checkpoint rules без dupes
- **Что визуально проверить:** Ammo, оружие и companions
- **Possible problems:** Неверный loadout или повтор награды
- **Status:** Not Run

### DEATH-RACE-006 — Смерть в момент завершения

- **Area:** 14 Game Over / Death / Restart
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Последний enemy и low HP
- **Steps:** 1) Убить enemy одновременно с получением смертельного урона
- **Expected Result:** Одно согласованное итоговое состояние, можно продолжить/retry
- **Screenshot checkpoints:** Начало: Смерть в момент завершения → Ключевое действие: Убить enemy одновременно с получением смертельного урона → Результат: Одно согласованное итоговое состояние, можно продолжить/retry
- **Что визуально проверить:** Result и death overlay
- **Possible problems:** Два окна и soft-lock
- **Status:** Not Run

## 15 Level Complete / Progression (8)

### PROGRESS-ORDER-001 — Все 10 этапов

- **Area:** 15 Level Complete / Progression
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Новая игра
- **Steps:** 1) Пройти office→office7→office8→office11→cafe12→street1→street2→factory→lab→boss
- **Expected Result:** Порядок и chapter captions совпадают с next в коде
- **Screenshot checkpoints:** Начало: Все 10 этапов → Ключевое действие: Пройти office→office7→office8→office11→cafe12→street1→street2→factory→lab→boss → Результат: Порядок и chapter captions совпадают с next в коде
- **Что визуально проверить:** Каждый result и начало следующего
- **Possible problems:** Устаревший README-порядок
- **Status:** Not Run

### PROGRESS-STATE-002 — Перенос снаряжения

- **Area:** 15 Level Complete / Progression
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Этаж заканчивается с несколькими guns/supplies
- **Steps:** 1) Записать HP/armor/ammo; 2) перейти; 3) сравнить
- **Expected Result:** Loadout переносится по carryOut; HP минимум 60 в текущем коде
- **Screenshot checkpoints:** Начало: Перенос снаряжения → Ключевое действие: Записать HP/armor/ammo → Результат: Loadout переносится по carryOut; HP минимум 60 в текущем коде
- **Что визуально проверить:** Entry HUD
- **Possible problems:** Ложный баг о предусмотренном HP floor
- **Status:** Not Run

### PROGRESS-DOUBLE-003 — Двойное Дальше

- **Area:** 15 Level Complete / Progression
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Level complete panel
- **Steps:** 1) Быстро нажать Дальше дважды; 2) на mobile повторить
- **Expected Result:** Один переход и одна session
- **Screenshot checkpoints:** Начало: Двойное Дальше → Ключевое действие: Быстро нажать Дальше дважды → Результат: Один переход и одна session
- **Что визуально проверить:** HUD и номер этапа
- **Possible problems:** Пропущен этаж
- **Status:** Not Run

### PROGRESS-TEAM-004 — Разделённая команда у выхода

- **Area:** 15 Level Complete / Progression
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Exit требует humanPlayers в зоне
- **Steps:** 1) Оставить B далеко; 2) A входит; 3) B догоняет
- **Expected Result:** Gate ждёт живых по current script; сообщение объясняет ожидание
- **Screenshot checkpoints:** Начало: Разделённая команда у выхода → Ключевое действие: Оставить B далеко → Результат: Gate ждёт живых по current script; сообщение объясняет ожидание
- **Что визуально проверить:** Arrow/teammate и exit
- **Possible problems:** Невидимый запрет перехода
- **Status:** Not Run

### PROGRESS-SAVE-005 — Solo reload после перехода

- **Area:** 15 Level Complete / Progression
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Только вошли следующий этаж
- **Steps:** 1) Reload; 2) Continue
- **Expected Result:** Возврат на вход следующего этажа с carry
- **Screenshot checkpoints:** Начало: Solo reload после перехода → Ключевое действие: Reload → Результат: Возврат на вход следующего этажа с carry
- **Что визуально проверить:** Continue caption
- **Possible problems:** Сохранён прежний этаж
- **Status:** Not Run

### PROGRESS-RECONNECT-006 — Разрыв в границе этапов

- **Area:** 15 Level Complete / Progression
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** 2 клиента на result
- **Steps:** 1) Разорвать B; 2) A продолжает; 3) B возвращается
- **Expected Result:** B входит на текущий server floor с корректным loadout
- **Screenshot checkpoints:** Начало: Разрыв в границе этапов → Ключевое действие: Разорвать B → Результат: B входит на текущий server floor с корректным loadout
- **Что визуально проверить:** Уровень A/B
- **Possible problems:** Устаревшая карта и snapshot
- **Status:** Not Run

### PROGRESS-COMPANION-007 — Companion и story state

- **Area:** 15 Level Complete / Progression
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Following не-сюжетный NPC
- **Steps:** 1) Завершить этап; 2) проверить предусмотренный carry NPC и заражение
- **Expected Result:** Story evacuation и companion carry различаются; нет повторных drops
- **Screenshot checkpoints:** Начало: Companion и story state → Ключевое действие: Завершить этап → Результат: Story evacuation и companion carry различаются; нет повторных drops
- **Что визуально проверить:** NPC в начале следующего
- **Possible problems:** Clone companion
- **Status:** Not Run

### PROGRESS-VICTORY-008 — Сохранение после победы

- **Area:** 15 Level Complete / Progression
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Boss defeated
- **Steps:** 1) Вернуться в меню; 2) reload; 3) посмотреть Continue и room code
- **Expected Result:** Победа очищает соответствующий save, новая игра доступна
- **Screenshot checkpoints:** Начало: Сохранение после победы → Ключевое действие: Вернуться в меню → Результат: Победа очищает соответствующий save, новая игра доступна
- **Что визуально проверить:** Main menu caption
- **Possible problems:** Continue ведёт в завершённый бой
- **Status:** Not Run

## 16 Multiplayer Lobby (8)

### LOBBY-CREATE-001 — Создать и войти по коду

- **Area:** 16 Multiplayer Lobby
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Нет комнат
- **Steps:** 1) A создаёт; 2) B вводит код; 3) оба смотрят cards
- **Expected Result:** Одна комната, оба имени и host видимы
- **Screenshot checkpoints:** Начало: Создать и войти по коду → Ключевое действие: A создаёт → Результат: Одна комната, оба имени и host видимы
- **Что визуально проверить:** Code, portraits и readiness
- **Possible problems:** Join не выполняется
- **Status:** Not Run

### LOBBY-LIMIT-002 — 2, 3, 4 и пятый

- **Area:** 16 Multiplayer Lobby
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Одна комната
- **Steps:** 1) Подключить B/C/D; 2) попытаться E
- **Expected Result:** 4 места заняты, пятый получает понятный отказ
- **Screenshot checkpoints:** Начало: 2, 3, 4 и пятый → Ключевое действие: Подключить B/C/D → Результат: 4 места заняты, пятый получает понятный отказ
- **Что визуально проверить:** Состав и error E
- **Possible problems:** Пятый вытесняет коллегу
- **Status:** Not Run

### LOBBY-HOST-003 — Передача host

- **Area:** 16 Multiplayer Lobby
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A host, B/C connected
- **Steps:** 1) A выходит; 2) проверить B; 3) повторить host disconnect
- **Expected Result:** Следующий подключённый ведёт, controls обновлены
- **Screenshot checkpoints:** Начало: Передача host → Ключевое действие: A выходит → Результат: Следующий подключённый ведёт, controls обновлены
- **Что визуально проверить:** Host badge A/B
- **Possible problems:** Комната без ведущего
- **Status:** Not Run

### LOBBY-PROFILE-004 — Имя, внешность и readiness

- **Area:** 16 Multiplayer Lobby
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A/B в lobby
- **Steps:** 1) Изменить look/name; 2) переключить ready; 3) host начать при B not ready
- **Expected Result:** Cards синхронны; ready информационен, start остаётся по current rules
- **Screenshot checkpoints:** Начало: Имя, внешность и readiness → Ключевое действие: Изменить look/name → Результат: Cards синхронны; ready информационен, start остаётся по current rules
- **Что визуально проверить:** Portrait и имя
- **Possible problems:** Ложное обязательное ready
- **Status:** Not Run

### LOBBY-SAVED-005 — Продолжить и Новая игра комнаты

- **Area:** 16 Multiplayer Lobby
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Есть server save под кодом
- **Steps:** 1) Вернуться по коду; 2) Continue; 3) вернуться и подтвердить New Game
- **Expected Result:** Continue реального floor, fresh требует подтверждения и сбрасывает save
- **Screenshot checkpoints:** Начало: Продолжить и Новая игра комнаты → Ключевое действие: Вернуться по коду → Результат: Continue реального floor, fresh требует подтверждения и сбрасывает save
- **Что визуально проверить:** Saved caption и confirm
- **Possible problems:** Прогресс стёрт первым тапом
- **Status:** Not Run

### LOBBY-REJOIN-006 — Повтор той же identity

- **Area:** 16 Multiplayer Lobby
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A в lobby или игре
- **Steps:** 1) Закрыть вкладку; 2) вновь открыть тем же профилем
- **Expected Result:** Вернулся в своё место, не новый игрок
- **Screenshot checkpoints:** Начало: Повтор той же identity → Ключевое действие: Закрыть вкладку → Результат: Вернулся в своё место, не новый игрок
- **Что визуально проверить:** Player card и loadout
- **Possible problems:** Двойное место A
- **Status:** Not Run

### LOBBY-LATE-007 — Вход в текущую игру

- **Area:** 16 Multiplayer Lobby
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A уже играет
- **Steps:** 1) B входит по коду; 2) проверить spawn
- **Expected Result:** Новый коллега в текущем floor как fresh employee
- **Screenshot checkpoints:** Начало: Вход в текущую игру → Ключевое действие: B входит по коду → Результат: Новый коллега в текущем floor как fresh employee
- **Что визуально проверить:** A/B position и HUD
- **Possible problems:** Guest заперт в пустом lobby
- **Status:** Not Run

### LOBBY-CODE-008 — Неверный код и отмена

- **Area:** 16 Multiplayer Lobby
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Главное меню
- **Steps:** 1) Ввести пустой/неверный код; 2) cancel; 3) быстро Create и Back
- **Expected Result:** Понятная ошибка, нет зависшей сессии после cancel
- **Screenshot checkpoints:** Начало: Неверный код и отмена → Ключевое действие: Ввести пустой/неверный код → Результат: Понятная ошибка, нет зависшей сессии после cancel
- **Что визуально проверить:** Error и возврат
- **Possible problems:** Late connection после ухода
- **Status:** Not Run

## 17 Multiplayer Gameplay (10)

### MP-MOVE-001 — Движение и стрельба на обоих

- **Area:** 17 Multiplayer Gameplay
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A/B играют
- **Steps:** 1) Двигаться навстречу; 2) стрелять разным оружием; 3) сравнить
- **Expected Result:** A/B видят согласованные позиции и свои/чужие выстрелы
- **Screenshot checkpoints:** Начало: Движение и стрельба на обоих → Ключевое действие: Двигаться навстречу → Результат: A/B видят согласованные позиции и свои/чужие выстрелы
- **Что визуально проверить:** Feet, muzzle и remote smoothing
- **Possible problems:** У себя нет tracers
- **Status:** Not Run

### MP-KILL-002 — Общая смерть врага

- **Area:** 17 Multiplayer Gameplay
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A/B целят одного
- **Steps:** 1) Стрелять одновременно; 2) проверить kill/drop на обоих
- **Expected Result:** Enemy удалён один раз, один pickup
- **Screenshot checkpoints:** Начало: Общая смерть врага → Ключевое действие: Стрелять одновременно → Результат: Enemy удалён один раз, один pickup
- **Что визуально проверить:** Труп и pickup A/B
- **Possible problems:** Ghost enemy
- **Status:** Not Run

### MP-PICKUP-003 — Один pickup двум игрокам

- **Area:** 17 Multiplayer Gameplay
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A/B у weapon/ammo
- **Steps:** 1) Одновременно пройти по pickup
- **Expected Result:** Результат authoritative, ресурс не выдан дважды
- **Screenshot checkpoints:** Начало: Один pickup двум игрокам → Ключевое действие: Одновременно пройти по pickup → Результат: Результат authoritative, ресурс не выдан дважды
- **Что визуально проверить:** HUD и disappearance
- **Possible problems:** Разные inventories
- **Status:** Not Run

### MP-NPC-004 — Rescue и мутация

- **Area:** 17 Multiplayer Gameplay
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A/B у NPC
- **Steps:** 1) A rescue; 2) B следит; 3) затем mutation
- **Expected Result:** Одни follow/appearance/mutation states
- **Screenshot checkpoints:** Начало: Rescue и мутация → Ключевое действие: A rescue → Результат: Одни follow/appearance/mutation states
- **Что визуально проверить:** NPC и objective A/B
- **Possible problems:** Companion только на одном экране
- **Status:** Not Run

### MP-SUPPORT-005 — Tap/hold через реальные UI

- **Area:** 17 Multiplayer Gameplay
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A/B с supplies
- **Steps:** 1) Выполнить ammo, heal, revive; 2) сменить helper
- **Expected Result:** UI обоих согласован с server, расход однократен
- **Screenshot checkpoints:** Начало: Tap/hold через реальные UI → Ключевое действие: Выполнить ammo, heal, revive → Результат: UI обоих согласован с server, расход однократен
- **Что визуально проверить:** Progress и HP
- **Possible problems:** Local optimistic effect без server
- **Status:** Not Run

### MP-OBJECTIVE-006 — Разные комнаты и общая цель

- **Area:** 17 Multiplayer Gameplay
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A/B разделены по карте
- **Steps:** 1) A выполняет key/action; 2) B проверяет guide и gate
- **Expected Result:** Основная цель и flags общие
- **Screenshot checkpoints:** Начало: Разные комнаты и общая цель → Ключевое действие: A выполняет key/action → Результат: Основная цель и flags общие
- **Что визуально проверить:** Arrow на обоих
- **Possible problems:** B ведут к старому key
- **Status:** Not Run

### MP-SPECTATE-007 — Наблюдатель и поздний вход

- **Area:** 17 Multiplayer Gameplay
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** B dead, A жив
- **Steps:** 1) B наблюдает; 2) C входит; 3) A завершает этап
- **Expected Result:** Dead seat не заменяется новым игроком, spectator controls понятны
- **Screenshot checkpoints:** Начало: Наблюдатель и поздний вход → Ключевое действие: B наблюдает → Результат: Dead seat не заменяется новым игроком, spectator controls понятны
- **Что визуально проверить:** Camera и roster
- **Possible problems:** Спектатор управляет живым
- **Status:** Not Run

### MP-BOSS-008 — Босс для команды

- **Area:** 17 Multiplayer Gameplay
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** 2–4 клиента, естественный loadout
- **Steps:** 1) Играть через фазы; 2) один downed; 3) добить
- **Expected Result:** Фазы, revive и victory едины; scaling не оценивать по solo HP
- **Screenshot checkpoints:** Начало: Босс для команды → Ключевое действие: Играть через фазы → Результат: Фазы, revive и victory едины; scaling не оценивать по solo HP
- **Что визуально проверить:** Boss HP и finale A/B
- **Possible problems:** Один клиент продолжает бой
- **Status:** Not Run

### MP-PAUSE-009 — Pause одного клиента

- **Area:** 17 Multiplayer Gameplay
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A/B в бою
- **Steps:** 1) A pause; 2) B продолжает; 3) A resume
- **Expected Result:** Локальный overlay не рассинхронизирует комнату
- **Screenshot checkpoints:** Начало: Pause одного клиента → Ключевое действие: A pause → Результат: Локальный overlay не рассинхронизирует комнату
- **Что визуально проверить:** HP/position A/B
- **Possible problems:** Скрытый held fire
- **Status:** Not Run

### MP-LATENCY-010 — 100–200 мс задержки

- **Area:** 17 Multiplayer Gameplay
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Сетевая эмуляция на A, B обычный
- **Steps:** 1) Провести бой, pickup и revive; 2) вернуть обычную сеть
- **Expected Result:** Нет двойных действий, задержка не оставляет permanently stale HUD
- **Screenshot checkpoints:** Начало: 100–200 мс задержки → Ключевое действие: Провести бой, pickup и revive → Результат: Нет двойных действий, задержка не оставляет permanently stale HUD
- **Что визуально проверить:** Remote движение и progress
- **Possible problems:** Ошибка prediction или freeze
- **Status:** Not Run

## 18 Reconnect / Network Edge Cases (8)

### MP-RECONNECT-001 — Короткий разрыв

- **Area:** 18 Reconnect / Network Edge Cases
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A/B в бою
- **Steps:** 1) Отключить сеть B на 5 с; 2) вернуть
- **Expected Result:** B автоматически возвращается с тем же seat/position/loadout
- **Screenshot checkpoints:** Начало: Короткий разрыв → Ключевое действие: Отключить сеть B на 5 с → Результат: B автоматически возвращается с тем же seat/position/loadout
- **Что визуально проверить:** Reconnect panel и HUD
- **Possible problems:** Новый персонаж вместо старого
- **Status:** Not Run

### MP-RECONNECT-002 — Окно 25 секунд истекло

- **Area:** 18 Reconnect / Network Edge Cases
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** B отключён
- **Steps:** 1) Ждать >25 с; 2) вернуть; 3) проверить автоматическое rejoin по pid/code
- **Expected Result:** Понятный flow возврата; reservation seat сохраняется по текущей реализации
- **Screenshot checkpoints:** Начало: Окно 25 секунд истекло → Ключевое действие: Ждать >25 с → Результат: Понятный flow возврата; reservation seat сохраняется по текущей реализации
- **Что визуально проверить:** Timeout message и roster
- **Possible problems:** Ложное ожидание удаления места
- **Status:** Not Run

### MP-RECONNECT-003 — Выход при reconnect

- **Area:** 18 Reconnect / Network Edge Cases
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Reconnect panel B
- **Steps:** 1) Нажать Выйти в меню; 2) восстановить сеть
- **Expected Result:** Нет позднего подключения после отмены
- **Screenshot checkpoints:** Начало: Выход при reconnect → Ключевое действие: Нажать Выйти в меню → Результат: Нет позднего подключения после отмены
- **Что визуально проверить:** Меню и roster A
- **Possible problems:** Late successful room живёт скрыто
- **Status:** Not Run

### MP-RECONNECT-004 — Разрыв во время удержания

- **Area:** 18 Reconnect / Network Edge Cases
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** B fire или support hold
- **Steps:** 1) Разорвать сеть; 2) вернуть без нажатия
- **Expected Result:** Input сброшен, нет phantom firing/heal
- **Screenshot checkpoints:** Начало: Разрыв во время удержания → Ключевое действие: Разорвать сеть → Результат: Input сброшен, нет phantom firing/heal
- **Что визуально проверить:** Muzzle/progress после возврата
- **Possible problems:** Повторный consumable
- **Status:** Not Run

### MP-RECONNECT-005 — Закрытая вкладка и takeover

- **Area:** 18 Reconnect / Network Edge Cases
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A играет с persistent pid
- **Steps:** 1) Закрыть и открыть; 2) затем открыть вторую вкладку той же identity
- **Expected Result:** Новое окно получает прежний seat, старое показывает takeover
- **Screenshot checkpoints:** Начало: Закрытая вкладка и takeover → Ключевое действие: Закрыть и открыть → Результат: Новое окно получает прежний seat, старое показывает takeover
- **Что визуально проверить:** Old/new panels
- **Possible problems:** Два владельца одного player
- **Status:** Not Run

### MP-RECONNECT-006 — Server restart и save

- **Area:** 18 Reconnect / Network Edge Cases
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Сохранённая комната с NPC/story flags
- **Steps:** 1) Остановить только QA server; 2) запустить с тем же save dir; 3) войти по коду
- **Expected Result:** Текущий checkpoint комнаты восстановлен, одноразовые события не повторены
- **Screenshot checkpoints:** Начало: Server restart и save → Ключевое действие: Остановить только QA server → Результат: Текущий checkpoint комнаты восстановлен, одноразовые события не повторены
- **Что визуально проверить:** Position, enemies, timers
- **Possible problems:** Сохранение заменено entry loadout
- **Status:** Not Run

### MP-RECONNECT-007 — Разрыв ведущего

- **Area:** 18 Reconnect / Network Edge Cases
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** A host, B жив
- **Steps:** 1) Отключить A; 2) B завершает floor; 3) A возвращается
- **Expected Result:** B получает управление host, возврат A не ломает transition
- **Screenshot checkpoints:** Начало: Разрыв ведущего → Ключевое действие: Отключить A → Результат: B получает управление host, возврат A не ломает transition
- **Что визуально проверить:** Host и result
- **Possible problems:** Два host
- **Status:** Not Run

### MP-RECONNECT-008 — Возврат к мёртвому seat

- **Area:** 18 Reconnect / Network Edge Cases
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** B dead до закрытия
- **Steps:** 1) Закрыть B; 2) открыть прежним профилем
- **Expected Result:** Dead seat не выдаёт бесплатное новое тело; ждёт предусмотренный return
- **Screenshot checkpoints:** Начало: Возврат к мёртвому seat → Ключевое действие: Закрыть B → Результат: Dead seat не выдаёт бесплатное новое тело; ждёт предусмотренный return
- **Что визуально проверить:** Spectating message
- **Possible problems:** Обход смерти reload
- **Status:** Not Run

## 19 Telegram Integration (6)

### TG-LAUNCH-001 — Mini App и HTML5 Game

- **Area:** 19 Telegram Integration
- **Priority:** Critical
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Telegram / Multiplayer
- **Preconditions:** Тестовый бот настроен
- **Steps:** 1) Открыть game card /play; 2) отдельно Mini App /app
- **Expected Result:** Имя и identity Telegram, правильная chat/personal room
- **Screenshot checkpoints:** Начало: Mini App и HTML5 Game → Ключевое действие: Открыть game card /play → Результат: Имя и identity Telegram, правильная chat/personal room
- **Что визуально проверить:** Fullscreen, lobby и имя
- **Possible problems:** Потеря chat room
- **Status:** Not Run

### TG-ROOM-002 — Два коллеги из чата

- **Area:** 19 Telegram Integration
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Telegram / Multiplayer
- **Preconditions:** Два Telegram пользователя в тестовом чате
- **Steps:** 1) Открыть одну game card; 2) войти в игру
- **Expected Result:** Оба в одной комнате под своим именем
- **Screenshot checkpoints:** Начало: Два коллеги из чата → Ключевое действие: Открыть одну game card → Результат: Оба в одной комнате под своим именем
- **Что визуально проверить:** Room code и cards
- **Possible problems:** Личная комната вместо общей
- **Status:** Not Run

### TG-BACK-003 — Назад и viewport

- **Area:** 19 Telegram Integration
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Telegram / Multiplayer
- **Preconditions:** Игра в Telegram
- **Steps:** 1) Использовать Telegram Back; 2) изменить высоту окна; 3) вернуться
- **Expected Result:** Back даёт предусмотренный guard/pause, UI не перекрыт Telegram header
- **Screenshot checkpoints:** Начало: Назад и viewport → Ключевое действие: Использовать Telegram Back → Результат: Back даёт предусмотренный guard/pause, UI не перекрыт Telegram header
- **Что визуально проверить:** Controls и top inset
- **Possible problems:** Случайный exit
- **Status:** Not Run

### TG-HANDOFF-004 — Открыть в браузере

- **Area:** 19 Telegram Integration
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Telegram / Multiplayer
- **Preconditions:** Telegram desktop small window
- **Steps:** 1) Нажать баннер; 2) открыть браузер; 3) проверить старое окно
- **Expected Result:** Тот же Telegram seat и loadout, старое уступает управление
- **Screenshot checkpoints:** Начало: Открыть в браузере → Ключевое действие: Нажать баннер → Результат: Тот же Telegram seat и loadout, старое уступает управление
- **Что визуально проверить:** Identity и takeover
- **Possible problems:** Новый player
- **Status:** Not Run

### TG-HAPTIC-005 — Vibration и безопасные зоны

- **Area:** 19 Telegram Integration
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Telegram / Multiplayer
- **Preconditions:** Физический телефон, Telegram
- **Steps:** 1) Получить damage; 2) выключить vibration; 3) играть у краёв
- **Expected Result:** Вибрация следует настройке/поддержке платформы, targets доступны
- **Screenshot checkpoints:** Начало: Vibration и безопасные зоны → Ключевое действие: Получить damage → Результат: Вибрация следует настройке/поддержке платформы, targets доступны
- **Что визуально проверить:** Safe area и пальцы
- **Possible problems:** Эмуляция выдана за real device
- **Status:** Not Run

### TG-SUMMON-006 — Приглашение и achievement share

- **Area:** 19 Telegram Integration
- **Priority:** Low
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Telegram / Multiplayer
- **Preconditions:** Тестовый чат, явно разрешённая отправка сообщений
- **Steps:** 1) Нажать Призвать чат; 2) повторить до минуты; 3) share rare achievement
- **Expected Result:** Rate limit и сообщения соответствуют действию, без дублей
- **Screenshot checkpoints:** Начало: Приглашение и achievement share → Ключевое действие: Нажать Призвать чат → Результат: Rate limit и сообщения соответствуют действию, без дублей
- **Что визуально проверить:** Кнопки и результат
- **Possible problems:** Не тестировать отправку в реальный чужой чат
- **Status:** Not Run

## 20 Mobile Controls (10)

### MOBILE-MOVE-001 — Левый floating stick

- **Area:** 20 Mobile Controls
- **Priority:** Critical
- **Modes:** Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** Touch environment (coarse pointer + реальные touch events); физический телефон отдельный обязательный прогон
- **Steps:** 1) Начать touch в разных местах слева; 2) медленно тянуть; 3) ускорить; 4) отпустить
- **Expected Result:** Движение соответствует вектору, release останавливает
- **Screenshot checkpoints:** Начало: Левый floating stick → Ключевое действие: Начать touch в разных местах слева → Результат: Движение соответствует вектору, release останавливает
- **Что визуально проверить:** Основание и персонаж
- **Possible problems:** Stick залипает
- **Status:** Not Run

### MOBILE-AIM-002 — Правый стик и fire edge

- **Area:** 20 Mobile Controls
- **Priority:** Critical
- **Modes:** Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** Touch environment (coarse pointer + реальные touch events); физический телефон отдельный обязательный прогон
- **Steps:** 1) Повернуть aim в 8 сторон внутри круга; 2) довести deflection до 0.8; 3) отпустить
- **Expected Result:** Внутри aim без fire, у края огонь по deflection
- **Screenshot checkpoints:** Начало: Правый стик и fire edge → Ключевое действие: Повернуть aim в 8 сторон внутри круга → Результат: Внутри aim без fire, у края огонь по deflection
- **Что визуально проверить:** Aim/fire state и ствол
- **Possible problems:** Огонь зависит от наличия enemy вопреки controls
- **Status:** Not Run

### MOBILE-COMBAT-003 — Две руки в бою

- **Area:** 20 Mobile Controls
- **Priority:** Critical
- **Modes:** Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** Реальная стая office
- **Steps:** 1) Одновременно move/aim/fire; 2) сменить направление; 3) отступить
- **Expected Result:** Оба stick независимы, движение не сбрасывает огонь
- **Screenshot checkpoints:** Начало: Две руки в бою → Ключевое действие: Одновременно move/aim/fire → Результат: Оба stick независимы, движение не сбрасывает огонь
- **Что визуально проверить:** Две touch зоны и игрок
- **Possible problems:** Потеря одного touch
- **Status:** Not Run

### MOBILE-INTERACT-004 — Третье касание action

- **Area:** 20 Mobile Controls
- **Priority:** High
- **Modes:** Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** NPC или support target рядом
- **Steps:** 1) Держать левый стик; 2) tap action; 3) затем hold с отпущенным движением
- **Expected Result:** Tap/hold различимы, случайный touch не переключает NPC многократно
- **Screenshot checkpoints:** Начало: Третье касание action → Ключевое действие: Держать левый стик → Результат: Tap/hold различимы, случайный touch не переключает NPC многократно
- **Что визуально проверить:** Context label и progress
- **Possible problems:** Control перехватывает палец
- **Status:** Not Run

### MOBILE-RELOAD-005 — Reload и выбор из 9

- **Area:** 20 Mobile Controls
- **Priority:** High
- **Modes:** Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** Несколько guns, малый magazine
- **Steps:** 1) Нажать reload; 2) открыть picker; 3) выбрать спецоружие; 4) закрыть
- **Expected Result:** Кнопки доступны пальцем, действия не уходят в aim zone
- **Screenshot checkpoints:** Начало: Reload и выбор из 9 → Ключевое действие: Нажать reload → Результат: Кнопки доступны пальцем, действия не уходят в aim zone
- **Что визуально проверить:** Picker/dock
- **Possible problems:** Непопадаемый touch target
- **Status:** Not Run

### MOBILE-CANCEL-006 — Touchcancel и смена приложения

- **Area:** 20 Mobile Controls
- **Priority:** High
- **Modes:** Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** Оба стика и E held
- **Steps:** 1) Вызвать touchcancel/переключить приложение; 2) вернуть
- **Expected Result:** Нет продолжающегося движения, fire или E
- **Screenshot checkpoints:** Начало: Touchcancel и смена приложения → Ключевое действие: Вызвать touchcancel/переключить приложение → Результат: Нет продолжающегося движения, fire или E
- **Что визуально проверить:** Ghost sticks после возврата
- **Possible problems:** Старый pointerId
- **Status:** Not Run

### MOBILE-ROTATE-007 — Поворот во время боя

- **Area:** 20 Mobile Controls
- **Priority:** High
- **Modes:** Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** 390×844 portrait
- **Steps:** 1) Играть; 2) повернуть в 844×390; 3) продолжить
- **Expected Result:** Canvas, aim и controls перестроены, input не залипает
- **Screenshot checkpoints:** Начало: Поворот во время боя → Ключевое действие: Играть → Результат: Canvas, aim и controls перестроены, input не залипает
- **Что визуально проверить:** Safe area и HUD
- **Possible problems:** Старые координаты
- **Status:** Not Run

### MOBILE-LEFT-008 — Левша

- **Area:** 20 Mobile Controls
- **Priority:** Medium
- **Modes:** Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** Настройка левша включена
- **Steps:** 1) Начать новый бой; 2) aim слева, move справа; 3) проверить controls help
- **Expected Result:** Зоны и подсказка согласованы с настройкой
- **Screenshot checkpoints:** Начало: Левша → Ключевое действие: Начать новый бой → Результат: Зоны и подсказка согласованы с настройкой
- **Что визуально проверить:** Схема и реальные sticks
- **Possible problems:** Подсказка учит наоборот
- **Status:** Not Run

### MOBILE-EDGE-009 — Бой у края экрана

- **Area:** 20 Mobile Controls
- **Priority:** High
- **Modes:** Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** Игрок у края комнаты
- **Steps:** 1) Начать sticks у краёв и возле dock; 2) вести бой 2 минуты
- **Expected Result:** Пальцы не скрывают основную угрозу, случайные действия не мешают
- **Screenshot checkpoints:** Начало: Бой у края экрана → Ключевое действие: Начать sticks у краёв и возле dock → Результат: Пальцы не скрывают основную угрозу, случайные действия не мешают
- **Что визуально проверить:** Точки контакта и visible world
- **Possible problems:** Слишком малый обзор
- **Status:** Not Run

### MOBILE-FEEL-010 — Удобство реального телефона

- **Area:** 20 Mobile Controls
- **Priority:** Medium
- **Modes:** Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** Физический телефон, естественный loadout
- **Steps:** 1) Пройти первый бой 5 минут; 2) записать промахи и accidental taps
- **Expected Result:** Отдельная UX оценка с моделью телефона, без экстраполяции emulation
- **Screenshot checkpoints:** Начало: Удобство реального телефона → Ключевое действие: Пройти первый бой 5 минут → Результат: Отдельная UX оценка с моделью телефона, без экстраполяции emulation
- **Что визуально проверить:** Пальцы, aim response и text
- **Possible problems:** Мелкие targets, input lag
- **Status:** Not Run

## 21 Responsive / Viewports (4)

### RESP-MENU-001 — Все размеры меню

- **Area:** 21 Responsive / Viewports
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** Матрица 1920×1080, 1280×720, 390×844, 844×390, 640×720, 480×640 Telegram desktop; viewport ≠ touch emulation
- **Steps:** 1) На каждом размере открыть main, editor, settings, lobby
- **Expected Result:** Действия и Back достижимы, scroll при необходимости работает
- **Screenshot checkpoints:** Начало: Все размеры меню → Ключевое действие: На каждом размере открыть main, editor, settings, lobby → Результат: Действия и Back достижимы, scroll при необходимости работает
- **Что визуально проверить:** Clipping и touch targets
- **Possible problems:** Кнопки за экраном
- **Status:** Not Run

### RESP-HUD-002 — Все размеры боя

- **Area:** 21 Responsive / Viewports
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** Матрица 1920×1080, 1280×720, 390×844, 844×390, 640×720, 480×640 Telegram desktop; viewport ≠ touch emulation
- **Steps:** 1) Начать office; 2) включить long objective; 3) ammo, buff и downed notice
- **Expected Result:** HP, objective и dock не перекрыты
- **Screenshot checkpoints:** Начало: Все размеры боя → Ключевое действие: Начать office → Результат: HP, objective и dock не перекрыты
- **Что визуально проверить:** HUD margins и world visibility
- **Possible problems:** Overflow и overlap
- **Status:** Not Run

### RESP-OVERLAY-003 — Все размеры результата

- **Area:** 21 Responsive / Viewports
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** Матрица 1920×1080, 1280×720, 390×844, 844×390, 640×720, 480×640 Telegram desktop; viewport ≠ touch emulation
- **Steps:** 1) Показать pause, death, floor complete, victory
- **Expected Result:** Основная кнопка и выход доступны, текст переносится
- **Screenshot checkpoints:** Начало: Все размеры результата → Ключевое действие: Показать pause, death, floor complete, victory → Результат: Основная кнопка и выход доступны, текст переносится
- **Что визуально проверить:** Panel scroll и кнопки
- **Possible problems:** Непроходимый result
- **Status:** Not Run

### RESP-RESIZE-004 — Resize без перезагрузки

- **Area:** 21 Responsive / Viewports
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Telegram
- **Preconditions:** Desktop или Telegram окно
- **Steps:** 1) В бою сузить 1280→640→480; 2) увеличить обратно
- **Expected Result:** Canvas и input bounds соответствуют viewport
- **Screenshot checkpoints:** Начало: Resize без перезагрузки → Ключевое действие: В бою сузить 1280→640→480 → Результат: Canvas и input bounds соответствуют viewport
- **Что визуально проверить:** Aim и края canvas
- **Possible problems:** Растянутый UI, старый input offset
- **Status:** Not Run

## 22 Visual 2.5D Quality (6)

### VISUAL-DEPTH-001 — Обход мебели в 8 направлениях

- **Area:** 22 Visual 2.5D Quality
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Стол/шкаф с foreground
- **Steps:** 1) Обойти сверху, снизу и сбоку; 2) повторить с enemy/NPC
- **Expected Result:** Feet-based depth одинаков для всех actors
- **Screenshot checkpoints:** Начало: Обход мебели в 8 направлениях → Ключевое действие: Обойти сверху, снизу и сбоку → Результат: Feet-based depth одинаков для всех actors
- **Что визуально проверить:** Feet, тень и façade
- **Possible problems:** Actor поверх высоких props
- **Status:** Not Run

### VISUAL-OCCLUSION-002 — Прозрачная передняя стена

- **Area:** 22 Visual 2.5D Quality
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Игрок за фасадом
- **Steps:** 1) Зайти за стену; 2) целиться и стрелять; 3) выйти
- **Expected Result:** Закрывающий фасад позволяет видеть игрока и угрозу
- **Screenshot checkpoints:** Начало: Прозрачная передняя стена → Ключевое действие: Зайти за стену → Результат: Закрывающий фасад позволяет видеть игрока и угрозу
- **Что визуально проверить:** Alpha и переход прозрачности
- **Possible problems:** Player исчезает
- **Status:** Not Run

### VISUAL-WEAPON-003 — Ствол и FX в 8 направлениях

- **Area:** 22 Visual 2.5D Quality
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** ПМ и длинный gun
- **Steps:** 1) Прицелиться в 8 сторон; 2) fire стоя и в движении
- **Expected Result:** Muzzle/tracer из дула, оружие в руках
- **Screenshot checkpoints:** Начало: Ствол и FX в 8 направлениях → Ключевое действие: Прицелиться в 8 сторон → Результат: Muzzle/tracer из дула, оружие в руках
- **Что визуально проверить:** Крупные checkpoints каждого направления
- **Possible problems:** Вспышка из груди
- **Status:** Not Run

### VISUAL-ANIMATION-004 — Стопы, gait и stationary follower

- **Area:** 22 Visual 2.5D Quality
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Игрок и follow NPC
- **Steps:** 1) Стоять; 2) идти; 3) остановиться; 4) strafe и reverse
- **Expected Result:** Ходьба только при перемещении, тело не вращается плоской карточкой
- **Screenshot checkpoints:** Начало: Стопы, gait и stationary follower → Ключевое действие: Стоять → Результат: Ходьба только при перемещении, тело не вращается плоской карточкой
- **Что визуально проверить:** Ноги, руки и тень
- **Possible problems:** Idle walk и skating
- **Status:** Not Run

### VISUAL-MUTANT-005 — Узнаваемость NPC и тип врага

- **Area:** 22 Visual 2.5D Quality
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Известный NPC до превращения
- **Steps:** 1) Снять до/во время/после; 2) сравнить экипировку
- **Expected Result:** Связь человека и мутанта понятна, угроза различима
- **Screenshot checkpoints:** Начало: Узнаваемость NPC и тип врага → Ключевое действие: Снять до/во время/после → Результат: Связь человека и мутанта понятна, угроза различима
- **Что визуально проверить:** Одежда, head и размер
- **Possible problems:** Все mutant одинаковы
- **Status:** Not Run

### VISUAL-SCALE-006 — Человек, мебель и boss

- **Area:** 22 Visual 2.5D Quality
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Разные локации
- **Steps:** 1) Сравнить actors с дверями, столами, машинами; 2) проверить boss collision
- **Expected Result:** Масштаб не обманывает относительно проходов и зон поражения
- **Screenshot checkpoints:** Начало: Человек, мебель и boss → Ключевое действие: Сравнить actors с дверями, столами, машинами → Результат: Масштаб не обманывает относительно проходов и зон поражения
- **Что визуально проверить:** Ground footprint
- **Possible problems:** Графика обещает несуществующий проход
- **Status:** Not Run

## 23 Performance During Real Gameplay (5)

### PERF-CROWD-001 — Реальная большая стая

- **Area:** 23 Performance During Real Gameplay
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Factory yard или meeting
- **Steps:** 1) Играть при большой группе; 2) записать frame times и реакцию input
- **Expected Result:** Нет заметных зависаний/input lag; метрики привязаны к конкретному устройству
- **Screenshot checkpoints:** Начало: Реальная большая стая → Ключевое действие: Играть при большой группе → Результат: Нет заметных зависаний/input lag; метрики привязаны к конкретному устройству
- **Что визуально проверить:** Толпа и управление
- **Possible problems:** SwiftShader выдан за hardware FPS
- **Status:** Not Run

### PERF-FX-002 — Взрывы и огнемёт

- **Area:** 23 Performance During Real Gameplay
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Группа и barrels
- **Steps:** 1) Взорвать цепь; 2) использовать flame; 3) повторить после очистки
- **Expected Result:** FX не вызывают существенного stall и input loss
- **Screenshot checkpoints:** Начало: Взрывы и огнемёт → Ключевое действие: Взорвать цепь → Результат: FX не вызывают существенного stall и input loss
- **Что визуально проверить:** FX density и видимость угроз
- **Possible problems:** Particle leak
- **Status:** Not Run

### PERF-MOBILE-003 — Пятиминутный бой телефона

- **Area:** 23 Performance During Real Gameplay
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Физический телефон
- **Steps:** 1) Играть 5 минут; 2) сравнить начало/конец; 3) переключить приложение
- **Expected Result:** Задержки/нагрев оценены на указанном устройстве
- **Screenshot checkpoints:** Начало: Пятиминутный бой телефона → Ключевое действие: Играть 5 минут → Результат: Задержки/нагрев оценены на указанном устройстве
- **Что визуально проверить:** Controls response
- **Possible problems:** CPU throttling, real-phone gap
- **Status:** Not Run

### PERF-TRANSITION-004 — Spawn, intro и переход

- **Area:** 23 Performance During Real Gameplay
- **Priority:** Medium
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** Кампания через несколько уровней
- **Steps:** 1) Записать loading, первый spawn, boss intro и finale
- **Expected Result:** Нет freeze, мешающего реакции; первый load отделён от steady state
- **Screenshot checkpoints:** Начало: Spawn, intro и переход → Ключевое действие: Записать loading, первый spawn, boss intro и finale → Результат: Нет freeze, мешающего реакции; первый load отделён от steady state
- **Что визуально проверить:** Первый кадр и input response
- **Possible problems:** Shader compile stall
- **Status:** Not Run

### PERF-NET-005 — Комната 4 игроков

- **Area:** 23 Performance During Real Gameplay
- **Priority:** High
- **Modes:** Desktop / Mobile Portrait / Mobile Landscape / Multiplayer (2–4 отдельных identity)
- **Preconditions:** 4 клиента и большая волна
- **Steps:** 1) Играть одновременно; 2) наблюдать client frame и server update
- **Expected Result:** Нет постоянного задержанного input/snapshot drift
- **Screenshot checkpoints:** Начало: Комната 4 игроков → Ключевое действие: Играть одновременно → Результат: Нет постоянного задержанного input/snapshot drift
- **Что визуально проверить:** Remote actors и HUD
- **Possible problems:** Snapshot/backpressure, memory growth
- **Status:** Not Run

