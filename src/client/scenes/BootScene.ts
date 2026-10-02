import Phaser from 'phaser';
import { LEVELS } from '../../shared/levels';
import { loadLayerAtlas } from '../render/Looks';
import { music } from '../audio/Music';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload() {
    this.load.atlas('office25', 'assets/gen/office25.png', 'assets/gen/office25.json');
    const bar = document.querySelector<HTMLDivElement>('.boot-bar i');
    this.load.on('progress', (v: number) => { if (bar) bar.style.width = Math.round(v * 100) + '%'; });
    this.load.image('tiles25', 'assets/gen/tiles25.png');
    this.load.image('walls', 'assets/gen/walls.png');
    this.load.atlas('chars', 'assets/gen/chars.png', 'assets/gen/chars.json');
    this.load.atlas('fx', 'assets/gen/fx.png', 'assets/gen/fx.json');
    this.load.atlas('props', 'assets/gen/props.png', 'assets/gen/props.json');
    for (const id of Object.keys(LEVELS)) this.load.tilemapTiledJSON('map_' + id, `assets/maps/${id}.tmj`);
  }

  create() {
    // character layers are composited on canvases; wait for them before the menu (editor portraits)
    loadLayerAtlas().then(() => this.game.events.emit('booted'), (e) => { console.error('LPC layers failed', e); this.game.events.emit('booted'); });
    music.init();
  }
}
