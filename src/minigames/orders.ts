import Phaser from 'phaser';
import { MiniGame } from './base';

const ING = [
  { name: '별빵', color: 0xd9a066, key: '←' },
  { name: '성운젤리', color: 0xb06cff, key: '↑' },
  { name: '운석구이', color: 0xff8a3d, key: '→' },
  { name: '우주채소', color: 0x4be37a, key: '↓' },
];

interface Seat {
  x: number;
  order: number[] | null;
  patience: number;
  max: number;
  wait: number;
  c: Phaser.GameObjects.Container | null;
  bar: Phaser.GameObjects.Graphics;
}

function drawIng(g: Phaser.GameObjects.Graphics, k: number, x: number, y: number, s = 1) {
  const c = ING[k].color;
  g.fillStyle(0x0d0a16);
  g.fillRect(x - 9 * s, y - 7 * s, 18 * s, 14 * s);
  g.fillStyle(c);
  if (k === 0) g.fillRect(x - 8 * s, y - 6 * s, 16 * s, 12 * s);
  else if (k === 1) {
    g.fillRect(x - 6 * s, y - 6 * s, 12 * s, 12 * s);
    g.fillStyle(0xffffff, 0.6);
    g.fillRect(x - 4 * s, y - 4 * s, 3 * s, 3 * s);
  } else if (k === 2) {
    g.fillCircle(x, y, 7 * s);
    g.fillStyle(0x5a3f33);
    g.fillRect(x - 2 * s, y - 2 * s, 4 * s, 4 * s);
  } else {
    g.fillTriangle(x - 8 * s, y + 6 * s, x + 8 * s, y + 6 * s, x, y - 8 * s);
  }
}

/** 우주 식당: 주문대로 재료를 올려 서빙 */
export class OrdersGame extends MiniGame {
  seats: Seat[] = [];
  plate: number[] = [];
  plateG!: Phaser.GameObjects.Graphics;
  served = 0;

  create() {
    const g = this.gfx();
    g.fillStyle(0x2b3a66);
    g.fillRect(40, 150, 560, 16);
    g.fillStyle(0x1b2450);
    g.fillRect(40, 166, 560, 30);
    // 주방대
    g.fillStyle(0x141c38);
    g.fillRect(150, 230, 340, 100);
    g.lineStyle(1, 0x5fd3e0, 0.6);
    g.strokeRect(150, 230, 340, 100);
    this.player(110, 330, 44);
    const xs = this.h.micro ? [320] : [160, 320, 480];
    xs.forEach((x, k) => {
      const bar = this.gfx();
      this.seats.push({ x, order: null, patience: 0, max: 1, wait: this.h.micro ? 0 : 0.3 + k * 1.4, c: null, bar });
    });
    // 재료 버튼
    ING.forEach((ing, k) => {
      const bx = 196 + k * 82,
        by = 300;
      const bg = this.gfx();
      bg.fillStyle(0x07060f);
      bg.fillRect(bx - 34, by - 18, 68, 30);
      bg.lineStyle(1, ing.color);
      bg.strokeRect(bx - 34, by - 18, 68, 30);
      drawIng(bg, k, bx - 18, by - 3);
      this.text(bx + 10, by - 9, ing.key, 12, '#ffffff');
      this.text(bx + 10, by + 4, ing.name, 10, '#a69fd0');
      const z = this.add(this.s.add.zone(bx - 34, by - 18, 68, 30).setOrigin(0).setInteractive());
      z.on('pointerdown', () => this.addIng(k));
    });
    this.text(160, 236, '스페이스: 서빙 · X: 비우기', 10, '#6d669a', [0, 0]);
    this.plateG = this.gfx();
    const serveZ = this.add(this.s.add.zone(250, 238, 140, 40).setOrigin(0).setInteractive());
    serveZ.on('pointerdown', () => this.serve());
  }

  addIng(k: number) {
    if (this.plate.length >= 4) return;
    this.plate.push(k);
    this.h.sfx('select');
  }

