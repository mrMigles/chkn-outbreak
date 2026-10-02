import type { LevelScript } from './types';
import type { EnemyType } from '../enemies';

/** Endless combat sandbox for tuning shooting feel. */
const arena: LevelScript = {
  id: 'arena',
  title: 'Полигон',
  subtitle: 'Отдел тестирования оружия',
  onStart(w) {
    w.setObjective('Полигон: подбери всё оружие и держись');
    let wave = 0;
    const groups = ['w', 'e', 'n', 's'];
    w.every(7, () => {
      if (w.enemies.length > 140) return;
      wave++;
      const pool: EnemyType[] = ['normal', 'normal', 'normal', 'fast'];
      if (wave > 1) pool.push('spitter');
      if (wave > 2) pool.push('fat', 'exploder');
      if (wave > 3) pool.push('armored', 'fast', 'fast');
      const n = Math.min(10 + wave * 4, 45);
      for (const g of groups) w.spawnWave(g, pool, Math.ceil(n / 4), 0.25);
      if (wave % 3 === 0) w.msg('Волна ' + wave, 'Отдел кадров прислал подкрепление', 2);
    });
  },
};
export default arena;
