import Phaser from 'phaser';
import { MiniGame } from './base';

// 기호: 모양 id (0~7) 과 색 (0~3)
const SHAPES = 8;
const COLORS = [0x4fd1c5, 0xffd84b, 0xff5fd2, 0xe8f4ff];

type Sym = { s: number; c: number };
type Rule = { kind: 'shape_step' | 'color_step' | 'both' | 'alt'; a: number; b: number };

/** 보물 해독: 기호 수열의 규칙을 읽고 다음 기호를 골라라. 맞을수록 규칙이 복잡해진다. */
export class CipherGame extends MiniGame {
  seq: Sym[] = [];
  answer!: Sym;
  options: Sym[] = [];
  level = 0;
  solved = 0;
  g!: Phaser.GameObjects.Graphics;
  label!: Phaser.GameObjects.Text;
  lock = 0;
  optRects: { x: number; y: number; w: number; h: number }[] = [];

  create() {
    const bg = this.gfx();
    bg.fillStyle(0x071d26, 1);
    bg.fillRect(0, 0, 640, 340);
    bg.fillStyle(0x0b2a30, 1);
    bg.fillRect(40, 60, 560, 110);
    bg.lineStyle(2, 0x4fd1c5, 0.5);
    bg.strokeRect(40.5, 60.5, 559, 109);
    this.g = this.gfx();
    this.text(320, 40, '규칙을 읽고 다음 기호를 고르세요', 10, '#4fd1c5');
    this.label = this.text(320, 326, '', 10, '#4fd1c5');
    this.next();
  }

  gen(): { seq: Sym[]; ans: Sym } {
    const d = this.h.difficulty;
    const lv = this.level + Math.round((d - 1) * 2);
    const kinds: Rule['kind'][] = lv < 2 ? ['shape_step'] : lv < 4 ? ['shape_step', 'color_step'] : lv < 6 ? ['shape_step', 'color_step', 'both'] : ['both', 'alt', 'color_step'];
    const kind = kinds[Math.floor(this.h.rng() * kinds.length)];
    const a = 1 + Math.floor(this.h.rng() * (lv < 3 ? 1 : 3)); // 모양 보폭
    const b = 1 + Math.floor(this.h.rng() * 2); // 색 보폭
    const n = Math.min(6, 4 + Math.floor(lv / 3));
    let s = Math.floor(this.h.rng() * SHAPES),
      c = Math.floor(this.h.rng() * COLORS.length);
    const seq: Sym[] = [];
    const alt: Sym[] = [
      { s: Math.floor(this.h.rng() * SHAPES), c: Math.floor(this.h.rng() * COLORS.length) },
      { s: Math.floor(this.h.rng() * SHAPES), c: Math.floor(this.h.rng() * COLORS.length) },
    ];
    for (let i = 0; i < n + 1; i++) {
      if (kind === 'alt') seq.push({ ...alt[i % 2] });
      else {
        seq.push({ s, c });
        if (kind === 'shape_step' || kind === 'both') s = (s + a) % SHAPES;
        if (kind === 'color_step' || kind === 'both') c = (c + b) % COLORS.length;
      }
    }
    const ans = seq.pop()!;
    return { seq, ans };
  }

  next() {
    const { seq, ans } = this.gen();
    this.seq = seq;
    this.answer = ans;
    const opts: Sym[] = [ans];
    while (opts.length < 3) {
      const o = { s: Math.floor(this.h.rng() * SHAPES), c: Math.floor(this.h.rng() * COLORS.length) };
      if (!opts.some((x) => x.s === o.s && x.c === o.c)) opts.push(o);
    }
    // 섞기
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(this.h.rng() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    this.options = opts;
    this.draw();
  }

  sym(g: Phaser.GameObjects.Graphics, x: number, y: number, v: Sym, size = 16) {
    const col = COLORS[v.c];
    g.fillStyle(col, 1);
    g.lineStyle(2, col, 1);
    const r = size;
    switch (v.s) {
      case 0:
        g.fillCircle(x, y, r);
        break;
      case 1:
        g.fillRect(x - r, y - r, r * 2, r * 2);
        break;
      case 2:
        g.fillTriangle(x, y - r, x + r, y + r, x - r, y + r);
        break;
      case 3:
        g.fillTriangle(x - r, y, x, y - r, x + r, y);
        g.fillTriangle(x - r, y, x, y + r, x + r, y);
        break;
      case 4:
        g.strokeCircle(x, y, r);
        break;
      case 5:
        g.strokeRect(x - r, y - r, r * 2, r * 2);
        break;
      case 6:
        g.lineBetween(x - r, y - r, x + r, y + r);
        g.lineBetween(x - r, y + r, x + r, y - r);
        break;
      case 7:
        g.fillRect(x - r, y - 3, r * 2, 6);
        g.fillRect(x - 3, y - r, 6, r * 2);
        break;
    }
  }

  draw() {
    const g = this.g;
    g.clear();
    const n = this.seq.length + 1;
    const step = Math.min(90, 520 / n);
    const x0 = 320 - ((n - 1) * step) / 2;
    this.seq.forEach((v, i) => this.sym(g, x0 + i * step, 115, v));
    // 물음표 칸
    const qx = x0 + (n - 1) * step;
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeRect(qx - 20, 95, 40, 40);
    this.optRects = [];
    this.options.forEach((v, i) => {
      const x = 320 + (i - 1) * 140;
      const y = 235;
      g.fillStyle(0x0b2a30, 1);
      g.fillRect(x - 50, y - 36, 100, 72);
      g.lineStyle(1, 0x4fd1c5, 0.6);
      g.strokeRect(x - 50.5, y - 36.5, 101, 73);
      this.sym(g, x, y, v, 18);
      this.optRects.push({ x: x - 50, y: y - 36, w: 100, h: 72 });
    });
    this.label.setText(`해독 ${this.solved} · 1/2/3 키 또는 클릭`);
  }

  update(dt: number) {
    if (this.lock > 0) {
      this.lock -= dt;
      return;
    }
    const inp = this.h.inp;
    let pick = -1;
    if (inp.codes.has('Digit1') || inp.codes.has('Numpad1')) pick = 0;
    if (inp.codes.has('Digit2') || inp.codes.has('Numpad2')) pick = 1;
    if (inp.codes.has('Digit3') || inp.codes.has('Numpad3')) pick = 2;
    if (inp.pointer.pressed) {
      const i = this.optRects.findIndex((r) => inp.pointer.x >= r.x && inp.pointer.x <= r.x + r.w && inp.pointer.y >= r.y && inp.pointer.y <= r.y + r.h);
      if (i >= 0) pick = i;
    }
    if (pick < 0) return;
    const v = this.options[pick];
    const x = 320 + (pick - 1) * 140;
    if (v.s === this.answer.s && v.c === this.answer.c) {
      this.solved++;
      this.level++;
      this.h.sfx('good');
      this.h.addScore(100 + this.level * 15, x, 190);
      this.lock = 0.35;
      this.s.time.delayedCall(250, () => !this.finished && this.next());
    } else {
      this.h.sfx('bad');
      this.h.float('틀림', x, 190, '#ff4b6e');
      this.level = Math.max(0, this.level - 1);
      this.h.hit(x, 235);
      this.lock = 0.5;
      this.s.time.delayedCall(400, () => !this.finished && this.next());
    }
  }

  microDone() {
    return this.solved >= 1;
  }
  microSuccess() {
    return this.solved >= 1;
  }
}
