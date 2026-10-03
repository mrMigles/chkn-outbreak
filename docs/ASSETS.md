# Ассеты для переделки 2.5D

Итерация 16 (D74): существующее процедурное матовое стекло стало почти непрозрачным (97%); новых ассетов и источников нет.

Итерация 15 (D73, 2026-10-03): матовое стекло и ботва на ногах рисуются Phaser Graphics, предупреждения корней используют существующий `shard`. Внешних источников и новых лицензий нет; `check:art` прошёл.

Дата проверки страниц источников: 2026-10-02. Требования: [PLAN-2.5D.md](PLAN-2.5D.md), задачи A: [TASKS-2.5D.md](TASKS-2.5D.md).

**Статус:** итерация 2 перевела все уровни на 2.5D (раздел ниже). Таблица первой итерации сохранена как история.

## Итерация 2 (2026-10-02): весь комплект 2.5D

Источники и их фактическое использование. Сборка: `npm run art:fetch` (слои ULPC) и `npm run assets`; проверка: `npm run check:art`.

| Что | Источник / файлы | Лицензия | Как используется |
|---|---|---|---|
| 46 слоёв персонажей (тела М/Ж/крупное, 5 голов, 14 причёсок, 11 верхов, 5 низов, обувь, очки/борода/усы, перьевые крылья) | S07 Universal LPC, ревизия `4963a69`; анимации `walk`, `hurt` и `thrust` (кадр 3 — поза «оружие двумя руками»); список — `tools/art/lpc-layers.mjs`, файлы/SHA/лицензия каждого — `vendor/lpc-characters/manifest.json`, авторы — `SELECTED-CREDITS.csv` | CC BY-SA 3.0, где доступно (99 листов); OGA-BY 3.0 (27), CC BY 4.0 (3), CC0 (9) | Атлас `lpc` (полосы 576×384: ходьба, падение, вооружённая поза); персонажи собираются в рантайме (`compose.ts`) с перекраской |
| Люди-куры | Те же слои + собственная «хирургия» в коде: перья, гребень, клюв, бородка, глаза, хвост, лапы | Производное, CC BY-SA 3.0 | Текстура `mut:<look>` для каждой внешности |
| Цыплята / куры | S08 Chicken Rework `chicken.png` (3 кадра × 4 направления) | CC BY 3.0 | `chick_*` (перекраска в жёлтый), `hen_*` |
| Мебель офиса | S02/S03: Desk, Laptop, Water Cooler, Copy Machine, Bins, Sink, TV Widescreen; Chairs Dining (дерево, 4 ракурса), Tables, Sofas Casual, Countertops, Cabinets, Planters | OGA-BY 3.0 / CC BY-SA 3.0 | `office25`: desk, chair_0–3 (+_90/_180/_270), table_*, sofa_*, counter_*, stove/hob (столешница + собственная плита), sink, reception, tv, cabinet, shelf, plant(_small) |
| Полы | S01 Floor: Wood Floor A, Tile A/B/C, Diamond Tile A, Herringbone A, Gritty Dirt, Geometric Carpet A | CC BY-SA 3.0 | `tiles25.png`: все индексы Kenney, встречающиеся в картах, заменены |
| Лаборатория/завод | S09 Skorpio: Objects.png (автоматы Coffee/Crack, бочка, плакаты, терминал), Interior-Furniture.png (лабораторный стол, стойки/пульты, двери лифта), Interior-Walls-Blue.png, Pipes-RustyWalls.png; архив и SHA — `vendor/skorpio` | CC BY-SA 3.0 | vending(_b), barrel(s), hazard_barrel (перекраска), poster(_b), terminal, server_rack, lab_console, lab_bench, elevator, pipe_h, стена лаборатории |
| Собственная пиксель-графика | `tools/art/lpc.mjs` (палитра LPC, ×2) | Проект | 7 видов оружия, egg_pod(_broken), ящики, паллеты, forklift → штабель, machine, generator, conveyor, aquarium, whiteboard, sign_exit, emergency/ceiling light, lamp, двери (3 темы + заперта), стальная стена завода |
| Музыка | Juhani Junkala, Chiptune Adventures (OGG): Stage Select → calm, Stage 1 → tense, Boss Fight → wave, Stage 2 → boss; `public/assets/music`, SHA — `vendor/music/SHA256SUMS` | CC0 | `audio/Music.ts` |

