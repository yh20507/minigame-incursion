import Phaser from 'phaser';
import { MiniGame } from './base';

/** 네온 하키: AI와 1:1 */
export class HockeyGame extends MiniGame {
  L = 40;
  R = 600;
  T = 16;
  B = 324;
  goalH = 96;
  puck = { x: 320, y: 170, vx: 0, vy: 0, r: 9 };
  me = { x: 120, y: 170, vx: 0, vy: 0, r: 18 };
  ai = { x: 520, y: 170, vx: 0, vy: 0, r: 18 };
  pO!: Phaser.GameObjects.Arc;
  meO!: Phaser.GameObjects.Container;
  aiO!: Phaser.GameObjects.Arc;
  serve = 0.6;
  goals = 0;
  conceded = false;
  usePtr = false;

  create() {
    const g = this.gfx();
    g.fillStyle(0x10142a);
    g.fillRect(this.L, this.T, this.R - this.L, this.B - this.T);
    g.lineStyle(2, 0x5fd3e0, 0.9);
    g.strokeRect(this.L, this.T, this.R - this.L, this.B - this.T);
    g.lineStyle(1, 0xff4fa8, 0.5);
    g.lineBetween(320, this.T, 320, this.B);
    g.strokeCircle(320, 170, 40);
    const gy = 170 - this.goalH / 2;
    g.fillStyle(0x4be37a, 0.8);
    g.fillRect(this.L - 6, gy, 6, this.goalH);
    g.fillStyle(0xff4b6e, 0.8);
    g.fillRect(this.R, gy, 6, this.goalH);
    this.aiO = this.add(this.s.add.circle(this.ai.x, this.ai.y, this.ai.r, 0xff4b6e).setStrokeStyle(3, 0xffffff));
    this.meO = this.s.add.container(this.me.x, this.me.y);
    this.meO.add(this.s.add.circle(0, 0, this.me.r, 0x4be37a).setStrokeStyle(3, 0xffffff));
    const face = this.s.add.image(0, 0, this.h.leaderKey);
    face.setScale(Math.min(26 / face.width, 26 / face.height));
    this.meO.add(face);
    this.add(this.meO);
    this.pO = this.add(this.s.add.circle(320, 170, this.puck.r, 0xffd84b).setStrokeStyle(2, 0x0d0a16));
    if (this.h.micro) this.serve = 0.3;
    (this as any).serveDir = 1;
  }

  resetPuck(towardAI: boolean) {
    this.puck.x = 320;
    this.puck.y = 170;
    this.puck.vx = 0;
    this.puck.vy = 0;
    this.serve = 0.7;
    (this as any).serveDir = towardAI ? 1 : -1;
  }

  collide(p: { x: number; y: number; vx: number; vy: number; r: number }) {
    const pk = this.puck;
    const dx = pk.x - p.x,
      dy = pk.y - p.y;
    const d = Math.hypot(dx, dy);
    const min = p.r + pk.r;
    if (d < min && d > 0) {
      const nx = dx / d,
        ny = dy / d;
      pk.x = p.x + nx * min;
      pk.y = p.y + ny * min;
      const rel = (pk.vx - p.vx) * nx + (pk.vy - p.vy) * ny;
      if (rel < 0) {
        pk.vx -= 1.9 * rel * nx;
        pk.vy -= 1.9 * rel * ny;
        pk.vx += p.vx * 0.35;
        pk.vy += p.vy * 0.35;
      }
      const sp = Math.hypot(pk.vx, pk.vy);
      const max = 720 * Math.min(1.4, this.ramp(0.005));
      if (sp > max) {
        pk.vx *= max / sp;
        pk.vy *= max / sp;
      }
      if (sp < 160) {
        pk.vx = nx * 200;
        pk.vy = ny * 200;
      }
      return true;
    }
    return false;
  }

