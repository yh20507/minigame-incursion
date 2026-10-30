import Phaser from 'phaser';
import { MiniGame } from './base';

/** 조명 큐: 무대 위를 뛰어다니는 배우를 스포트라이트(마우스)로 계속 비춰라. 비춘 시간만큼 점수, 놓치면 관객이 떠난다(피격). */
export class SpotlightGame extends MiniGame {
  ax = 320;
  ay = 220;
  tx = 320;
  ty = 220;
  actor!: Phaser.GameObjects.Image;
  light!: Phaser.GameObjects.Graphics;
  dark!: Phaser.GameObjects.Rectangle;
  maskG!: Phaser.GameObjects.Graphics;
  warn!: Phaser.GameObjects.Graphics;
  moveT = 0;
  outT = 0;
  inT = 0;
  radius = 70;
  label!: Phaser.GameObjects.Text;
  scoreAcc = 0;
  dash = false;
  decoys: { x: number; y: number; vx: number; o: Phaser.GameObjects.Graphics }[] = [];

  create() {
    const bg = this.gfx();
    bg.fillStyle(0x241212, 1);
    bg.fillRect(0, 0, 640, 340);
    bg.fillStyle(0x3a2222, 1);
    bg.fillRect(0, 120, 640, 220);
    bg.fillStyle(0x5a3030, 1);
    for (let i = 0; i < 8; i++) bg.fillRect(0, 130 + i * 26, 640, 2);
    bg.fillStyle(0x8a2a2a, 1);
    bg.fillRect(0, 0, 640, 40);
    for (let i = 0; i < 16; i++) bg.fillTriangle(i * 40, 40, i * 40 + 40, 40, i * 40 + 20, 62);
    this.actor = this.player(this.ax, this.ay, 42);
    this.light = this.gfx().setDepth(2);
    this.dark = this.add(this.s.add.rectangle(320, 170, 640, 340, 0x100808, 0.78)).setDepth(1);
    this.maskG = this.s.add.graphics(); // 마스크는 컨테이너 변환을 안 타므로 씬 좌표로 그린다
    this.maskG.setVisible(false);
    const m = this.maskG.createGeometryMask();
    m.invertAlpha = true;
    this.dark.setMask(m);
    this.warn = this.gfx().setDepth(4);
    this.label = this.text(320, 12, '', 10, '#ffb3a7').setDepth(5);
  }

  pickTarget() {
    const d = this.h.difficulty;
    const far = this.h.rng() < 0.25 + (d - 1) * 0.2;
    this.tx = far ? this.rnd(40, 600) : Phaser.Math.Clamp(this.ax + this.rnd(-160, 160), 40, 600);
    this.ty = Phaser.Math.Clamp(this.ay + this.rnd(-70, 70), 150, 320);
    this.dash = far;
    this.moveT = this.rnd(0.5, 1.4);
  }

  update(dt: number) {
    const ramp = this.ramp(0.015, 2.2);
    this.moveT -= dt;
    if (this.moveT <= 0) this.pickTarget();
    const sp = (this.dash ? 260 : 130) * ramp;
    const dx = this.tx - this.ax,
      dy = this.ty - this.ay;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      this.ax += (dx / d) * Math.min(sp * dt, d);
      this.ay += (dy / d) * Math.min(sp * dt, d);
      this.actor.setFlipX(dx < 0);
    }
    this.actor.setPosition(this.ax, this.ay + Math.abs(Math.sin(this.h.t * 12)) * -4);
    // 조명
    const p = this.h.inp.pointer;
    this.radius = Math.max(44, 70 - this.h.t * 0.6 - (this.h.difficulty - 1) * 12);
    const lit = Math.hypot(p.x - this.ax, p.y - this.ay + 20) < this.radius;
    if (lit) {
      this.inT += dt;
      this.outT = 0;
      this.scoreAcc += dt * 60 * (1 + Math.min(1, this.inT / 5));
      if (this.scoreAcc >= 30) {
        this.h.addScore(30, this.ax, this.ay - 50);
        this.scoreAcc -= 30;
      }
    } else {
      this.inT = 0;
      this.outT += dt;
      if (this.outT > 1.2) {
        this.outT = 0;
        this.h.hit(this.ax, this.ay);
        this.h.float('관객이 떠난다!', 320, 100, '#ff4b6e');
      }
    }
    const g = this.light;
    g.clear();
    g.fillStyle(0xffe08a, lit ? 0.35 : 0.2);
    g.fillCircle(p.x, p.y, this.radius);
    g.lineStyle(2, 0xffffff, 0.7);
    g.strokeCircle(p.x, p.y, this.radius);
    // 조명 밖 어두움: 반전 마스크
    this.maskG.clear();
    this.maskG.fillStyle(0xffffff, 1);
    this.maskG.fillCircle(p.x, p.y + (360 - this.h.H), this.radius);
    const dk = this.warn;
    dk.clear();
    if (!lit) {
      dk.fillStyle(0xff4b6e, Math.min(0.5, this.outT * 0.4));
      dk.fillRect(0, 0, 640, 6);
      dk.fillRect(0, 334, 640, 6);
    }
    this.label.setText(lit ? `비추는 중 ${this.inT.toFixed(1)}초` : `놓침! ${(1.2 - this.outT).toFixed(1)}초 안에 다시 비춰라`);
  }

  microDone() {
    return this.inT >= 2.5;
  }
  microSuccess() {
    return this.inT >= 1.5;
  }
}
