import Phaser from 'phaser';
import { MiniGame } from './base';

interface Fall {
  o: Phaser.GameObjects.Container;
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  star: boolean;
}

/** 운석 피하기 */
export class DodgeGame extends MiniGame {
  pl!: Phaser.GameObjects.Image;
  px = 320;
  py = 316;
  falls: Fall[] = [];
  spawnT = 0.4;
  acc = 0;
  stars: Phaser.GameObjects.Rectangle[] = [];

  create() {
    for (let k = 0; k < 40; k++) {
      this.stars.push(this.rect(Math.random() * 640, Math.random() * 340, 2, 2, 0xffffff, 0.3 + Math.random() * 0.5));
    }
    this.rect(0, this.py, 640, 30, 0x141c38).setOrigin(0);
    this.rect(0, this.py, 640, 2, 0x5fd3e0).setOrigin(0);
    this.pl = this.player(this.px, this.py, 40);
  }

  spawn(star = false) {
    const r = star ? 8 : this.rnd(9, 18) * (this.h.micro ? 1.1 : 1);
    const x = this.rnd(20, 620);
    const c = this.s.add.container(x, -20);
    const g = this.s.add.graphics();
    if (star) {
      g.fillStyle(0xffd84b);
      g.fillRect(-2, -8, 4, 16);
      g.fillRect(-8, -2, 16, 4);
      g.fillStyle(0xffffff);
      g.fillRect(-2, -2, 4, 4);
    } else {
      g.fillStyle(0xff8a3d, 0.4);
      g.fillCircle(0, -r * 0.8, r * 0.9);
      g.fillStyle(0x7a5a4a);
      g.fillCircle(0, 0, r);
      g.fillStyle(0x5a3f33);
      g.fillCircle(-r * 0.3, -r * 0.2, r * 0.3);
      g.fillCircle(r * 0.35, r * 0.3, r * 0.22);
      g.lineStyle(1, 0x0d0a16);
      g.strokeCircle(0, 0, r);
    }
    c.add(g);
    this.add(c);
    const sp = (star ? 130 : this.rnd(150, 260)) * this.ramp(0.02, 2.2);
    this.falls.push({ o: c, x, y: -20, r, vy: sp, vx: star ? 0 : this.rnd(-30, 30), star });
  }

  update(dt: number) {
    const i = this.h.inp;
    let mv = (i.right ? 1 : 0) - (i.left ? 1 : 0);
    if (i.pointer.down) mv = Math.abs(i.pointer.x - this.px) > 6 ? Math.sign(i.pointer.x - this.px) : 0;
    this.px = Phaser.Math.Clamp(this.px + mv * 300 * dt, 16, 624);
    this.pl.x = this.px;
    this.pl.angle = mv * 10;

    this.stars.forEach((s) => {
      s.y += 20 * dt;
      if (s.y > 320) s.y = 0;
    });

    this.acc += dt * 100;
    if (this.acc >= 10) {
      this.h.addScore(10);
      this.acc -= 10;
    }

    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawn();
      const base = this.h.micro ? 0.2 : Math.max(0.16, 0.55 - this.h.t * 0.009 - (this.h.difficulty - 1) * 0.1);
      this.spawnT = base * this.rnd(0.6, 1.3);
      if (!this.h.micro && this.h.rng() < 0.08) this.spawn(true);
    }

    for (const f of [...this.falls]) {
      f.y += f.vy * dt;
      f.x += f.vx * dt;
      f.o.setPosition(f.x, f.y);
      if (!f.star) f.o.angle += f.vx * dt;
      const dx = f.x - this.px,
        dy = f.y - (this.py - 16);
      if (Math.hypot(dx, dy) < f.r + 12) {
        f.o.destroy();
        this.falls.splice(this.falls.indexOf(f), 1);
        if (f.star) {
          this.h.addScore(50, f.x, f.y - 10);
          this.h.sfx('coin');
        } else if (!this.h.hit(f.x, f.y)) return;
        continue;
      }
      if (f.y > this.py + 6) {
        if (!f.star) {
          const boom = this.add(this.s.add.circle(f.x, this.py, f.r, 0xff8a3d, 0.6));
          this.s.tweens.add({ targets: boom, scale: 2, alpha: 0, duration: 200, onComplete: () => boom.destroy() });
        }
        f.o.destroy();
        this.falls.splice(this.falls.indexOf(f), 1);
      }
    }
  }
}