  update(dt: number) {
    const i = this.h.inp;
    const m = this.me;
    // 내 채
    if (i.pointer.down || i.pointer.pressed || (this.usePtr && !(i.left || i.right || i.up || i.down))) {
      if (i.pointer.down || i.pointer.pressed) this.usePtr = true;
    }
    if (i.left || i.right || i.up || i.down) this.usePtr = false;
    let tx = m.x,
      ty = m.y;
    if (this.usePtr) {
      tx = i.pointer.x;
      ty = i.pointer.y;
    } else {
      tx += ((i.right ? 1 : 0) - (i.left ? 1 : 0)) * 340 * dt;
      ty += ((i.down ? 1 : 0) - (i.up ? 1 : 0)) * 340 * dt;
    }
    tx = Phaser.Math.Clamp(tx, this.L + m.r, 320 - m.r);
    ty = Phaser.Math.Clamp(ty, this.T + m.r, this.B - m.r);
    const maxStep = 640 * dt;
    const ddx = tx - m.x,
      ddy = ty - m.y;
    const dd = Math.hypot(ddx, ddy);
    const step = Math.min(dd, maxStep);
    const nx = dd ? (ddx / dd) * step : 0,
      ny = dd ? (ddy / dd) * step : 0;
    m.vx = dt ? nx / dt : 0;
    m.vy = dt ? ny / dt : 0;
    m.x += nx;
    m.y += ny;
    this.meO.setPosition(m.x, m.y);

    // AI
    const a = this.ai;
    const pk = this.puck;
    const aiSpeed = (this.h.micro ? 0 : 190) * this.ramp(0.012, 1.9);
    let ax = 540,
      ay = pk.y;
    if (pk.x > 320) {
      ax = pk.x + 14;
      ay = pk.y;
      if (pk.x > a.x) ax = a.x + 30; // 퍽이 뒤로 가면 물러난다
    }
    ax = Phaser.Math.Clamp(ax, 320 + a.r, this.R - a.r);
    ay = Phaser.Math.Clamp(ay, this.T + a.r, this.B - a.r);
    const adx = ax - a.x,
      ady = ay - a.y;
    const ad = Math.hypot(adx, ady);
    const as = Math.min(ad, aiSpeed * dt);
    a.vx = ad && dt ? ((adx / ad) * as) / dt : 0;
    a.vy = ad && dt ? ((ady / ad) * as) / dt : 0;
    a.x += ad ? (adx / ad) * as : 0;
    a.y += ad ? (ady / ad) * as : 0;
    this.aiO.setPosition(a.x, a.y);

    // 서브
    if (this.serve > 0) {
      this.serve -= dt;
      if (this.serve <= 0) {
        const dir = this.h.micro ? -1 : ((this as any).serveDir ?? (this.h.rng() < 0.5 ? 1 : -1));
        const sp = this.h.micro ? 420 : 260;
        const ang = this.rnd(-0.4, 0.4);
        pk.vx = Math.cos(ang) * sp * dir;
        pk.vy = Math.sin(ang) * sp;
      }
    }

    // 퍽 이동 (작게 나눠서 터널링 방지)
    const sub = 4;
    for (let k = 0; k < sub; k++) {
      pk.x += (pk.vx * dt) / sub;
      pk.y += (pk.vy * dt) / sub;
      if (pk.y < this.T + pk.r) {
        pk.y = this.T + pk.r;
        pk.vy = Math.abs(pk.vy);
      }
      if (pk.y > this.B - pk.r) {
        pk.y = this.B - pk.r;
        pk.vy = -Math.abs(pk.vy);
      }
      const inGoal = Math.abs(pk.y - 170) < this.goalH / 2;
      if (pk.x < this.L + pk.r) {
        if (inGoal && pk.x < this.L - pk.r) {
          this.conceded = true;
          this.h.float('실점!', 200, 170, '#ff4b6e');
          this.resetPuck(false);
          if (!this.h.hit(this.L, 170)) return;
          return;
        }
        if (!inGoal) {
          pk.x = this.L + pk.r;
          pk.vx = Math.abs(pk.vx);
        }
      }
      if (pk.x > this.R - pk.r) {
        if (inGoal && pk.x > this.R + pk.r) {
          this.goals++;
          this.h.addScore(500, 480, 170);
          this.h.float('골!', 480, 140, '#ffd84b');
          this.h.sfx('star');
          this.resetPuck(true);
          return;
        }
        if (!inGoal) {
          pk.x = this.R - pk.r;
          pk.vx = -Math.abs(pk.vx);
        }
      }
      if (this.collide(m)) {
        if (!(this as any).cool) {
          this.h.addScore(20);
          this.h.sfx('score');
          (this as any).cool = 0.15;
        }
      }
      this.collide(a);
    }
    if ((this as any).cool) (this as any).cool = Math.max(0, (this as any).cool - dt);
    pk.vx *= Math.pow(0.6, dt);
    pk.vy *= Math.pow(0.6, dt);
    this.pO.setPosition(pk.x, pk.y);
  }

  microSuccess() {
    return !this.conceded;
  }
}
