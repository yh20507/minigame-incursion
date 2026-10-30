import Phaser from 'phaser';
import { MiniGame } from './base';

interface Treasure {
  x: number;
  y: number;
  found: boolean;
  o: Phaser.GameObjects.Graphics;
}

/** 소나 탐지: 캄캄한 바다. 핑(스페이스)을 쏘면 파문이 퍼지며 보물이 잠깐 보인다. 기억해서 클릭. 핑은 횟수 제한. */
export class SonarGame extends MiniGame {
  treasures: Treasure[] = [];
  pings = 3;
  ring: { r: number; alive: boolean } | null = null;
  ringG!: Phaser.GameObjects.Graphics;
  dark!: Phaser.GameObjects.Graphics;
  round = 0;
  found = 0;
  misses = 0;
  label!: Phaser.GameObjects.Text;
  px = 320;
  py = 170;
  readonly reveal = 1.1; // 파문이 지나간 뒤 보이는 시간

  create() {
    const g = this.gfx();
    g.fillStyle(0x061a22, 1);
    g.fillRect(0, 0, 640, 340);
    // 해저 바닥
    g.fillStyle(0x0b2a30, 1);
    g.fillRect(0, 300, 640, 40);
    for (let i = 0; i < 14; i++) {
      g.fillStyle(0x12474a, 1);
      g.fillRect(i * 48 + 6, 284 + (i % 3) * 5, 10, 16 - (i % 3) * 5);
    }
    this.ringG = this.gfx().setDepth(3);
    this.player(this.px, this.py + 20, 34).setDepth(4);
    this.label = this.text(320, 12, '', 10, '#4fd1c5').setDepth(6);
    this.newRound();
  }

  newRound() {
    for (const t of this.treasures) t.o.destroy();
    this.treasures = [];
    const n = this.h.micro ? 2 : Math.min(6, 3 + Math.floor(this.round / 2) + Math.round((this.h.difficulty - 1)));
    for (let i = 0; i < n; i++) {
      let x = 0,
        y = 0,
        ok = false;
      for (let k = 0; k < 30 && !ok; k++) {
        x = this.rnd(30, 610);
        y = this.rnd(40, 280);
        ok = Math.hypot(x - this.px, y - this.py) > 50 && this.treasures.every((t) => Math.hypot(t.x - x, t.y - y) > 44);
      }
      const o = this.gfx().setAlpha(0).setDepth(2);
      o.fillStyle(0xffd84b, 1);
      o.fillRect(x - 9, y - 6, 18, 12);
      o.fillStyle(0xb8860b, 1);
      o.fillRect(x - 9, y - 1, 18, 2);
      o.fillStyle(0x4fd1c5, 1);
      o.fillCircle(x, y - 6, 3);
      this.treasures.push({ x, y, found: false, o });
    }
    this.pings = this.h.micro ? 1 : Math.max(1, 3 - Math.floor(this.round / 3));
    this.misses = 0;
    this.round++;
  }

  update(dt: number) {
    const inp = this.h.inp;
    const p = inp.pointer;
    // 핑
    if ((inp.actionP || (p.pressed && this.pings > 0 && Math.hypot(p.x - this.px, p.y - this.py) < 26)) && this.pings > 0 && !this.ring) {
      this.pings--;
      this.ring = { r: 0, alive: true };
      this.h.sfx('select');
    }
    this.ringG.clear();
    if (this.ring) {
      this.ring.r += 260 * dt;
      this.ringG.lineStyle(3, 0x4fd1c5, 0.9);
      this.ringG.strokeCircle(this.px, this.py, this.ring.r);
      this.ringG.lineStyle(1, 0x4fd1c5, 0.4);
      this.ringG.strokeCircle(this.px, this.py, this.ring.r * 0.7);
      for (const t of this.treasures) {
        if (t.found) continue;
        const d = Math.hypot(t.x - this.px, t.y - this.py);
        if (d < this.ring.r && d > this.ring.r - 40) {
          t.o.setAlpha(1);
          this.s.tweens.add({ targets: t.o, alpha: 0, duration: this.reveal * 1000 * (this.h.difficulty > 1.5 ? 0.6 : 1), ease: 'Quad.In' });
        }
      }
      if (this.ring.r > 720) this.ring = null;
    }
    // 클릭으로 지목
    if (p.pressed && !(Math.hypot(p.x - this.px, p.y - this.py) < 26)) {
      const hit = this.treasures.find((t) => !t.found && Math.hypot(t.x - p.x, t.y - p.y) < 22);
      if (hit) {
        hit.found = true;
        hit.o.setAlpha(1);
        this.s.tweens.killTweensOf(hit.o);
        this.found++;
        this.h.sfx('coin');
        this.h.addScore(120 + this.round * 10, hit.x, hit.y - 14);
        const glow = this.add(this.s.add.circle(hit.x, hit.y, 10, 0xffd84b, 0.6));
        this.s.tweens.add({ targets: glow, scale: 3, alpha: 0, duration: 400, onComplete: () => glow.destroy() });
        if (this.treasures.every((t) => t.found)) {
          this.h.addScore(100, 320, 60);
          this.h.float('전부 찾음!', 320, 40, '#4fd1c5');
          this.s.time.delayedCall(500, () => !this.finished && this.newRound());
        }
      } else {
        this.misses++;
        this.h.sfx('bad');
        this.h.float('빈 바다', p.x, p.y - 10, '#ff4b6e');
        this.h.addTime(-1.5);
        const x = this.add(this.s.add.circle(p.x, p.y, 4, 0xff4b6e, 0.8));
        this.s.tweens.add({ targets: x, alpha: 0, scale: 2, duration: 300, onComplete: () => x.destroy() });
        if (this.misses >= 3) {
          this.misses = 0;
          this.h.hit(p.x, p.y);
        }
      }
    }
    this.label.setText(`핑 ${this.pings} · 보물 ${this.treasures.filter((t) => t.found).length}/${this.treasures.length} · 스페이스: 핑`);
  }

  microDone() {
    return this.found >= 2;
  }
  microSuccess() {
    return this.found >= 2;
  }
}
