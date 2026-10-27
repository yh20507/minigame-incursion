import Phaser from 'phaser';
import { MiniGame } from './base';

interface Cup {
  o: Phaser.GameObjects.Container;
  slot: number;
}

/** 술잔 야바위: 구슬이 든 잔을 따라가서 고르기 */
export class ShuffleGame extends MiniGame {
  cups: Cup[] = [];
  ball!: Phaser.GameObjects.Arc;
  ballCup!: Cup;
  phase: 'show' | 'shuffle' | 'pick' | 'reveal' = 'show';
  pt = 0;
  round = 0;
  swaps: [number, number][] = [];
  swapDur = 0.4;
  cur = 0;
  sel!: Phaser.GameObjects.Graphics;
  y = 220;
  correct = 0;
  wrong = false;
  slotX: number[] = [];
  table!: Phaser.GameObjects.Rectangle;
  done = 0;
  tickIdx = -1;

  finalize(k: number) {
    const [a, b] = this.swaps[k];
    const ca = this.cups.find((c) => c.slot === a)!,
      cb = this.cups.find((c) => c.slot === b)!;
    ca.slot = b;
    cb.slot = a;
    ca.o.x = this.slotX[b];
    cb.o.x = this.slotX[a];
    ca.o.y = cb.o.y = this.y;
  }

  create() {
    this.table = this.rect(320, this.y + 10, 520, 14, 0x5a3a1b).setStrokeStyle(1, 0x0d0a16);
    this.rect(320, this.y + 50, 480, 70, 0x3b2414);
    this.player(60, this.y + 6, 44);
    this.sel = this.gfx();
    this.ball = this.add(this.s.add.circle(0, this.y, 8, 0xffd84b).setStrokeStyle(1, 0x0d0a16));
    this.newRound();
  }

  cupCount() {
    if (this.h.micro) return 3;
    return this.round >= 6 ? 5 : this.round >= 3 ? 4 : 3;
  }

  newRound() {
    this.cups.forEach((c) => c.o.destroy());
    this.cups = [];
    const n = this.cupCount();
    const span = n === 3 ? 260 : n === 4 ? 340 : 400;
    this.slotX = [...Array(n)].map((_, k) => 320 - span / 2 + (span / (n - 1)) * k);
    for (let k = 0; k < n; k++) {
      const o = this.s.add.container(this.slotX[k], this.y);
      const g = this.s.add.graphics();
      g.fillStyle(0x0d0a16);
      g.fillRect(-23, -45, 46, 47);
      g.fillStyle(0xb7b0c4);
      g.fillRect(-22, -44, 44, 45);
      g.fillStyle(0xe8e2f0);
      g.fillRect(-18, -40, 6, 36);
      g.fillStyle(0x8a8398);
      g.fillRect(-22, -6, 44, 7);
      g.fillStyle(0xd9a066);
      g.fillRect(-14, -30, 28, 4);
      o.add(g);
      this.add(o);
      this.cups.push({ o, slot: k });
    }
    this.ballCup = this.cups[Math.floor(this.h.rng() * n)];
    this.ball.setPosition(this.slotX[this.ballCup.slot], this.y - 4).setVisible(true);
    this.h.layer.bringToTop(this.ball);
    this.cups.forEach((c) => this.h.layer.bringToTop(c.o));
    // 처음엔 잔을 들어 구슬을 보여준다
    this.ballCup.o.y = this.y - 40;
    this.phase = 'show';
    this.pt = 0;
    const nSwaps = this.h.micro ? 3 : Math.min(14, 4 + this.round + (this.h.difficulty - 1) * 2);
    this.swaps = [];
    for (let k = 0; k < nSwaps; k++) {
      const a = Math.floor(this.h.rng() * n);
      let b = Math.floor(this.h.rng() * (n - 1));
      if (b >= a) b++;
      this.swaps.push([a, b]);
    }
    this.swapDur = this.h.micro ? 0.22 : Math.max(0.16, 0.42 - this.round * 0.03 - (this.h.difficulty - 1) * 0.06);
    this.cur = Math.floor(n / 2);
    this.wrong = false;
    this.done = 0;
    this.tickIdx = -1;
  }

