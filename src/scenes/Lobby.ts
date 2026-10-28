import Phaser from 'phaser';
import { App, C, H, W, hexNum } from '../core/app';
import { audio } from '../core/audio';
import { fitImage } from '../core/art';
import { showBackdrop } from '../core/backdrop';
import { applyAccent, lobbyMusicName, playLobbyMusic } from '../core/lobby';
import { currentSeason, showNews, unseenNews } from '../core/news';
import { T, button, coinLabel, fadeIn, go, toast } from '../core/ui';

/** 로비: 직접 꾸미는 메인 화면 */
export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('Lobby');
  }

  create() {
    fadeIn(this);
    const st = App.store;
    const lb = st.save.extra.lobby;
    applyAccent(lb.accent);
    showBackdrop(this, lb.bgs, lb.interval);
    playLobbyMusic();

    // 읽기 좋게 오른쪽과 위에 그림자
    const g = this.add.graphics();
    g.fillGradientStyle(0x07060f, 0x07060f, 0x07060f, 0x07060f, 0, 0.75, 0, 0.75);
    g.fillRect(W - 220, 0, 220, H);
    g.fillStyle(0x07060f, 0.55);
    g.fillRect(0, 0, W, 26);
    g.fillStyle(C.accentN, 1);
    g.fillRect(0, 26, W, 1);

    T(this, 10, 6, '미니게임-인커젼', { bold: true, color: C.accent, stroke: true });
    const season = currentSeason();
    if (season) T(this, 132, 7, season.name, { size: 10, color: C.text, stroke: true });
    coinLabel(this, W - 10, 6);

    // 메뉴
    const explore = st.save.cleared['final'];
    const menu: [string, string, () => void, boolean?][] = [
      ['모험', '조각세계 지도', () => go(this, 'WorldMap')],
      ['차원 균열', '뽑기', () => go(this, 'Gacha')],
      ['도감', `${st.ownedChars().length}/${App.content.chars.length}`, () => go(this, 'Collection')],
      ['편성', '팀 · 패시브', () => go(this, 'Team', { back: { scene: 'Lobby' } })],
      ['도전', '번개·오늘·마라톤', () => go(this, 'Challenge'), !st.modeUnlocked('micro')],
      ['원정대', explore ? '탐사 · 파견' : '최종장 이후', () => go(this, 'Expedition'), !explore],
      ['가방', '아이템', () => go(this, 'Bag', { back: 'Lobby' })],
      ['꾸미기', '배경 · 음악', () => go(this, 'Decor')],
      ['소식', season ? season.name : '', () => showNews(this, true)],
      ['설정', '', () => go(this, 'Settings')],
    ];
    const bx = W - 132,
      bw = 122,
      bh = 29;
    menu.forEach(([label, sub, fn, locked], i) => {
      button(this, bx, 34 + i * (bh + 3), bw, bh, label, locked ? () => toast(this, label === '도전' ? '잿빛 왕관을 해방하면 열려요' : '최종장을 깨면 열려요') : fn, {
        sub,
        size: 10,
        color: i === 0 || i === 1 ? C.accent : undefined,
        disabled: false,
      });
    });
    if (st.save.totalPulls === 0) {
      const hint = T(this, bx - 8, 34 + bh + 3 + 8, '동료를 불러보자 ▶', { size: 10, align: 'right', color: C.accent, stroke: true });
      this.tweens.add({ targets: hint, x: hint.x - 4, yoyo: true, repeat: -1, duration: 350 });
    }

    // 지금 곡
    T(this, 10, H - 16, '♪ ' + lobbyMusicName(lb.bgm), { size: 10, color: C.dim, stroke: true });

    // 걸어다니는 캐릭터
    const walkers = (lb.walkers.length ? lb.walkers : st.teamIds()).filter((id) => st.owns(id)).slice(0, 3);
    walkers.forEach((id, i) => this.walker(id, 60 + i * 130));

    // 새 소식
    if (unseenNews()) this.time.delayedCall(500, () => showNews(this, false));
    void hexNum;
  }

  walker(id: string, x0: number) {
    const ch = App.content.char(id);
    const ground = H - 22;
    const img = this.add.image(x0, ground, 'spr_' + id).setOrigin(0.5, 1);
    fitImage(img, 44, 44);
    const base = img.scaleX;
    img.setInteractive({ useHandCursor: true });
    let target = x0;
    let pause = 1 + Math.random() * 2;
    let bubble: Phaser.GameObjects.Container | null = null;
    const ev = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const dt = 0.016;
        if (pause > 0) {
          pause -= dt;
          if (pause <= 0) target = 20 + Math.random() * (W - 260);
          img.y = ground;
          return;
        }
        const d = target - img.x;
        if (Math.abs(d) < 2) {
          pause = 1.5 + Math.random() * 3;
          return;
        }
        img.x += Math.sign(d) * 34 * dt;
        img.setFlipX(d < 0);
        img.y = ground - Math.abs(Math.sin(img.x / 6)) * 3;
        if (bubble) bubble.x = img.x;
      },
    });
    img.on('pointerup', () => {
      audio.sfx('text');
      img.setScale(base * 1.2, base * 0.8);
      this.tweens.add({ targets: img, scaleX: base, scaleY: base, duration: 200, ease: 'Back.Out' });
      bubble?.destroy();
      const text = ch.line || `${ch.title}!`;
      const t = T(this, 0, -60, text, { size: 10, align: 'center', color: '#1a0f22', wrap: 150 });
      const bw = Math.min(160, t.width + 14),
        bh2 = t.height + 8;
      const bg = this.add.graphics();
      bg.fillStyle(0xffffff, 0.95);
      bg.fillRect(-bw / 2, -64, bw, bh2);
      bg.fillTriangle(-4, -64 + bh2, 4, -64 + bh2, 0, -64 + bh2 + 5);
      t.setY(-60);
      bubble = this.add.container(img.x, ground - 4, [bg, t]).setDepth(10);
      const b = bubble;
      this.time.delayedCall(2500, () => {
        b.destroy();
        if (bubble === b) bubble = null;
      });
    });
    this.events.once('shutdown', () => ev.remove());
  }
}
