import Phaser from 'phaser';
import { MiniGame } from './base';

interface Ice {
  o: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vy: number;
  warn: number; // 경고 시간 (떨어지기 전)
  flake: boolean;
  w: number;
}

/** 고드름 시간정지: 좌우 이동으로 고드름을 피하고, 스페이스를 누르는 동안 세상이 느려진다 (게이지). 눈꽃은 점수. */
export class IcicleGame extends MiniGame {
  px = 320;
  pl!: Phaser.GameObjects.Image;
  items: Ice[] = [];
  spawnT = 0.6;
  gauge = 1;
  slow = false;
  ui!: Phaser.GameObjects.Graphics;
  flakes = 0;
  readonly floorY = 300;

  create() {
    const g = this.gfx();
    g.fillStyle(0x1b2838, 1);
    g.fillRect(0, this.floorY, 640, 40);
    g.fillStyle(0xdbeeff, 1);
    g.fillRect(0, this.floorY, 640, 4);
    // 천장 얼음
    g.fillStyle(0x2a3f5c, 1);
    g.fillRect(0, 0, 640, 14);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(0x9fe0ff, 0.5);
      g.fillTriangle(i * 16, 14, i * 16 + 8, 14, i * 16 + 4, 22 + (i % 3) * 4);
    }
    this.pl = this.player(this.px, this.floorY, 40);
    this.ui = this.gfx().setDepth(5);
  }

  spawn() {
    const flake = this.h.rng() < 0.3;
    const x = this.rnd(20, 620);
    const o = this.gfx();
    const w = flake ? 10 : this.rnd(10, 18);
    if (flake) {
      o.fillStyle(0xffffff, 1);
      o.fillCircle(0, 0, 4);
      o.lineStyle(1, 0x9fe0ff, 1);
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3;
        o.lineBetween(-Math.cos(a) * 7, -Math.sin(a) * 7, Math.cos(a) * 7, Math.sin(a) * 7);
      }
    } else {
      o.fillStyle(0xcfe9ff, 1);
      o.fillTriangle(-w / 2, -10, w / 2, -10, 0, 26);
      o.fillStyle(0xffffff, 0.8);
      o.fillRect(-w / 4, -6, 2, 14);
    }
    o.setPosition(x, flake ? -10 : 18);
    this.add(o);
    this.items.push({ o, x, y: flake ? -10 : 18, vy: 0, warn: flake ? 0 : 0.55, flake, w });
  }

  update(dt: number) {
    const inp = this.h.inp;
    const ramp = this.ramp(0.018, 2.4);
    // 시간 정지 게이지
    this.slow = (inp.action || inp.pointer.down) && this.gauge > 0;
    if (this.slow) this.gauge = Math.max(0, this.gauge - dt * 0.45);
    else this.gauge = Math.min(1, this.gauge + dt * 0.22);
    const wdt = this.slow ? dt * 0.3 : dt;
    // 이동 (플레이어는 느려지지 않는다)
    const sp = 230;
    if (inp.left) this.px -= sp * dt;
    if (inp.right) this.px += sp * dt;
    if (inp.pointer.down && !this.slow) this.px += Math.sign(inp.pointer.x - this.px) * Math.min(sp * dt, Math.abs(inp.pointer.x - this.px));
    this.px = Phaser.Math.Clamp(this.px, 16, 624);
    this.pl.x = this.px;
    this.pl.setFlipX(inp.left && !inp.right);

    this.spawnT -= wdt;
    if (this.spawnT <= 0) {
      this.spawn();
      this.spawnT = (this.h.micro ? 0.45 : Math.max(0.22, 0.75 / ramp)) * this.rnd(0.7, 1.3);
    }
    for (const it of [...this.items]) {
      if (it.warn > 0) {
        it.warn -= wdt;
        it.o.setAlpha(0.4 + 0.6 * Math.abs(Math.sin(it.warn * 25)));
        if (it.warn <= 0) it.o.setAlpha(1);
        continue;
      }
      it.vy += (it.flake ? 60 : 520) * wdt;
      if (it.flake) it.vy = Math.min(it.vy, 70);
      it.y += it.vy * wdt * (it.flake ? 1 : ramp * 0.6 + 0.4);
      it.x += it.flake ? Math.sin(this.h.t * 2 + it.w) * 20 * wdt : 0;
      it.o.setPosition(it.x, it.y);
      // 플레이어 충돌
      const dx = Math.abs(it.x - this.px);
      const dy = this.floorY - it.y;
      if (dx < (it.flake ? 18 : it.w / 2 + 10) && dy < 36 && dy > -6) {
        it.o.destroy();
        this.items.splice(this.items.indexOf(it), 1);
        if (it.flake) {
          this.flakes++;
          this.h.sfx('coin');
          this.h.addScore(50, it.x, it.y - 10);
        } else this.h.hit(it.x, it.y);
        continue;
      }
      if (it.y > this.floorY + 10) {
        if (!it.flake) {
          this.h.sfx('tick');
          this.h.addScore(10, it.x, this.floorY - 10);
          const sh = this.add(this.s.add.rectangle(it.x, this.floorY, it.w + 6, 6, 0xcfe9ff));
          this.s.tweens.add({ targets: sh, alpha: 0, scaleX: 2, duration: 250, onComplete: () => sh.destroy() });
        }
        it.o.destroy();
        this.items.splice(this.items.indexOf(it), 1);
      }
    }
    // 게이지 UI
    const g = this.ui;
    g.clear();
    g.fillStyle(0x0b0918, 0.8);
    g.fillRect(8, 24, 120, 10);
    g.fillStyle(this.slow ? 0xffffff : 0x9fe0ff, 1);
    g.fillRect(9, 25, 118 * this.gauge, 8);
    if (this.slow) {
      g.fillStyle(0x9fe0ff, 0.08);
      g.fillRect(0, 0, 640, 340);
    }
  }

  microDone() {
    return this.flakes >= 2;
  }
}