  update(dt: number) {
    this.pt += dt;
    const i = this.h.inp;
    this.sel.clear();
    if (this.phase === 'show') {
      const showT = this.h.micro ? 0.5 : 0.8;
      if (this.pt > showT) {
        this.ballCup.o.y = Phaser.Math.Linear(this.y - 40, this.y, Math.min(1, (this.pt - showT) / 0.15));
        if (this.pt > showT + 0.2) {
          this.ballCup.o.y = this.y;
          this.ball.setVisible(false);
          this.phase = 'shuffle';
          this.pt = 0;
        }
      }
    } else if (this.phase === 'shuffle') {
      const idx = Math.floor(this.pt / this.swapDur);
      while (this.done < Math.min(idx, this.swaps.length)) this.finalize(this.done++);
      if (idx >= this.swaps.length) {
        this.cups.forEach((c) => {
          c.o.x = this.slotX[c.slot];
          c.o.y = this.y;
        });
        this.phase = 'pick';
        this.pt = 0;
        return;
      }
      const f = (this.pt % this.swapDur) / this.swapDur;
      const [a, b] = this.swaps[idx];
      const ca = this.cups.find((c) => c.slot === a)!,
        cb = this.cups.find((c) => c.slot === b)!;
      const e = Phaser.Math.Easing.Sine.InOut(f);
      ca.o.x = Phaser.Math.Linear(this.slotX[a], this.slotX[b], e);
      cb.o.x = Phaser.Math.Linear(this.slotX[b], this.slotX[a], e);
      ca.o.y = this.y - Math.sin(f * Math.PI) * 18;
      cb.o.y = this.y + Math.sin(f * Math.PI) * 10;
      if (this.tickIdx !== idx) {
        this.tickIdx = idx;
        this.h.sfx('tick');
      }
    } else if (this.phase === 'pick') {
      const n = this.cups.length;
      if (i.leftP) this.cur = (this.cur + n - 1) % n;
      if (i.rightP) this.cur = (this.cur + 1) % n;
      const x = this.slotX[this.cur];
      const blink = Math.floor(this.pt * 6) % 2 === 0;
      this.sel.fillStyle(0xffffff, blink ? 1 : 0.5);
      this.sel.fillTriangle(x - 7, this.y - 64, x + 7, this.y - 64, x, this.y - 54);
      let choice: Cup | null = null;
      if (i.actionP) choice = this.cups.find((c) => c.slot === this.cur)!;
      if (i.pointer.pressed) {
        const p = i.pointer;
        choice = this.cups.find((c) => Math.abs(p.x - c.o.x) < 26 && p.y > this.y - 60 && p.y < this.y + 10) ?? null;
      }
      if (choice) this.reveal(choice);
    } else if (this.phase === 'reveal') {
      if (this.pt > (this.h.micro ? 0.5 : 0.9)) {
        if (this.h.micro && this.correct > 0) return;
        this.round++;
        this.newRound();
      }
    }
  }

  reveal(choice: Cup) {
    this.phase = 'reveal';
    this.pt = 0;
    this.ball.setPosition(this.slotX[this.ballCup.slot], this.y - 4).setVisible(true);
    this.h.layer.bringToTop(this.ball);
    this.cups.forEach((c) => this.h.layer.bringToTop(c.o));
    this.s.tweens.add({ targets: choice.o, y: this.y - 40, duration: 150 });
    if (choice === this.ballCup) {
      this.correct++;
      this.h.addScore(200 + this.round * 20, choice.o.x, this.y - 80);
      this.h.sfx('good');
    } else {
      this.s.tweens.add({ targets: this.ballCup.o, y: this.y - 40, duration: 150, delay: 200 });
      this.h.sfx('bad');
      this.wrong = true;
      this.h.hit(choice.o.x, this.y - 60);
    }
  }

  microDone() {
    return this.correct > 0 && this.pt > 0.3;
  }
  microSuccess() {
    return this.correct > 0;
  }
}
