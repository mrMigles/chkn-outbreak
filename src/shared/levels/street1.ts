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
  w.setObjective('На юг, к рынку: дорога к заводу «Провансаль»', 'south_exit');
}

const street1: LevelScript = {
  id: 'street1', title: 'Улица. Вертолёт у фонтана',
  subtitle: 'Город. Пятница. Петухи на проспекте',
  chapter: 'Глава 2 · Город',
  next: 'street2', enemyDamage: .85,

  onStart(w) {
    objective(w);
    w.after(1.5, () => w.say('radio', 'Капитан Крылов: Приём! Кто-нибудь! Я у фонтана, на площади за проспектом. Рация цела, но вокруг… курицы. Много куриц.', 7));
    w.after(9, () => w.say(w.anyPlayer?.id ?? 'radio', 'Город. Свежий воздух. И петухи на проезжей части. Как обычно в пятницу.', 4));
    w.flags.streetAt = 25;
  },

  onTick(w, dt) {
    const sec = Math.floor(w.time) !== Math.floor(w.time - dt);
    if (sec) objective(w);
    if (!w.flags.pilotMet && w.time >= w.flags.streetAt) {
      w.flags.streetAt = w.time + 22;
      if (w.countTag('street') < 10) w.spawnWave('street', ['normal', 'fast', 'normal', 'spitter'], 3 + w.players.length, .5, true, 'street', true);
    }
    // the radio defence: waves from every side of the square, heavier towards the end
    if (w.flags.pilotMet && !w.flags.radioDone) {
      const t = w.time - w.flags.radioAt;
      if (w.time >= w.flags.heliWaveAt) {
        w.flags.heliWaveAt = w.time + 4;
        const pool: EnemyType[] = t < 20 ? ['normal', 'fast', 'fast'] : t < 40 ? ['normal', 'fast', 'spitter', 'exploder'] : ['armored', 'fast', 'normal', 'fat', 'spitter'];
        if (w.countTag('heli') < 12 + 4 * w.players.length) w.spawnWave('heli', pool, 2 + Math.floor(t / 20) + w.players.length, .3, true, 'heli');
      }
      if (t >= RADIO) {
        w.flags.radioDone = true;
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
    const exit = w.object('south_exit');
    if (w.flags.radioDone && exit && !w.finished && w.humanPlayers.length && w.humanPlayers.every(p => p.x >= exit.x && p.x <= exit.x + exit.w && p.y >= exit.y && p.y <= exit.y + exit.h)) w.completeLevel('street2');
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
    if (id === 'park' && !w.flags.parkSeen) {
      w.flags.parkSeen = true;
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
      } else w.say(n.id, w.flags.flockAngry ? 'Иди уже, стрелок…' : 'Цыпа-цыпа…', 3);
      return true;
    }
    if (n.id === 'ashot') { w.say(n.id, w.flags.shawarmaDone ? 'Шаурма кончилась, брат. Петухи — нет.' : 'Помоги отогнать их от ларька!', 3); return true; }
    if (n.id === 'pilot' && w.flags.pilotMet) { w.say(n.id, w.flags.radioDone ? '«Провансаль» — на юге. Удачи, гражданские!' : 'Связь ещё не готова! Держите их!', 3); return true; }
    if (n.id === 'courier' && n.rescued) { w.say(n.id, 'Пять звёзд, если доживу!', 2); return true; }
  },

  onKill(w, e, tag) {
    if (tag === 'square' && !w.flags.pilotMet && !w.countTag('square')) {
      const n = w.npc('pilot');
      if (n && w.humanPlayers.some(p => dist(p.x, p.y, n.x, n.y) < 600)) w.say(n.id, 'Чисто! Подойдите ко мне!', 3);
    }
  },
};
export default street1;
