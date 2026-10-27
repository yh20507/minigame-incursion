import Phaser from 'phaser';
import { MiniGame } from './base';

const SYM_COLORS = [0xff4b6e, 0x4aa3ff, 0x4be37a, 0xffd84b, 0xb06cff, 0xff8a3d, 0x5fd3e0, 0xffffff, 0xff5fd2, 0x9aa3ad];

function drawSymbol(g: Phaser.GameObjects.Graphics, k: number) {
  const col = SYM_COLORS[k % SYM_COLORS.length];
  g.fillStyle(col, 1);
  g.lineStyle(2, 0x0d0a16, 1);
  switch (k % 10) {
    case 0:
      g.fillCircle(0, 0, 12);
      g.strokeCircle(0, 0, 12);
      break;
    case 1:
      g.fillTriangle(0, -13, 13, 11, -13, 11);
      g.strokeTriangle(0, -13, 13, 11, -13, 11);
      break;
    case 2:
      g.fillRect(-11, -11, 22, 22);
      g.strokeRect(-11, -11, 22, 22);
      break;
    case 3:
      g.fillPoints([new Phaser.Math.Vector2(0, -14), new Phaser.Math.Vector2(12, 0), new Phaser.Math.Vector2(0, 14), new Phaser.Math.Vector2(-12, 0)], true);
      break;
    case 4: {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 6 : 14;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r));
      }
      g.fillPoints(pts, true);
      break;
    }
    case 5:
      g.fillRect(-4, -13, 8, 26);
      g.fillRect(-13, -4, 26, 8);
      break;
    case 6:
      g.fillCircle(0, 0, 12);
      g.fillStyle(0x1e1a3a, 1);
      g.fillCircle(6, -4, 10);
      break;
    case 7:
      g.fillCircle(-6, -3, 7);
      g.fillCircle(6, -3, 7);
      g.fillTriangle(-13, 0, 13, 0, 0, 13);
      break;
    case 8: {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        pts.push(new Phaser.Math.Vector2(Math.cos(a) * 13, Math.sin(a) * 13));
      }
      g.fillPoints(pts, true);
      break;
    }
    default:
      g.fillTriangle(0, -14, 12, 0, -12, 0);
      g.fillRect(-5, 0, 10, 13);
  }
}

interface Card {
  c: Phaser.GameObjects.Container;
  back: Phaser.GameObjects.Graphics;
  face: Phaser.GameObjects.Container;
  sym: number;
  up: boolean;
  done: boolean;
  x: number;
  y: number;
}

/** 문장 맞추기: 같은 문장 카드 짝 맞추기 */
export class MemoryGame extends MiniGame {
  cards: Card[] = [];
  open: Card[] = [];
  level = 0;
  wait = 0;
  preview = 0;
  combo = 0;
  matched = 0;
  cursor = 0;
  cols = 4;
  cur!: Phaser.GameObjects.Rectangle;
  CW = 52;
  CH = 64;

  create() {
    this.cur = this.rect(0, 0, this.CW + 6, this.CH + 6, 0, 0).setStrokeStyle(2, 0xffffff).setDepth(5);
    this.deal();
  }

