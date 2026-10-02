// «Как управлять» (D55): a drawn scheme of the touch layout, or the keyboard map on a PC.
// Shown once before the first fight, from the pause menu and from the main menu.
import { isTouch } from '../input/Input';

export function controlsMarkup(touch = isTouch()) {
  const pc = `<div class="keys">
      <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>бег</span></div>
      <div><kbd>мышь</kbd><span>прицел · голова = ×2 урона</span></div>
      <div><kbd>ЛКМ</kbd><span>огонь</span></div>
      <div><kbd>R</kbd><span>перезарядка</span></div>
      <div><kbd>E</kbd><span>действие · держать — лечить/поднять</span></div>
      <div><kbd>1–7</kbd><kbd>колесо</kbd><span>оружие</span></div>
      <div><kbd>Esc</kbd><span>пауза и настройки</span></div>
    </div>`;
  if (!touch) return `<div class="controls-help-box">${pc}</div>`;
  return `<div class="controls-help-box">
    <div class="ctl-scheme" aria-hidden="true">
      <div class="ctl-half left"><div class="ctl-stick"><i></i></div><b>БЕГ</b><span>коснитесь в любом месте слева и тяните</span></div>
      <div class="ctl-half right"><div class="ctl-stick aim"><i></i></div><b>ПРИЦЕЛ</b><span>тяните справа — огонь сам, когда враг на линии</span></div>
      <div class="ctl-pause">❚❚</div>
      <div class="ctl-dock"><div class="ctl-act">действие</div><div class="ctl-round">⟳</div><div class="ctl-weapon">⇄ оружие</div></div>
    </div>
    <ul class="ctl-list">
      <li><b>❚❚</b> пауза, настройки и эта подсказка</li>
      <li><b>⇄</b> нажмите на панель оружия — сменить ствол</li>
      <li><b>⟳</b> перезарядка (пустой магазин заряжается сам)</li>
      <li><b class="o">действие</b> появляется у людей, дверей и пультов. Удерживайте — лечиться или поднять друга</li>
    </ul>
    <p class="preference-help">Играть можно и вертикально, и горизонтально.</p>
  </div>`;
}
