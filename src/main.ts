import './style.css';
import Phaser from 'phaser';
import { W, H, App } from './core/app';
import { BootScene } from './scenes/Boot';
import { TitleScene } from './scenes/Title';
import { StoryScene } from './scenes/Story';
import { WorldMapScene } from './scenes/WorldMap';
import { DomainScene } from './scenes/Domain';
import { PrepScene } from './scenes/Prep';
import { PlayScene } from './scenes/Play';
import { ResultScene } from './scenes/Result';
import { GachaScene } from './scenes/Gacha';
import { CollectionScene } from './scenes/Collection';
import { TeamScene } from './scenes/Team';
import { ChallengeScene } from './scenes/Challenge';
import { SettingsScene } from './scenes/Settings';
import { BagScene } from './scenes/Bag';
import { LobbyScene } from './scenes/Lobby';
import { DecorScene } from './scenes/Decor';
import { ExpeditionScene } from './scenes/Expedition';

async function start() {
  try {
    await Promise.all([
      document.fonts.load('12px Galmuri11'),
      document.fonts.load('12px Galmuri11Bold'),
      document.fonts.load('10px Galmuri9'),
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
    scene: [
      BootScene,
      TitleScene,
      StoryScene,
      WorldMapScene,
      DomainScene,
      PrepScene,
      PlayScene,
      ResultScene,
      GachaScene,
      CollectionScene,
      TeamScene,
      ChallengeScene,
      SettingsScene,
      BagScene,
      LobbyScene,
      DecorScene,
      ExpeditionScene,
    ],
  });
  (window as any).__game = game;
  (window as any).__app = App;
}

start();
