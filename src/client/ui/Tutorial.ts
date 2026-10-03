// Contextual tutorial cards: shown once per player (remembered in settings), one at a time, never blocking combat.
import { settings, saveSettings } from '../settings';

interface Tip { title: string; text: string; touch?: string }

export const TIPS: Record<string, Tip> = {
  move: { title: 'Управление', text: '<b>WASD</b> — бег · <b>мышь</b> — прицел · <b>ЛКМ</b> — огонь', touch: 'Левый стик — бег · правый стик — прицел, до края круга — огонь' },
  objective: { title: 'Задача', text: 'Текущая цель всегда вверху экрана. Следуйте ей — она меняется по ходу сюжета.' },
  enemy: { title: 'Коллеги-мутанты', text: 'Пули попадают туда, где нарисован враг. <b>В голову — двойной урон.</b> Держите дистанцию: они бьют вблизи.' },
  mutation: { title: 'Заражение', text: 'Люди превращаются в кур-людей. Перед мутацией они дёргаются и роняют перья — даже спасённые спутники.' },
  reload: { title: 'Перезарядка', text: '<b>R</b> — перезарядить. Пистолет бесконечен, остальное оружие тратит запас.', touch: 'Кнопка <b>⟳</b> — перезарядить. Пустой магазин перезаряжается сам.' },
  weapon: { title: 'Новое оружие', text: '<b>1–9</b>, <b>Q</b> или <b>колесо мыши</b> — сменить оружие.', touch: 'Нажмите на <b>панель оружия</b> справа внизу — следующий ствол; удерживайте — выбрать из списка.' },
  npc: { title: 'Выжившие', text: '<b>E</b> рядом с человеком — поговорить или позвать за собой. Вооружённые спутники стреляют сами.', touch: 'Оранжевая кнопка рядом с человеком — позвать за собой.' },
  pickup: { title: 'Припасы', text: 'Аптечки, патроны и броня подбираются, если просто пройти по ним.' },
  medkit: { title: 'Аптечка', text: '<b>Удерживайте E</b> без друга рядом — лечение собственной аптечкой (+40).', touch: 'Удерживайте кнопку действия — лечение аптечкой.' },
  locked: { title: 'Заперто', text: 'Красная лампа — дверь заперта. Нужен пропуск или действие по сюжету.' },
  fat: { title: 'Менеджер среднего звена', text: 'Толстый и медленный, но держит много урона. Дробовик и автомат — лучший ответ.' },
  spitter: { title: 'Бухгалтер-плевун', text: 'Плюётся кислотой издалека. Уходите с линии плевка и сближайтесь.' },
  armored: { title: 'Охранник в броне', text: 'Броня гасит больше половины урона от пуль. Взрывы и огонь пробивают её лучше.' },
  exploder: { title: 'Химик', text: 'Мигает зелёным и взрывается рядом. Убейте издалека — взрыв ранит и кур вокруг.' },
  chick: { title: 'Цыплята', text: 'Быстрые и слабые. Не дайте стае окружить вас.' },
  barrel: { title: 'Опасные бочки', text: 'Красные бочки взрываются от выстрела. Заманите к ним толпу.' },
  dark: { title: 'Темнота', text: 'Фонарик светит туда, куда вы целитесь. Куры в темноте видны хуже — слушайте их.' },
  bonus: { title: '★ Бонус этажа', text: 'Необязательная задача под целью. Выполните — команда получит +300 KPI, аптечку, патроны и ачивку. Провал ничего не стоит.' },
    downed: { title: 'Друг ранен', text: '<b>Удерживайте E</b> рядом с лежащим другом 2,6 с, чтобы поднять его. Коротко E — передать магазин.', touch: 'Удерживайте кнопку действия рядом с раненым другом.' },
};

export class Tutorial {
  private queue: string[] = [];
  private el: HTMLDivElement | null = null;
  private t = 0;
  private gap = 1.5;
  private cur = '';

  constructor(private touch: boolean) {}

  /** Queue a tip unless the player has already seen it (or tips are off). */
  show(id: keyof typeof TIPS) {
    if (!settings.tutorials || settings.seenTips.includes(id) || this.queue.includes(id)) return;
    settings.seenTips.push(id);
    saveSettings();
    this.queue.push(id);
  }

  update(dt: number) {
    // nothing over pause/result panels
    if (document.querySelector('.overlay.screen, .pause-menu:not(.hidden)')) { if (this.el) this.close(); return; }
    // D64: the phone feed is small: a tip waits for the current alert and radio message
    const crowded = this.touch && !!document.querySelector('.hud-notice.show, .hud-radio.show');
    if (this.el && crowded && this.cur) { this.queue.unshift(this.cur); this.close(); return; }
    if (this.el) {
      this.t -= dt;
      if (this.t <= 0) this.close();
      return;
    }
    this.gap -= dt;
    if (this.gap > 0 || !this.queue.length) return;
    // D57: on a phone in portrait one popup at a time — a tip waits for the current alert to go
    if (crowded) return;
    this.cur = this.queue.shift()!;
    const tip = TIPS[this.cur];
    const d = document.createElement('div');
    d.className = 'tip-card';
    d.innerHTML = `<small>ПОДСКАЗКА</small><b>${tip.title}</b><p>${this.touch && tip.touch ? tip.touch : tip.text}</p><i>✕</i>`;
    d.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.close(); });
    (document.querySelector('.hud .tip-slot') ?? document.getElementById('ui'))?.appendChild(d);
    requestAnimationFrame(() => d.classList.add('in'));
    this.el = d;
    this.t = 7.5;
  }

  private close() {
    const d = this.el;
    if (!d) return;
    this.el = null;
    this.gap = 1.2;
    d.classList.remove('in');
    setTimeout(() => d.remove(), 300);
  }

  destroy() { this.el?.remove(); this.el = null; this.queue = []; }
}

/** Reset helper for the settings screen. */
export function resetTips() { settings.seenTips = []; saveSettings(); }
