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
    if (season) {
      const sn = T(this, 132, 7, `${season.name}  [소식]`, { size: 10, color: C.text, stroke: true }).setInteractive({ useHandCursor: true });
      sn.on('pointerup', () => showNews(this, true));
    }
    const title = st.equippedTitle();
    if (title) T(this, W - 140, 7, `「${title.name}」`, { size: 10, align: 'right', color: C.gold, stroke: true });
    coinLabel(this, W - 10, 6);

    // 메뉴
    const explore = st.save.cleared['final'];
    const nTitle = st.claimableTitles().length;
    const nTicket = st.availableTickets().filter((t) => !st.save.extra.tickets.includes(t.id)).length;
    const rewardSub = nTicket ? `★5 선택권 ${nTicket}장!` : nTitle ? `받을 칭호 ${nTitle}개` : '출석 · 칭호';
    const rewardTab = nTicket ? 'tickets' : nTitle ? 'titles' : 'attend';
    const menu: [string, string, () => void, boolean?][] = [
      ['모험', '조각세계 지도', () => go(this, 'WorldMap')],
      ['차원 균열', '뽑기', () => go(this, 'Gacha')],
      ['도감', `${st.ownedChars().length}/${App.content.chars.length}`, () => go(this, 'Collection')],
      ['편성', '팀 · 패시브', () => go(this, 'Team', { back: { scene: 'Lobby' } })],
      ['도전', '번개·오늘·마라톤', () => go(this, 'Challenge'), !st.modeUnlocked('micro')],
      ['원정대', explore ? '탐사 · 파견' : '최종장 이후', () => go(this, 'Expedition'), !explore],
      ['보상', rewardSub, () => go(this, 'Rewards', { tab: rewardTab })],
      ['가방', '아이템', () => go(this, 'Bag', { back: 'Lobby' })],
      ['꾸미기', '배경 · 음악', () => go(this, 'Decor')],
      ['설정', '', () => go(this, 'Settings')],
    ];
    const bx = W - 132,
      bw = 122,
      bh = 29;
    menu.forEach(([label, sub, fn, locked], i) => {
      button(this, bx, 34 + i * (bh + 3), bw, bh, label, locked ? () => toast(this, label === '도전' ? '잿빛 왕관을 해방하면 열려요' : '최종장을 깨면 열려요') : fn, {
        sub,
        size: 10,
        color: i === 0 || i === 1 ? C.accent : label === '보상' && (nTitle || nTicket) ? C.gold : undefined,
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

    // 출석 → 새 소식
    st.checkAttendance().then((r) => {
      if (r) this.attendPopup(r);
      else if (unseenNews()) this.time.delayedCall(500, () => showNews(this, false));
    });
    void hexNum;
  }

  attendPopup(r: { day: number; coins: number; items: Record<string, number> }) {
    audio.sfx('coin');
    const ov = this.add.container(0, 0).setDepth(600);
    ov.add(this.add.rectangle(0, 0, W, H, 0x07060f, 0.75).setOrigin(0).setInteractive());
    const x = W / 2 - 150,
      y = H / 2 - 70;
    const g = this.add.graphics();
    g.fillStyle(0x07060f, 1);
    g.fillRect(x - 1, y - 1, 302, 142);
    g.fillStyle(C.panel, 1);
    g.fillRect(x, y, 300, 140);
    g.lineStyle(2, hexNum(C.gold), 1);
    g.strokeRect(x + 1, y + 1, 298, 138);
    ov.add(g);
    ov.add(T(this, W / 2, y + 12, '출석 보상', { size: 10, align: 'center', color: C.gold }));
    ov.add(T(this, W / 2, y + 28, `${r.day}일째`, { size: 24, align: 'center', color: '#ffffff' }));
    const parts = [r.coins ? `코인 ${r.coins.toLocaleString()}` : '', ...Object.entries(r.items).map(([k, n]) => `${App.content.item(k)?.name ?? k}${n > 1 ? ' ×' + n : ''}`)].filter(Boolean);
    ov.add(T(this, W / 2, y + 62, parts.join(' · '), { align: 'center', color: C.text }));
    const left = 28 - r.day;
    ov.add(T(this, W / 2, y + 82, left ? `28일 보상까지 ${left}일` : '이번 주기 개근!', { size: 10, align: 'center', color: C.dim }));
    const close = () => {
      ov.destroy();
      if (unseenNews()) this.time.delayedCall(200, () => showNews(this, false));
    };
    ov.add(button(this, W / 2 - 110, y + 104, 104, 26, '달력 보기', () => go(this, 'Rewards', { tab: 'attend' }), { size: 10 }));
    ov.add(button(this, W / 2 + 6, y + 104, 104, 26, '확인', close, { size: 10, color: C.gold }));
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
      if (ch.line) audio.voice(id, ch.line);
      else audio.sfx('text');
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
