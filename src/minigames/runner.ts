import Phaser from 'phaser';
import { MiniGame, overlap } from './base';

interface Obs {
  o: Phaser.GameObjects.Container;
  x: number;
  w: number;
  top: number;
  bottom: number;
}

/** 호버보드 질주: 점프와 숙이기로 끝없이 달리기 */
export class RunnerGame extends MiniGame {
  ground = 290;
  pl!: Phaser.GameObjects.Image;
  board!: Phaser.GameObjects.Rectangle;
  glow!: Phaser.GameObjects.Rectangle;
  vy = 0;
  onGround = true;
  ducking = false;
  obs: Obs[] = [];
  spawnT = 1.0;
  acc = 0;
  spawned = 0;
  bld: Phaser.GameObjects.Rectangle[] = [];
  lines: Phaser.GameObjects.Rectangle[] = [];
  px = 110;

  create() {
    for (let i = 0; i < 12; i++) {
      const h = 60 + ((i * 37) % 90);
      const b = this.rect(i * 60, this.ground - h, 50, h, i % 2 ? 0x1f1538 : 0x24183f).setOrigin(0);
      this.bld.push(b);
    }
    this.rect(0, this.ground, 640, 60, 0x0b0818).setOrigin(0);
    this.rect(0, this.ground, 640, 2, 0xff4fa8).setOrigin(0);
    for (let k = 0; k < 10; k++) this.lines.push(this.rect(k * 70, this.ground + 20, 30, 2, 0x5fd3e0, 0.6).setOrigin(0));
    this.glow = this.rect(this.px, this.ground - 2, 46, 4, 0x5fd3e0, 0.5);
    this.board = this.rect(this.px, this.ground - 6, 44, 6, 0xff4fa8).setStrokeStyle(1, 0x0d0a16);
    this.pl = this.player(this.px, this.ground - 8, 42);
  }

  speed() {
    return 270 * this.ramp(0.02, 2.1);
  }

  spawn() {
    const overhead = (this.h.t > 6 || this.h.difficulty > 1 || this.h.micro) && this.h.rng() < 0.35;
    const c = this.s.add.container(670, 0);
    const g = this.s.add.graphics();
    let w: number, top: number, bottom: number;
    if (overhead) {
      w = 56;
      bottom = this.ground - 30;
      top = bottom - 26;
      g.fillStyle(0x0d0a16);
      g.fillRect(-w / 2 - 1, top - 1, w + 2, 28);
      g.fillStyle(0x5fd3e0);
      g.fillRect(-w / 2, top, w, 26);
      g.fillStyle(0x0d0a16);
      g.fillRect(-w / 2 + 6, top + 8, w - 12, 3);
      g.fillRect(-w / 2 + 6, top + 15, w - 24, 3);
      g.fillStyle(0x5a4a6a);
      g.fillRect(-2, 0, 4, top);
    } else {
      const tall = this.h.rng() < 0.4;
      w = tall ? 22 : 34;
      const hh = tall ? 40 : 22;
      top = this.ground - hh;
      bottom = this.ground;
      g.fillStyle(0x0d0a16);
      g.fillRect(-w / 2 - 1, top - 1, w + 2, hh + 1);
      g.fillStyle(0xffd84b);
      g.fillRect(-w / 2, top, w, hh);
      g.fillStyle(0x0d0a16);
      for (let k = -w / 2; k < w / 2; k += 10) g.fillRect(k, top + 4, 5, hh - 4);
    }
    c.add(g);
    this.add(c);
    this.obs.push({ o: c, x: 670, w, top, bottom });
    this.spawned++;
  }

  update(dt: number) {
    const i = this.h.inp;
    const sp = this.speed();
    this.ducking = i.down && this.onGround;
    if ((i.actionP || i.upP) && this.onGround) {
      this.vy = -500;
      this.onGround = false;
      this.h.sfx('jump');
    }
    if (!(i.action || i.up) && this.vy < -200) this.vy = -200;
    if (i.down && !this.onGround) this.vy += 2400 * dt; // 빠른 착지
    this.vy += 1500 * dt;
    let y = this.pl.y + this.vy * dt;
    const floor = this.ground - 8;
    if (y >= floor) {
      y = floor;
      if (!this.onGround) this.squash(this.pl);
      this.vy = 0;
      this.onGround = true;
    }
    this.pl.y = y;
    const base = (this.pl as any).baseScale;
    if (this.ducking) this.pl.setScale(base * 1.2, base * 0.55);
    else if (!this.s.tweens.isTweening(this.pl)) this.pl.setScale(base);
    this.board.y = y + 2;
    this.glow.y = this.ground - 2;
    this.glow.setAlpha(0.3 + Math.random() * 0.3);

    this.bld.forEach((b) => {
      b.x -= sp * 0.3 * dt;
      if (b.x < -60) b.x += 720;
    });
    this.lines.forEach((l) => {
      l.x -= sp * dt;
      if (l.x < -40) l.x += 700;
    });

    this.acc += sp * dt * 0.2;
    if (this.acc >= 10) {
      const n = Math.floor(this.acc / 10) * 10;
      this.acc -= n;
      this.h.addScore(n);
    }

    this.spawnT -= dt;
    const limit = this.h.micro ? 2 : Infinity;
    if (this.spawnT <= 0 && this.spawned < limit) {
      this.spawn();
      this.spawnT = this.h.micro ? 1.6 : this.rnd(0.8, 1.6) * Math.max(0.6, 1 - this.h.t * 0.008);
    }
    const hH = this.ducking ? 20 : 36;
    const pb = { x: this.px - 12, y: y - hH, w: 24, h: hH };
    for (const o of [...this.obs]) {
      o.x -= sp * dt;
      o.o.x = o.x;
      if (overlap(pb, { x: o.x - o.w / 2 + 3, y: o.top + 2, w: o.w - 6, h: o.bottom - o.top - 2 })) {
        const alive = this.h.hit(o.x, o.top);
        o.o.destroy();
        this.obs.splice(this.obs.indexOf(o), 1);
        if (!alive) return;
        continue;
      }
      if (o.x < -40) {
        o.o.destroy();
        this.obs.splice(this.obs.indexOf(o), 1);
      }
    }
    void Phaser;
  }
}
