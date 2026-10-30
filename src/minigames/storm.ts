import Phaser from 'phaser';
import { MiniGame } from './base';

type Dir = 0 | 1 | 2 | 3; // 상 우 하 좌
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** 모래폭풍 질주: 탑뷰. 표지판이 가리킨 방향의 가장자리로 달려라. 시야는 좁아지고 표지판은 금방 묻힌다. 틀린 방향 가장자리로 나가면 피격. */
export class StormGame extends MiniGame {
  px = 320;
  py = 170;
  pl!: Phaser.GameObjects.Image;
  dir: Dir = 1;
  signT = 0; // 표지판 보이는 남은 시간
  signG!: Phaser.GameObjects.Graphics;
  fog!: Phaser.GameObjects.Rectangle;
  maskG!: Phaser.GameObjects.Graphics;
  view = 1; // 시야 비율
  runs = 0;
  label!: Phaser.GameObjects.Text;
  dust: { x: number; y: number; o: Phaser.GameObjects.Rectangle }[] = [];

  create() {
    const bg = this.gfx();
    bg.fillStyle(0xd9b98a, 1);
    bg.fillRect(0, 0, 640, 340);
    for (let i = 0; i < 60; i++) {
      bg.fillStyle(0xc9a670, 0.6);
      bg.fillEllipse(this.rnd(0, 640), this.rnd(0, 340), this.rnd(20, 80), this.rnd(4, 10));
    }
    for (let i = 0; i < 40; i++) {
      const o = this.add(this.s.add.rectangle(this.rnd(0, 640), this.rnd(0, 340), this.rnd(6, 20), 2, 0xf2dcb0, 0.7));
      this.dust.push({ x: o.x, y: o.y, o });
    }
    this.signG = this.gfx().setDepth(2);
    this.pl = this.player(this.px, this.py + 18, 36).setDepth(3);
    this.fog = this.add(this.s.add.rectangle(320, 170, 640, 340, 0xcfa875, 0.93)).setDepth(4);
    this.maskG = this.s.add.graphics(); // 마스크는 컨테이너 변환을 안 타므로 씬 좌표로 그린다
    this.maskG.setVisible(false);
    const m = this.maskG.createGeometryMask();
    m.invertAlpha = true;
    this.fog.setMask(m);
    this.label = this.text(320, 12, '', 10, '#2e1f36').setDepth(6);
    this.newSign();
  }

  newSign() {
    this.dir = Math.floor(this.h.rng() * 4) as Dir;
    this.signT = Math.max(0.6, (this.h.micro ? 1.6 : 2.2) - this.runs * 0.12 - (this.h.difficulty - 1) * 0.5);
    this.px = 320;
    this.py = 170;
    this.view = Math.max(0.3, 1 - this.runs * 0.06 - (this.h.difficulty - 1) * 0.2);
  }

  update(dt: number) {
    const inp = this.h.inp;
    const sp = 170 * this.ramp(0.01, 1.6);
    let mx = 0,
      my = 0;
    if (inp.left) mx -= 1;
    if (inp.right) mx += 1;
    if (inp.up) my -= 1;
    if (inp.down) my += 1;
    if (inp.pointer.down) {
      const dx = inp.pointer.x - this.px,
        dy = inp.pointer.y - this.py;
      const d = Math.hypot(dx, dy);
      if (d > 10) {
        mx = dx / d;
        my = dy / d;
      }
    }
    this.px += mx * sp * dt;
    this.py += my * sp * dt;
    this.pl.setPosition(this.px, this.py + 18);
    if (mx) this.pl.setFlipX(mx < 0);
    this.signT -= dt;
    // 가장자리 판정
    let out: Dir | -1 = -1;
    if (this.py < 10) out = 0;
    else if (this.px > 630) out = 1;
    else if (this.py > 330) out = 2;
    else if (this.px < 10) out = 3;
    if (out >= 0) {
      if (out === this.dir) {
        this.runs++;
        this.h.sfx('good');
        this.h.addScore(120 + this.runs * 15 + (this.signT > 0 ? 40 : 0), 320, 150);
      } else {
        this.h.hit(this.px, this.py);
        this.h.float('틀린 방향!', 320, 150, '#ff4b6e');
      }
      this.newSign();
    }
    // 모래 바람
    for (const d of this.dust) {
      d.x -= (260 + this.runs * 20) * dt;
      d.y += Math.sin(this.h.t * 5 + d.x) * 20 * dt;
      if (d.x < -20) {
        d.x = 660;
        d.y = this.rnd(0, 340);
      }
      d.o.setPosition(d.x, d.y);
    }
    // 표지판
    const g = this.signG;
    g.clear();
    if (this.signT > 0) {
      const a = Math.min(1, this.signT * 2);
      g.fillStyle(0x8a6a4a, a);
      g.fillRect(314, 60, 12, 60);
      g.fillStyle(0xffe08a, a);
      g.fillRect(290, 60, 60, 30);
      g.fillStyle(0x2e1f36, a);
      const cx = 320,
        cy = 75;
      const ax = DX[this.dir],
        ay = DY[this.dir];
      g.fillTriangle(cx + ax * 12, cy + ay * 12, cx - ay * 8 - ax * 4, cy + ax * 8 - ay * 4, cx + ay * 8 - ax * 4, cy - ax * 8 - ay * 4);
    }
    // 시야
    const r = 60 + 220 * this.view;
    this.maskG.clear();
    this.maskG.fillStyle(0xffffff, 1);
    this.maskG.fillCircle(this.px, this.py + (360 - this.h.H), r);
    this.label.setText(`통과 ${this.runs} · 표지판 방향의 가장자리로!`);
  }

  microDone() {
    return this.runs >= 1;
  }
  microSuccess() {
    return this.runs >= 1;
  }
}
