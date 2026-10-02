import type { LevelScript } from './types';
import type { World } from '../sim/World';
import { dist } from '../math';
export const FRIENDS = ['andrey', 'sergey', 'vlad', 'stas', 'pasha'];
const allFound = (w: World) => FRIENDS.every(id => w.npc(id)?.rescued);
function objective(w: World) {
  if (w.finished) return;
  const gate = w.doors.find(d => d.id === 'castor_lock');
  if (!w.flags.siegeStarted) { w.setObjective('Пробиться к запертому Castor: Андрей и Серёга в окружении', 'siege7'); return; }
  if (!w.flags.siegeCleared) {
    const enemies = w.enemies.filter(e => w.enemyTags.get(e.id) === 'siege7');
    enemies.sort((a, b) => Math.min(...w.humanPlayers.map(p => dist(p.x, p.y, a.x, a.y))) - Math.min(...w.humanPlayers.map(p => dist(p.x, p.y, b.x, b.y))));
    const e = enemies[0];
    w.setObjective('Разогнать стаю у двери Castor', e ? { x: e.x, y: e.y } : 'siege7'); return;
  }
  if (!w.flags.elenaStarted) { w.setObjective('Найти Елену: нужен пропуск в Castor', 'elena'); return; }
  if (!w.flags.elenaDead) {
    const elena = w.npc('elena')!;
    const enemy = w.enemies.find(e => e.appearance?.npcId === 'elena');
    w.setObjective('Елена превращается! Отбить пропуск', { x: enemy?.x ?? elena.x, y: enemy?.y ?? elena.y }); return;
  }
  if (!w.players.some(p => p.keys.includes('f7_pass')) && !gate?.open) {
    const card = w.pickups.find(k => k.key === 'f7_pass');
    w.setObjective('Подобрать пропуск Елены', card ? { x: card.x, y: card.y } : 'elena'); return;
  }
  if (!gate?.open && gate?.locked) { w.setObjective('Открыть Castor пропуском Елены', 'castor_lock'); return; }
  const left = FRIENDS.filter(id => !w.npc(id)?.rescued);
  if (left.length) w.setObjective(`Найти друзей (${5 - left.length}/5) · кухня, Phoenix, Castor`, left);
  else if (!w.flags.rootStarted) w.setObjective('Все пятеро с нами. Провести их к лифтам', 'root_ambush');
  else if (!w.flags.rootDead || w.countTag('root_attack')) {
    const root = w.enemies.find(e => e.appearance?.npcId === 'root_manager');
    const other = w.enemies.find(e => w.enemyTags.get(e.id) === 'root_attack');
    const enemy = root ?? other;
    w.setObjective(root ? 'Уволить Рутового петушка. Защитить друзей' : 'Отбить нападение менеджера. Защитить друзей', enemy ? { x: enemy.x, y: enemy.y } : undefined);
  }
  else if (!w.flags.rootAchievement) {
    const drop = w.pickups.find(k => k.kind === 'achievement');
    w.setObjective('Подобрать «Рутового петушка»', drop ? { x: drop.x, y: drop.y } : 'evacuation');
  } else w.setObjective('Отвести всех пятерых к лифтам', 'evacuation');
}
const level: LevelScript = {
  id: 'office7', title: 'Этаж 7. Пятеро на одного петуха',
  subtitle: 'Capella · Castor · Phoenix. Эвакуация без записи в календаре', next: 'office8', enemyDamage: .8,
  onStart(w) {
    objective(w);
    w.flags.escortWaveAt = w.time + 10;
    w.say('radio', 'Серёга: Мы с Андреем заперлись в Castor! Снаружи стая! Разгони их и найди пропуск у офис-администратора Елены!', 7);
    w.after(6, () => w.say('radio', 'Влад: На банке написано «проект ЯЙЦО, лаборатория −3». Они разослали опытную партию по офису!', 6));
  },
  onTick(w, dt) {
    for (const id of ['stas', 'pasha']) {
      const n = w.npc(id)!;
      const p = w.humanPlayers.find(p => dist(p.x, p.y, n.x, n.y) < 160 && w.map.lineOfSight(p.x, p.y, n.x, n.y, false));
      if (w.npc('andrey')?.rescued && w.npc('sergey')?.rescued && !n.rescued && p && !w.enemies.some(e => dist(e.x, e.y, n.x, n.y) < 380 && w.map.lineOfSight(e.x, e.y, n.x, n.y, false))) {
        n.rescued = true; level.onRescue!(w, n, p);
      }
    }
    for (const n of w.npcs.filter(n => n.tag === 'worker7')) {
      if (!n.mutation && n.mode !== 'gone' && n.mode !== 'dead' && w.humanPlayers.some(p => dist(p.x, p.y, n.x, n.y) < 430)) {
        w.say(n.id, w.rng.pick(['Я на минуту отойду… ко-ко!', 'Daily превращается в poultry!', 'Перья — это наш новый дресс-код!']), 2.5);
        w.infect(n, n.props?.turn || 'normal', 'workers7');
      }
    }
    if (w.time >= w.flags.escortWaveAt && !w.flags.evacuated && !w.flags.rootStarted) {
      w.flags.escortWaveAt = w.time + (allFound(w) ? 9 : 12);
      if (w.enemies.length < 65) w.spawnWave('escort', ['normal', 'fast', 'fast', 'spitter', 'armored'], allFound(w) ? 12 : 8, .3, true, 'escort7', true);
    }
    if (w.flags.siegeStarted && !w.flags.siegeCleared && !w.countTag('siege7')) {
      w.flags.siegeCleared = true;
      w.say('sergey', 'У двери чисто! Елена в офисной службе рядом с кухней. У неё мастер-пропуск. И характер.', 6);
      objective(w);
    }
    const admin = w.enemies.find(e => e.appearance?.npcId === 'elena');
    if (admin && !w.flags.elenaScaled) { w.flags.elenaScaled = true; admin.hp = admin.maxHp = 320; admin.speedMul = 1.3; }
    const boss = w.enemies.find(e => e.appearance?.npcId === 'root_manager');
    if (boss && !w.flags.rootScaled) {
      w.flags.rootScaled = true; // D68: rules 5 halve the root manager (2200 was too long a fight for the second floor)
      boss.hp = boss.maxHp = (w.rules >= 5 ? 1100 : 2200) * (1 + .4 * (w.players.length - 1)); boss.speedMul = 1.8; boss.abilityCd = 2.5;
      boss.appearance!.name = 'Рутовый петушок · sudo ко-ко';
    }
    if (boss && w.time >= w.flags.rootSupportAt && w.countTag('root_attack') < 48) {
      w.flags.rootSupportAt = w.time + 9;
      w.spawnWave('escort', ['fast', 'armored', 'spitter', 'normal'], 8, .25, true, 'root_attack', true);
      w.say(String(boss.id), 'СРОЧНЫЙ ДЕЙЛИ! Всем клевать сотрудника!', 2.5);
    }
    if (Math.floor(w.time) !== Math.floor(w.time - dt)) objective(w);
    const lift = w.object('evacuation');
    if (lift && allFound(w) && w.flags.rootDead && w.flags.rootAchievement && !w.countTag('root_attack') &&
      w.humanPlayers.length && w.humanPlayers.every(p => p.x >= lift.x && p.x <= lift.x + lift.w && p.y >= lift.y && p.y <= lift.y + lift.h) &&
      FRIENDS.every(id => { const n = w.npc(id)!; return n.mode === 'follow' && dist(n.x, n.y, lift.cx, lift.cy) < 285; })) {
      w.flags.evacuated = true;
      w.award('no_one_left');
      for (const id of FRIENDS) w.npc(id)!.mode = 'gone';
      // Earlier office survivors evacuate too; nobody is dragged into the lab against the story.
      for (const n of w.npcs) if (n.mode === 'follow') n.mode = 'gone';
      w.say('radio', 'Андрей: Мы в лифте, едем к выходу! А ваш лифт… кнопку «вниз» заклевали. Он едет только вверх. Держитесь там!', 8);
      w.msg('ДРУЗЬЯ СПАСЕНЫ', 'Пятеро едут к выходу. Ваш лифт — только вверх: на восьмой.', 5);
      w.completeLevel('office8');
    }
  },
  onTrigger(w, id, by) {
    if (id === 'siege7' && !w.flags.siegeStarted) {
      w.flags.siegeStarted = true;
      for (const n of w.npcs.filter(n => n.tag === 'gate_workers')) w.infect(n, n.props?.turn || 'normal', 'siege7');
      w.spawnWave('siege7', ['normal', 'fast', 'armored', 'spitter'], 16, .25, true, 'siege7', true);
      w.say('andrey', 'Мы за этой дверью! Они заполнили весь коридор!', 4);
      objective(w);
    }
    if (id === 'east') w.say('sergey', 'Андрей говорит, это просто очередная реорганизация. Андрей, у них клювы!', 4);
    if (id === 'pingpong') w.say('stas', 'Паша, партия до одиннадцати! Даже если конец света!', 4);
    if (id === 'root_ambush' && allFound(w) && !w.flags.rootStarted) {
      w.flags.rootStarted = true;
      w.flags.rootSupportAt = w.time + 8;
      const n = w.npc('root_manager')!;
      w.say(n.id, 'Эвакуация? Тикет согласован? Сейчас вы получите ROOT-ПЕТУШКА!', 4);
      w.infect(n, 'armored', 'root_attack');
      w.setAlarm(true);
      w.spawnWave('escort', ['fast', 'normal', 'armored', 'spitter'], 28, .25, true, 'root_attack', true);
      w.say(by.id, 'sudo увольнение. Без пароля.', 3);
      objective(w);
    }
  },
  onRescue(w, n, by) {
    if (!FRIENDS.includes(n.id)) return;
    n.mode = 'follow'; n.follow = by.id;
    const lines: Record<string, string> = { andrey: 'Я прикрою. Серёга, закрывай вкладки — уходим!', sergey: 'Я тут! Только ноутбук… Ладно, пятеро важнее ноутбука.', vlad: 'Я не пил! Я только понюхал. На банке адрес лаборатории −3.', stas: 'Счёт 10:10. Объявляем техническое спасение!', pasha: 'Ракетку забрал. Если что — отражаю яйца бэкхендом.' };
    w.say(n.id, lines[n.id], 4);
    objective(w);
  },
  onNpcUse(w, n) {
    if (n.id !== 'elena') return;
    if (!w.flags.siegeCleared) { w.say(n.id, 'Сначала разгоните петухов у Castor. Пропуска в клюв не выдаём!'); return true; }
    if (!w.flags.elenaStarted) {
      w.flags.elenaStarted = true;
      w.say(n.id, 'Вот ваш пропуск… минуточку… КО-КО-КОМПЛАЕНС!', 4);
      w.infect(n, 'spitter', 'admin7');
      w.spawnWave('escort', ['fast', 'normal', 'spitter'], 12, .3, true, 'admin7', true);
      objective(w);
    }
    return true;
  },
  onKill(w, e) {
    if (e.appearance?.npcId === 'elena' && !w.flags.elenaDead) {
      w.flags.elenaDead = true;
      w.addPickup('keycard', e.x, e.y, { key: 'f7_pass', ttl: -1 });
      w.say('radio', 'Елена оставила пропуск. Подбери его и открывай Castor — Андрей и Серёга ещё внутри!', 5);
      objective(w);
    }
    if (e.appearance?.npcId !== 'root_manager') return;
    w.flags.rootDead = true; w.setAlarm(false);
    w.addPickup('achievement', e.x, e.y, { key: 'root_rooster', ttl: -1 });
    w.msg('ROOT ДОСТУП ОТОЗВАН', 'Менеджер оставил «Рутового петушка». Подберите трофей.', 4);
    objective(w);
  },
  onPickup(w, k) { if (k.kind === 'achievement') { w.flags.rootAchievement = true; objective(w); } },
};
export default level;
