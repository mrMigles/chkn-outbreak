import type { LevelScript } from './types';
import type { World } from '../sim/World';
import type { EnemyType } from '../enemies';
import { dist } from '../math';

/**
 * Chapter 2, street 1 (D69): reach the fallen helicopter, hold the square for 60 s while Капитан Крылов
 * gets through to HQ, learn the epicentre — the «Провансаль» factory — and head south. Optional scenes:
 * Ашот's kiosk (shawarma achievement + shotgun), the grandma and her flock (do not shoot nearby), the courier.
 */
const RADIO = 60;

function objective(w: World) {
  if (w.finished) return;
  if (!w.flags.pilotMet) { w.setObjective('К вертолёту на площади у фонтана (юго-восток)', 'pilot'); return; }
  if (!w.flags.radioDone) {
    const pct = Math.min(99, Math.floor((w.time - w.flags.radioAt) / RADIO * 100));
    w.setObjective(`Прикрыть Капитана Крылова: рация ${pct}%`);
    return;
  }
  // D72: south through the parking lot — Литовец steals a car and breaks the fence for us
  if (!w.flags.lotSeen) { w.setObjective('На юг, к парковке «Элит-Авто»: дорога к рынку', 'lot'); return; }
  if (!w.flags.carGone) { w.setObjective('Литовец угоняет машину! Прикрыть его', 'litovets'); return; }
  w.setObjective('За Литовцем! Через пролом в ограде — к рынку', 'lot_exit');
}

/** D72: Бабушка Зина feeds her flock — and then crumbles into a flock of fierce hens herself. */
function crumble(w: World) {
  const n = w.npc('babushka');
  if (!n || w.flags.grandmaGone || n.mode === 'gone') return;
  w.flags.grandmaGone = true;
  w.say(n.id, 'Кушайте, мои хорошие… и бабушку… бабушку тоже… КО-КО-КОРМИТЕ!', 3.5);
  w.scare('flicker', n.x, n.y);
  w.emit({ e: 'mutation', id: n.id, x: n.x, y: n.y, stage: 'twitch' });
  w.after(2.6, () => {
    n.mode = 'gone';
    w.scare('poof', n.x, n.y);
    w.emit({ e: 'mutation', id: n.id, x: n.x, y: n.y, stage: 'complete' });
    const k = 5 + 2 * w.players.length;
    for (let i = 0; i < k; i++) {
      const a = i / k * Math.PI * 2;
      const e = w.spawnEnemy('fast', n.x + Math.cos(a) * 40, n.y + Math.sin(a) * 30, { how: 'egg', aggro: true, tag: 'grandma' });
      e.appearance = { npcId: 'hen_' + e.id, kind: 'babushka', name: 'Бабушкина курочка' };
    }
    for (const e of w.enemies) if (w.enemyTags.get(e.id) === 'flock') { e.dormant = false; e.aggro = true; }
    const p = w.humanPlayers.sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y))[0];
    if (p) w.moment(p.id, w.flags.pirozhok ? 'Съел(а) бабушкин пирожок за минуту до того, как бабушка рассыпалась на курочек' : 'Видел(а), как бабушка Зина рассыпалась на курочек');
    w.msg('БАБУШКА ЗИНА…', '…рассыпалась на курочек. Свирепых', 3);
  });
}

/** D72: Литовец gets into the sports car, drives through the flock and breaks the fence. */
function getaway(w: World) {
  const n = w.npc('litovets'), m = w.object('getaway');
  if (!n || !m || w.flags.carGo) return;
  w.flags.carGo = true;
  w.say(n.id, 'Ну всё, заводится! Держитесь за что-нибудь! Ааа-ааа! Свобо-о-о-да!', 4);
  // he gets in (the NPC leaves, the car's engine and horn say the rest)
  n.mode = 'gone';
  w.after(1.2, () => {
    const v = w.vehicles[0];
    if (!v) return;
    w.driveVehicle(v, [{ x: 50 * 64, y: m.cy }, { x: 90 * 64, y: m.cy }], 420);
    w.spawnWave('lot', ['normal', 'fast', 'fast', 'spitter'], 4 + 2 * w.players.length, .35, true, 'lotwave');
  });
  objective(w);
}