  newCustomer(seat: Seat) {
    const maxItems = this.h.micro ? 1 : Math.min(4, 1 + Math.floor(this.h.t / 12) + (this.h.difficulty - 1));
    const n = 1 + Math.floor(this.h.rng() * maxItems);
    seat.order = [...Array(n)].map(() => Math.floor(this.h.rng() * 4)).sort();
    seat.max = Math.max(6, 13 - this.h.t * 0.08 - (this.h.difficulty - 1) * 2) + n * 1.5;
    if (this.h.micro) seat.max = 5;
    seat.patience = seat.max;
    const c = this.s.add.container(seat.x, 150);
    const body = this.s.add.graphics();
    const hue = this.h.rng();
    const col = Phaser.Display.Color.HSVToRGB(hue, 0.5, 0.9).color as number;
    body.fillStyle(0x0d0a16);
    body.fillRect(-15, -37, 30, 37);
    body.fillStyle(col);
    body.fillRect(-14, -36, 28, 36);
    body.fillStyle(0xffffff);
    body.fillRect(-8, -28, 6, 6);
    body.fillRect(2, -28, 6, 6);
    body.fillStyle(0x0d0a16);
    body.fillRect(-6, -26, 3, 3);
    body.fillRect(4, -26, 3, 3);
    body.fillStyle(col);
    body.fillRect(-12, -44, 4, 8);
    body.fillRect(8, -44, 4, 8);
    // 말풍선
    const w = seat.order.length * 22 + 10;
    body.fillStyle(0x0d0a16);
    body.fillRect(-w / 2 - 1, -83, w + 2, 30);
    body.fillStyle(0xf2e6cf);
    body.fillRect(-w / 2, -82, w, 28);
    body.fillTriangle(-4, -54, 4, -54, 0, -48);
    seat.order.forEach((k, j) => drawIng(body, k, -w / 2 + 16 + j * 22, -68));
    c.add(body);
    c.setScale(0);
    this.add(c);
    this.s.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.Out' });
    seat.c = c;
  }

  leave(seat: Seat, happy: boolean) {
    const c = seat.c!;
    this.s.tweens.add({ targets: c, y: happy ? 120 : 170, alpha: 0, duration: 250, onComplete: () => c.destroy() });
    seat.c = null;
    seat.order = null;
    seat.wait = this.h.micro ? 99 : this.rnd(0.6, 1.6);
    seat.bar.clear();
  }

  serve() {
    if (!this.plate.length) return;
    const mine = [...this.plate].sort().join(',');
    const match = this.seats
      .filter((s) => s.order && s.order.join(',') === mine)
      .sort((a, b) => a.patience - b.patience)[0];
    if (match) {
      const bonus = Math.round((match.patience / match.max) * 50);
      this.h.addScore(match.order!.length * 100 + bonus, match.x, 80);
      this.h.sfx('coin');
      this.served++;
      this.leave(match, true);
    } else {
      this.h.float('주문이 달라요', 320, 220, '#ff4b6e');
      this.h.sfx('bad');
    }
    this.plate = [];
  }

  update(dt: number) {
    const i = this.h.inp;
    if (i.leftP) this.addIng(0);
    if (i.upP) this.addIng(1);
    if (i.rightP) this.addIng(2);
    if (i.downP) this.addIng(3);
    if (i.actionP) this.serve();
    if (i.codes.has('KeyX') || i.codes.has('Backspace')) this.plate = [];

    for (const s of this.seats) {
      if (!s.order) {
        s.wait -= dt;
        if (s.wait <= 0) this.newCustomer(s);
        continue;
      }
      s.patience -= dt;
      const f = Math.max(0, s.patience / s.max);
      s.bar.clear();
      s.bar.fillStyle(0x0d0a16);
      s.bar.fillRect(s.x - 20, 160, 40, 6);
      s.bar.fillStyle(f > 0.5 ? 0x4be37a : f > 0.25 ? 0xffd84b : 0xff4b6e);
      s.bar.fillRect(s.x - 19, 161, 38 * f, 4);
      if (f < 0.25 && s.c) s.c.x = s.x + Math.sin(this.h.t * 40) * 1.5;
      if (s.patience <= 0) {
        this.leave(s, false);
        this.h.float('화났어요!', s.x, 90, '#ff4b6e');
        if (!this.h.hit(s.x, 100)) return;
      }
    }
    // 접시
    const g = this.plateG;
    g.clear();
    g.fillStyle(0xe8e2f0);
    g.fillEllipse(320, 268, 120, 22);
    g.lineStyle(1, 0x0d0a16);
    g.strokeEllipse(320, 268, 120, 22);
    this.plate.forEach((k, j) => drawIng(g, k, 320 - (this.plate.length - 1) * 11 + j * 22, 262));
  }

  microDone() {
    return this.served >= 1;
  }
  microSuccess() {
    return this.served >= 1;
  }
}
