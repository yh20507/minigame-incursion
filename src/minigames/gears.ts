import Phaser from 'phaser';
import { MiniGame } from './base';

// 타일 종류: 연결 방향 비트 (상1 우2 하4 좌8)
const SHAPES = [0b0101, 0b0011, 0b0111, 0b1111]; // 직선, 꺾임, T, 십자
function rot(mask: number, n: number) {
  for (let i = 0; i < n; i++) mask = ((mask << 1) & 0b1111) | (mask >> 3);
  return mask;
}

interface Tile {
  shape: number;
  r: number; // 0~3 회전
  g: Phaser.GameObjects.Graphics;
  powered: boolean;
}

/** 톱니 조립: 조각을 돌려 왼쪽 동력원에서 오른쪽 출구까지 잇기 (파이프 퍼즐) */
export class GearsGame extends MiniGame {
  cols = 4;
  rows = 3;
  tiles: Tile[] = [];
  size = 56;
  ox = 0;
  oy = 0;
  src = 1; // 동력원 행
  dst = 1; // 출구 행
  solved = 0;
  bg!: Phaser.GameObjects.Graphics;
  lock = 0;
  label!: Phaser.GameObjects.Text;

  create() {
    this.bg = this.gfx();
    this.label = this.text(320, 326, '', 10, '#9fe0ff');
    this.cols = this.h.micro ? 3 : 4;
    this.rows = 3;
    this.board();
  }

  board() {
    for (const t of this.tiles) t.g.destroy();
    this.tiles = [];
    this.size = Math.min(56, Math.floor(560 / this.cols), Math.floor(270 / this.rows));
    this.ox = Math.round((640 - this.cols * this.size) / 2);
    this.oy = Math.round((300 - this.rows * this.size) / 2) + 10;
    this.src = Math.floor(this.h.rng() * this.rows);
    this.dst = Math.floor(this.h.rng() * this.rows);
    // 해답 경로를 먼저 만들고(랜덤 워크) 나머지는 아무 조각
    const path: [number, number][] = [];
    let r = this.src;
    for (let c = 0; c < this.cols; c++) {
      path.push([c, r]);
      // 세로로 움직이기
      const target = c === this.cols - 1 ? this.dst : Math.max(0, Math.min(this.rows - 1, r + Math.round(this.rnd(-1, 1))));
      while (r !== target) {
        r += target > r ? 1 : -1;
        path.push([c, r]);
      }
    }
    const need = new Map<string, number>();
    const key = (c: number, r: number) => `${c},${r}`;
    need.set(key(0, this.src), 8);
    for (let i = 0; i < path.length; i++) {
      const [c, r] = path[i];
      let m = need.get(key(c, r)) ?? 0;
      if (i > 0) {
        const [pc, pr] = path[i - 1];
        m |= pc < c ? 8 : pr < r ? 1 : 4;
      }
      if (i < path.length - 1) {
        const [nc, nr] = path[i + 1];
        m |= nc > c ? 2 : nr > r ? 4 : 1;
      }
      need.set(key(c, r), m);
    }
    const last = path[path.length - 1];
    need.set(key(last[0], last[1]), (need.get(key(last[0], last[1])) ?? 0) | 2);
    for (let rr = 0; rr < this.rows; rr++)
      for (let cc = 0; cc < this.cols; cc++) {
        const m = need.get(key(cc, rr));
        let shape: number;
        if (m !== undefined) {
          // 비트 수에 따라 모양 고르기 (필요 연결을 포함하는 모양)
          const bits = [m & 1, m & 2, m & 4, m & 8].filter(Boolean).length;
          shape = bits >= 3 ? (bits === 4 ? 0b1111 : 0b0111) : (m === 0b0101 || m === 0b1010 ? 0b0101 : 0b0011);
          if (bits === 2 && (m === 0b0101 || m === 0b1010)) shape = 0b0101;
          else if (bits === 2) shape = 0b0011;
          // 가끔 더 많은 연결 (십자) 로 쉬움 조절
          if (this.h.rng() < 0.12 && bits <= 2) shape = 0b0111;
        } else shape = SHAPES[Math.floor(this.h.rng() * 3)];
        const g = this.gfx();
        const t: Tile = { shape, r: Math.floor(this.h.rng() * 4), g, powered: false };
        this.tiles.push(t);
      }
    this.power();
    this.drawAll();
  }