Старый арт остаётся только для эффектов (`fx`), иконок подбираемых предметов и плоских деталей пола (oil, note, blood_trail, feather_pile, plates). Атлас `people25` и `officeTiles.png` удалены. Скачаны, но не использованы (плотность пикселей не совпадает с LPC): Warped Tech Lab 2 и Factory Tileset.


## Итерация 12 (2026-10-03): главы 1–2 — тёмный офис, начальство, кафе, город (D69)

Сборка: `tools/art/city.mjs` (вызывается из `buildLpc`), `npm run assets`. Габариты столкновений новых объектов задаются отдельно от картинки (`foot` в `artMeta.office25`); высокие уличные объекты (деревья, фонари, ларёк) становятся полупрозрачными над игроком.

| Что | Источник / файлы | Лицензия | Как используется |
|---|---|---|---|
| Машины (такси-хэтчбек ×4 цвета перекраской, седан), сгоревший седан | Skorpio's Sprite Pack, `Cars_final.png` (распакован из `vendor/skorpio/Skorpios_Sprite_Pack.zip`, SHA в `SHA256SUMS`) | CC BY-SA 3.0 / GPL 3 | `car_<цвет>`, `_l` (влево), `_v` (сверху), `car_burnt`; масштаб ×1.5 (пропорции LPC-персонажа) |
| Асфальт, тротуар-брусчатка, стеклянный фасад, уличный фонарь, урна | Skorpio: `Street.png`, `Sidewalk_dark.png`, `Building.png`, `Lamp_alternative.png`, `Fire/Trashcan.png` | CC BY-SA 3.0 / GPL 3 | полы 502–506 (разметка и зебра дорисованы), 510; `wall_face_glass`; `street_lamp`, `trash_can` |
| Деревья, живая изгородь | [LPC] Trees, bluecarrot16 и др. — `vendor/lpc-trees/` (zip, `trees-green.png`, `CREDITS-trees.txt`, `SHA256SUMS`), https://opengameart.org/content/lpc-trees | CC BY-SA 3.0 (части CC0 / CC BY) | `tree_round`, `tree_oak`, `tree_pine`, `tree_big`, `hedge` |
| Фонтан, кирпич, забор, цветы, дисковые телефоны, барные стулья, картины, тележка, кружка | LPC office / structure (уже в `vendor/lpc-office`) | CC BY-SA 3.0 / OGA-BY 3.0 | `fountain`, `wall_face_street`, `fence`, `flowers_*`, `desk_phone`, `bar_stool`, `portrait_ceo`, `painting_*`, `shopping_cart`, `coffee_cup` |
| Собственная пиксель-графика (палитра LPC, ×2) | `tools/art/city.mjs` | проект | вертолёт (летящий и обломки), ларёк шаурмы, рыночный прилавок, остановка, билборд, скамейка, конус, гидрант, рубильник, курочка гриль, панорамные окна, полы (трава, ковры, плитка, дорожка), фасады стен `dark` / `exec` / `cafe`, двери новых тем |

## Итерация 14 (2026-10-03): правки D72

- Universal LPC (та же ревизия 4963a69): `torso/clothes/sleeveless/tanktop/female` (white, перекраска рантаймом) и `legs/shorts/short_shorts/{thin,male}` — купальник Кати (майка + шорты одного цвета, босиком) и майка/шорты Толика. Авторы: MadMarcel, makrohn, ElizaWy, bluecarrot16, Redshrike, Wulax, JaidynReiman; CC-BY-SA 3.0 / OGA-BY 3.0 (`vendor/lpc-characters/SELECTED-CREDITS.csv`, копия в `public/assets/credits/lpc-characters.csv`).
- Skorpio's SciFi Sprite Pack: спорткар Литовца и машины VIP-парковки — перекраска тех же купе/вертикальных машин (жёлтый с гоночными полосами, чёрный, лайм).
- Собственный пиксель-арт в `tools/art/d72.mjs` (палитра и обводка city.mjs, ×2): `heart_bed`, `kink_rack`, `poster_kink`, `poster_kink2`, `fluffy_cuffs`, `disco_lamp`, `button_panel`, `potato_bed`, `tomato_plant`, `grow_lamp`, `watering_can`, `doc_form`, `fence_v`, `beer_crate`, `ashtray`, `bottle`; полы 515 (земля агрокомнаты) и 516 (асфальт парковки с разметкой и пятном масла).
- Мутанты: петух-растение (листья и цветок картошки вместо гребня, зелёное оперение с бурыми крапинками), ГМО-петух (кислотно-лаймовый с фиолетовыми крапинками, пятизубый гребень, крупное тело), разжиревший жёлтый Генеральный (живот, золотой хвост, рисуется в 1,3 раза шире) — процедурно в `src/client/render/compose.ts`.

