import Phaser from 'phaser';
import { MiniGame } from './base';

interface Jelly {
  o: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  phase: number;
  period: number;
  on: boolean;
}
interface Bubble {
  o: Phaser.GameObjects.Arc;
  x: number;
  y: number;
}

/** 해파리 잠수: ↑↓로 부력 조절(관성). 해파리는 박자에 맞춰 전류를 켠다 — 켜져 있을 때 닿으면 피격. 공기방울로 산소를 채워라. */
export class DiveGame extends MiniGame {
  py = 170;
  vy = 0;
  pl!: Phaser.GameObjects.Image;
  jellies: Jelly[] = [];
  bubbles: Bubble[] = [];
  spawnT = 0.8;
  bubbleT = 1.5;
  o2 = 1;
  ui!: Phaser.GameObjects.Graphics;
  dist = 0;
  passed = 0;
  readonly px = 120;

  create() {
    const g = this.gfx();
    g.fillGradientStyle(0x0a3038, 0x0a3038, 0x030c10, 0x030c10, 1);
    g.fillRect(0, 0, 640, 340);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(0x4fd1c5, 0.08 + (i % 3) * 0.04);
      g.fillCircle(this.rnd(0, 640), this.rnd(0, 340), this.rnd(1, 3));
    }
    g.fillStyle(0x0b2a30, 1);
    g.fillRect(0, 320, 640, 20);
    this.pl = this.player(this.px, this.py + 18, 36);
    this.ui = this.gfx().setDepth(5);
  }

  spawnJelly() {
    const o = this.gfx();
    const period = this.rnd(1.2, 2.2);
    const j: Jelly = { o, x: 680, y: this.rnd(40, 290), phase: this.h.rng() * period, period, on: false };
    this.jellies.push(j);
    this.drawJelly(j);
  }
  drawJelly(j: Jelly) {
    const o = j.o;
    o.clear();
    const c = j.on ? 0xfff2b0 : 0x8a6cff;
    o.fillStyle(c, j.on ? 1 : 0.8);
    o.fillEllipse(0, 0, 30, 22);
    o.fillStyle(0x030c10, 0.35);
    o.fillEllipse(0, 4, 24, 8);
    o.lineStyle(2, c, j.on ? 1 : 0.6);
    for (let k = -2; k <= 2; k++) o.lineBetween(k * 5, 8, k * 5 + (j.on ? 3 : 0), 26);
    if (j.on) {
      o.lineStyle(1, 0xffffff, 0.8);
      o.strokeEllipse(0, 0, 40, 32);
    }
    o.setPosition(j.x, j.y);
  }

  update(dt: number) {
    const inp = this.h.inp;
    const ramp = this.ramp(0.015, 2);
    // 부력: 천천히
    const acc = 220;
    if (inp.up || (inp.pointer.down && inp.pointer.y < this.py)) this.vy -= acc * dt;
    else if (inp.down || (inp.pointer.down && inp.pointer.y > this.py)) this.vy += acc * dt;
    this.vy *= 1 - 1.4 * dt; // 물의 저항
    this.vy = Phaser.Math.Clamp(this.vy, -150, 150);
    this.py = Phaser.Math.Clamp(this.py + this.vy * dt, 24, 300);
    this.pl.setPosition(this.px, this.py + 18);
    this.pl.setAngle(this.vy * 0.08);
    // 산소
    this.o2 -= dt * (this.h.micro ? 0.05 : 0.07) * (1 + (this.h.difficulty - 1) * 0.5);
    if (this.o2 <= 0) {
      this.o2 = 0.5;
      this.h.hit(this.px, this.py);
      this.h.float('산소 부족!', this.px, this.py - 30, '#ff4b6e');
    }
    this.dist += 60 * ramp * dt;
    // 스폰
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnJelly();
      this.spawnT = (this.h.micro ? 0.8 : Math.max(0.45, 1.3 / ramp)) * this.rnd(0.7, 1.3);
    }
    this.bubbleT -= dt;
    if (this.bubbleT <= 0) {
      const b = this.add(this.s.add.circle(680, this.rnd(40, 300), 7, 0xd9fbff, 0.9));
      this.bubbles.push({ o: b, x: 680, y: b.y });
      this.bubbleT = this.rnd(1.2, 2.2);
    }
    const sp = 110 * ramp;
    for (const j of [...this.jellies]) {
      j.x -= sp * dt;
      j.phase += dt;
      const on = (j.phase % j.period) < j.period * 0.4;
      if (on !== j.on) {
        j.on = on;
        this.drawJelly(j);
      } else j.o.setPosition(j.x, j.y);
      j.y += Math.sin(j.phase * 2) * 10 * dt;
      if (Math.abs(j.x - this.px) < 22 && Math.abs(j.y - this.py) < 20) {
        if (j.on) {
          this.h.hit(j.x, j.y);
          j.o.destroy();
          this.jellies.splice(this.jellies.indexOf(j), 1);
          continue;
        }
      }
      if (j.x < this.px - 30 && !(j as any).counted) {
        (j as any).counted = true;
        this.passed++;
        this.h.addScore(40, this.px, this.py - 26);
      }
      if (j.x < -40) {
        j.o.destroy();
        this.jellies.splice(this.jellies.indexOf(j), 1);
      }
    }
    for (const b of [...this.bubbles]) {
      b.x -= sp * dt;
      b.y -= 12 * dt;
      b.o.setPosition(b.x, b.y);
      if (Math.abs(b.x - this.px) < 20 && Math.abs(b.y - this.py) < 22) {
        this.o2 = Math.min(1, this.o2 + 0.3);
        this.h.sfx('coin');
        this.h.addScore(60, b.x, b.y - 12);
        b.o.destroy();
        this.bubbles.splice(this.bubbles.indexOf(b), 1);
        continue;
      }
      if (b.x < -20) {
        b.o.destroy();
        this.bubbles.splice(this.bubbles.indexOf(b), 1);
      }
    }
    const g = this.ui;
    g.clear();
    g.fillStyle(0x0b0918, 0.8);
    g.fillRect(8, 24, 120, 10);
    g.fillStyle(this.o2 < 0.3 ? 0xff4b6e : 0x4fd1c5, 1);
    g.fillRect(9, 25, 118 * this.o2, 8);
  }

  microDone() {
    return this.passed >= 3;
  }
  microSuccess() {
    return this.passed >= 3;
  }
}
