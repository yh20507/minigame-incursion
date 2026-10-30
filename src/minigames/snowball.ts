import Phaser from 'phaser';
import { MiniGame } from './base';

interface Pin {
  x: number;
  y: number;
  up: boolean;
  o: Phaser.GameObjects.Graphics;
}

/** 눈덩이 볼링: 길게 눌러 눈덩이를 키우고(너무 크면 터짐), 좌우로 방향을 잡아 얼음 핀을 쓰러뜨려라 */
export class SnowballGame extends MiniGame {
  pins: Pin[] = [];
  ball!: Phaser.GameObjects.Graphics;
  pl!: Phaser.GameObjects.Image;
  r = 0; // 눈덩이 반지름 (0 = 아직)
  charging = false;
  rolling = false;
  bx = 320;
  by = 290;
  vx = 0;
  vy = 0;
  aim = 0; // -1~1
  frame = 0;
  knocked = 0;
  wait = 0;
  guide!: Phaser.GameObjects.Graphics;
  label!: Phaser.GameObjects.Text;
  readonly maxR = 30;

  create() {
    const g = this.gfx();
    g.fillStyle(0xdbeeff, 1);
    g.fillRect(140, 0, 360, 340);
    g.fillStyle(0xc4ddf5, 1);
    for (let i = 0; i < 10; i++) g.fillRect(140, i * 34, 360, 2);
    g.fillStyle(0x1b2838, 1);
    g.fillRect(0, 0, 140, 340);
    g.fillRect(500, 0, 140, 340);
    this.guide = this.gfx();
    this.ball = this.gfx().setDepth(2);
    this.pl = this.player(this.bx, 330, 40);
    this.label = this.text(320, 326, '', 10, '#1b2838');
    this.setPins();
  }

  setPins() {
    for (const p of this.pins) p.o.destroy();
    this.pins = [];
    const rows = this.h.micro ? 2 : 3 + Math.min(1, Math.floor(this.frame / 3));
    const cx = 320 + (this.frame > 0 ? this.rnd(-60, 60) * Math.min(1, (this.h.difficulty - 1) + this.frame * 0.1) : 0);
    for (let r = 0; r < rows; r++)
      for (let i = 0; i <= r; i++) {
        const x = cx + (i - r / 2) * 30;
        const y = 70 - r * 26;
        const o = this.gfx();
        this.pins.push({ x, y, up: true, o });
        this.drawPin(this.pins[this.pins.length - 1]);
      }
  }

  drawPin(p: Pin) {
    const o = p.o;
    o.clear();
    if (p.up) {
      o.fillStyle(0xffffff, 1);
      o.fillRect(p.x - 6, p.y - 22, 12, 22);
      o.fillStyle(0x9fe0ff, 1);
      o.fillRect(p.x - 6, p.y - 14, 12, 3);
      o.fillStyle(0x7fb8e0, 1);
      o.fillCircle(p.x, p.y - 24, 5);
    } else {
      o.fillStyle(0xcfe9ff, 0.7);
      o.fillRect(p.x - 12, p.y - 4, 24, 6);
    }
  }

  update(dt: number) {
    const inp = this.h.inp;
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) this.reset();
      return;
    }
    if (!this.rolling) {
      if (inp.left) this.aim = Math.max(-1, this.aim - 1.6 * dt);
      if (inp.right) this.aim = Math.min(1, this.aim + 1.6 * dt);
      if (inp.pointer.down && !inp.action) this.aim = Phaser.Math.Clamp((inp.pointer.x - 320) / 160, -1, 1);
      const pressing = inp.action || (inp.pointer.down && inp.pointer.y > 240);
      if (pressing) {
        this.charging = true;
        this.r += (16 + (this.h.difficulty - 1) * 6) * dt;
        if (this.r > this.maxR) {
          // 터짐
          this.h.sfx('bad');
          this.h.float('펑! 너무 컸다', this.bx, this.by - 40, '#ff4b6e');
          const puff = this.add(this.s.add.circle(this.bx, this.by, this.maxR, 0xffffff, 0.9));
          this.s.tweens.add({ targets: puff, scale: 2, alpha: 0, duration: 300, onComplete: () => puff.destroy() });
          this.r = 0;
          this.charging = false;
          this.h.addTime(-2);
        }
      } else if (this.charging) {
        this.charging = false;
        if (this.r < 6) this.r = 6;
        this.rolling = true;
        const speed = 420 - this.r * 6; // 클수록 느림
        this.vx = this.aim * 140;
        this.vy = -speed;
        this.h.sfx('throw');
      }
      // 가이드
      const g = this.guide;
      g.clear();
      g.lineStyle(1, 0x1b2838, 0.4);
      g.lineBetween(this.bx, this.by - 10, this.bx + this.aim * 140 * 0.6, 60);
      this.label.setText(`프레임 ${this.frame + 1} · 쓰러뜨린 핀 ${this.knocked}`);
    } else {
      this.bx += this.vx * dt;
      this.by += this.vy * dt;
      // 벽
      if (this.bx - this.r < 140 || this.bx + this.r > 500) {
        this.vx *= -0.5;
        this.bx = Phaser.Math.Clamp(this.bx, 140 + this.r, 500 - this.r);
      }
      let hitNow = 0;
      for (const p of this.pins) {
        if (!p.up) continue;
        if (Math.abs(p.x - this.bx) < this.r + 8 && Math.abs(p.y - 10 - this.by) < this.r + 12) {
          p.up = false;
          this.drawPin(p);
          hitNow++;
          this.knocked++;
          this.vy *= 0.92;
        }
      }
      if (hitNow) {
        this.h.sfx('good');
        this.h.addScore(hitNow * 60 + (this.r > 20 ? 20 : 0), this.bx, this.by - this.r - 10);
      }
      if (this.by < -40 || Math.abs(this.vy) < 20) {
        const left = this.pins.filter((p) => p.up).length;
        if (left === 0) {
          this.h.sfx('win');
          this.h.addScore(200, 320, 120);
          this.h.float('스트라이크!', 320, 100, '#ffd84b');
        } else if (left === this.pins.length) {
          this.h.hit(this.bx, 60);
        }
        this.wait = 0.8;
      }
    }
    // 공 그리기
    const b = this.ball;
    b.clear();
    if (this.r > 0) {
      b.fillStyle(0xffffff, 1);
      b.fillCircle(this.bx, this.by, this.r);
      b.fillStyle(0x9fe0ff, 0.5);
      b.fillCircle(this.bx - this.r * 0.3, this.by - this.r * 0.3, this.r * 0.3);
      if (this.charging && this.r > this.maxR * 0.8) {
        b.lineStyle(2, 0xff4b6e, 0.8);
        b.strokeCircle(this.bx, this.by, this.r + 3);
      }
    }
    this.pl.setVisible(!this.rolling || this.by > 240);
  }

  reset() {
    this.rolling = false;
    this.r = 0;
    this.bx = 320;
    this.by = 290;
    this.frame++;
    if (this.pins.every((p) => !p.up) || this.frame % 2 === 0) this.setPins();
  }

  microDone() {
    return this.knocked >= 1;
  }
  microSuccess() {
    return this.knocked >= 1;
  }
}
