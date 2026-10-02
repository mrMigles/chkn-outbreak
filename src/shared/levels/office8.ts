import type { LevelScript } from './types';
import type { World } from '../sim/World';
import type { Npc } from '../sim/types';
import { dist } from '../math';

/**
 * Floor 8 «Тёмная тема» (D69). Darkness, sleeping red-eyed chickens and four scares. The den door has two
 * safety releases in opposite wings that must be pulled within a few seconds of each other: a team splits up,
 * a lone player gets Неля on the radio. Валера sits on a call in the dark; the breaker turns him into a
 * hit-and-run elite that hates flashlights. His defeat brings the light back and opens the service lift.
 */
const WINDOW = 6;
const SCARES = ['scare_printer', 'scare_phone', 'scare_flicker', 'scare_vent'];
const team = (w: World) => w.humanPlayers.filter(p => p.connected).length;
const valeraEnemy = (w: World) => w.enemies.find(e => e.appearance?.npcId === 'valera');

function objective(w: World) {
  if (w.finished) return;
  if (!w.flags.doorOpen) {
    const left = ['lock_w', 'lock_e'].filter(id => !w.flags[id + '_t'] || w.time - w.flags[id + '_t'] > WINDOW);
    const solo = !!w.flags.nelyaHelps;
    const text = solo
      ? (w.flags.nelyaReady ? 'Взвести западный размыкатель — Неля держит восточный' : 'Пробраться к западному размыкателю. Неля идёт к восточному')
      : `Разделиться: взвести оба размыкателя за ${WINDOW} секунд (запад и восток)`;
    w.setObjective(text, solo ? 'lock_w' : left.length ? left : ['lock_w', 'lock_e']);
    return;
  }
  if (!w.flags.breaker) {
    w.setObjective(w.flags.denSeen ? 'Включить рубильник на стене серверной' : 'В серверную: найти щиток этажа', w.flags.denSeen ? 'breaker' : 'den');
    return;
  }
  const v = valeraEnemy(w);
  if (!w.flags.valeraDead) { w.setObjective('Победить Петуха Тёмной Темы. Светите ему в глаза!', v ? { x: v.x, y: v.y } : 'den'); return; }
  w.setObjective('Свет есть! К служебному лифту за серверной', 'lift8');
}

function nelyaGo(w: World) {
  const n = w.npc('nelya');
  const lock = w.object('lock_e');
  if (!n || !lock || w.flags.nelyaHelps) return;
  w.flags.nelyaHelps = true;
  n.mode = 'idle';
  w.npcGoto(n, lock.cx - 30, lock.cy + 50);
  w.say(n.id, 'Я возьму восточный размыкатель, а ты — западный. Скажу по рации, когда буду на месте!', 5);
  objective(w);
}

function pull(w: World, id: 'lock_w' | 'lock_e', who: string) {
  if (w.flags.doorOpen) { w.say(who, 'Дверь уже открыта.'); return; }
  w.flags[id + '_t'] = w.time;
  const other = id === 'lock_w' ? 'lock_e' : 'lock_w';
  const t = w.flags[other + '_t'];
  if (t && w.time - t <= WINDOW) {
    w.flags.doorOpen = true;
    w.openDoor('dark_door');
    w.award('two_keys');
    w.scare('flicker', w.object('dark_door')!.cx, w.object('dark_door')!.cy);
    w.msg('ДВЕРЬ В СЕРВЕРНУЮ ОТКРЫТА', 'Два ключа, как в фильмах про ракеты', 3);
    w.say('radio', 'Неля: Щёлкнуло! Серверная по центру, на север от коридора. Валера там. Он… разговаривает.', 5);
    // Валера knows: a few of his pets come down the corridor
    w.spawnWave('dark', ['fast', 'normal', 'normal', 'fast'], 6 + 2 * Math.max(0, team(w) - 1), .5, true, 'dark', true);
    objective(w);
    return;
  }
  // a lone player pulling the west release while Неля stands at the east one: she pulls hers
  const n = w.npc('nelya');
  if (id === 'lock_w' && w.flags.nelyaReady && n && n.mode !== 'gone') {
    w.say('radio', 'Неля: Тяну восточный! Раз, два…', 3);
    w.after(0.8, () => pull(w, 'lock_e', n.id));
    return;
  }
  w.say(who, `Размыкатель взведён. Второй — в течение ${WINDOW} секунд!`, 3);
  objective(w);
}

