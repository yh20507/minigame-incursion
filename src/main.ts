import './style.css';
import './ui/ui.css';
import Phaser from 'phaser';
import { W, H, App } from './core/app';
import { setDomNavigate } from './core/ui';
import { BootScene } from './scenes/Boot';
import { BlankScene } from './scenes/Blank';
import { PlayScene } from './scenes/Play';
import { ui } from './ui/app';
import { fx } from './ui/fx';
import { registerScreens } from './ui/screens';

async function start() {
  try {
    await Promise.all([
      document.fonts.load('12px Galmuri11'),
      document.fonts.load('12px Galmuri11Bold'),
      document.fonts.load('10px Galmuri9'),
      document.fonts.load('700 20px Pretendard'),
      document.fonts.load('700 20px Rajdhani'),
    ]);
  } catch {
    /* 글꼴이 늦게 와도 게임은 시작 */
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    transparent: true,
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { keyboard: true, mouse: true, touch: true },
    scene: [BootScene, BlankScene, PlayScene],
  });
  ui.init(game);
  fx.init();
  registerScreens();
  setDomNavigate((key, data) => {
    if (ui.has(key)) ui.show(key, data);
    else ui.toast(`${key} 화면은 준비 중이에요`);
  });
  (window as any).__game = game;
  (window as any).__app = App;
  (window as any).__ui = ui;
}

start();
