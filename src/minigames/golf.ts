import Phaser from 'phaser';
import { MiniGame } from './base';

interface Planet {
  x: number;
  y: number;
  r: number;
  mass: number;
  hole: boolean; // 블랙홀
  o: Phaser.GameObjects.Graphics;
}

/** 중력 골프: 드래그해서 방향·세기 → 놓으면 발사. 행성 중력을 타고 구멍(깃발)에 넣어라. 적게 칠수록 고득점, 블랙홀은 피격. */
export class GolfGame extends MiniGame {
  planets: Planet[] = [];
  ball = { x: 80, y: 280, vx: 0, vy: 0, moving: false };
  ballG!: Phaser.GameObjects.Graphics;
  hole = { x: 560, y: 80 };
  holeG!: Phaser.GameObjects.Graphics;
  aim!: Phaser.GameObjects.Graphics;
  dragging = false;
  dragStart: [number, number] | null = null;
  strokes = 0;
  holes = 0;
  label!: Phaser.GameObjects.Text;
  trail: Phaser.GameObjects.Arc[] = [];
  stillT = 0;
  flyT = 0; // 이번 샷 비행 시간
  streak = 0; // 연속으로 2타 이내에 넣은 홀 수

  create() {
    const bg = this.gfx();
    bg.fillGradientStyle(0x0a0a1e, 0x0a0a1e, 0x1a1040, 0x1a1040, 1);
    bg.fillRect(0, 0, 640, 340);
    for (let i = 0; i < 70; i++) {
      bg.fillStyle(0xffffff, this.rnd(0.2, 0.8));
      bg.fillRect(this.rnd(0, 640), this.rnd(0, 340), 1, 1);
    }
    this.holeG = this.gfx();
    this.ballG = this.gfx().setDepth(3);
    this.aim = this.gfx().setDepth(2);
    this.label = this.text(320, 12, '', 10, '#b48cff');
    this.course();
  }

