import Phaser from 'phaser';
import { MiniGame, overlap } from './base';

interface Obs {
  o: Phaser.GameObjects.Container;
  x: number;
  w: number;
  h: number;
  passed: boolean;
  spin: boolean;
}

/** 성벽 뛰어넘기: 굴러오는 통과 바위를 점프로 넘는다 */
export class JumpGame extends MiniGame {
  ground = 292;
  pl!: Phaser.GameObjects.Image;
  vy = 0;
  onGround = true;
  obs: Obs[] = [];
  spawnT = 1.2;
  spawned = 0;
  walls: Phaser.GameObjects.Rectangle[] = [];

  create() {
    const s = this.s;
    // 먼 성벽 (시차 스크롤)
    for (let i = 0; i < 8; i++) {
      const w = this.rect(i * 100, this.ground - 60 - (i % 3) * 18, 70, 140, 0x2a2230).setOrigin(0, 0);
      this.walls.push(w);
    }
    this.rect(0, this.ground, 640, 60, 0x1d1820).setOrigin(0);
    this.rect(0, this.ground, 640, 2, 0x6b5a4a).setOrigin(0);
    for (let x = 0; x < 640; x += 32) this.rect(x, this.ground + 10, 14, 2, 0x2f2730).setOrigin(0);
    this.pl = this.player(120, this.ground, 44);
    if (this.h.micro) this.spawnT = 1.1;
    void s;
  }

  speed() {
    return 240 * this.ramp(0.018, 2.0);
  }

  spawn() {
    const s = this.s;
    const r = this.h.rng();
    const tall = this.h.t > 14 && r < 0.25;
    const barrel = !tall && r < 0.6;
    const w = tall ? 14 : barrel ? 24 : 30;
    const hgt = tall ? 40 : barrel ? 24 : 20;
    const c = s.add.container(660, this.ground);
    const g = s.add.graphics();
    if (barrel) {
      g.fillStyle(0x8a5a2b);
      g.fillCircle(0, -12, 12);
      g.fillStyle(0x5a3a1b);
      g.fillRect(-12, -14, 24, 3);
      g.fillRect(-2, -24, 3, 24);
      g.lineStyle(1, 0x0d0a16);
      g.strokeCircle(0, -12, 12);
      c.setData('r', true);
    } else if (tall) {
      g.fillStyle(0x6b6470);
      g.fillRect(-7, -40, 14, 40);
      g.fillStyle(0x9a93a0);
      g.fillTriangle(-7, -40, 7, -40, 0, -48);
      g.lineStyle(1, 0x0d0a16);
      g.strokeRect(-7, -40, 14, 40);
    } else {
      g.fillStyle(0x7a7080);
      g.fillRect(-15, -20, 30, 20);
      g.fillStyle(0x9a93a0);
      g.fillRect(-11, -18, 10, 6);
      g.lineStyle(1, 0x0d0a16);
      g.strokeRect(-15, -20, 30, 20);
    }
    c.add(g);
    this.add(c);
    this.obs.push({ o: c, x: 660, w, h: hgt, passed: false, spin: barrel });
    this.spawned++;
  }

  update(dt: number) {
    const i = this.h.inp;
    const sp = this.speed();
    if ((i.actionP || i.upP) && this.onGround) {
      this.vy = -540;
      this.onGround = false;
      this.h.sfx('jump');
      this.squash(this.pl, 0.8, 1.25);
    }
    if (!(i.action || i.up) && this.vy < -220) this.vy = -220;
    this.vy += 1600 * dt;
    this.pl.y += this.vy * dt;
    if (this.pl.y >= this.ground) {
      this.pl.y = this.ground;
      if (!this.onGround) this.squash(this.pl);
      this.vy = 0;
      this.onGround = true;
    }
    this.pl.angle = this.onGround ? Math.sin(this.h.t * 18) * 3 : -8;

    this.walls.forEach((w) => {
      w.x -= sp * 0.25 * dt;
      if (w.x < -80) w.x += 800;
    });

    this.spawnT -= dt;
    const limit = this.h.micro ? 1 : Infinity;
    if (this.spawnT <= 0 && this.spawned < limit) {
      this.spawn();
      const gap = this.rnd(0.75, 1.5) * Math.max(0.55, 1 - this.h.t * 0.008);
      this.spawnT = gap;
      if (this.h.rng() < Math.min(0.3, this.h.t * 0.01)) this.spawnT = 0.32; // 연속 장애물
    }

    const pb = { x: this.pl.x - 13, y: this.pl.y - 36, w: 26, h: 34 };
    for (const o of [...this.obs]) {
      o.x -= sp * dt;
      o.o.x = o.x;
      if (o.spin) o.o.angle -= sp * dt * 2;
      const ob = { x: o.x - o.w / 2 + 3, y: this.ground - o.h + 3, w: o.w - 6, h: o.h - 3 };
      if (overlap(pb, ob)) {
        const alive = this.h.hit(o.x, this.ground - o.h);
        o.o.destroy();
        this.obs.splice(this.obs.indexOf(o), 1);
        if (!alive) return;
        continue;
      }
      if (!o.passed && o.x < this.pl.x - 20) {
        o.passed = true;
        this.h.addScore(100, o.x, this.ground - 40);
      }
      if (o.x < -40) {
        o.o.destroy();
        this.obs.splice(this.obs.indexOf(o), 1);
      }
    }
  }

  microSuccess() {
    return this.obs.length === 0 || this.obs.every((o) => o.passed);
  }
}
