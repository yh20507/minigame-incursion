import Phaser from 'phaser';
import { MiniGame } from './base';

interface Ship {
  o: Phaser.GameObjects.Container;
  ang: number; // 등대 기준 각도
  dist: number; // 등대까지 거리
  speed: number;
  lit: number; // 빛을 받은 누적 시간
  side: number; // 암초를 피해 가는 방향 (-1/1)
  done: boolean;
}

/** 등대 돌리기: 빛줄기를 ←→로 돌려 다가오는 배를 비춰라. 비춘 배는 암초를 피해 항구로, 못 비춘 배는 좌초(목숨). 여러 척이면 빛을 나눠 써야 한다. */
export class LighthouseGame extends MiniGame {
  beam = -Math.PI / 2; // 위쪽
  beamW = 0.42;
  ships: Ship[] = [];
  spawnT = 1;
  g!: Phaser.GameObjects.Graphics;
  saved = 0;
  readonly cx = 320;
  readonly cy = 300;

  create() {
    const bg = this.gfx();
    bg.fillStyle(0x071d26, 1);
    bg.fillRect(0, 0, 640, 340);
    // 암초들
    bg.fillStyle(0x0d3b40, 1);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI + (i + 0.5) * (Math.PI / 9);
      const r = 150;
      bg.fillCircle(this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r, 9);
    }
    // 등대
    bg.fillStyle(0xe8f4ff, 1);
    bg.fillRect(this.cx - 8, this.cy - 40, 16, 40);
    bg.fillStyle(0xff4b6e, 1);
    bg.fillRect(this.cx - 8, this.cy - 40, 16, 8);
    bg.fillRect(this.cx - 8, this.cy - 24, 16, 8);
    bg.fillStyle(0x0b2a30, 1);
    bg.fillRect(0, this.cy, 640, 40);
    this.g = this.gfx().setDepth(2);
    this.text(320, 12, '← →: 빛줄기 회전 · 배를 비추면 암초를 피한다', 10, '#4fd1c5').setDepth(5);
  }

  spawn() {
    const ang = -Math.PI + this.rnd(0.25, Math.PI - 0.25); // 위쪽 반원
    const c = this.s.add.container(0, 0);
    const g = this.s.add.graphics();
    g.fillStyle(0x3b2a22, 1);
    g.fillRect(-12, -3, 24, 7);
    g.fillStyle(0xe8f4ff, 1);
    g.fillTriangle(-2, -4, -2, -20, 10, -4);
    g.fillStyle(0xffd84b, 1);
    g.fillRect(-10, -5, 3, 3);
    c.add(g);
    this.add(c);
    this.ships.push({ o: c, ang, dist: 330, speed: this.rnd(28, 40) * this.ramp(0.012, 1.8), lit: 0, side: this.h.rng() < 0.5 ? -1 : 1, done: false });
  }

  update(dt: number) {
    const inp = this.h.inp;
    const rot = 2.4;
    if (inp.left) this.beam -= rot * dt;
    if (inp.right) this.beam += rot * dt;
    if (inp.pointer.down) {
      const want = Math.atan2(inp.pointer.y - this.cy, inp.pointer.x - this.cx);
      let d = want - this.beam;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.beam += Phaser.Math.Clamp(d, -rot * dt, rot * dt);
    }
    this.beam = Phaser.Math.Clamp(this.beam, -Math.PI + 0.1, -0.1);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawn();
      this.spawnT = (this.h.micro ? 1.2 : Math.max(1.1, 3.2 - this.h.t * 0.04 - (this.h.difficulty - 1) * 0.6)) * this.rnd(0.8, 1.2);
    }
    for (const sh of [...this.ships]) {
      let ad = Math.abs(sh.ang - this.beam);
      if (ad > Math.PI) ad = Math.PI * 2 - ad;
      const inBeam = ad < this.beamW / 2;
      if (inBeam) sh.lit += dt;
      sh.dist -= sh.speed * dt;
      // 암초 지대(거리 150)에 닿으면 판정: 충분히 비췄으면 피해 감
      if (!sh.done && sh.dist <= 160) {
        sh.done = true;
        if (sh.lit >= 0.9 || inBeam) {
          this.saved++;
          this.h.sfx('good');
          const x = this.cx + Math.cos(sh.ang) * sh.dist;
          const y = this.cy + Math.sin(sh.ang) * sh.dist;
          this.h.addScore(100 + Math.round(sh.lit * 30), x, y - 20);
          this.s.tweens.add({ targets: sh.o, x: sh.side * 420, y: 60, alpha: 0, duration: 900, onComplete: () => sh.o.destroy() });
          this.ships.splice(this.ships.indexOf(sh), 1);
          continue;
        } else {
          const x = this.cx + Math.cos(sh.ang) * sh.dist;
          const y = this.cy + Math.sin(sh.ang) * sh.dist;
          this.h.hit(x, y);
          this.h.float('좌초!', x, y - 20, '#ff4b6e');
          sh.o.destroy();
          this.ships.splice(this.ships.indexOf(sh), 1);
          continue;
        }
      }
      sh.o.setPosition(this.cx + Math.cos(sh.ang) * sh.dist, this.cy + Math.sin(sh.ang) * sh.dist);
      sh.o.setAlpha(inBeam ? 1 : 0.35 + Math.min(0.4, sh.lit * 0.3));
    }
    // 빛줄기
    const g = this.g;
    g.clear();
    g.fillStyle(0xfff2b0, 0.22);
    g.slice(this.cx, this.cy - 36, 420, this.beam - this.beamW / 2, this.beam + this.beamW / 2, false);
    g.fillPath();
    g.fillStyle(0xffffff, 0.12);
    g.slice(this.cx, this.cy - 36, 420, this.beam - this.beamW / 6, this.beam + this.beamW / 6, false);
    g.fillPath();
  }

  microDone() {
    return this.saved >= 1;
  }
  microSuccess() {
    return this.saved >= 1;
  }
}