  deal() {
    this.cards.forEach((c) => c.c.destroy());
    this.cards = [];
    this.open = [];
    const sizes = this.h.micro ? [[2, 2]] : [[4, 3], [4, 4], [5, 4], [6, 4]];
    const [cols, rows] = sizes[Math.min(this.level, sizes.length - 1)];
    this.cols = cols;
    const pairs = (cols * rows) / 2;
    const syms = Phaser.Utils.Array.Shuffle([...Array(10).keys()]).slice(0, pairs);
    const deck = Phaser.Utils.Array.Shuffle([...syms, ...syms]);
    const gap = 10;
    const tw = cols * this.CW + (cols - 1) * gap,
      th = rows * this.CH + (rows - 1) * gap;
    const x0 = (this.h.W - tw) / 2 + this.CW / 2,
      y0 = (this.h.H - th) / 2 + this.CH / 2;
    deck.forEach((sym, i) => {
      const x = x0 + (i % cols) * (this.CW + gap),
        y = y0 + Math.floor(i / cols) * (this.CH + gap);
      const c = this.s.add.container(x, y);
      const back = this.s.add.graphics();
      back.fillStyle(0x0d0a16);
      back.fillRect(-this.CW / 2 - 1, -this.CH / 2 - 1, this.CW + 2, this.CH + 2);
      back.fillStyle(0x3b2a22);
      back.fillRect(-this.CW / 2, -this.CH / 2, this.CW, this.CH);
      back.lineStyle(1, 0xd9a066);
      back.strokeRect(-this.CW / 2 + 3, -this.CH / 2 + 3, this.CW - 6, this.CH - 6);
      back.fillStyle(0xd9a066);
      back.fillRect(-3, -8, 6, 16);
      back.fillRect(-8, -3, 16, 6);
      const face = this.s.add.container(0, 0);
      const fg = this.s.add.graphics();
      fg.fillStyle(0x0d0a16);
      fg.fillRect(-this.CW / 2 - 1, -this.CH / 2 - 1, this.CW + 2, this.CH + 2);
      fg.fillStyle(0xf2e6cf);
      fg.fillRect(-this.CW / 2, -this.CH / 2, this.CW, this.CH);
      const sg = this.s.add.graphics();
      drawSymbol(sg, sym);
      face.add([fg, sg]);
      c.add([back, face]);
      face.setVisible(true);
      back.setVisible(false);
      this.add(c);
      this.cards.push({ c, back, face, sym, up: true, done: false, x, y });
    });
    this.preview = this.h.micro ? 0.9 : 1.2 + this.level * 0.2;
    this.cursor = 0;
  }

  flip(card: Card, up: boolean) {
    card.up = up;
    this.s.tweens.add({
      targets: card.c,
      scaleX: 0,
      duration: 70,
      yoyo: true,
      onYoyo: () => {
        card.face.setVisible(up);
        card.back.setVisible(!up);
      },
    });
  }

  pick(card: Card) {
    if (card.up || card.done || this.open.length >= 2) return;
    this.flip(card, true);
    this.h.sfx('select');
    this.open.push(card);
    if (this.open.length === 2) {
      const [a, b] = this.open;
      if (a.sym === b.sym) {
        a.done = b.done = true;
        this.open = [];
        this.combo++;
        this.matched++;
        this.h.addScore(150 + (this.combo - 1) * 25, (a.x + b.x) / 2, Math.min(a.y, b.y) - 30);
        this.h.sfx('good');
        [a, b].forEach((c) => this.s.tweens.add({ targets: c.c, y: c.c.y - 6, yoyo: true, duration: 120 }));
        if (this.cards.every((c) => c.done)) {
          if (!this.h.micro) {
            this.h.addScore(300, this.h.W / 2, 30);
            this.level++;
            this.wait = 0.5;
          }
        }
      } else {
        this.combo = 0;
        this.wait = 0.55;
        this.h.sfx('bad');
      }
    }
  }

  update(dt: number) {
    if (this.preview > 0) {
      this.preview -= dt;
      if (this.preview <= 0) this.cards.forEach((c) => this.flip(c, false));
      this.cur.setVisible(false);
      return;
    }
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.cards.every((c) => c.done)) {
          this.deal();
          return;
        }
        this.open.forEach((c) => this.flip(c, false));
        this.open = [];
      }
    }
    const i = this.h.inp;
    const n = this.cards.length;
    if (i.leftP) this.cursor = (this.cursor + n - 1) % n;
    if (i.rightP) this.cursor = (this.cursor + 1) % n;
    if (i.upP) this.cursor = (this.cursor + n - this.cols) % n;
    if (i.downP) this.cursor = (this.cursor + this.cols) % n;
    const cc = this.cards[this.cursor];
    this.cur.setVisible(true).setPosition(cc.x, cc.y);
    if (i.actionP) this.pick(cc);
    if (i.pointer.pressed) {
      const p = i.pointer;
      const hit = this.cards.find((c) => Math.abs(p.x - c.x) < this.CW / 2 && Math.abs(p.y - c.y) < this.CH / 2);
      if (hit) {
        this.cursor = this.cards.indexOf(hit);
        this.pick(hit);
      }
    }
  }

  microDone() {
    return this.matched >= 2;
  }
  microSuccess() {
    return this.matched >= 2;
  }
}
