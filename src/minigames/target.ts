import Phaser from 'phaser';
import { MiniGame } from './base';

interface Drone {
  o: Phaser.GameObjects.Container;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  bomb: boolean;
  phase: number;
}

/** 드론 사격: 마우스로 드론 쏘기, 빨간 폭탄 드론은 피하기 */
export class TargetGame extends MiniGame {
  drones: Drone[] = [];
  spawnT = 0.3;
  cross!: Phaser.GameObjects.Graphics;
  kills = 0;
  shot = 0;

  create() {
    const g = this.gfx();
    g.fillStyle(0x141c38, 1);
    g.fillRect(0, 300, 640, 40);
    for (let k = 0; k < 8; k++) {
      g.fillStyle(0x2b3a66, 1);
      g.fillRect(k * 84, 286, 60, 14);
    }
    this.player(320, 338, 40);
    this.cross = this.gfx().setDepth(10);
  }

  spawn() {
    const bombChance = this.h.micro ? 0.1 : Math.min(0.25, 0.1 + this.h.t * 0.003 + (this.h.difficulty - 1) * 0.05);
    const bomb = this.h.rng() < bombChance;
    const fromLeft = this.h.rng() < 0.5;
    const x = fromLeft ? -16 : 656;
    const y = this.rnd(30, 250);
    const sp = this.rnd(90, 170) * this.ramp(0.015, 2);
    const c = this.s.add.container(x, y);
    const g = this.s.add.graphics();
    const body = bomb ? 0xff4b6e : 0x9fb3c8;
    g.fillStyle(0x0d0a16);
    g.fillRect(-15, -7, 30, 14);
    g.fillStyle(body);
    g.fillRect(-14, -6, 28, 12);
    g.fillStyle(bomb ? 0xffd84b : 0x5fd3e0);
    g.fillRect(-4, -3, 8, 6);
    g.fillStyle(0x55606e);
    g.fillRect(-18, -10, 10, 2);
    g.fillRect(8, -10, 10, 2);
    if (bomb) {
      g.fillStyle(0xffffff);
      g.fillRect(-1, -14, 2, 4);
    }
    c.add(g);
    this.add(c);
    this.drones.push({ o: c, x, y, vx: fromLeft ? sp : -sp, vy: 0, life: 640 / sp + 0.5, age: 0, bomb, phase: this.h.rng() * 6 });
  }

  update(dt: number) {
    const p = this.h.inp.pointer;
    this.cross.clear();
    this.cross.lineStyle(1, 0xffffff, 0.9);
    this.cross.strokeCircle(p.x, p.y, 9);
    this.cross.lineBetween(p.x - 14, p.y, p.x - 5, p.y);
    this.cross.lineBetween(p.x + 5, p.y, p.x + 14, p.y);
    this.cross.lineBetween(p.x, p.y - 14, p.x, p.y - 5);
    this.cross.lineBetween(p.x, p.y + 5, p.x, p.y + 14);

    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawn();
      this.spawnT = (this.h.micro ? 0.35 : Math.max(0.24, 0.7 - this.h.t * 0.012 - (this.h.difficulty - 1) * 0.1)) * this.rnd(0.7, 1.3);
    }
    for (const d of [...this.drones]) {
      d.age += dt;
      d.x += d.vx * dt;
      d.y += Math.sin(d.age * 3 + d.phase) * 40 * dt;
      d.o.setPosition(d.x, d.y);
      if (d.x < -30 || d.x > 670) {
        d.o.destroy();
        this.drones.splice(this.drones.indexOf(d), 1);
      }
    }
    if (p.pressed) {
      this.h.sfx('shoot');
      const flash = this.add(this.s.add.circle(p.x, p.y, 6, 0xffffff, 0.8));
      this.s.tweens.add({ targets: flash, scale: 2.5, alpha: 0, duration: 120, onComplete: () => flash.destroy() });
      const hit = this.drones.find((d) => Math.abs(d.x - p.x) < 18 && Math.abs(d.y - p.y) < 12);
      if (hit) {
        hit.o.destroy();
        this.drones.splice(this.drones.indexOf(hit), 1);
        const boom = this.add(this.s.add.circle(hit.x, hit.y, 8, hit.bomb ? 0xff4b6e : 0xffd84b));
        this.s.tweens.add({ targets: boom, scale: 3, alpha: 0, duration: 220, onComplete: () => boom.destroy() });
        if (hit.bomb) {
          this.h.hit(hit.x, hit.y);
        } else {
          this.kills++;
          this.h.addScore(100, hit.x, hit.y - 14);
        }
      }
    }
  }

  microDone() {
    return this.kills >= 3;
  }
  microSuccess() {
    return this.kills >= 3;
  }
}