## Фактически импортировано в первой итерации (история)

Адаптация: `tools/art/lpc.mjs`; сборка: `npm run assets`. Результат: `public/assets/gen/people25.{png,json}` (648 кадров, 2048×2048), `office25.{png,json}` (14 кадров, 2048×256), `officeTiles.png`. Проверка: `npm run check:art`. Указанные ниже области имеют формат `[x,y,w,h]` исходного PNG; кроме стены масштаб ×2 без сглаживания.

| Игровой ID / кадры | Сохранённый исходник | Область и изменения | Источник / выбранная лицензия |
|---|---|---|---|
| `desk`, `desk_b` | `vendor/lpc-office/source/Desk, Ornate.png` + `Laptop.png` | Стол `[0,0,32,48]` + `[64,0,32,48]`, сокращённая композиция 128×96; ноутбук `[0,0,32,32]` / `[32,0,32,32]`; стопа y=83 | S02, Eliza Wyatt / Lanea Zimmerman, OGA-BY 3.0 |
| `water_cooler` | `source/Water Cooler.png` в той же папке | `[0,0,32,64]` | S02, Eliza Wyatt, OGA-BY 3.0 |
| `printer` | `source/Copy Machine.png` | `[0,0,64,64]` | S02, Eliza Wyatt, OGA-BY 3.0 |
| `bin` | `source/Bins.png` | `[0,0,32,32]` | S02, Eliza Wyatt, OGA-BY 3.0 |
| `office_chair` | `vendor/lpc-office/objects/Objects/Furniture/Chairs, Dining.png` | `[128,0,32,32]`; один фронтальный вариант | S03, Lanea Zimmerman / bluecarrot16 / Eliza Wyatt, CC BY-SA 3.0 |
| `cabinet` | `objects/Objects/Storage/Cabinets.png` | `[0,0,32,96]` | S03, Lanea Zimmerman / Eliza Wyatt, CC BY-SA 3.0 |
| `plant`, `plant_small` | `objects/Objects/Decoration/Planters.png` | `[128,32,32,54]`; в образце одна композиция для обоих ID | S03, Lanea Zimmerman / Eliza Wyatt, CC BY-SA 3.0 |
| `floor_wood_0–2` | `structure/Structure/Floor/Wood Floor A.png` | `[96,96,32,32]`, `[128,96,32,32]`, `[160,96,32,32]`; заменяют используемые офисом клетки floor-атласа | S01, Lanea Zimmerman / Eliza Wyatt, CC BY-SA 3.0 |
| `floor_tile` | `structure/Structure/Floor/Tile A.png` | `[0,0,32,32]` | S01, Eliza Wyatt, CC BY-SA 3.0 |
| `wall_face` | `structure/Structure/Walls/Painted Walls.png` + `Half-Wall Paneling A.png` | Штукатурка `[1152,0,96,96]` → 64×112 nearest; деревянная панель `[0,0,32,32]` ×2 в нижних 64 px; собственные кромка/плинтус. Фасад только на открытом южном краю стены | S01, Lanea Zimmerman / Eliza Wyatt, CC BY-SA 3.0 |
| `<kind>_<n/w/s/e>_<0–8>` | Шесть PNG в `vendor/lpc-characters/spritesheets/`; точные пути/URL/SHA в `manifest.json` | Исходная сетка 64×64, строки N/W/S/E, девять кадров; композиция тела/головы/волос/рубашки/брюк/обуви, перекраска рубашек; 9 kind × 36 = 324 кадра | S07, выбранный CC BY-SA 3.0 всех шести слоёв; полный состав авторов в SELECTED-CREDITS.csv |
| `mut_<kind>_<dir>_<frame>` | Те же слои + `vendor/lpc-characters/chicken.png` | Сохраняется одежда и нижняя часть y≥28. Головы из Chicken Rework: внутри 32×32 клетки N/S `[9,0,14,17]`, W `[0,3,13,15]`, E `[19,3,13,15]`; строки источника N/E/S/W, три шага; 324 производных кадра | S07 CC BY-SA 3.0 + S08 Daniel Eddeland / AntumDeluge CC BY 3.0; составные кадры CC BY-SA 3.0 |

