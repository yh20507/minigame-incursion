import Phaser from 'phaser';
import { MiniGame } from './base';

const PROPS = ['의자', '램프', '꽃병', '상자', '시계', '거울'];
const COLS = [0xffb3a7, 0xffe08a, 0x4fd1c5, 0xb48cff, 0x7fd37a, 0xff9ad5];

/** 무대 전환: 커튼이 열릴 때 소품이 빛나는 순서를 외워 그대로 누르기 (사이먼). 막이 갈수록 순서가 길어진다. */
export class StageGame extends MiniGame {
  seq: number[] = [];
  input: number[] = [];
  showing = false;
  showIdx = 0;
  showT = 0;
  tiles: { x: number; y: number; o: Phaser.GameObjects.Graphics }[] = [];
  acts = 0;
  label!: Phaser.GameObjects.Text;
  n = 4; // 소품 수

  create() {
    const bg = this.gfx();
    bg.fillGradientStyle(0x6b3a3a, 0x6b3a3a, 0x241212, 0x241212, 1);
    bg.fillRect(0, 0, 640, 340);
    bg.fillStyle(0x3a2222, 1);
    bg.fillRect(0, 260, 640, 80);
    bg.fillStyle(0x8a2a2a, 1);
    bg.fillRect(0, 0, 36, 340);
    bg.fillRect(604, 0, 36, 340);
    this.n = this.h.micro ? 4 : 4 + Math.round(this.h.difficulty - 1);
    this.n = Math.min(6, this.n);
    for (let i = 0; i < this.n; i++) {
      const x = 320 + (i - (this.n - 1) / 2) * 95;
      const o = this.gfx();
      this.tiles.push({ x, y: 170, o });
      this.text(x, 228, PROPS[i], 10, '#ffb3a7');
    }
    this.drawAll(-1);
    this.label = this.text(320, 12, '', 10, '#ffb3a7');
    this.player(320, 300, 40);
    this.newAct();
  }

  drawTile(i: number, lit: boolean) {
    const t = this.tiles[i];
    const g = t.o;
    g.clear();
    g.fillStyle(lit ? COLS[i] : 0x241212, 1);
    g.fillRoundedRect(t.x - 36, t.y - 36, 72, 72, 10);
    g.lineStyle(2, COLS[i], lit ? 1 : 0.6);
    g.strokeRoundedRect(t.x - 36, t.y - 36, 72, 72, 10);
    // 소품 아이콘
    g.fillStyle(lit ? 0x241212 : COLS[i], 1);
    switch (i) {
      case 0:
        g.fillRect(t.x - 14, t.y - 4, 28, 6);
        g.fillRect(t.x - 14, t.y - 20, 6, 36);
        g.fillRect(t.x + 8, t.y + 2, 6, 14);
        break;
      case 1:
        g.fillTriangle(t.x - 16, t.y - 4, t.x + 16, t.y - 4, t.x, t.y - 22);
        g.fillRect(t.x - 2, t.y - 4, 4, 22);
        break;
      case 2:
        g.fillEllipse(t.x, t.y + 6, 22, 26);
        g.fillRect(t.x - 5, t.y - 20, 10, 12);
        break;
      case 3:
        g.fillRect(t.x - 16, t.y - 10, 32, 26);
        break;
      case 4:
        g.fillCircle(t.x, t.y, 18);
        g.fillStyle(lit ? COLS[i] : 0x241212, 1);
        g.fillRect(t.x - 1, t.y - 12, 2, 12);
        g.fillRect(t.x, t.y - 1, 9, 2);
        break;
      case 5:
        g.fillEllipse(t.x, t.y - 2, 24, 32);
        g.fillRect(t.x - 3, t.y + 12, 6, 10);
        break;
    }
  }
  drawAll(lit: number) {
    for (let i = 0; i < this.tiles.length; i++) this.drawTile(i, i === lit);
  }

  newAct() {
    const len = Math.min(9, (this.h.micro ? 2 : 3) + Math.floor(this.acts / 1) + Math.round(this.h.difficulty - 1));
    this.seq = [];
    for (let i = 0; i < len; i++) this.seq.push(Math.floor(this.h.rng() * this.n));
    this.input = [];
    this.showing = true;
    this.showIdx = -1;
    this.showT = 0.4;
    this.label.setText(`${this.acts + 1}막 · 순서를 외우세요`);
  }

  update(dt: number) {
    const speed = Math.max(0.28, 0.55 - this.acts * 0.03 - (this.h.difficulty - 1) * 0.1);
    if (this.showing) {
      this.showT -= dt;
      if (this.showT <= 0) {
        this.showIdx++;
        if (this.showIdx >= this.seq.length) {
          this.showing = false;
          this.drawAll(-1);
          this.label.setText(`${this.acts + 1}막 · 본 순서대로 누르세요 (${this.seq.length}개)`);
          return;
        }
        this.drawAll(this.seq[this.showIdx]);
        this.h.sfx('tick');
        this.showT = speed;
        this.s.time.delayedCall(speed * 600, () => !this.showing || this.drawAll(-1));
      }
      return;
    }
    const inp = this.h.inp;
    let pick = -1;
    for (let i = 0; i < this.n; i++) if (inp.codes.has('Digit' + (i + 1)) || inp.codes.has('Numpad' + (i + 1))) pick = i;
    if (inp.pointer.pressed) {
      const i = this.tiles.findIndex((t) => Math.abs(t.x - inp.pointer.x) < 38 && Math.abs(t.y - inp.pointer.y) < 38);
      if (i >= 0) pick = i;
    }
    if (pick < 0) return;
    this.drawAll(pick);
    this.s.time.delayedCall(150, () => !this.showing && this.drawAll(-1));
    const expect = this.seq[this.input.length];
    if (pick === expect) {
      this.input.push(pick);
      this.h.sfx('select');
      this.h.addScore(20, this.tiles[pick].x, this.tiles[pick].y - 50);
      if (this.input.length === this.seq.length) {
        this.acts++;
        this.h.sfx('win');
        this.h.addScore(80 + this.seq.length * 25, 320, 100);
        this.h.float(`${this.acts}막 완료!`, 320, 80, '#ffe08a');
        this.s.time.delayedCall(600, () => !this.finished && this.newAct());
        this.showing = true;
        this.showIdx = 999;
        this.showT = 99;
      }
    } else {
      this.h.sfx('bad');
      this.h.float('순서가 틀렸다', 320, 100, '#ff4b6e');
      this.h.hit(this.tiles[pick].x, this.tiles[pick].y);
      this.input = [];
      // 같은 순서 다시 보여 주기
      this.showing = true;
      this.showIdx = -1;
      this.showT = 0.8;
    }
  }

  microDone() {
    return this.acts >= 1;
  }
  microSuccess() {
    return this.acts >= 1;
  }
}
