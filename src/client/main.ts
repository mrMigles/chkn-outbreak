import Phaser from 'phaser';
import './styles.css';
import { BootScene } from './scenes/BootScene';
import { GameScene, GameSceneData } from './scenes/GameScene';
import { App } from './ui/App';
import { settings } from './settings';

document.documentElement.style.setProperty('--hud-scale', String(settings.hudScale || 1));

const DPR = Math.min(2, window.devicePixelRatio || 1);

const game = new Phaser.Game({
  type: Phaser.AUTO,   // WebGL, falls back to Canvas when WebGL is unavailable
  parent: 'game',
  backgroundColor: '#17191d',
  scale: {
    mode: Phaser.Scale.NONE,
    width: Math.round(window.innerWidth * DPR),
    height: Math.round(window.innerHeight * DPR),
    zoom: 1 / DPR,
  },
  render: { antialias: false, pixelArt: true },
  input: { activePointers: 4 },
  // ?loop=timeout keeps the game ticking in hidden tabs (automated testing)
  // D67: 120 Hz phones would draw every frame twice for nothing — the game is capped at 60
  fps: { target: 60, limit: location.search.includes('loop=timeout') ? 0 : 60, forceSetTimeOut: location.search.includes('loop=timeout') },
  scene: [BootScene, GameScene],
  disableContextMenu: true,
});
(game as any).dprScale = DPR;

window.addEventListener('resize', () => {
  game.scale.resize(Math.round(window.innerWidth * DPR), Math.round(window.innerHeight * DPR));
  game.scale.setZoom(1 / DPR);
});

const app = new App(game);
game.events.once('booted', () => app.ready());

export type { GameSceneData };
// debug handle
(window as any).__game = game;
(window as any).__app = app;

// Phaser games can't be hot-swapped: always do a full page reload on code changes.
if (import.meta.hot) import.meta.hot.on('vite:beforeUpdate', () => location.reload());