  mask(t: Tile) {
    return rot(t.shape, t.r);
  }
  at(c: number, r: number) {
    return this.tiles[r * this.cols + c];
  }

  /** 동력 전파. 출구에 닿으면 true */
  power() {
    for (const t of this.tiles) t.powered = false;
    const q: [number, number][] = [];
    const s = this.at(0, this.src);
    if (this.mask(s) & 8) {
      s.powered = true;
      q.push([0, this.src]);
    }
    const dirs: [number, number, number, number][] = [
      [0, -1, 1, 4],
      [1, 0, 2, 8],
      [0, 1, 4, 1],
      [-1, 0, 8, 2],
    ];
    while (q.length) {
      const [c, r] = q.shift()!;
      const m = this.mask(this.at(c, r));
      for (const [dx, dy, bit, back] of dirs) {
        if (!(m & bit)) continue;
        const nc = c + dx,
          nr = r + dy;
        if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
        const n = this.at(nc, nr);
        if (n.powered || !(this.mask(n) & back)) continue;
        n.powered = true;
        q.push([nc, nr]);
      }
    }
    const e = this.at(this.cols - 1, this.dst);
    return e.powered && !!(this.mask(e) & 2);
  }

  drawAll() {
    const bg = this.bg;
    bg.clear();
    bg.fillStyle(0x0f1a2a, 1);
    bg.fillRect(this.ox - 8, this.oy - 8, this.cols * this.size + 16, this.rows * this.size + 16);
    // 동력원·출구
    const sy = this.oy + this.src * this.size + this.size / 2;
    const dy = this.oy + this.dst * this.size + this.size / 2;
    bg.fillStyle(0xffd84b, 1);
    bg.fillRect(this.ox - 26, sy - 8, 18, 16);
    bg.fillStyle(0x9fe0ff, 1);
    bg.fillRect(this.ox + this.cols * this.size + 8, dy - 8, 18, 16);
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this.drawTile(c, r);
    this.label.setText(`완성 ${this.solved} · 조각을 눌러 회전`);
  }

  drawTile(c: number, r: number) {
    const t = this.at(c, r);
    const g = t.g;
    const x = this.ox + c * this.size;
    const y = this.oy + r * this.size;
    const s = this.size;
    const h = s / 2;
    g.clear();
    g.fillStyle(0x1b2838, 1);
    g.fillRect(x + 1, y + 1, s - 2, s - 2);
    const col = t.powered ? 0xffd84b : 0x4f6a8a;
    const m = this.mask(t);
    g.lineStyle(Math.max(4, s * 0.18), col, 1);
    if (m & 1) g.lineBetween(x + h, y + h, x + h, y);
    if (m & 2) g.lineBetween(x + h, y + h, x + s, y + h);
    if (m & 4) g.lineBetween(x + h, y + h, x + h, y + s);
    if (m & 8) g.lineBetween(x + h, y + h, x, y + h);
    // 톱니 허브
    g.fillStyle(t.powered ? 0xfff2b0 : 0x7d93b3, 1);
    g.fillCircle(x + h, y + h, s * 0.17);
    g.fillStyle(0x0f1a2a, 1);
    g.fillCircle(x + h, y + h, s * 0.06);
  }

  update(dt: number) {
    if (this.lock > 0) {
      this.lock -= dt;
      return;
    }
    const p = this.h.inp.pointer;
    if (!p.pressed) return;
    const c = Math.floor((p.x - this.ox) / this.size);
    const r = Math.floor((p.y - this.oy) / this.size);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
    const t = this.at(c, r);
    t.r = (t.r + 1) % 4;
    this.h.sfx('tick');
    const done = this.power();
    this.drawAll();
    if (done) {
      this.solved++;
      const bonus = this.cols * this.rows * 12;
      this.h.sfx('win');
      this.h.addScore(150 + bonus, 320, 150);
      this.lock = 0.6;
      // 다음 판 커지기
      if (!this.h.micro) {
        if (this.solved % 2 === 1) this.cols = Math.min(9, this.cols + 1);
        else this.rows = Math.min(5, this.rows + 1);
      }
      this.s.time.delayedCall(500, () => !this.finished && this.board());
    }
  }

  microDone() {
    return this.solved >= 1;
  }
  microSuccess() {
    return this.solved >= 1;
  }
}
