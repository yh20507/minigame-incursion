import Phaser from 'phaser';
import { MiniGame } from './base';

type Stage = 0 | 1 | 2 | 3 | 4; // 빈 땅, 씨앗, 물 줌(자람), 익음, 시듦
interface Plot {
  x: number;
  y: number;
  stage: Stage;
  t: number;
  o: Phaser.GameObjects.Graphics;
}
interface Bird {
  o: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  target: Plot;
  t: number;
  eating: boolean;
}

/** 씨앗 심기: 밭 칸 클릭으로 심기→물주기→수확. 새가 익은 작물을 쪼아먹기 전에 클릭으로 쫓아라. 익은 걸 놔두면 시든다. */
export class FarmGame extends MiniGame {
  plots: Plot[] = [];
  birds: Bird[] = [];
  birdT = 4;
  harvested = 0;
  label!: Phaser.GameObjects.Text;
  readonly cols = 4;
  readonly rows = 2;
  readonly cell = 84;

  create() {
    const bg = this.gfx();
    bg.fillGradientStyle(0x6fb0e8, 0x6fb0e8, 0xb8f28b, 0xb8f28b, 1);
    bg.fillRect(0, 0, 640, 340);
    bg.fillStyle(0x5a9a4a, 1);
    bg.fillRoundedRect(60, 70, 520, 230, 20);
    const ox = 320 - (this.cols * this.cell) / 2;
    const oy = 100;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const o = this.gfx();
        const p: Plot = { x: ox + c * this.cell + this.cell / 2, y: oy + r * 100 + 40, stage: 0, t: 0, o };
        this.plots.push(p);
        this.drawPlot(p);
      }
    this.label = this.text(320, 12, '', 10, '#1d3320').setDepth(5);
  }

  drawPlot(p: Plot) {
    const o = p.o;
    o.clear();
    o.fillStyle(0x6b4a2b, 1);
    o.fillRoundedRect(p.x - 34, p.y - 22, 68, 48, 6);
    o.fillStyle(0x55391f, 1);
    for (let k = 0; k < 3; k++) o.fillRect(p.x - 28, p.y - 14 + k * 14, 56, 3);
    switch (p.stage) {
      case 1:
        o.fillStyle(0xf5e6b0, 1);
        o.fillCircle(p.x, p.y + 2, 4);
        break;
      case 2:
        o.fillStyle(0x4be37a, 1);
        o.fillRect(p.x - 2, p.y - 12, 4, 16);
        o.fillEllipse(p.x - 8, p.y - 8, 12, 6);
        o.fillEllipse(p.x + 8, p.y - 4, 12, 6);
        break;
      case 3:
        o.fillStyle(0x4be37a, 1);
        o.fillRect(p.x - 2, p.y - 18, 4, 22);
        o.fillStyle(0xffd84b, 1);
        o.fillCircle(p.x, p.y - 22, 9);
        o.fillStyle(0xff9ad5, 1);
        o.fillCircle(p.x - 7, p.y - 24, 4);
        o.fillCircle(p.x + 7, p.y - 24, 4);
        break;
      case 4:
        o.fillStyle(0x8a7a5a, 1);
        o.fillRect(p.x - 2, p.y - 12, 4, 16);
        o.fillStyle(0x7a6a4a, 1);
        o.fillEllipse(p.x + 6, p.y - 10, 10, 5);
        break;
    }
    // 진행 바 (자람/익음 대기)
    if (p.stage === 2 || p.stage === 3) {
      const limit = p.stage === 2 ? this.growTime() : this.ripeTime();
      o.fillStyle(0x0b0918, 0.4);
      o.fillRect(p.x - 30, p.y + 20, 60, 4);
      o.fillStyle(p.stage === 2 ? 0x5fd3e0 : 0xff4b6e, 1);
      o.fillRect(p.x - 30, p.y + 20, 60 * Math.min(1, p.t / limit), 4);
    }
  }
  growTime() {
    return Math.max(1.6, 3.2 / this.ramp(0.012, 1.8));
  }
  ripeTime() {
    return Math.max(2.2, 5 - (this.h.difficulty - 1) * 1.5);
  }

  spawnBird() {
    const ripe = this.plots.filter((p) => p.stage === 3 || p.stage === 2);
    if (!ripe.length) return;
    const target = ripe[Math.floor(this.h.rng() * ripe.length)];
    const fromLeft = this.h.rng() < 0.5;
    const o = this.gfx().setDepth(3);
    o.fillStyle(0x3a2a4a, 1);
    o.fillEllipse(0, 0, 22, 14);
    o.fillStyle(0xffd84b, 1);
    o.fillTriangle(fromLeft ? 11 : -11, 0, fromLeft ? 18 : -18, -2, fromLeft ? 11 : -11, 4);
    o.fillStyle(0xffffff, 1);
    o.fillCircle(fromLeft ? 5 : -5, -3, 2);
    o.setPosition(fromLeft ? -20 : 660, this.rnd(30, 80));
    this.add(o);
    this.birds.push({ o, x: o.x, y: o.y, target, t: 0, eating: false });
  }

  update(dt: number) {
    const inp = this.h.inp;
    const p = inp.pointer;
    // 새 클릭 (우선)
    if (p.pressed) {
      const b = this.birds.find((b) => Math.hypot(b.x - p.x, b.y - p.y) < 24);
      if (b) {
        this.h.sfx('good');
        this.h.addScore(30, b.x, b.y - 10);
        this.s.tweens.add({ targets: b.o, y: -40, x: b.x + 200, alpha: 0, duration: 500, onComplete: () => b.o.destroy() });
        this.birds.splice(this.birds.indexOf(b), 1);
      } else {
        const pl = this.plots.find((q) => Math.abs(q.x - p.x) < 36 && Math.abs(q.y - p.y) < 28);
        if (pl) {
          if (pl.stage === 0) {
            pl.stage = 1;
            this.h.sfx('tick');
          } else if (pl.stage === 1) {
            pl.stage = 2;
            pl.t = 0;
            this.h.sfx('select');
          } else if (pl.stage === 3) {
            pl.stage = 0;
            this.harvested++;
            this.h.sfx('coin');
            this.h.addScore(120, pl.x, pl.y - 30);
          } else if (pl.stage === 4) {
            pl.stage = 0;
            this.h.sfx('cancel');
          }
          this.drawPlot(pl);
        }
      }
    }
    // 자람 / 시듦
    for (const pl of this.plots) {
      if (pl.stage === 2) {
        pl.t += dt;
        if (pl.t >= this.growTime()) {
          pl.stage = 3;
          pl.t = 0;
        }
        this.drawPlot(pl);
      } else if (pl.stage === 3) {
        pl.t += dt;
        if (pl.t >= this.ripeTime()) {
          pl.stage = 4;
          this.h.sfx('bad');
          this.h.float('시들었다', pl.x, pl.y - 30, '#ff4b6e');
          this.h.addTime(-2);
        }
        this.drawPlot(pl);
      }
    }
    // 새
    this.birdT -= dt;
    if (this.birdT <= 0) {
      this.spawnBird();
      this.birdT = (this.h.micro ? 2 : Math.max(1.4, 4 / this.ramp(0.015, 2))) * this.rnd(0.8, 1.3);
    }
    for (const b of [...this.birds]) {
      if (!b.eating) {
        const dx = b.target.x - b.x,
          dy = b.target.y - 26 - b.y;
        const d = Math.hypot(dx, dy);
        const sp = 110 * this.ramp(0.01, 1.6);
        if (d < 4) b.eating = true;
        else {
          b.x += (dx / d) * sp * dt;
          b.y += (dy / d) * sp * dt;
        }
      } else {
        b.t += dt;
        if (b.t > 1.2) {
          if (b.target.stage === 2 || b.target.stage === 3) {
            b.target.stage = 0;
            this.drawPlot(b.target);
            this.h.hit(b.x, b.y);
            this.h.float('먹혔다!', b.x, b.y - 20, '#ff4b6e');
          }
          b.o.destroy();
          this.birds.splice(this.birds.indexOf(b), 1);
          continue;
        }
      }
      b.o.setPosition(b.x, b.y + (b.eating ? Math.sin(b.t * 20) * 2 : 0));
    }
    this.label.setText(`수확 ${this.harvested} · 심기 → 물주기 → 수확 · 새는 클릭으로 쫓기`);
  }

  microDone() {
    return this.harvested >= 1;
  }
  microSuccess() {
    return this.harvested >= 1;
  }
}
