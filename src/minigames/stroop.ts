import Phaser from 'phaser';
import { MiniGame } from './base';

const COLORS = [
  { name: '빨강', hex: '#ff4b6e' },
  { name: '파랑', hex: '#4aa3ff' },
  { name: '초록', hex: '#4be37a' },
  { name: '노랑', hex: '#ffd84b' },
  { name: '보라', hex: '#b06cff' },
];

/** 방화벽 해킹: 단어 뜻과 글자 색이 같은지 판단 */
export class StroopGame extends MiniGame {
  word!: Phaser.GameObjects.Text;
  decoy!: Phaser.GameObjects.Text;
  same = false;
  streak = 0;
  correct = 0;
  lock = 0;
  frame!: Phaser.GameObjects.Graphics;
  progress!: Phaser.GameObjects.Graphics;
  codeLines: Phaser.GameObjects.Text[] = [];

  create() {
    for (let k = 0; k < 14; k++) {
      const t = this.text(20, 20 + k * 22, this.junk(), 10, '#2a5a4a', [0, 0]);
      this.codeLines.push(t);
    }
    this.frame = this.gfx();
    this.frame.fillStyle(0x07060f, 0.9);
    this.frame.fillRect(170, 90, 300, 120);
    this.frame.lineStyle(2, 0x4be37a, 0.8);
    this.frame.strokeRect(170, 90, 300, 120);
    this.text(320, 104, '[ 방화벽 검증 ]', 10, '#4be37a');
    this.word = this.text(320, 150, '', 36);
    this.decoy = this.text(320, 186, '', 10, '#a69fd0');
    this.progress = this.gfx();
    const lb = this.text(200, 262, '◀ 다름', 24, '#ff4b6e');
    const rb = this.text(440, 262, '같음 ▶', 24, '#4be37a');
    lb.setInteractive();
    rb.setInteractive();
    this.player(320, 330, 40);
    this.next();
  }

  junk() {
    const chars = '01ABCDEF<>{}=#$';
    let s = '';
    for (let i = 0; i < 18; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  next() {
    const r = this.h.rng;
    const a = Math.floor(r() * COLORS.length);
    this.same = r() < 0.5;
    let b = a;
    if (!this.same) {
      b = Math.floor(r() * (COLORS.length - 1));
      if (b >= a) b++;
    }
    this.word.setText(COLORS[a].name).setColor(COLORS[b].hex).setScale(1.2);
    this.s.tweens.add({ targets: this.word, scale: 1, duration: 100 });
    const hard = this.h.difficulty > 1 || this.h.t > 15;
    if (hard) {
      const c = COLORS[Math.floor(r() * COLORS.length)];
      this.decoy.setText(COLORS[Math.floor(r() * COLORS.length)].name).setColor(c.hex);
    } else this.decoy.setText('');
  }

  answer(saySame: boolean) {
    if (saySame === this.same) {
      this.streak++;
      this.correct++;
      this.h.addScore(100 + Math.min(this.streak, 20) * 10, 320, 120);
      this.h.sfx('good');
      this.frame.clear();
      this.frame.fillStyle(0x07060f, 0.9);
      this.frame.fillRect(170, 90, 300, 120);
      this.frame.lineStyle(2, 0x4be37a, 1);
      this.frame.strokeRect(170, 90, 300, 120);
    } else {
      this.streak = 0;
      this.h.sfx('bad');
      this.h.float('-3초', 320, 120, '#ff4b6e');
      this.h.shake(0.006);
      if (this.h.micro) {
        this.h.hit();
        return;
      }
      this.h.addTime(-3);
      this.lock = 0.25;
    }
    this.next();
  }

  update(dt: number) {
    const i = this.h.inp;
    if (Math.random() < dt * 8) {
      const t = this.codeLines[Math.floor(Math.random() * this.codeLines.length)];
      t.setText(this.junk());
    }
    if (this.lock > 0) {
      this.lock -= dt;
      return;
    }
    if (i.leftP) this.answer(false);
    else if (i.rightP) this.answer(true);
    else if (i.pointer.pressed && i.pointer.y > 230) this.answer(i.pointer.x > 320);
  }

  microDone() {
    return this.correct >= 3;
  }
  microSuccess() {
    return this.correct >= 3;
  }
}
