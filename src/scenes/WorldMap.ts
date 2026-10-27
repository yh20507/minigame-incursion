import Phaser from 'phaser';
import { App, C, H, W, hexNum } from '../core/app';
import { audio } from '../core/audio';
import { fitImage } from '../core/art';
import type { DomainDef } from '../core/types';
import { T, bg, button, fadeIn, go, toast, topBar } from '../core/ui';

export class WorldMapScene extends Phaser.Scene {
  constructor() {
    super('WorldMap');
  }

  create() {
    fadeIn(this);
    audio.bgm('map', 50, 'dorian', 92);
    bg(this, 'rift', 0.2);
    const st = App.store;
    topBar(this, '조각세계');
    T(this, W - 120, 6, `★ ${st.totalStars()}`, { color: C.gold, align: 'right' });

    const doms = App.content.domains;
    const center = { x: 330, y: 238 };

    // 꿰맨 실
    const g = this.add.graphics();
    const stitch = (a: { x: number; y: number }, b: { x: number; y: number }, on: boolean) => {
      const len = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const n = Math.floor(len / 10);
      for (let i = 0; i < n; i += 2) {
        const t0 = i / n,
          t1 = (i + 1) / n;
        g.lineStyle(2, on ? 0xff5fd2 : 0x3a3270, on ? 0.9 : 0.6);
        g.lineBetween(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
      }
    };
    for (let i = 0; i < doms.length - 1; i++) {
      const a = doms[i],
        b = doms[i + 1];
      stitch({ x: a.mapPos[0], y: a.mapPos[1] }, { x: b.mapPos[0], y: b.mapPos[1] }, st.isDomainUnlocked(b));
    }
    for (const d of doms) stitch({ x: d.mapPos[0], y: d.mapPos[1] }, center, st.finalUnlocked());

    doms.forEach((d, i) => this.island(d, i));
    this.centerNode(center.x, center.y);

    // 대표 캐릭터
    const last = [...doms].reverse().find((d) => st.isDomainUnlocked(d)) ?? doms[0];
    const leader = this.add.image(last.mapPos[0] - 58, last.mapPos[1] - 26, 'spr_' + st.save.team.leader);
    fitImage(leader, 40, 40);
    this.tweens.add({ targets: leader, y: leader.y - 4, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.InOut' });

    // 하단 메뉴
    const menu: [string, string, () => void, boolean?][] = [
      ['차원 균열', '뽑기', () => go(this, 'Gacha'), false],
      ['도감', `${st.ownedChars().length}/${App.content.chars.length}`, () => go(this, 'Collection')],
      ['편성', '팀 · 패시브', () => go(this, 'Team')],
      ['도전', '번개 · 오늘 · 마라톤', () => go(this, 'Challenge'), !st.modeUnlocked('micro')],
      ['설정', '', () => go(this, 'Settings')],
    ];
    const bw = 118,
      gap = 8,
      x0 = (W - (bw * menu.length + gap * (menu.length - 1))) / 2;
    menu.forEach(([label, sub, fn, locked], i) => {
      button(this, x0 + i * (bw + gap), H - 40, bw, 32, label, locked ? () => toast(this, '잿빛 왕관을 해방하면 열려요') : fn, {
        sub,
        color: i === 0 ? C.accent : undefined,
      });
    });

    if (st.save.totalPulls === 0) {
      const hint = T(this, x0 + bw / 2, H - 58, '▼ 동료를 불러보자', { size: 10, align: 'center', color: C.accent, stroke: true });
      this.tweens.add({ targets: hint, y: hint.y - 3, yoyo: true, repeat: -1, duration: 350 });
    }
  }

  private island(d: DomainDef, i: number) {
    const st = App.store;
    const [x, y] = d.mapPos;
    const open = st.isDomainUnlocked(d);
    const cleared = !!st.save.cleared[d.id];
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const col = hexNum(d.color);
    const pts = [
      [-62, -6],
      [-50, -22],
      [-20, -30],
      [12, -28],
      [46, -24],
      [64, -8],
      [56, 4],
      [30, 8],
      [-30, 8],
      [-58, 4],
    ];
    const under = [
      [-50, 6],
      [-30, 26],
      [-8, 44],
      [10, 30],
      [32, 22],
      [52, 6],
    ];
    g.fillStyle(open ? hexNum(d.dark) : 0x15122a, 1);
    g.fillPoints([...under.map(([a, b]) => new Phaser.Math.Vector2(a, b)), new Phaser.Math.Vector2(-58, 4)], true);
    g.fillStyle(open ? col : 0x2c2845, 1);
    g.fillPoints(
      pts.map(([a, b]) => new Phaser.Math.Vector2(a, b)),
      true,
    );
    g.lineStyle(1, 0x07060f, 1);
    g.strokePoints(
      pts.map(([a, b]) => new Phaser.Math.Vector2(a, b)),
      true,
    );
    // 미니 풍경
    if (open) {
      g.fillStyle(Phaser.Display.Color.ValueToColor(col).darken(40).color, 1);
      if (d.id === 'ashen') {
        g.fillRect(-30, -44, 14, 20);
        g.fillRect(-14, -36, 30, 12);
        g.fillRect(18, -50, 12, 26);
        g.fillRect(16, -54, 4, 4);
        g.fillRect(26, -54, 4, 4);
      } else if (d.id === 'neon') {
        [-36, -20, -4, 14, 30].forEach((bx, k) => g.fillRect(bx, -30 - (k % 3) * 14 - 10, 12, (k % 3) * 14 + 10));
        g.fillStyle(0x5fd3e0, 1);
        g.fillRect(-2, -40, 4, 4);
        g.fillRect(16, -46, 4, 4);
      } else {
        g.fillRect(-10, -50, 20, 26);
        g.fillStyle(0x5fd3e0, 1);
        g.fillRect(-4, -44, 8, 4);
        g.lineStyle(2, Phaser.Display.Color.ValueToColor(col).darken(40).color, 1);
        g.strokeEllipse(0, -38, 70, 16);
      }
    }
    c.add(g);
    this.tweens.add({ targets: c, y: y - 3, yoyo: true, repeat: -1, duration: 1400 + i * 300, ease: 'Sine.InOut' });

    const name = T(this, 0, 14, open ? d.name : '???', { align: 'center', bold: true, color: open ? d.color : C.faint, stroke: true });
    c.add(name);
    if (open) {
      const stars = st.domainStars(d.id);
      const max = d.games.length * 3;
      c.add(T(this, 0, 30, `★ ${stars}/${max}${cleared ? '  · 해방됨' : st.bossUnlocked(d.id) ? '  · 보스 도전 가능' : ''}`, {
        size: 10,
        align: 'center',
        color: cleared ? C.good : st.bossUnlocked(d.id) ? C.accent : C.dim,
        stroke: true,
      }));
    } else {
      c.add(this.add.image(0, -14, 'ic_lock').setScale(3));
      const prev = d.unlockAfter ? App.content.domainName(d.unlockAfter) : '';
      c.add(T(this, 0, 30, `${prev} 해방 후 열림`, { size: 10, align: 'center', color: C.faint, stroke: true }));
    }

    const zone = this.add.zone(-64, -56, 128, 100).setOrigin(0).setInteractive({ useHandCursor: open });
    c.add(zone);
    zone.on('pointerover', () => open && name.setColor('#ffffff'));
    zone.on('pointerout', () => name.setColor(open ? d.color : C.faint));
    zone.on('pointerup', () => {
      if (!open) {
        audio.sfx('cancel');
        toast(this, '아직 열리지 않은 영역이에요');
        return;
      }
      audio.sfx('confirm');
      const arrive = d.id + '_arrive';
      if (!st.save.story[arrive]) go(this, 'Story', { id: arrive, next: 'Domain', nextData: { id: d.id } });
      else go(this, 'Domain', { id: d.id });
    });
  }

  private centerNode(x: number, y: number) {
    const st = App.store;
    const open = st.finalUnlocked();
    const done = !!st.save.cleared['final'];
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(open ? 0x2c1650 : 0x15122a, 1);
    g.fillCircle(0, 0, 18);
    g.lineStyle(2, open ? 0xff5fd2 : 0x3a3270, 1);
    g.strokeCircle(0, 0, 18);
    c.add(g);
    if (open) {
      const core = this.add.rectangle(0, 0, 10, 10, 0xff5fd2).setAngle(45);
      c.add(core);
      this.tweens.add({ targets: core, angle: 405, duration: 3000, repeat: -1 });
    } else {
      c.add(this.add.image(0, 0, 'ic_lock').setScale(2));
    }
    c.add(T(this, 0, 22, open ? (done ? '중심부 · 놀이터' : '조각세계의 중심') : '???', { size: 10, align: 'center', color: open ? C.accent : C.faint, stroke: true }));
    const z = this.add.zone(-24, -24, 48, 56).setOrigin(0).setInteractive({ useHandCursor: open });
    c.add(z);
    z.on('pointerup', () => {
      if (!open) {
        audio.sfx('cancel');
        toast(this, '세 영역을 모두 해방하면 열려요');
        return;
      }
      audio.sfx('confirm');
      const playData = { mode: 'final', domain: 'rift' };
      if (!st.save.story['final_boss']) go(this, 'Story', { id: 'final_boss', next: 'Play', nextData: playData });
      else go(this, 'Play', playData);
    });
  }
}