const street1: LevelScript = {
  id: 'street1', title: 'Улица. Вертолёт у фонтана', rev: 2,
  subtitle: 'Город. Пятница. Петухи на проспекте',
  chapter: 'Глава 2 · Город',
  next: 'street2', enemyDamage: 1,

  onStart(w) {
    objective(w);
    const m = w.object('getaway');
    if (m) w.addVehicle(String(m.props.kind || 'car_sport'), m.cx, m.cy, 0);
    w.after(1.5, () => w.say('radio', 'Капитан Крылов: Приём! Кто-нибудь! Я у фонтана, на площади за проспектом. Рация цела, но вокруг… курицы. Много куриц.', 7));
    w.after(9, () => w.say(w.anyPlayer?.id ?? 'radio', 'Город. Свежий воздух. И петухи на проезжей части. Как обычно в пятницу.', 4));
    w.flags.streetAt = 25;
  },

  onTick(w, dt) {
    const sec = Math.floor(w.time) !== Math.floor(w.time - dt);
    // D71 (rules 6): now and then a pack of «прыгуны» — street parkour couriers, quicker and tougher
    if (w.rules >= 6 && !w.finished && !(w.flags.pilotMet && !w.flags.radioDone) && w.time >= (w.flags.jumpAt ?? 40)) {
      w.flags.jumpAt = w.time + w.rng.range(42, 58);
      const groups = w.objects('spawner').map(o => o.name);
      const g = 'street';
      if (groups.includes(g) && w.countTag('jump') < 3 && w.enemies.length < 14) {
        w.spawnWave(g, ['jumper'], 1 + Math.ceil(w.players.length / 2), .6, true, 'jump');
        if (!w.flags.jumpSaid) { w.flags.jumpSaid = true; w.emit({ e: 'notice', tone: 'danger', text: 'ПРЫГУНЫ!', sub: 'Уличные петухи-паркурщики: прыгают издалека. Отходите в сторону, когда они присели.' }); }
      }
    }
    if (sec) objective(w);
    // D72: the grandma keeps feeding; after the pie (or a while in the park) she crumbles into hens
    const zina = w.npc('babushka');
    if (zina && zina.mode !== 'gone' && w.flags.parkSeen && !w.flags.grandmaGone) {
      if (w.time >= (w.flags.feedAt ?? 0)) {
        w.flags.feedAt = w.time + 6;
        w.scare('grain', zina.x, zina.y + 40);
        if (w.rng.chance(.5)) w.say(zina.id, w.rng.pick(['Цыпа-цыпа-цыпа! Кушайте, мои хорошие!', 'Пшёнка свежая, с рынка!', 'Это Рябушка, это Пеструшка, а это… кто это?', 'Ешьте, ешьте. Бабушка ещё насыплет.']), 3, true);
      }
      const near = w.humanPlayers.some(p => Math.hypot(p.x - zina.x, p.y - zina.y) < 700);
      if (near && w.time >= (w.flags.crumbleAt ?? Infinity)) crumble(w);
    }
    // the car: the fence must be gone once it is through (safety: never a closed way)
    const car = w.vehicles[0];
    if (w.flags.carGo && !w.flags.carGone && (!car || car.x > 66 * 64)) {
      w.flags.carGone = true;
      for (const d of [...w.dprops]) if (d.name === 'fence_v') w.damageProp(d, d.hp + 1, '');
      // the survivors of the flock wake up behind the car
      for (const e of w.enemies) if (w.enemyTags.get(e.id) === 'lot') { e.dormant = false; e.aggro = true; }
      w.scare('crash', 63.5 * 64, 62 * 64);
      w.emit({ e: 'shake', s: 0.4 });
      w.say('radio', 'Литовец (по рации таксистов): Ограду снёс, петухов собрал! Рынок — прямо по дороге. Ачю, ребята!', 6);
      objective(w);
    }
    if (!w.flags.pilotMet && w.time >= w.flags.streetAt) {
      w.flags.streetAt = w.time + 22;
      if (w.countTag('street') < 10) w.spawnWave('street', ['normal', 'fast', 'normal', 'spitter'], 3 + w.players.length, .5, true, 'street', true);
    }
    // the radio defence: waves from every side of the square, heavier towards the end
    if (w.flags.pilotMet && !w.flags.radioDone) {
      const t = w.time - w.flags.radioAt;
      if (w.time >= w.flags.heliWaveAt) {
        w.flags.heliWaveAt = w.time + 3.5;
        const pool: EnemyType[] = t < 20 ? ['normal', 'fast', 'fast', 'spitter'] : t < 40 ? ['normal', 'fast', 'spitter', 'exploder', 'armored'] : ['armored', 'fast', 'normal', 'fat', 'spitter', 'armored'];
        if (w.countTag('heli') < 14 + 4 * w.players.length) w.spawnWave('heli', pool, 3 + Math.floor(t / 15) + w.players.length, .3, true, 'heli');
      }
      if (t >= RADIO) {
        w.flags.radioDone = true;
        w.flags.jumpAt = w.time + 25;
        w.say('pilot', 'Штаб на связи! Эпицентр — завод «Провансаль», цех номер три. Там всё началось! Дорога — на юг, через рынок.', 7);
        w.after(7, () => w.say('pilot', 'Держите автомат — без вертолёта он мне ни к чему. Я останусь, буду наводить вертушки… ну, когда они снова начнут летать.', 6));
        const n = w.npc('pilot')!;
        w.addPickup('weapon', n.x + 40, n.y + 30, { weapon: 'rifle', ttl: -1 });
        w.addPickup('ammo', n.x - 40, n.y + 30, { ttl: -1 });
        w.msg('СВЯЗЬ ЕСТЬ', 'Эпицентр: завод «Провансаль»', 4);
        objective(w);
      }
    }
    // the flock: shots close to the grandma wake the chicks; she scolds (once)
    if (!w.flags.flockAngry && w.enemies.some(e => w.enemyTags.get(e.id) === 'flock' && e.aggro)) {
      w.flags.flockAngry = true;
      w.say('babushka', 'Ну вот! Распугали! Я ж говорила — не стрелять рядом!', 4);
    }
    // Ашот's kiosk is saved when its attackers are gone
    if (w.flags.shawarmaSeen && !w.flags.shawarmaDone && !w.countTag('shawarma')) {
      w.flags.shawarmaDone = true;
      const n = w.npc('ashot')!;
      n.rescued = true; n.mode = 'idle';
      w.award('shawarma');
      w.say(n.id, 'Спасибо, брат! Шаурма за счёт заведения — и дробовик. Он мне больше не нужен, ларёк закрываю.', 6);
      w.addPickup('health', n.x - 60, n.y + 40, { ttl: -1 });
      w.addPickup('weapon', n.x - 100, n.y + 50, { weapon: 'shotgun', ttl: -1 });
    }
    const exit = w.object('lot_exit');
    if (w.flags.carGone && exit && !w.finished && w.humanPlayers.length && w.humanPlayers.every(p => p.x >= exit.x && p.x <= exit.x + exit.w && p.y >= exit.y && p.y <= exit.y + exit.h)) {
      w.award('gone_in_60');
      w.completeLevel('street2');
    }
  },

  onTrigger(w, id, by) {
    if (id === 'avenue' && !w.flags.avenue) {
      w.flags.avenue = true;
      w.spawnWave('street', ['normal', 'fast', 'normal'], 4 + w.players.length, .4, true, 'street', true);
      w.say(by.id, 'Пробка из машин. И ни одного водителя. Только перья на сиденьях.', 3.5);
    }
    if (id === 'shawarma' && !w.flags.shawarmaSeen) {
      w.flags.shawarmaSeen = true;
      for (const e of w.enemies) if (w.enemyTags.get(e.id) === 'shawarma') { e.dormant = false; e.aggro = true; }
      w.say('ashot', 'Эй! Помогите! Они думают, что шаурма из их родственников! Клянусь — телятина!', 5);
    }
    if (id === 'lot' && w.flags.radioDone && !w.flags.lotSeen) {
      w.flags.lotSeen = true;
      const n = w.npc('litovets')!;
      w.say(n.id, 'Тише! Не спугните! Вы видите эти тачки?! Всю жизнь мечтал угнать такую. ВСЮ ЖИЗНЬ!', 5);
      w.after(5, () => w.say(n.id, 'А тут — конец света, охрана — петух, никто не против! Отвлеките их — я завожу жёлтую!', 5));
      w.after(10.5, () => getaway(w));
      w.moment(by.id, 'Помог(ла) Литовцу угнать жёлтую спортивную машину');
      objective(w);
    }
    if (id === 'lot' && !w.flags.radioDone) w.rearmTrigger('lot');
    if (id === 'park' && !w.flags.parkSeen) {
      w.flags.parkSeen = true;
      w.flags.crumbleAt = w.time + 45;
      w.say('babushka', 'Цыпа-цыпа-цыпа… Внучок, не стреляй тут, они нервные. Пирожок хочешь?', 5);
      w.spawnWave('park', ['normal', 'fast'], 2 + w.players.length, .6, true, 'parkwave');
    }
    if (id === 'square' && !w.flags.squareSeen) {
      w.flags.squareSeen = true;
      for (const e of w.enemies) if (w.enemyTags.get(e.id) === 'square') e.aggro = true;
      w.say('pilot', 'Сюда! К вертолёту! Осторожно — мой второй пилот где-то рядом. Он теперь… клюётся.', 4);
    }
  },

  onRescue(w, n, by) {
    if (n.id === 'pilot' && !w.flags.pilotMet) {
      n.mode = 'idle';
      w.flags.pilotMet = true; w.flags.radioAt = w.time; w.flags.heliWaveAt = w.time + 2;
      w.setAlarm(true);
      w.say(n.id, 'Живые! Мне нужна минута, чтобы пробиться к штабу. Держите площадь!', 5);
      w.msg('ОБОРОНА ВЕРТОЛЁТА', '60 секунд, пока работает рация', 3);
      if (w.rules >= 6) {
        // D71: the helicopter's door gun — plenty of bullets, but no more where those came from
        const wr = w.objects('prop', 'heli_wreck')[0];
        w.addPickup('weapon', (wr?.cx ?? n.x) - 30, (wr?.cy ?? n.y) + 70, { weapon: 'minigun', ttl: -1 });
        w.after(2.5, () => w.say(n.id, 'С борта снимите миниган! Он ещё крутится. Патронов — сколько есть, больше не будет.', 5));
      }
      w.after(RADIO, () => w.setAlarm(false));
      objective(w);
    }
    if (n.id === 'courier') {
      n.mode = 'idle';
      w.say(n.id, 'Спасли! Заказ: «патроны 9 мм и бронежилет, оплачено». Получатель — петух. Забирайте!', 5);
      w.addPickup('ammo', n.x + 40, n.y + 40, { ttl: -1 }); w.addPickup('armor', n.x - 40, n.y + 40, { ttl: -1 });
    }
    void by;
  },

  onNpcUse(w, n) {
    if (n.id === 'babushka') {
      if (!w.flags.pirozhok) {
        w.flags.pirozhok = true;
        w.award('grandma');
        w.say(n.id, 'Держи пирожок, с капустой. С курицей не пеку — неудобно перед ними.', 5);
        w.addPickup('health', n.x + 50, n.y + 60, { ttl: -1 });
        w.flags.crumbleAt = Math.min(w.flags.crumbleAt ?? Infinity, w.time + 12);
      } else w.say(n.id, w.flags.flockAngry ? 'Иди уже, стрелок…' : 'Цыпа-цыпа…', 3);
      return true;
    }
    if (n.id === 'ashot') { w.say(n.id, w.flags.shawarmaDone ? 'Шаурма кончилась, брат. Петухи — нет.' : 'Помоги отогнать их от ларька!', 3); return true; }
    if (n.id === 'pilot' && w.flags.pilotMet) { w.say(n.id, w.flags.radioDone ? '«Провансаль» — на юге. Удачи, гражданские!' : 'Связь ещё не готова! Держите их!', 3); return true; }
    if (n.id === 'courier' && n.rescued) { w.say(n.id, 'Пять звёзд, если доживу!', 2); return true; }
    if (n.id === 'litovets') {
      if (!w.flags.radioDone) w.say(n.id, 'Я? Я просто смотрю. Красивая, да? Жёлтая…', 3);
      else if (!w.flags.carGo) getaway(w);
      return true;
    }
  },

  onKill(w, e, tag) {
    if (tag === 'square' && !w.flags.pilotMet && !w.countTag('square')) {
      const n = w.npc('pilot');
      if (n && w.humanPlayers.some(p => dist(p.x, p.y, n.x, n.y) < 600)) w.say(n.id, 'Чисто! Подойдите ко мне!', 3);
    }
  },
};
export default street1;
