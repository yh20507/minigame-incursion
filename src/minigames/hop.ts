import Phaser from 'phaser';
import { MiniGame } from './base';

interface Isle {
  x: number;
  y: number;
  w: number;
  o: Phaser.GameObjects.Graphics;
}

/** 섬 건너뛰기: 바람 화살표를 읽고 스페이스를 길게 눌러 점프 세기를 정한다. 바람에 궤적이 휜다. 떨어지면 목숨. */
export class HopGame extends MiniGame {
  isles: Isle[] = [];
  pl!: Phaser.GameObjects.Image;
  px = 80;
  py = 240;
  vx = 0;
  vy = 0;
  air = false;
  charge = 0;
  charging = false;
  wind = 0; // -1~1 (px/s² 로 변환)
  cur = 0; // 서 있는 섬 번호
  hops = 0;
  g!: Phaser.GameObjects.Graphics;
  windG!: Phaser.GameObjects.Graphics;
  camX = 0;
  world!: Phaser.GameObjects.Container;

  create() {
    const bg = this.gfx();
    bg.fillGradientStyle(0x6fb0e8, 0x6fb0e8, 0xcfe6ff, 0xcfe6ff, 1);
    bg.fillRect(0, 0, 640, 340);
    for (let i = 0; i < 8; i++) {
      bg.fillStyle(0xffffff, 0.5);
      bg.fillEllipse(this.rnd(0, 640), this.rnd(200, 330), this.rnd(60, 140), 24);
    }
    this.world = this.add(this.s.add.container(0, 0));
    this.g = this.s.add.graphics();
    this.world.add(this.g);
    this.pl = this.s.add.image(this.px, this.py, this.h.leaderKey).setOrigin(0.5, 1);
    const sc = 40 / Math.max(this.pl.width, this.pl.height);
    this.pl.setScale(sc);
    this.world.add(this.pl);
    this.windG = this.gfx().setDepth(5);
    this.text(320, 12, '스페이스 길게: 점프 세기 · 바람을 읽어라', 10, '#1d3320').setDepth(5);
    this.addIsle(80, 240, 90);
    for (let i = 0; i < 4; i++) this.nextIsle();
    this.newWind();
  }

  addIsle(x: number, y: number, w: number) {
    const o = this.s.add.graphics();
    o.fillStyle(0x7a5a3a, 1);
    o.fillRoundedRect(x - w / 2, y, w, 26, 8);
    o.fillStyle(0x7fd37a, 1);
    o.fillRoundedRect(x - w / 2, y - 6, w, 12, 6);
    o.fillStyle(0xff9ad5, 1);
    for (let k = 0; k < Math.floor(w / 25); k++) o.fillCircle(x - w / 2 + 12 + k * 25, y - 6, 3);
    this.world.add(o);
    this.isles.push({ x, y, w, o });
  }
  nextIsle() {
    const last = this.isles[this.isles.length - 1];
    const d = this.h.difficulty;
    const gap = this.rnd(120, 190) + this.hops * 4 + (d - 1) * 30;
    const w = Math.max(40, 90 - this.hops * 3 - (d - 1) * 15);
    const y = Phaser.Math.Clamp(last.y + this.rnd(-60, 60), 140, 290);
    this.addIsle(last.x + gap, y, w);
  }
  newWind() {
    const d = this.h.difficulty;
    this.wind = this.rnd(-1, 1) * Math.min(1, 0.4 + this.hops * 0.06 + (d - 1) * 0.3);
  }

  update(dt: number) {
    const inp = this.h.inp;
    if (!this.air) {
      const pressing = inp.action || inp.pointer.down;
      if (pressing) {
        this.charging = true;
        this.charge = Math.min(1, this.charge + dt * 1.1);
      } else if (this.charging) {
        this.charging = false;
        this.air = true;
        const p = 0.35 + this.charge * 0.65;
        this.vx = 180 + p * 260;
        this.vy = -(260 + p * 160);
        this.charge = 0;
        this.h.sfx('jump');
      }
    } else {
      this.vy += 700 * dt;
      this.vx += this.wind * 160 * dt;
      this.px += this.vx * dt;
      this.py += this.vy * dt;
      // 착지
      if (this.vy > 0) {
        for (let i = this.cur + 1; i < this.isles.length; i++) {
          const is = this.isles[i];
          if (Math.abs(this.px - is.x) <= is.w / 2 + 6 && this.py >= is.y - 8 && this.py <= is.y + 14) {
            this.py = is.y - 4;
            this.air = false;
            this.vx = this.vy = 0;
            const skipped = i - this.cur - 1;
            this.cur = i;
            this.hops++;
            const prec = 1 - Math.abs(this.px - is.x) / (is.w / 2 + 6);
            this.h.sfx('good');
            this.h.addScore(100 + Math.round(prec * 60) + skipped * 120, is.x, is.y - 50);
            if (skipped) this.h.float('섬 건너뜀!', is.x, is.y - 70, '#ffd84b');
            this.squash(this.pl);
            this.nextIsle();
            this.newWind();
            break;
          }
        }
      }
      if (this.py > 360) {
        // 추락
        const alive = this.h.hit(this.px - this.camX, 300);
        // 현재 섬으로 복귀
        const is = this.isles[this.cur];
        this.px = is.x;
        this.py = is.y - 4;
        this.air = false;
        this.vx = this.vy = 0;
        this.newWind();
        void alive;
      }
    }
    // 카메라
    const target = Math.max(0, this.px - 160);
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
    this.world.x = -this.camX;
    this.pl.setPosition(this.px, this.py);
    // 게이지 + 바람
    const g = this.g;
    g.clear();
    if (this.charging) {
      g.fillStyle(0x0b0918, 0.6);
      g.fillRect(this.px - 20, this.py - 56, 40, 6);
      g.fillStyle(this.charge > 0.85 ? 0xff4b6e : 0xffd84b, 1);
      g.fillRect(this.px - 20, this.py - 56, 40 * this.charge, 6);
    }
    const w = this.windG;
    w.clear();
    const cx = 320,
      cy = 36;
    w.fillStyle(0x0b0918, 0.5);
    w.fillRect(cx - 70, cy - 10, 140, 20);
    const len = this.wind * 60;
    w.lineStyle(3, 0xffffff, 1);
    w.lineBetween(cx, cy, cx + len, cy);
    const dir = Math.sign(len) || 1;
    w.fillStyle(0xffffff, 1);
    w.fillTriangle(cx + len + dir * 8, cy, cx + len, cy - 5, cx + len, cy + 5);
    // 이전 섬들 정리
    while (this.isles.length > 8 && this.cur > 2) {
      const old = this.isles.shift()!;
      old.o.destroy();
      this.cur--;
    }
  }

  microDone() {
    return this.hops >= 2;
  }
  microSuccess() {
    return this.hops >= 2;
  }
}
