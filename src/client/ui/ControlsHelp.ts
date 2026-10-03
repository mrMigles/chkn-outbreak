// «Как управлять» (D55): a drawn scheme of the touch layout, or the keyboard map on a PC.
// Shown once before the first fight, from the pause menu and from the main menu.
import { isTouch } from '../input/Input';
import { settings } from '../settings';

/** D72 (issue #5): the left-handed layout swaps the halves — aim/fire on the left, running on the right. */
function halves(lefty: boolean) {
  const run = (side: string) => `<div class="ctl-half ${side === 'left' ? 'left' : 'right'}"><div class="ctl-stick"><i></i></div><b>БЕГ</b><span>коснитесь в любом месте ${side === 'left' ? 'слева' : 'справа'} и тяните</span></div>`;
  const aim = (side: string) => `<div class="ctl-half ${side === 'left' ? 'left' : 'right'}"><div class="ctl-stick aim"><i></i></div><b>ПРИЦЕЛ</b><span>тяните ${side === 'left' ? 'слева' : 'справа'} — внутри круга целитесь, до края — стреляете</span></div>`;
  return lefty ? aim('left') + run('right') : run('left') + aim('right');
}

export function controlsMarkup(touch = isTouch()) {
  const pc = `<div class="keys">
      <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>бег</span></div>
      <div><kbd>мышь</kbd><span>прицел · голова = ×2 урона</span></div>
      <div><kbd>ЛКМ</kbd><span>огонь</span></div>
      <div><kbd>R</kbd><span>перезарядка</span></div>
      <div><kbd>E</kbd><span>действие · держать — лечить/поднять</span></div>
      <div><kbd>1–9</kbd><kbd>колесо</kbd><kbd>Q</kbd><span>оружие</span></div>
      <div><kbd>Esc</kbd><span>пауза и настройки</span></div>
    </div>`;
  if (!touch) return `<div class="controls-help-box">${pc}</div>`;
  return `<div class="controls-help-box">
    <div class="ctl-scheme" aria-hidden="true">
      ${halves(settings.leftHanded)}
      <div class="ctl-pause">❚❚</div>
      <div class="ctl-dock"><div class="ctl-act">действие</div><div class="ctl-round">⟳</div><div class="ctl-weapon">⇄ оружие</div></div>
    </div>
    <ul class="ctl-list">
      <li><b>❚❚</b> пауза, настройки и эта подсказка</li>
      <li><b>⇄</b> нажмите на панель оружия — следующий ствол; удерживайте — выбрать из списка</li>
      <li><b>⟳</b> перезарядка (пустой магазин заряжается сам)</li>
      <li><b class="o">действие</b> появляется у людей, дверей и пультов. Удерживайте — лечиться или поднять друга</li>
    </ul>
    <p class="preference-help">Играть можно и вертикально, и горизонтально.</p>
  </div>`;
}
