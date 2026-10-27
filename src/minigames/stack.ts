import Phaser from 'phaser';
import { MiniGame } from './base';

const CRATE = [0x5fd3e0, 0xff8a3d, 0xb06cff, 0x4be37a, 0xffd84b, 0xff4fa8];

/** 화물 쌓기: 움직이는 화물을 떨어뜨려 높이 쌓기 */
export class StackGame extends MiniGame {
  stackC!: Phaser.GameObjects.Container;
  blocks: { x: number; w: number; o: Phaser.GameObjects.Rectangle }[] = [];
  cur!: Phaser.GameObjects.Rectangle;
  curX = 0;
  curW = 180;
  dir = 1;
  BH = 18;
  baseY = 318;
  placed = 0;
  camY = 0;
  dropping = false;
  crane!: Phaser.GameObjects.Graphics;

  create() {
    this.stackC = this.s.add.container(0, 0);
    this.add(this.stackC);
    const base = this.s.add.rectangle(320, this.baseY, 200, this.BH, 0x2b3a66).setOrigin(0.5, 1).setStrokeStyle(1, 0x0d0a16);
    this.stackC.add(base);
    this.blocks.push({ x: 320, w: 200, o: base });
    this.crane = this.gfx();
    this.player(560, this.baseY, 40);
    this.curW = 180;
    this.newBlock();
  }

  topY() {
    return this.baseY - this.blocks.length * this.BH;
  }

  newBlock() {
    const col = CRATE[this.placed % CRATE.length];
    this.cur = this.s.add.rectangle(0, this.topY() - 60, this.curW, this.BH, col).setOrigin(0.5, 1).setStrokeStyle(1, 0x0d0a16);
    this.stackC.add(this.cur);
    this.dir = this.h.rng() < 0.5 ? 1 : -1;
    this.curX = this.dir > 0 ? 120 : 520;
    this.cur.x = this.curX;
    this.dropping = false;
  }

  speed() {
    return (150 + this.placed * 9) * (1 + (this.h.difficulty - 1) * 0.25) * (this.h.micro ? 1.2 : 1);
  }

  update(dt: number) {
    const i = this.h.inp;
    // 카메라: 탑이 높아지면 내려 보여준다
    const want = Math.max(0, this.baseY - this.topY() - 200);
    this.camY += (want - this.camY) * Math.min(1, dt * 6);
    this.stackC.y = this.camY;

    this.crane.clear();
    if (this.dropping) {
      this.cur.y += 600 * dt;
      if (this.cur.y >= this.topY()) {
        this.cur.y = this.topY();
        this.land();
      }
      return;
    }
    this.curX += this.dir * this.speed() * dt;
    if (this.curX > 560 || this.curX < 80) this.dir *= -1;
    this.cur.x = this.curX;
    this.crane.lineStyle(1, 0x9aa3ad, 0.8);
    this.crane.lineBetween(this.curX, 0, this.curX, this.cur.y - this.BH + this.camY);
    if (i.actionP || i.pointer.pressed) {
      this.dropping = true;
      this.h.sfx('select');
    }
  }

  land() {
    const top = this.blocks[this.blocks.length - 1];
    const l = Math.max(this.curX - this.curW / 2, top.x - top.w / 2);
    const r = Math.min(this.curX + this.curW / 2, top.x + top.w / 2);
    const ov = r - l;
    if (ov <= 0) {
      this.h.sfx('bad');
      const miss = this.cur;
      this.s.tweens.add({ targets: miss, y: miss.y + 300, angle: this.dir * 40, duration: 600, onComplete: () => miss.destroy() });
      if (this.h.hit(this.curX, this.topY() + this.camY)) this.newBlock();
      else this.finished = true;
      return;
    }
    const perfect = Math.abs(this.curX - top.x) < 4;
    let nx = (l + r) / 2,
      nw = ov;
    if (perfect) {
      nx = top.x;
      nw = Math.min(200, top.w + 4);
      this.h.float('완벽!', nx, this.topY() + this.camY - 24, '#ffd84b');
      this.h.sfx('star');
    } else {
      // 잘린 조각 떨어뜨리기
      const cutW = this.curW - ov;
      const cutX = this.curX > top.x ? r + cutW / 2 : l - cutW / 2;
      const piece = this.s.add.rectangle(cutX, this.cur.y, cutW, this.BH, this.cur.fillColor).setOrigin(0.5, 1);
      this.stackC.add(piece);
      this.s.tweens.add({ targets: piece, y: piece.y + 260, angle: (cutX > nx ? 1 : -1) * 60, alpha: 0, duration: 700, onComplete: () => piece.destroy() });
      this.h.sfx('stack');
    }
    this.cur.x = nx;
    this.cur.width = nw;
    this.cur.setDisplaySize(nw, this.BH);
    this.blocks.push({ x: nx, w: nw, o: this.cur });
    this.placed++;
    this.curW = nw;
    this.h.addScore(100 + (perfect ? 50 : 0), nx, this.topY() + this.camY - 10);
    this.h.shake(0.003);
    this.newBlock();
  }

  microDone() {
    return this.placed >= 3;
  }
  microSuccess() {
    return this.placed >= 3;
  }
}
