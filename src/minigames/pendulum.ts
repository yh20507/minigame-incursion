import Phaser from 'phaser';
import { MiniGame } from './base';

/** 시계추 멈추기: 흔들리는 추를 표시 구간 안에서 멈춰라. 구간은 좁아지고 추는 변덕스러워진다. */
export class PendulumGame extends MiniGame {
  g!: Phaser.GameObjects.Graphics;
  ang = 0;
  phase = 0;
  speed = 1.6; // rad/s 기준 각속도 배율
  amp = 1.1; // 최대 각도(rad)
  zoneC = 0.4; // 구간 중심 각도
  zoneW = 0.3; // 구간 반폭
  level = 0;
  hold = 0; // 멈춘 뒤 대기
  wobble = 0; // 변덕 (속도 요동)
  hits = 0;
  bob!: Phaser.GameObjects.Image;
  label!: Phaser.GameObjects.Text;
  readonly cx = 320;
  readonly cy = 40;
  readonly len = 230;

  create() {
    const bg = this.gfx();
    // 시계 문자판 느낌의 아치
    bg.lineStyle(2, 0x2a3f5c, 1);
    bg.strokeCircle(this.cx, this.cy, this.len + 14);
    bg.fillStyle(0x1b2838, 1);
    bg.fillRect(0, 300, 640, 40);
    bg.fillStyle(0x9fe0ff, 0.15);
    for (let i = 0; i < 12; i++) bg.fillRect(i * 56 + 10, 300, 24, 3);
    this.g = this.gfx();
    this.bob = this.player(this.cx, this.cy + this.len, 34);
    this.label = this.text(320, 320, '스페이스로 멈추기', 10, '#9fe0ff');
    this.newZone();
    if (this.h.micro) this.zoneW = 0.32;
  }

  newZone() {
    const d = this.h.difficulty;
    this.zoneW = Math.max(0.07, (this.h.micro ? 0.32 : 0.3) - this.level * 0.03 - (d - 1) * 0.04);
    this.zoneC = this.rnd(-this.amp + this.zoneW + 0.1, this.amp - this.zoneW - 0.1);
    this.speed = (1.5 + this.level * 0.12) * (1 + (d - 1) * 0.25);
    this.wobble = Math.min(0.8, this.level * 0.08 + (d - 1) * 0.2);
  }

  update(dt: number) {
    const inp = this.h.inp;
    if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold <= 0) this.phase = this.h.rng() * Math.PI * 2;
      this.draw();
      return;
    }
    // 변덕: 속도가 사인파로 요동
    const w = this.speed * (1 + this.wobble * Math.sin(this.h.t * 2.3 + this.level));
    this.phase += w * dt;
    this.ang = Math.sin(this.phase) * this.amp;
    if (inp.actionP || inp.pointer.pressed) {
      const diff = Math.abs(this.ang - this.zoneC);
      const bx = this.cx + Math.sin(this.ang) * this.len;
      const by = this.cy + Math.cos(this.ang) * this.len;
      if (diff <= this.zoneW) {
        const prec = 1 - diff / this.zoneW; // 0~1
        const pts = 60 + Math.round(prec * 140) + this.level * 10;
        this.hits++;
        this.level++;
        this.h.sfx(prec > 0.7 ? 'good' : 'select');
        this.h.addScore(pts, bx, by - 30);
        if (prec > 0.85) this.h.float('정확!', bx, by - 48, '#ffffff');
        this.newZone();
      } else {
        this.h.hit(bx, by - 20);
        this.h.float('빗나감', bx, by - 48, '#ff4b6e');
        this.level = Math.max(0, this.level - 1);
        this.newZone();
      }
      this.hold = 0.45;
    }
    this.draw();
  }

  draw() {
    const g = this.g;
    g.clear();
    // 구간 호
    const r = this.len + 14;
    g.lineStyle(10, 0x9fe0ff, 0.25);
    g.beginPath();
    g.arc(this.cx, this.cy, r, Math.PI / 2 - this.zoneC - this.zoneW, Math.PI / 2 - this.zoneC + this.zoneW, false);
    g.strokePath();
    g.lineStyle(3, 0xffffff, 0.9);
    g.beginPath();
    g.arc(this.cx, this.cy, r, Math.PI / 2 - this.zoneC - this.zoneW, Math.PI / 2 - this.zoneC + this.zoneW, false);
    g.strokePath();
    // 줄과 추
    const bx = this.cx + Math.sin(this.ang) * this.len;
    const by = this.cy + Math.cos(this.ang) * this.len;
    g.lineStyle(2, 0xd9e8ff, 1);
    g.lineBetween(this.cx, this.cy, bx, by);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(this.cx, this.cy, 4);
    this.bob.setPosition(bx, by + 10);
    this.label.setText(this.hold > 0 ? '' : `구간 ${Math.round(this.zoneW * 100)} · 연속 ${this.level}`);
  }

  microDone() {
    return this.hits >= 1;
  }
  microSuccess() {
    return this.hits >= 1;
  }
}
