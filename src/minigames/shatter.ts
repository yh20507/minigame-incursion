import Phaser from 'phaser';
import { MiniGame } from './base';

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  col: number; // 0~3, -1 검은 구슬
  o: Phaser.GameObjects.Arc;
  r: number;
}
const COLS = [0xf2c4ff, 0x4fd1c5, 0xffd84b, 0xff9ad5];

/** 유리 깨기: 떠다니는 유리구슬을 클릭해 깨라. 같은 색을 연속으로 깨면 연쇄 배율. 검은 구슬은 피격. */
export class ShatterGame extends MiniGame {
  orbs: Orb[] = [];
  spawnT = 0.3;
  lastCol = -2;
  chain = 0;
  broken = 0;
  label!: Phaser.GameObjects.Text;

  create() {
    const bg = this.gfx();
    bg.fillGradientStyle(0x2e1f36, 0x2e1f36, 0x5a3f6e, 0x5a3f6e, 1);
    bg.fillRect(0, 0, 640, 340);
    bg.fillStyle(0xf2c4ff, 0.12);
    bg.fillRect(0, 300, 640, 40);
    this.player(320, 338, 36);
    this.label = this.text(320, 12, '', 10, '#f2c4ff');
  }

  spawn() {
    const d = this.h.difficulty;
    const black = this.h.rng() < Math.min(0.22, 0.08 + this.h.t * 0.003 + (d - 1) * 0.06);
    const col = black ? -1 : Math.floor(this.h.rng() * (this.h.t > 20 || d > 1.5 ? 4 : 3));
    const r = this.rnd(12, 20);
    const x = this.rnd(30, 610);
    const o = this.add(this.s.add.circle(x, 360, r, black ? 0x111118 : COLS[col], 0.9));
    o.setStrokeStyle(2, 0xffffff, black ? 0.3 : 0.8);
    this.orbs.push({ x, y: 360, vx: this.rnd(-30, 30), vy: -this.rnd(70, 120) * this.ramp(0.012, 1.8), col, o, r });
  }

  update(dt: number) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawn();
      this.spawnT = (this.h.micro ? 0.3 : Math.max(0.22, 0.6 / this.ramp(0.015, 2.2))) * this.rnd(0.7, 1.3);
    }
    for (const ob of [...this.orbs]) {
      ob.vy += 20 * dt; // 아주 약한 중력 → 포물선
      ob.x += ob.vx * dt;
      ob.y += ob.vy * dt;
      ob.o.setPosition(ob.x, ob.y);
      if (ob.y > 380 || ob.x < -30 || ob.x > 670) {
        ob.o.destroy();
        this.orbs.splice(this.orbs.indexOf(ob), 1);
        if (ob.col >= 0 && ob.y > 380 && ob.vy > 0) {
          // 색 구슬을 놓침 → 연쇄 끊김
          this.chain = 0;
        }
      }
    }
    const p = this.h.inp.pointer;
    if (p.pressed) {
      const hit = this.orbs.find((ob) => Math.hypot(ob.x - p.x, ob.y - p.y) < ob.r + 6);
      if (hit) {
        hit.o.destroy();
        this.orbs.splice(this.orbs.indexOf(hit), 1);
        // 파편
        for (let k = 0; k < 6; k++) {
          const sh = this.add(this.s.add.rectangle(hit.x, hit.y, 5, 5, hit.col < 0 ? 0x333344 : COLS[hit.col]));
          const a = (k / 6) * Math.PI * 2;
          this.s.tweens.add({ targets: sh, x: hit.x + Math.cos(a) * 40, y: hit.y + Math.sin(a) * 40, alpha: 0, angle: 180, duration: 350, onComplete: () => sh.destroy() });
        }
        if (hit.col < 0) {
          this.chain = 0;
          this.lastCol = -2;
          this.h.hit(hit.x, hit.y);
        } else {
          this.broken++;
          if (hit.col === this.lastCol) this.chain++;
          else this.chain = 1;
          this.lastCol = hit.col;
          const mult = Math.min(5, this.chain);
          this.h.sfx(this.chain >= 3 ? 'good' : 'select');
          this.h.addScore(40 * mult, hit.x, hit.y - 16);
          if (this.chain >= 3) this.h.float(`연쇄 ×${mult}`, hit.x, hit.y - 34, '#ffe08a');
          // 연쇄 3 이상이면 같은 색 주변 구슬도 터짐
          if (this.chain >= 3) {
            for (const ob of [...this.orbs]) {
              if (ob.col === hit.col && Math.hypot(ob.x - hit.x, ob.y - hit.y) < 90) {
                ob.o.destroy();
                this.orbs.splice(this.orbs.indexOf(ob), 1);
                this.broken++;
                this.h.addScore(30, ob.x, ob.y - 10);
              }
            }
          }
        }
      }
    }
    this.label.setText(`깬 구슬 ${this.broken} · 연쇄 ${this.chain} · 검은 구슬 주의`);
  }

  microDone() {
    return this.broken >= 4;
  }
  microSuccess() {
    return this.broken >= 4;
  }
}
