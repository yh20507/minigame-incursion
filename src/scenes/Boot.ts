import Phaser from 'phaser';
import { App, C, H, W } from '../core/app';
import { Content } from '../core/content';
import { makeBgTextures, makeCharTextures, makeIconTextures, makeItemTextures } from '../core/art';
import { LocalBackend, SupabaseBackend, loadOnlineConfig } from '../core/backend';
import { Store } from '../core/store';
import { T } from '../core/ui';
import { audio } from '../core/audio';

const DATA = ['domains', 'minigames', 'characters', 'gacha', 'banners', 'synergies', 'challenges', 'story', 'worlds', 'items', 'updates', 'frontier'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const bar = this.add.rectangle(W / 2 - 100, H / 2 + 20, 0, 4, C.accentN).setOrigin(0, 0.5);
    this.add.rectangle(W / 2, H / 2 + 20, 202, 6).setStrokeStyle(1, C.lineHi);
    T(this, W / 2, H / 2 - 4, '불러오는 중...', { align: 'center', color: C.dim });
    this.load.on('progress', (p: number) => (bar.width = 200 * p));
    for (const k of DATA) this.load.json(k, `data/${k}.json`);
  }

  create() {
    App.content = Content.fromCache(this.cache.json);
    // 사용자 그림. 없는 파일은 조용히 넘어가고 임시 그림으로 채운다.
    this.load.on('loaderror', () => {});
    for (const ch of App.content.chars) {
      this.load.image('spr_' + ch.id, `assets/chars/${ch.id}_sprite.png`);
      this.load.image('art_' + ch.id, `assets/chars/${ch.id}_art.png`);
      if (ch.rarity >= 4) this.load.image('full_' + ch.id, `assets/chars/${ch.id}_full.png`);
    }
    for (const id of [...App.content.domains.map((d) => d.id), 'rift', ...App.content.worlds.map((w) => w.id)]) this.load.image('bg_' + id, `assets/bg/${id}.png`);
    for (const it of App.content.items) this.load.image('it_' + it.id, `assets/items/${it.id}.png`);
    this.load.image('logo', 'assets/ui/logo.png');
    this.load.once('complete', () => this.finish());
    this.load.start();
  }

  async finish() {
    makeIconTextures(this);
    makeCharTextures(this, App.content);
    makeBgTextures(this, App.content);
    makeItemTextures(this, App.content);

    await audio.scan(
      [
        ...App.content.domains.map((d) => d.id),
        ...App.content.worlds.map((w) => w.id),
        ...App.content.banners.map((b) => 'gacha_' + b.id),
        ...App.content.worlds.map((w) => 'gacha_' + w.id),
      ],
      App.content.chars.map((c) => c.id),
      App.content.worlds.map((w) => w.id),
    );
    const cfg = await loadOnlineConfig();
    if (cfg) {
      const be = new SupabaseBackend(cfg);
      App.backend = be;
      App.online = true;
      App.store = new Store(App.content, be);
      // 로그인은 타이틀 화면에서
    } else {
      App.backend = new LocalBackend();
      App.store = new Store(App.content, App.backend);
      await App.store.init();
    }
    this.scene.start('Title');
  }
}
