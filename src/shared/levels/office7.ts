import type { LevelScript } from './types';
import type { World } from '../sim/World';
import { dist } from '../math';
export const FRIENDS = ['andrey', 'sergey', 'vlad', 'stas', 'pasha'];
const allFound = (w: World) => FRIENDS.every(id => w.npc(id)?.rescued);
function objective(w: World) {
  if (w.finished) return;
  const left = FRIENDS.filter(id => !w.npc(id)?.rescued);
  if (left.length) w.setObjective(`Найти друзей (${5 - left.length}/5) · кухня, Phoenix, Castor`, left);
  else if (!w.flags.rootStarted) w.setObjective('Все пятеро с нами. Провести их к лифтам', 'root_ambush');
  else if (!w.flags.rootDead || w.countTag('root_attack')) w.setObjective('Отбить нападение менеджера. Защитить друзей');
  else if (!w.flags.rootAchievement) {
    const drop = w.pickups.find(k => k.kind === 'achievement');
    w.setObjective('Подобрать «Рутового петушка»', drop ? { x: drop.x, y: drop.y } : 'evacuation');
  } else w.setObjective('Отвести всех пятерых к лифтам', 'evacuation');
}
const level: LevelScript = {
  id: 'office7', title: 'Этаж 7. Пятеро на одного петуха',
  subtitle: 'Capella · Castor · Phoenix. Эвакуация без записи в календаре', next: 'lab', enemyDamage: .8,
  onStart(w) {
    objective(w);
    w.flags.escortWaveAt = w.time + 24;
    w.say('radio', 'Серёга: Мы этажом выше! Андрей со мной у Castor, Влад на кухне, Стас и Паша в Phoenix. Забери нас!', 7);
    w.after(6, () => w.say('radio', 'Влад: На банке написано «проект ЯЙЦО, лаборатория −3». Они разослали опытную партию по офису!', 6));
  },
  onTick(w) {
    for (const n of w.npcs.filter(n => n.tag === 'worker7')) {
      if (!n.mutation && n.mode !== 'gone' && n.mode !== 'dead' && w.humanPlayers.some(p => dist(p.x, p.y, n.x, n.y) < 430)) {
        w.say(n.id, w.rng.pick(['Я на минуту отойду… ко-ко!', 'Daily превращается в poultry!', 'Перья — это наш новый дресс-код!']), 2.5);
        w.infect(n, n.props?.turn || 'normal', 'workers7');
      }
    }
    if (w.time >= w.flags.escortWaveAt && !w.flags.evacuated) {
      w.flags.escortWaveAt = w.time + (allFound(w) ? 15 : 24);
      w.spawnWave('escort', ['normal', 'normal', 'fast', 'spitter'], allFound(w) ? 7 : 4, .5, true, 'escort7', true);
    }
    const boss = w.enemies.find(e => e.appearance?.npcId === 'root_manager');
    if (boss && !w.flags.rootScaled) {
      w.flags.rootScaled = true; boss.hp = boss.maxHp = 850 * (1 + .3 * (w.players.length - 1)); boss.speedMul = 1.12;
      boss.appearance!.name = 'Рутовый петушок · sudo ко-ко';
    }
    if (Math.floor(w.time) !== Math.floor(w.time - 1 / 30)) objective(w);
    const lift = w.object('evacuation');
    if (lift && allFound(w) && w.flags.rootDead && w.flags.rootAchievement && !w.countTag('root_attack') &&
      w.humanPlayers.length && w.humanPlayers.every(p => p.x >= lift.x && p.x <= lift.x + lift.w && p.y >= lift.y && p.y <= lift.y + lift.h) &&
      FRIENDS.every(id => { const n = w.npc(id)!; return n.mode === 'follow' && dist(n.x, n.y, lift.cx, lift.cy) < 285; })) {
      w.flags.evacuated = true;
      for (const id of FRIENDS) w.npc(id)!.mode = 'gone';
      // Earlier office survivors evacuate too; nobody is dragged into the lab against the story.
      for (const n of w.npcs) if (n.mode === 'follow') n.mode = 'gone';
      w.say('radio', 'Андрей: Мы в лифте, едем к выходу. Омлетов ответил: заражение идёт из лаборатории −3, без антидота весь город станет курятником. Ты знаешь, что делать.', 8);
      w.msg('ДРУЗЬЯ СПАСЕНЫ', 'Пятеро едут к выходу. Вы — в лабораторию за антидотом.', 5);
      w.completeLevel('lab');
    }
  },
  onTrigger(w, id, by) {
    if (id === 'east') w.say('sergey', 'Андрей говорит, это просто очередная реорганизация. Андрей, у них клювы!', 4);
    if (id === 'pingpong') w.say('stas', 'Паша, партия до одиннадцати! Даже если конец света!', 4);
    if (id === 'root_ambush' && allFound(w) && !w.flags.rootStarted) {
      w.flags.rootStarted = true;
      const n = w.npc('root_manager')!;
      n.props!.essential = false;
      w.say(n.id, 'Эвакуация? Тикет согласован? Сейчас вы получите ROOT-ПЕТУШКА!', 4);
      w.infect(n, 'armored', 'root_attack');
      w.setAlarm(true);
      w.spawnWave('escort', ['fast', 'normal', 'armored', 'spitter'], 16, .4, true, 'root_attack', true);
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
  onKill(w, e) {
    if (e.appearance?.npcId !== 'root_manager') return;
    w.flags.rootDead = true; w.setAlarm(false);
    w.addPickup('achievement', e.x, e.y, { key: 'root_rooster', ttl: -1 });
    w.msg('ROOT ДОСТУП ОТОЗВАН', 'Менеджер оставил «Рутового петушка». Подберите трофей.', 4);
    objective(w);
  },
  onPickup(w, k) { if (k.kind === 'achievement') { w.flags.rootAchievement = true; objective(w); } },
};
export default level;
