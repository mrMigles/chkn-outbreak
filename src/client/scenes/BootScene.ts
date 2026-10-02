import Phaser from 'phaser';
import { LEVELS } from '../../shared/levels';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload() {
    const bar = document.querySelector<HTMLDivElement>('.boot-bar i');
    this.load.on('progress', (v: number) => { if (bar) bar.style.width = Math.round(v * 100) + '%'; });
    this.load.image('tiles', 'assets/gen/tiles.png');
    this.load.image('walls', 'assets/gen/walls.png');
    this.load.atlas('chars', 'assets/gen/chars.png', 'assets/gen/chars.json');
    this.load.atlas('fx', 'assets/gen/fx.png', 'assets/gen/fx.json');
    this.load.atlas('props', 'assets/gen/props.png', 'assets/gen/props.json');
    for (const id of Object.keys(LEVELS)) this.load.tilemapTiledJSON('map_' + id, `assets/maps/${id}.tmj`);
  }

  create() {
    this.game.events.emit('booted');
  }
}