const office8: LevelScript = {
  id: 'office8', title: 'Этаж 8. Тёмная тема',
  subtitle: 'Здесь работает человек, который не любит свет',
  next: 'office11', enemyDamage: .8, enemyHp: .9,

  onStart(w) {
    w.flags.lastTeam = team(w);
    objective(w);
    w.after(1.5, () => w.say('nelya', 'Ой! Живые! Не светите сюда… шучу, светите. Я Неля из бухгалтерии.', 4));
    w.after(5.5, () => w.say('nelya', 'Валера из IT выкрутил все лампы. Щиток в его серверной, а дверь — на двух размыкателях: запад и восток.', 6));
    w.after(12, () => {
      if (team(w) < 2) nelyaGo(w);
      else { w.say('nelya', 'Вас много — разделитесь! Одни на запад, другие на восток. А я посторожу лифт… и свою психику.', 6); objective(w); }
    });
    w.after(19, () => w.say('radio', 'Неля: Тсс. Петушки в темноте спят. Не подходите близко и не светите им в глаза — проснутся. Спящего бейте первым: он не ждёт.', 7));
  },

  onTick(w, dt) {
    const sec = Math.floor(w.time) !== Math.floor(w.time - dt);
    // a teammate dropped out before the releases: Неля takes the east one
    if (sec && !w.flags.doorOpen && w.time > 12 && team(w) < 2) nelyaGo(w);
    for (const id of ['lock_w', 'lock_e']) {
      const t = w.flags[id + '_t'];
      if (t && !w.flags.doorOpen && w.time - t > WINDOW) {
        w.flags[id + '_t'] = 0;
        w.say('radio', 'Неля: Защёлка отщёлкнулась. Нужно одновременно — как ключи в фильмах про ракеты!', 4);
        objective(w);
      }
    }
    // the night shift: a few awake chickens roam the corridor until the den is open
    if (!w.flags.doorOpen && w.time >= (w.flags.patrolAt ?? 25)) {
      w.flags.patrolAt = w.time + 24;
      if (w.countTag('patrol') < 6) w.spawnWave('dark', ['fast', 'normal', 'normal'], 2 + w.players.length, .6, true, 'patrol', true);
    }
    // Валера's phone call in the dark
    const n = w.npc('valera');
    if (w.flags.denSeen && !w.flags.breaker && n && sec && w.time >= (w.flags.callAt ?? 0)) {
      const lines = ['Артём? Артём, не слышно тебя!', 'Артём! Ты на мьюте! Микрофон, Артём!', 'Да не вижу я твой экран. У меня ТЁМНАЯ ТЕМА!', 'Артём, Артём… не слышно тебя…', 'Кто здесь?! Только не включайте свет. НЕ ВКЛЮЧАЙТЕ СВЕТ.'];
      const i = w.flags.callLine ?? 0;
      w.say(n.id, lines[i % lines.length], 3);
      w.flags.callLine = i + 1; w.flags.callAt = w.time + 3.4;
    }
    const v = valeraEnemy(w);
    if (v && !w.flags.valeraScaled) {
      w.flags.valeraScaled = true;
      v.hp = v.maxHp = 2000 * (1 + .45 * (w.players.length - 1)); v.speedMul = 1.15; v.abilityCd = 4;
      w.setBoss(v, 'Петух Тёмной Темы · Валера');
      w.flags.summonAt = w.time + 10;
      w.spawnWave('den', ['fast', 'normal', 'fast'], 4 + 2 * (w.players.length - 1), .4, true, 'den');
    }
    if (v && w.time >= w.flags.summonAt && w.countTag('den') < 10) {
      w.flags.summonAt = w.time + 13;
      w.say(String(v.id), w.rng.pick(['Отдел! На созвон!', 'Тёмная тема — это корпоративный стандарт!', 'КО-КО-КОД-РЕВЬЮ!']), 2);
      w.spawnWave('den', ['fast', 'normal', 'spitter', 'fast'], 4 + w.players.length, .4, true, 'den');
    }
    if (v && !w.flags.valeraHalf && v.hp < v.maxHp / 2) {
      w.flags.valeraHalf = true;
      w.scare('flicker', v.x, v.y);
      w.say(String(v.id), 'Ctrl+Z! Ctrl+Z! Верните как было!', 2.5);
      w.spawnWave('den', ['fast', 'fast', 'normal', 'armored'], 6, .3, true, 'den');
    }
    if (sec) objective(w);
    const lift = w.object('lift8');
    if (w.flags.valeraDead && lift && !w.finished && w.humanPlayers.length && w.humanPlayers.every(p => p.x >= lift.x && p.x <= lift.x + lift.w && p.y >= lift.y && p.y <= lift.y + lift.h)) {
      if (w.flags.scares >= SCARES.length) w.award('who_is_there');
      w.say('radio', 'Неля: Девятый и десятый — субаренда, коворкинг. Туда даже петухи не ходят. Едем на одиннадцатый, к начальству!', 6);
      w.completeLevel('office11');
    }
  },

  onTrigger(w, id, by) {
    if (SCARES.includes(id)) {
      w.flags.scares = (w.flags.scares ?? 0) + 1;
      if (id === 'scare_printer') {
        const pr = w.objects('prop', 'printer')[0];
        w.scare('spark', pr.cx, pr.cy); w.scare('jump', pr.cx, pr.cy);
        w.say(by.id, 'Принтер… сам печатает?! «КО КО КО КО КО КО»…', 3);
        for (let i = 0; i < 2; i++) w.spawnEnemy('fast', pr.cx + (i ? 50 : -50), pr.cy + 60, { how: 'egg', aggro: true, tag: 'west' });
      }
      if (id === 'scare_phone') { const ph = w.objects('prop', 'desk_phone').find(o => o.cx > 40 * 64)!; w.scare('ring', ph.cx, ph.cy); w.say(by.id, 'Телефон звонит. В пустом офисе. Отлично. Просто отлично.', 3); }
      if (id === 'scare_flicker') { w.scare('flicker', by.x, by.y); w.after(1.3, () => w.say(by.id, 'Ты это видел?! Они… стоят. И смотрят.', 3)); }
      if (id === 'scare_vent') {
        w.scare('jump', by.x, by.y);
        w.say(by.id, 'ВЕНТИЛЯЦИЯ!!!', 2);
        w.spawnWave('vent', ['fast', 'fast', 'normal'], 3, .15, true, 'vent');
      }
    }
    if (id === 'phone_near' && !w.flags.phoneAnswered) {
      w.flags.phoneAnswered = true;
      const e = w.enemies.find(q => w.enemyTags.get(q.id) === 'phone');
      if (e) { e.dormant = false; e.aggro = true; w.say(String(e.id), 'Алло? КО? Алло-КО-КО!', 2.5); w.scare('jump', e.x, e.y); }
    }
    if (id === 'west' && !w.flags.westSaid) { w.flags.westSaid = true; w.say(by.id, 'Шкафы, папки и красные глаза между ними. Тихо…', 3); }
    if (id === 'east' && !w.flags.eastSaid) { w.flags.eastSaid = true; w.say(by.id, 'Отдел продаж. Даже в темноте пахнет дедлайном.', 3); }
    if (id === 'den' && w.flags.doorOpen && !w.flags.denSeen) {
      w.flags.denSeen = true; w.flags.callAt = w.time + 0.5;
      objective(w);
    }
  },

  onUse(w, id, by) {
    if (id === 'lock_w' || id === 'lock_e') { pull(w, id, by.id); return; }
    if (id !== 'breaker') return;
    if (!w.flags.doorOpen) return;
    if (w.flags.breaker) { w.say(by.id, 'Рубильник выбило. Валера перегрыз кабель.'); return; }
    w.flags.breaker = true;
    const n = w.npc('valera') as Npc;
    w.setLight(0.05);
    w.say(by.id, 'Да будет свет!', 2);
    w.after(0.6, () => { w.say(n.id, 'А-А-А-А! СВЕТ! МОИ ГЛАЗА! МОЯ ТЁМНАЯ ТЕМА!!!', 3); w.infect(n, 'fast', 'valera'); });
    w.after(2.6, () => {
      w.setLight(0.97);
      w.scare('jump', n.x, n.y);
      w.msg('ЩЁЛК', 'Валера перегрыз кабель. Свет — только ваши фонарики', 3);
    });
    objective(w);
  },

  onNpcUse(w, n) {
    if (n.id === 'valera') { w.say(n.id, w.flags.denSeen ? 'Тсс! У меня созвон! Артём, тебя не слышно!' : 'Кто здесь?', 2.5); return true; }
    if (n.id === 'nelya' && !w.flags.valeraDead) {
      w.say(n.id, w.flags.nelyaHelps ? 'Я на связи! Иди к своему размыкателю.' : 'Я сторожу лифт. Разделитесь и возьмите оба размыкателя!', 3);
      return true;
    }
  },

  onNpcArrive(w, n) {
    if (n.id !== 'nelya' || w.flags.doorOpen) return;
    w.flags.nelyaReady = true;
    n.angle = -Math.PI / 2;
    w.say('radio', 'Неля: Я у восточного размыкателя! Взводи западный — я дёрну свой сразу за тобой.', 6);
    objective(w);
  },

  onKill(w, e) {
    if (e.appearance?.npcId !== 'valera' || w.flags.valeraDead) return;
    w.flags.valeraDead = true;
    w.cancelWaves();
    w.setLight(0.1);
    w.award('light_theme');
    w.openDoor('service');
    w.msg('СВЕТ ДАЛИ', 'Валера уволен по собственному нежеланию', 4);
    w.addPickup('health', e.x, e.y, { ttl: -1 });
    const n = w.npc('nelya');
    if (n && n.mode !== 'gone' && n.mode !== 'dead') {
      const p = w.humanPlayers.sort((a, b) => dist(a.x, a.y, n.x, n.y) - dist(b.x, b.y, n.x, n.y))[0];
      if (p) { n.mode = 'follow'; n.follow = p.id; n.rescued = true; }
      w.say('radio', 'Неля: Ура, свет! Вижу служебный лифт — за серверной, на восток. Бегу к вам!', 5);
    }
    objective(w);
  },
};
export default office8;