Kinds образца: `survivor`, `soldier`, `womanGreen`, `hitman`, `manBlue`, `manBrown`, `manOld`, `robot`, `zombie`. Сейчас это цветовые варианты одной телесной основы; шесть полноценных профессий из референса ещё не готовы. Обычный/быстрый/толстый офисный мутант различаются масштабом; остальные старые враги и босс пока сохраняют прежний арт. Превратившийся NPC сохраняет свой kind, имя и одежду.

Стопа людей — `(32,62)` исходных 64×64; отображение ×2. Мебель — `feetX=width/2`, `feetY=height−8`, кроме стола. Точки сохранены в `artMeta.office25`. Физическое основание пока прежнее из `props.ts`: это известный незаконченный пункт P03/P05, не готовая спецификация коллизий.

Архивы и вложенные Credits сохранены в `vendor/lpc-office`; источники персонажей закреплены на коммите Universal LPC `4963a69795255fb15a934c47f478a8bdcf3668f5`. Полный исходный `CREDITS.csv` и выбранный `SELECTED-CREDITS.csv` сохранены рядом. SHA256 архивов: office.zip `697B688DE1C18CA71EE5851CA925C4CFEA8BE810A82551C3595990D1E6266AAA`; objects.zip `EC8DA59E8B31C44C8183F6737F6C84E59D1EC051914C951CD8B840B044585366`; structure.zip `63EF1772B00B73FCB9209CFC913253FEF0E17CE115601E5C8CBC03F7B90872ED`. Chicken Rework — [исходный chicken_7.png](https://opengameart.org/sites/default/files/chicken_7.png), SHA256 `3570C9C136ACBD047FD84511AD4B0F77F662C88CA2F6467E4E76D072A0ACA9B6`.

Оружие, большая часть FX, двери, доски, ящики и оставшиеся предметы ещё прежние; приведённая ниже карта S09–S12 для них описывает будущую замену. Не обозначать эти кадры как уже импортированные. Титры доступны по ссылке «Авторы графики» из меню: [public/credits.html](../public/credits.html). Собственные адаптации LPC распространяются с выбранными условиями исходников; DRM waiver сохранён во вложенных Credits.

## Принципы

- Бесплатные библиотеки — основной источник. Не использовать платные полные версии под видом бесплатного демо.
- База — детальный LPC pixel art, сетка исходников 32 px и Liberated Palette. Игровая клетка остаётся 64 единицы.
- Не растягивать персонажа для имитации ракурса. Нужны лица, ноги, передние грани и опорные точки.
- Новые ассеты проходят одну подготовку палитры, плотности пикселей, масштаба, кадров и размеров основания. Мягкий свет допустим поверх пиксельного мира.
- Сначала готовый кадр, затем адаптация/сборка. Генерация изображений — только для документированного пробела, который не закрывается этим путём.
- Референс пользователя — только визуальное направление. Не нарезать его в игровые спрайты и не считать тексты на нём инструкциями.

## Каталог источников

| ID | Набор и автор | Лицензия на странице | Роль |
|---|---|---|---|
| S01 | [LPC Revised — Base Structure Kit, Eliza Wyatt / Lanea Zimmerman](https://opengameart.org/content/lpc-revised-base-structure-kit) | CC BY-SA 3.0; сохранить сведения о DRM waiver и credits каждого файла | Полы, стены, двери, окна |
| S02 | [LPC Revised — The Office, Eliza Wyatt](https://opengameart.org/content/lpc-revised-the-office) | CC BY-SA 3.0 / OGA-BY 3.0; выбрать по конкретному файлу | Офисная техника, столы, кулер, корзины, бытовые детали |
| S03 | [LPC Revised — Base Object Kit, Eliza Wyatt и указанные соавторы](https://opengameart.org/content/lpc-revised-base-object-kit) | CC BY-SA 3.0; credits в подпапках | Мебель, шкафы, растения, предметы хранения и декор |
| S04 | [Warped Top-Down Tech Lab 2, Ansimuz](https://opengameart.org/content/warped-top-down-tech-lab-2) | CC0; на странице указаны тайлы 32×32 | Лаборатория, техника, холодный металл |
| S05 | [Factory Tileset, rubberduck / Kenney](https://opengameart.org/content/factory-tileset) | CC0 | Конвейеры, трубы, промышленные терминалы |
| S06 | [LPC Character Bases, BenCreating / bluecarrot16 и исходные авторы](https://opengameart.org/content/lpc-character-bases) | CC BY-SA 3.0 / GPL 3.0; для плана использовать вариант CC | Тела и анимации людей; версии 3.0+ |
| S07 | [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator) | Лицензия отдельного слоя: CC0, CC BY, CC BY-SA, OGA-BY или GPL | Одежда, волосы, аксессуары; экспортировать credits выбранных слоёв |
| S08 | [LPC Chicken Rework, Daniel Eddeland / AntumDeluge](https://opengameart.org/node/83296) | CC BY 3.0 / GPL 2.0; использовать CC BY 3.0 | Куры, направление головы, цыплята и производные куриные части |
| S09 | [Skorpio’s SciFi Sprite Pack, Skorpio](https://opengameart.org/content/lpc-skorpios-scifi-sprite-pack) | CC BY-SA 3.0 / GPL 3.0; использовать вариант CC | Оружие, механические детали, технические корпуса |
| S10 | [LPC Shotgun Animation and Icon, blancaster45](https://opengameart.org/content/lpc-shotgun-animation-and-icon) | CC0 | Дробовик и позы стрельбы |
| S11 | [Particle Pack, Kenney](https://kenney.nl/assets/particle-pack) | CC0 | Дым, вспышки, искры, огонь и взрывы |
| S12 | [Splat Pack, Kenney](https://kenney.nl/assets/splat-pack) | CC0 | Кровь, кислота и следы взрывов |

Ссылки и лицензии набора не заменяют сведения конкретного файла. Для S07 нельзя объявить всю одежду CC0 или применять лицензию кода генератора ко всем изображениям.

## Карта игровых элементов

| Элементы | Источники | Способ получения |
|---|---|---|
| office/lab/industrial floors, walls, doors, windows | S01; лабораторные дополнения S04 | Подготовленные наборы, фасады/верх/основание стены отдельно |
| desk, desk_b, printer, water_cooler, bin, laptops, mugs, papers, tv | S02 + S03 | Готовые предметы и составные рабочие места |
| office_chair, chair_0–3, chair_blue, tables, sofas, coffee_table, cabinet, plant, shelf | S03 | Выбор современного варианта и направленных кадров |
| reception, kitchen counters, stove, hob, sink, aquarium | S02 + S03 | Сборка из библиотечных корпусов; недостающие аквариум/специальные части — собственная адаптация, явно записанная в реестр |
| server_rack, lab_bench, lab_console, terminal, machine, generator, vending, elevator | S04 + S09 | Подготовка и сборка технических модулей; не обещать готовый кадр до проверки архива |
| conveyor, pipe_h | S05 | Адаптация разрешения, палитры и контура |
| crate, crate_small, crate_rot, crate_small_rot, pallet, barrels, hazard_barrel | S03 + S05 + технические корпуса S04 | Подготовленные направления и целое/разрушенное состояние |
| forklift | S03 + S05 | В первой версии заменить складским штабелем/паллетами, сохранив необходимое препятствие |
| whiteboard, poster, poster_b, sign_exit, emergency_light, notes | S01–S04 + собственные надписи | Библиотечный корпус, корпоративные тексты и пиктограммы |
| программист, сотрудница, охранник, уборщик, учёный, выживший; четыре игрока; портреты | S06 + S07 | Композиция выбранных тел/одежды; портреты из тех же обликов |
| chick, малая chicken | S08 | Готовая направленная анимация и согласованный масштаб |
| normal, fast, fat, spitter, armored, exploder | S06–S08; броня/детали S09 | Новые головы, гребни, крылья, лапы и атакующие позы на библиотечных телах. Узнаваемая одежда бывшего NPC |
| pistol, smg, rifle, machinegun | S09 | Адаптация оружейных частей и отдельных рук; четыре разные формы |
| shotgun | S10 | Адаптация готового оружия и поз |
| grenade, flamethrower | S09 + собственные части | Широкий ствол; баллон/сопло. Это новые составные ассеты |
| boss | S09 + производные S06/S08 | Составной механический босс с собственной куриной головой/корпусом и повреждаемой бронёй |
| muzzle flashes, sparks, smoke, fire, explosions | S11 | Небольшие текстуры и короткие частицы; палитра и плотность под общий стиль |
| blood, acid, scorch | S12 | Перекраска и небольшой набор следов под персонажами |
| feather_pile, blood_trail, casings, shell fragments | S08/S12/S09 + собственная адаптация | Выделить части и подготовить компактные кадры; реестр отличает производную работу от оригинальной |
| egg_pod, egg_pod_broken, целая/треснувшая/разбитая капсула | S04 + S08 + собственная адаптация | Технический корпус, яйцо, стекло и разрушенные варианты |
| mutation frames | S06–S08 + собственная адаптация | Сбой → судорога/перья → разрыв силуэта → петух, всего явная стадия 2,2 с |
| ammo/health/armor/weapon/keycard/supply icons | S03/S09/S10 + собственная пиксельная разметка | Узнаваемые расходники, карточки и оружейные пиктограммы |
| player rings, crosshair, markers, interaction progress | Существующий UI/код и согласованные формы | Подготовить к пиксельной сцене; не вводить новый большой UI-набор |
| звук оружия и существующие звуки | Текущая `src/client/audio/Sfx.ts` | Сохранить существующую звуковую систему; новая генерация звука в объём этой переделки не включена |

Полная инвентаризация реальных prop/frame ID выполняется в P02/P17. Неиспользуемые старые ID не требуют новой отрисовки; удаление или замена использованного ID должно сопровождаться проверкой карты и загрузчика.

## Запись для каждого импортированного кадра

В P02/P17 заполнить таблицу или отдельный машиночитаемый manifest следующими полями:

| Поле | Содержание |
|---|---|
| game_id / frame | Фактический ID в карте, анимации или атласе |
| source_id / author / url | S01–S12, авторы, исходная страница |
| source_version / archive / sha256 | Версия или дата, название архива, контрольная сумма |
| source_file / rect | Путь оригинала внутри архива и область кадра |
| selected_license / credits | Выбранная лицензия, полный текст, условия атрибуции |
| adaptation | Без изменений / перекраска / сборка / перерисовка / собственный ассет |
| output / geometry | Атлас, имя кадра, направления, масштаб, точка стоп, основание, рука/дуло |
| status | Источник выбран / проверен / подготовлен / импортирован / принят |

Оригиналы и лицензии хранить рядом в `vendor/<source>/`; воспроизводимые адаптации — в исходниках art pipeline. Итоговые атласы — производные результаты. Сведения авторов и лицензий доступны из экрана титров игры.

## Референс

Дополнение 2026-10-02: три приложенные пользователем схемы седьмого этажа использованы как ориентир планировки и палитры. `desk_light` — перекраска существующего LPC стола в светлое дерево до наложения ноутбука; `table_tennis`, четыре значка бафов и трофей — собственная пиксельная разметка в `tools/art/lpc.mjs`. Серые полы 500/501 и фасад `wall_face_office7` продолжают существующий art pipeline; исходные три темы сохранены. Андрей, Серёга, Влад, Стас, Паша и лысый менеджер собраны из уже лицензированных LPC слоёв. Новые внешние ассеты и AI-изображения не добавлялись.

Файл пользователя: [references/chkn-2.5d-reference.png](references/chkn-2.5d-reference.png). Оригинал скопирован без изменения. Использовать его для ракурса, видимых лиц, плотности декора, разделения трёх локаций и выразительности огня. Выбранная реализация — пиксель-арт; гладкую рисовку картинки повторять не требуется.
