import Phaser from 'phaser';
import { MiniGame } from './base';

/** 투석기 발사: 힘을 모아 포물선으로 과녁 맞히기 */
export class ThrowGame extends MiniGame {
  ground = 300;
  ox = 86;
  power = 0;
  dir = 1;
  charging = false;
  stone: { o: Phaser.GameObjects.Arc; vx: number; vy: number } | null = null;
  tx = 400;
  tvx = 0;
  target!: Phaser.GameObjects.Container;
  meter!: Phaser.GameObjects.Graphics;
  arm!: Phaser.GameObjects.Rectangle;
  trail!: Phaser.GameObjects.Graphics;
  hits = 0;
  throws = 0;
  cool = 0;
  G = 620;
  ANG = (52 * Math.PI) / 180;

  create() {
    this.rect(0, this.ground, 640, 60, 0x1d1820).setOrigin(0);
    this.rect(0, this.ground, 640, 2, 0x6b5a4a).setOrigin(0);
    // 투석기
    const base = this.gfx();
    base.fillStyle(0x5a3a1b);
    base.fillRect(this.ox - 26, this.ground - 14, 52, 10);
    base.fillStyle(0x3b2414);
    base.fillCircle(this.ox - 18, this.ground - 4, 6);
    base.fillCircle(this.ox + 18, this.ground - 4, 6);
    base.fillStyle(0x7a5030);
    base.fillTriangle(this.ox - 6, this.ground - 14, this.ox + 6, this.ground - 14, this.ox, this.ground - 34);
    this.arm = this.rect(this.ox, this.ground - 32, 44, 5, 0x8a5a2b).setOrigin(0.9, 0.5).setAngle(20);
    this.player(this.ox - 46, this.ground, 40);
    this.trail = this.gfx();
    this.meter = this.gfx();
    this.target = this.s.add.container(0, this.ground);
    const tg = this.s.add.graphics();
    const rings: [number, number][] = [
      [32, 0xd9a066],
      [20, 0xff4b6e],
      [9, 0xffd84b],
    ];
    rings.forEach(([w, c]) => {
      tg.fillStyle(c);
      tg.fillRect(-w, -6, w * 2, 6);
    });
    tg.fillStyle(0x0d0a16);
    tg.fillRect(-1, -22, 2, 16);
    tg.fillStyle(0xff4b6e);
    tg.fillTriangle(1, -22, 12, -18, 1, -14);
    this.target.add(tg);
    this.add(this.target);
    this.newTarget();
  }

  newTarget() {
    const min = this.h.micro ? 300 : 260;
    const max = this.h.micro ? 440 : 600;
    this.tx = this.rnd(min, max);
    this.target.x = this.tx;
    this.tvx = this.h.difficulty > 1 || this.h.t > 20 ? this.rnd(-40, 40) * this.ramp(0.01) : 0;
    this.target.setScale(1.3, 1);
    this.s.tweens.add({ targets: this.target, scaleX: 1, duration: 200 });
  }

  update(dt: number) {
    const i = this.h.inp;
    const press = i.action || i.pointer.down;
    if (this.tvx) {
      this.tx += this.tvx * dt;
      if (this.tx < 240 || this.tx > 610) this.tvx *= -1;
      this.target.x = this.tx;
    }
    if (this.cool > 0) this.cool -= dt;

    if (!this.stone && this.cool <= 0) {
      if (press && !this.charging && (i.actionP || i.pointer.pressed)) {
        this.charging = true;
        this.power = 0;
        this.dir = 1;
      }
      if (this.charging) {
        this.power += this.dir * dt * 1.25 * this.ramp(0.008, 1.6);
        if (this.power >= 1) {
          this.power = 1;
          this.dir = -1;
        }
        if (this.power <= 0) {
          this.power = 0;
          this.dir = 1;
        }
        this.arm.setAngle(20 + this.power * 40);
        if (!press) this.launch();
      }
    }
    this.meter.clear();
    if (this.charging) {
      this.meter.fillStyle(0x0d0a16);
      this.meter.fillRect(this.ox - 30, this.ground - 76, 60, 8);
      const c = this.power > 0.85 ? 0xff4b6e : this.power > 0.5 ? 0xffd84b : 0x4be37a;
      this.meter.fillStyle(c);
      this.meter.fillRect(this.ox - 29, this.ground - 75, 58 * this.power, 6);
    }

    if (this.stone) {
      const st = this.stone;
      st.vy += this.G * dt;
      st.o.x += st.vx * dt;
      st.o.y += st.vy * dt;
      this.trail.fillStyle(0xffffff, 0.35);
      this.trail.fillRect(st.o.x - 1, st.o.y - 1, 2, 2);
      if (st.o.y >= this.ground - 4) {
        this.land(st.o.x);
        st.o.destroy();
        this.stone = null;
      }
    }
  }

  launch() {
    this.charging = false;
    const v = 170 + this.power * 430;
    const sx = this.ox - 30,
      sy = this.ground - 50;
    const o = this.add(this.s.add.circle(sx, sy, 6, 0x9a93a0).setStrokeStyle(1, 0x0d0a16));
    this.stone = { o, vx: v * Math.cos(this.ANG), vy: -v * Math.sin(this.ANG) };
    this.arm.setAngle(-50);
    this.s.tweens.add({ targets: this.arm, angle: 20, duration: 400, delay: 150 });
    this.h.sfx('throw');
    this.throws++;
    this.trail.clear();
  }

  land(x: number) {
    const d = Math.abs(x - this.tx);
    let pts = 0;
    if (d <= 9) pts = 300;
    else if (d <= 20) pts = 150;
    else if (d <= 32) pts = 60;
    const dust = this.add(this.s.add.circle(x, this.ground, 4, 0xd9a066, 0.7));
    this.s.tweens.add({ targets: dust, scale: 4, alpha: 0, duration: 300, onComplete: () => dust.destroy() });
    if (pts) {
      this.hits++;
      this.h.addScore(pts, this.tx, this.ground - 40);
      this.h.sfx(pts >= 300 ? 'star' : 'good');
      if (pts >= 300) this.h.float('명중!', this.tx, this.ground - 64, '#ffd84b');
      this.cool = 0.35;
      this.s.time.delayedCall(250, () => this.newTarget());
    } else {
      this.h.float(x < this.tx ? '짧다!' : '길다!', x, this.ground - 30, '#a69fd0');
      this.h.sfx('bad');
      this.cool = 0.3;
    }
  }

  microDone() {
    return this.hits >= 1;
  }
  microSuccess() {
    return this.hits >= 1;
  }
}