  course() {
    for (const p of this.planets) p.o.destroy();
    this.planets = [];
    const d = this.h.difficulty;
    const n = Math.min(5, 2 + Math.floor(this.holes / 2) + Math.round((d - 1) * 2));
    this.ball = { x: 70, y: this.rnd(220, 300), vx: 0, vy: 0, moving: false };
    this.hole = { x: this.rnd(500, 600), y: this.rnd(50, 150) };
    for (let i = 0; i < n; i++) {
      let x = 0,
        y = 0,
        ok = false;
      for (let k = 0; k < 30 && !ok; k++) {
        x = this.rnd(160, 480);
        y = this.rnd(50, 300);
        ok = Math.hypot(x - this.ball.x, y - this.ball.y) > 90 && Math.hypot(x - this.hole.x, y - this.hole.y) > 80 && this.planets.every((p) => Math.hypot(p.x - x, p.y - y) > 80);
      }
      const hole = i > 0 && this.h.rng() < 0.25 + (d - 1) * 0.15;
      const r = hole ? 12 : this.rnd(14, 26);
      const o = this.gfx();
      if (hole) {
        o.fillStyle(0x000000, 1);
        o.fillCircle(x, y, r);
        o.lineStyle(3, 0xb48cff, 0.8);
        o.strokeCircle(x, y, r + 4);
        o.lineStyle(1, 0xb48cff, 0.3);
        o.strokeCircle(x, y, r + 14);
      } else {
        const cols = [0xd9a066, 0x5fd3e0, 0x7fd37a, 0xff9ad5];
        o.fillStyle(cols[i % cols.length], 1);
        o.fillCircle(x, y, r);
        o.fillStyle(0xffffff, 0.2);
        o.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.4);
        if (i % 2 === 0) {
          o.lineStyle(2, 0xffffff, 0.3);
          o.strokeEllipse(x, y, r * 2.8, r * 0.8);
        }
      }
      this.planets.push({ x, y, r, mass: hole ? 2600 : r * 90, hole, o });
    }
    this.strokes = 0;
    const g = this.holeG;
    g.clear();
    g.fillStyle(0x0b0918, 1);
    g.fillCircle(this.hole.x, this.hole.y, 9);
    g.lineStyle(2, 0xffd84b, 1);
    g.strokeCircle(this.hole.x, this.hole.y, 9);
    g.fillStyle(0xffd84b, 1);
    g.fillRect(this.hole.x - 1, this.hole.y - 30, 2, 30);
    g.fillTriangle(this.hole.x + 1, this.hole.y - 30, this.hole.x + 16, this.hole.y - 25, this.hole.x + 1, this.hole.y - 20);
  }

  update(dt: number) {
    const p = this.h.inp.pointer;
    const b = this.ball;
    if (!b.moving) {
      if (p.pressed && Math.hypot(p.x - b.x, p.y - b.y) < 40) {
        this.dragging = true;
        this.dragStart = [p.x, p.y];
      }
      if (this.dragging && p.released) {
        this.dragging = false;
        const dx = this.dragStart![0] - p.x,
          dy = this.dragStart![1] - p.y;
        const d = Math.min(140, Math.hypot(dx, dy));
        if (d > 8) {
          const pw = d * 3.6;
          b.vx = (dx / Math.hypot(dx, dy)) * pw;
          b.vy = (dy / Math.hypot(dx, dy)) * pw;
          b.moving = true;
          this.strokes++;
          this.stillT = 0;
          this.flyT = 0;
          this.h.sfx('throw');
        }
      }
    } else {
      // 중력 적분 (서브스텝)
      for (let k = 0; k < 3; k++) {
        const h = dt / 3;
        for (const pl of this.planets) {
          const dx = pl.x - b.x,
            dy = pl.y - b.y;
          const d2 = Math.max(400, dx * dx + dy * dy);
          const f = pl.mass / d2;
          const d = Math.sqrt(d2);
          b.vx += (dx / d) * f * h * 60;
          b.vy += (dy / d) * f * h * 60;
        }
        b.x += b.vx * h;
        b.y += b.vy * h;
      }
      // 마찰: 기본으로도 꽤 감속하고, 3초 넘게 날면(행성 궤도에 잡힌 경우) 점점 세게 잡아서 반드시 멈추게 한다
      this.flyT += dt;
      const drag = 0.45 + Math.max(0, this.flyT - 3) * 0.9;
      const k = Math.max(0, 1 - drag * dt);
      b.vx *= k;
      b.vy *= k;
      // 벽 반사
      if (b.x < 6 || b.x > 634) {
        b.vx *= -0.7;
        b.x = Phaser.Math.Clamp(b.x, 6, 634);
      }
      if (b.y < 6 || b.y > 334) {
        b.vy *= -0.7;
        b.y = Phaser.Math.Clamp(b.y, 6, 334);
      }
      // 충돌
      for (const pl of this.planets) {
        const d = Math.hypot(pl.x - b.x, pl.y - b.y);
        if (d < pl.r + 5) {
          if (pl.hole) {
            this.h.hit(b.x, b.y);
            this.h.float('블랙홀!', pl.x, pl.y - 30, '#ff4b6e');
            b.x = 70;
            b.y = 280;
            b.vx = b.vy = 0;
            b.moving = false;
            break;
          }
          // 튕김
          const nx = (b.x - pl.x) / d,
            ny = (b.y - pl.y) / d;
          const dot = b.vx * nx + b.vy * ny;
          b.vx -= 2 * dot * nx;
          b.vy -= 2 * dot * ny;
          b.vx *= 0.6;
          b.vy *= 0.6;
          b.x = pl.x + nx * (pl.r + 6);
          b.y = pl.y + ny * (pl.r + 6);
          this.h.sfx('tick');
        }
      }
      // 구멍
      const hd = Math.hypot(this.hole.x - b.x, this.hole.y - b.y);
      if (hd < 16) {
        // 구멍 근처면 빨려 들어가듯 감속
        b.vx *= 1 - 3 * dt;
        b.vy *= 1 - 3 * dt;
      }
      if (hd < 12 && Math.hypot(b.vx, b.vy) < 320) {
        this.holes++;
        // 홀인원 700 · 2타 500 · 3타 350 · 그 뒤 250, 2타 이내로 연속 성공하면 홀마다 +150 씩 더
        const base = [700, 500, 350][this.strokes - 1] ?? 250;
        this.streak = this.strokes <= 2 ? this.streak + 1 : 0;
        const bonus = Math.max(0, this.streak - 1) * 150;
        this.h.sfx('win');
        this.h.addScore(base + bonus, this.hole.x, this.hole.y - 40);
        this.h.float((this.strokes === 1 ? '홀인원!' : `${this.strokes}타`) + (bonus ? ` · 연속 ${this.streak}` : ''), this.hole.x, this.hole.y - 60, '#ffd84b');
        b.moving = false;
        this.s.time.delayedCall(350, () => !this.finished && this.course());
      }
      // 멈춤 판정
      if (Math.hypot(b.vx, b.vy) < 22) this.stillT += dt;
      else this.stillT = 0;
      if (this.stillT > 0.35 || this.flyT > 9) {
        b.moving = false;
        b.vx = b.vy = 0;
        this.h.sfx('tick');
      }
      // 잔상
      const t = this.add(this.s.add.circle(b.x, b.y, 2, 0xffffff, 0.5));
      this.trail.push(t);
      this.s.tweens.add({ targets: t, alpha: 0, duration: 600, onComplete: () => t.destroy() });
      if (this.trail.length > 60) this.trail.shift();
    }
    const g = this.ballG;
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(b.x, b.y, 5);
    const a = this.aim;
    a.clear();
    if (this.dragging && this.dragStart) {
      const dx = this.dragStart[0] - p.x,
        dy = this.dragStart[1] - p.y;
      const d = Math.min(140, Math.hypot(dx, dy));
      const ux = dx / (Math.hypot(dx, dy) || 1),
        uy = dy / (Math.hypot(dx, dy) || 1);
      // 예상 궤적: 처음 0.7초만 점선으로 (행성 중력 반영, 충돌은 무시)
      let px = b.x, py = b.y, pvx = ux * d * 3.6, pvy = uy * d * 3.6;
      const step = 1 / 60;
      for (let i = 0; i < 42; i++) {
        for (const pl of this.planets) {
          const ddx = pl.x - px, ddy = pl.y - py;
          const dd2 = Math.max(400, ddx * ddx + ddy * ddy), dd = Math.sqrt(dd2), ff = pl.mass / dd2;
          pvx += (ddx / dd) * ff * step * 60;
          pvy += (ddy / dd) * ff * step * 60;
        }
        px += pvx * step;
        py += pvy * step;
        if (i % 3 === 0) {
          a.fillStyle(0xffd84b, 0.85 - i * 0.018);
          a.fillCircle(px, py, 1.6);
        }
      }
      a.lineStyle(2, 0xffd84b, 0.9);
      a.lineBetween(b.x, b.y, b.x + ux * Math.min(d, 40), b.y + uy * Math.min(d, 40));
      a.lineStyle(1, 0xffffff, 0.4);
      a.lineBetween(b.x, b.y, b.x - ux * 30, b.y - uy * 30);
    }
    this.label.setText(`홀 ${this.holes} · 이번 홀 ${this.strokes}타 · 공을 드래그해서 발사`);
  }

  microDone() {
    return this.holes >= 1;
  }
  microSuccess() {
    return this.holes >= 1;
  }
}
