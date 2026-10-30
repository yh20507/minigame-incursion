import Phaser from 'phaser';
import { MiniGame } from './base';

interface Bird {
  x: number;
  y: number;
  vx: number;
  vy: number;
  o: Phaser.GameObjects.Graphics;
}

/** 새떼 몰이: 새떼는 커서를 피한다. 빛나는 링 안으로 몰아넣어라. 링은 점점 작아지고 자리를 옮긴다. */
export class FlockGame extends MiniGame {
  birds: Bird[] = [];
  ring = { x: 480, y: 170, r: 80 };
  ringG!: Phaser.GameObjects.Graphics;
  inT = 0; // 링 안에 충분히 모여 있는 시간
  rounds = 0;
  label!: Phaser.GameObjects.Text;

  create() {
    const bg = this.gfx();
    bg.fillGradientStyle(0x5fa0e0, 0x5fa0e0, 0xcfe6ff, 0xcfe6ff, 1);
    bg.fillRect(0, 0, 640, 340);
    for (let i = 0; i < 6; i++) {
      bg.fillStyle(0xffffff, 0.45);
      bg.fillEllipse(this.rnd(0, 640), this.rnd(40, 320), this.rnd(80, 160), 28);
    }
    this.ringG = this.gfx();
    const n = this.h.micro ? 6 : 10;
    for (let i = 0; i < n; i++) {
      const o = this.gfx().setDepth(2);
      o.fillStyle(0xffffff, 1);
      o.fillTriangle(-6, -3, 6, 0, -6, 3);
      o.fillStyle(0x3a2a4a, 1);
      o.fillTriangle(-4, -2, 4, 0, -4, 2);
      this.birds.push({ x: this.rnd(60, 300), y: this.rnd(60, 280), vx: 0, vy: 0, o });
    }
    this.label = this.text(320, 12, '', 10, '#1d3320').setDepth(5);
    this.newRing();
  }

  newRing() {
    const d = this.h.difficulty;
    this.ring.r = Math.max(42, 85 - this.rounds * 5 - (d - 1) * 12);
    let x = 0,
      y = 0;
    do {
      x = this.rnd(90, 550);
      y = this.rnd(80, 280);
    } while (Math.hypot(x - this.ring.x, y - this.ring.y) < 160);
    this.ring.x = x;
    this.ring.y = y;
    this.inT = 0;
  }

  update(dt: number) {
    const p = this.h.inp.pointer;
    const pr = 120; // 커서 영향 반경
    const speedCap = 150 * this.ramp(0.008, 1.5);
    let inside = 0;
    for (const b of this.birds) {
      // 분리 + 결집 + 커서 회피
      let ax = 0,
        ay = 0;
      let cx = 0,
        cy = 0,
        cnt = 0;
      for (const o of this.birds) {
        if (o === b) continue;
        const dx = b.x - o.x,
          dy = b.y - o.y;
        const d = Math.hypot(dx, dy) + 0.01;
        if (d < 22) {
          ax += (dx / d) * 120;
          ay += (dy / d) * 120;
        }
        if (d < 110) {
          cx += o.x;
          cy += o.y;
          cnt++;
        }
      }
      if (cnt) {
        ax += ((cx / cnt - b.x) * 0.6);
        ay += ((cy / cnt - b.y) * 0.6);
      }
      const dx = b.x - p.x,
        dy = b.y - p.y;
      const d = Math.hypot(dx, dy) + 0.01;
      if (d < pr) {
        const f = (1 - d / pr) * 520;
        ax += (dx / d) * f;
        ay += (dy / d) * f;
      }
      // 벽
      if (b.x < 30) ax += 200;
      if (b.x > 610) ax -= 200;
      if (b.y < 30) ay += 200;
      if (b.y > 310) ay -= 200;
      // 작은 방황
      ax += Math.sin(this.h.t * 3 + b.y) * 30;
      ay += Math.cos(this.h.t * 2.5 + b.x) * 30;
      b.vx = (b.vx + ax * dt) * 0.96;
      b.vy = (b.vy + ay * dt) * 0.96;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > speedCap) {
        b.vx *= speedCap / sp;
        b.vy *= speedCap / sp;
      }
      b.x = Phaser.Math.Clamp(b.x + b.vx * dt, 10, 630);
      b.y = Phaser.Math.Clamp(b.y + b.vy * dt, 10, 330);
      b.o.setPosition(b.x, b.y).setRotation(Math.atan2(b.vy, b.vx));
      if (Math.hypot(b.x - this.ring.x, b.y - this.ring.y) < this.ring.r) inside++;
    }
    const need = Math.ceil(this.birds.length * 0.8);
    if (inside >= need) {
      this.inT += dt;
      if (this.inT >= 1.2) {
        this.rounds++;
        this.h.sfx('win');
        this.h.addScore(200 + inside * 15 + this.rounds * 20, this.ring.x, this.ring.y - this.ring.r - 10);
        this.newRing();
      }
    } else this.inT = Math.max(0, this.inT - dt * 2);
    const g = this.ringG;
    g.clear();
    g.lineStyle(4, 0xffd84b, 0.9);
    g.strokeCircle(this.ring.x, this.ring.y, this.ring.r);
    g.fillStyle(0xffd84b, 0.1 + 0.25 * Math.min(1, this.inT / 1.2));
    g.fillCircle(this.ring.x, this.ring.y, this.ring.r);
    if (this.inT > 0) {
      g.lineStyle(6, 0xffffff, 0.9);
      g.beginPath();
      g.arc(this.ring.x, this.ring.y, this.ring.r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.inT / 1.2), false);
      g.strokePath();
    }
    this.label.setText(`링 안 ${inside}/${this.birds.length} (${need} 이상 1.2초) · 몰이 ${this.rounds}`);
  }

  microDone() {
    return this.rounds >= 1;
  }
  microSuccess() {
    return this.rounds >= 1;
  }
}
