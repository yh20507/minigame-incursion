import Phaser from 'phaser';
import { MiniGame } from './base';

/** 배달 드론: 격자 위에 드래그로 경로를 그려 모든 배달지를 잇는다. 막힌 칸·교차 금지, 시작은 드론 칸. 제한시간 안에 완성하면 다음 판. */
export class CourierGame extends MiniGame {
  cols = 6;
  rows = 4;
  size = 54;
  ox = 0;
  oy = 0;
  blocked = new Set<string>();
  targets = new Set<string>();
  path: string[] = [];
  drawing = false;
  g!: Phaser.GameObjects.Graphics;
  label!: Phaser.GameObjects.Text;
  solved = 0;
  roundT = 0;
  roundLimit = 14;
  lock = 0;

  create() {
    const bg = this.gfx();
    bg.fillGradientStyle(0x1a1030, 0x1a1030, 0x0a0618, 0x0a0618, 1);
    bg.fillRect(0, 0, 640, 340);
    this.g = this.gfx();
    this.label = this.text(320, 326, '', 10, '#ff5fd2');
    this.cols = this.h.micro ? 4 : 5;
    this.rows = 3;
    this.board();
  }

  key(c: number, r: number) {
    return `${c},${r}`;
  }
  board() {
    this.size = Math.min(60, Math.floor(540 / this.cols), Math.floor(250 / this.rows));
    this.ox = Math.round((640 - this.cols * this.size) / 2);
    this.oy = Math.round((300 - this.rows * this.size) / 2) + 6;
    this.blocked.clear();
    this.targets.clear();
    this.path = [this.key(0, 0)];
    // 해답 경로 (랜덤 워크로 만든 자기회피 경로) 위에 배달지, 밖에 장애물
    const visited = new Set<string>([this.key(0, 0)]);
    let c = 0,
      r = 0;
    const len = Math.min(this.cols * this.rows - 1, 5 + this.solved * 2 + Math.round((this.h.difficulty - 1) * 3));
    const route: [number, number][] = [[0, 0]];
    for (let i = 0; i < len; i++) {
      const opts = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]).map(([dx, dy]) => [c + dx, r + dy] as [number, number]).filter(([x, y]) => x >= 0 && y >= 0 && x < this.cols && y < this.rows && !visited.has(this.key(x, y)));
      if (!opts.length) break;
      const [nx, ny] = opts[Math.floor(this.h.rng() * opts.length)];
      c = nx;
      r = ny;
      visited.add(this.key(c, r));
      route.push([c, r]);
    }
    const nT = Math.min(4, 2 + Math.floor(this.solved / 2));
    const picks = route.slice(1).sort(() => this.h.rng() - 0.5).slice(0, nT);
    for (const [x, y] of picks) this.targets.add(this.key(x, y));
    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < this.cols; x++) if (!visited.has(this.key(x, y)) && this.h.rng() < 0.35) this.blocked.add(this.key(x, y));
    this.roundT = 0;
    this.roundLimit = Math.max(7, 14 - this.solved - (this.h.difficulty - 1) * 3);
    this.draw();
  }

  cellAt(px: number, py: number): [number, number] | null {
    const c = Math.floor((px - this.ox) / this.size);
    const r = Math.floor((py - this.oy) / this.size);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return null;
    return [c, r];
  }

  draw() {
    const g = this.g;
    const s = this.size;
    g.clear();
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const x = this.ox + c * s,
          y = this.oy + r * s;
        const k = this.key(c, r);
        g.fillStyle(this.blocked.has(k) ? 0x3a2a4a : 0x151025, 1);
        g.fillRect(x + 1, y + 1, s - 2, s - 2);
        if (this.blocked.has(k)) {
          g.fillStyle(0x5a3a6a, 1);
          g.fillRect(x + 8, y + s - 20, s - 16, 12);
          g.fillRect(x + 14, y + s - 30, s - 28, 10);
        }
        if (this.targets.has(k)) {
          const done = this.path.includes(k);
          g.fillStyle(done ? 0x4be37a : 0xffd84b, 1);
          g.fillRect(x + s / 2 - 10, y + s / 2 - 8, 20, 16);
          g.fillStyle(0x151025, 1);
          g.fillRect(x + s / 2 - 1, y + s / 2 - 8, 2, 16);
        }
      }
    // 경로
    g.lineStyle(6, 0x5fd3e0, 0.9);
    for (let i = 1; i < this.path.length; i++) {
      const [ac, ar] = this.path[i - 1].split(',').map(Number);
      const [bc, br] = this.path[i].split(',').map(Number);
      g.lineBetween(this.ox + ac * s + s / 2, this.oy + ar * s + s / 2, this.ox + bc * s + s / 2, this.oy + br * s + s / 2);
    }
    // 드론 (경로 끝)
    const [lc, lr] = this.path[this.path.length - 1].split(',').map(Number);
    const dx = this.ox + lc * s + s / 2,
      dy = this.oy + lr * s + s / 2;
    g.fillStyle(0xff5fd2, 1);
    g.fillRect(dx - 10, dy - 6, 20, 12);
    g.fillStyle(0x5fd3e0, 1);
    g.fillRect(dx - 16, dy - 10, 8, 3);
    g.fillRect(dx + 8, dy - 10, 8, 3);
    const left = Math.max(0, this.roundLimit - this.roundT);
    g.fillStyle(0x0b0918, 0.7);
    g.fillRect(this.ox, this.oy - 14, this.cols * s, 6);
    g.fillStyle(left < 3 ? 0xff4b6e : 0x5fd3e0, 1);
    g.fillRect(this.ox, this.oy - 14, this.cols * s * (left / this.roundLimit), 6);
    const got = [...this.targets].filter((t) => this.path.includes(t)).length;
    this.label.setText(`배달 ${got}/${this.targets.size} · 판 ${this.solved + 1} · 드래그로 경로 그리기 (교차·장애물 금지)`);
  }

  update(dt: number) {
    if (this.lock > 0) {
      this.lock -= dt;
      return;
    }
    this.roundT += dt;
    if (this.roundT >= this.roundLimit) {
      this.h.hit(320, 170);
      this.h.float('시간 초과!', 320, 150, '#ff4b6e');
      this.lock = 0.5;
      this.s.time.delayedCall(400, () => !this.finished && this.board());
      return;
    }
    const p = this.h.inp.pointer;
    const cell = this.cellAt(p.x, p.y);
    if (p.pressed) {
      // 시작: 경로 끝 칸이나 경로 위 칸에서 시작하면 그 지점까지 되감기
      if (cell) {
        const k = this.key(cell[0], cell[1]);
        const idx = this.path.indexOf(k);
        if (idx >= 0) {
          this.path = this.path.slice(0, idx + 1);
          this.drawing = true;
          this.draw();
        }
      }
    }
    if (p.released) this.drawing = false;
    if (this.drawing && p.down && cell) {
      const k = this.key(cell[0], cell[1]);
      const last = this.path[this.path.length - 1];
      if (k === last) return;
      const [lc, lr] = last.split(',').map(Number);
      const adjacent = Math.abs(lc - cell[0]) + Math.abs(lr - cell[1]) === 1;
      if (!adjacent) return;
      if (this.blocked.has(k)) {
        this.h.sfx('cancel');
        return;
      }
      const prev = this.path.indexOf(k);
      if (prev >= 0) {
        this.path = this.path.slice(0, prev + 1); // 되감기
      } else {
        this.path.push(k);
        this.h.sfx('tick');
        if (this.targets.has(k)) this.h.addScore(40, this.ox + cell[0] * this.size + this.size / 2, this.oy + cell[1] * this.size);
      }
      this.draw();
      if ([...this.targets].every((t) => this.path.includes(t))) {
        this.solved++;
        this.drawing = false;
        this.h.sfx('win');
        const bonus = Math.round((this.roundLimit - this.roundT) * 12);
        this.h.addScore(120 + bonus, 320, 150);
        this.h.float(`배달 완료! +${bonus} 시간 보너스`, 320, 130, '#4be37a');
        this.lock = 0.6;
        if (!this.h.micro && this.solved % 2 === 0) {
          if (this.cols < 8) this.cols++;
          else if (this.rows < 5) this.rows++;
        }
        this.s.time.delayedCall(500, () => !this.finished && this.board());
      }
    }
  }

  microDone() {
    return this.solved >= 1;
  }
  microSuccess() {
    return this.solved >= 1;
  }
}
