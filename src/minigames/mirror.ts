import Phaser from 'phaser';
import { MiniGame } from './base';

// 격자 안의 거울: '/' 또는 '\' . 빛은 왼쪽에서 들어와 거울에 반사된다. 모든 수정에 닿으면 판 완성.
type Cell = { mirror: 0 | 1 | 2; crystal: boolean; lit: boolean }; // 0 없음, 1 '/', 2 '\'

/** 거울 반사: 거울을 클릭해 돌려 빛을 모든 수정에 닿게 하라. */
export class MirrorGame extends MiniGame {
  cols = 6;
  rows = 4;
  grid: Cell[][] = [];
  size = 52;
  ox = 0;
  oy = 0;
  srcRow = 1;
  g!: Phaser.GameObjects.Graphics;
  solved = 0;
  lock = 0;
  label!: Phaser.GameObjects.Text;

  create() {
    const bg = this.gfx();
    bg.fillGradientStyle(0x5a3f6e, 0x5a3f6e, 0x1a1022, 0x1a1022, 1);
    bg.fillRect(0, 0, 640, 340);
    this.g = this.gfx();
    this.label = this.text(320, 326, '', 10, '#f2c4ff');
    this.cols = this.h.micro ? 4 : 5;
    this.rows = 3;
    this.board();
  }

  board() {
    const d = this.h.difficulty;
    this.size = Math.min(56, Math.floor(540 / this.cols), Math.floor(260 / this.rows));
    this.ox = Math.round((640 - this.cols * this.size) / 2);
    this.oy = Math.round((300 - this.rows * this.size) / 2) + 10;
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < this.cols; c++) row.push({ mirror: 0, crystal: false, lit: false });
      this.grid.push(row);
    }
    this.srcRow = Math.floor(this.h.rng() * this.rows);
    // 해답 경로 생성: 광선을 따라가며 거울을 놓고 수정을 놓는다
    let r = this.srcRow,
      c = 0,
      dir: [number, number] = [1, 0];
    const nCrystals = Math.min(4, 2 + Math.floor(this.solved / 2) + Math.round(d - 1));
    let placed = 0;
    let steps = 0;
    const visited = new Set<string>();
    while (c >= 0 && c < this.cols && r >= 0 && r < this.rows && steps < 40) {
      steps++;
      const key = `${c},${r}`;
      const cell = this.grid[r][c];
      if (!visited.has(key) && cell.mirror === 0 && !cell.crystal) {
        const roll = this.h.rng();
        if (roll < 0.3 && placed < nCrystals && steps > 1) {
          cell.crystal = true;
          placed++;
        } else if (roll < 0.62) {
          // 거울 놓고 방향 바꾸기
          cell.mirror = this.h.rng() < 0.5 ? 1 : 2;
          dir = this.reflect(dir, cell.mirror);
        }
      }
      visited.add(key);
      c += dir[0];
      r += dir[1];
    }
    if (placed === 0) {
      // 최소 하나는 보장
      const cc = Math.min(this.cols - 1, 2);
      this.grid[this.srcRow][cc].crystal = true;
      this.grid[this.srcRow][cc].mirror = 0;
    }
    // 거울 섞기 (정답에서 회전) + 미끼 거울
    for (const row of this.grid)
      for (const cell of row) {
        if (cell.mirror) cell.mirror = this.h.rng() < 0.7 ? ((cell.mirror === 1 ? 2 : 1) as 1 | 2) : cell.mirror;
        else if (!cell.crystal && this.h.rng() < 0.12) cell.mirror = this.h.rng() < 0.5 ? 1 : 2;
      }
    this.trace();
    this.draw();
  }

  reflect(dir: [number, number], m: 1 | 2): [number, number] {
    // '/' : (1,0)->(0,-1), (0,1)->(-1,0), (-1,0)->(0,1), (0,-1)->(1,0)
    if (m === 1) return [-dir[1], -dir[0]];
    return [dir[1], dir[0]];
  }

  /** 빛 추적. 닿은 수정 수와 경로를 돌려준다 */
  trace() {
    for (const row of this.grid) for (const cell of row) cell.lit = false;
    const path: [number, number][] = [];
    let r = this.srcRow,
      c = 0,
      dir: [number, number] = [1, 0];
    let steps = 0;
    const seen = new Set<string>();
    while (c >= 0 && c < this.cols && r >= 0 && r < this.rows && steps < 60) {
      const key = `${c},${r},${dir}`;
      if (seen.has(key)) break;
      seen.add(key);
      steps++;
      const cell = this.grid[r][c];
      path.push([c, r]);
      if (cell.crystal) cell.lit = true;
      if (cell.mirror) dir = this.reflect(dir, cell.mirror);
      c += dir[0];
      r += dir[1];
    }
    (this as any).path = path;
    (this as any).exit = [c, r];
    return this.grid.flat().filter((x) => x.crystal && x.lit).length;
  }

  draw() {
    const g = this.g;
    const s = this.size;
    g.clear();
    g.fillStyle(0x1a1022, 0.8);
    g.fillRect(this.ox - 6, this.oy - 6, this.cols * s + 12, this.rows * s + 12);
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const x = this.ox + c * s,
          y = this.oy + r * s;
        g.fillStyle(0x2e1f36, 1);
        g.fillRect(x + 1, y + 1, s - 2, s - 2);
      }
    // 광선
    const path = (this as any).path as [number, number][];
    g.lineStyle(4, 0xffe08a, 0.9);
    let px = this.ox - 20,
      py = this.oy + this.srcRow * s + s / 2;
    for (const [c, r] of path) {
      const x = this.ox + c * s + s / 2,
        y = this.oy + r * s + s / 2;
      g.lineBetween(px, py, x, y);
      px = x;
      py = y;
    }
    const [ec, er] = (this as any).exit as [number, number];
    g.lineBetween(px, py, this.ox + ec * s + s / 2, this.oy + er * s + s / 2);
    // 광원
    g.fillStyle(0xffe08a, 1);
    g.fillRect(this.ox - 28, this.oy + this.srcRow * s + s / 2 - 8, 14, 16);
    // 거울·수정
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        const x = this.ox + c * s + s / 2,
          y = this.oy + r * s + s / 2;
        if (cell.mirror) {
          g.lineStyle(5, 0xf2c4ff, 1);
          if (cell.mirror === 1) g.lineBetween(x - s * 0.32, y + s * 0.32, x + s * 0.32, y - s * 0.32);
          else g.lineBetween(x - s * 0.32, y - s * 0.32, x + s * 0.32, y + s * 0.32);
        }
        if (cell.crystal) {
          g.fillStyle(cell.lit ? 0xffe08a : 0x6a4a7a, 1);
          g.fillTriangle(x, y - s * 0.3, x + s * 0.22, y, x, y + s * 0.3);
          g.fillTriangle(x, y - s * 0.3, x - s * 0.22, y, x, y + s * 0.3);
          if (cell.lit) {
            g.lineStyle(2, 0xffffff, 0.8);
            g.strokeCircle(x, y, s * 0.36);
          }
        }
      }
    const total = this.grid.flat().filter((x) => x.crystal).length;
    const lit = this.grid.flat().filter((x) => x.crystal && x.lit).length;
    this.label.setText(`수정 ${lit}/${total} · 완성 ${this.solved} · 거울을 눌러 회전`);
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
    const cell = this.grid[r][c];
    if (cell.crystal) return;
    cell.mirror = ((cell.mirror + 1) % 3) as 0 | 1 | 2;
    this.h.sfx('tick');
    const lit = this.trace();
    const total = this.grid.flat().filter((x) => x.crystal).length;
    this.draw();
    if (lit === total && total > 0) {
      this.solved++;
      this.h.sfx('win');
      this.h.addScore(150 + total * 60, 320, 150);
      this.lock = 0.6;
      if (!this.h.micro && this.solved % 2 === 0) {
        if (this.cols < 8) this.cols++;
        else if (this.rows < 5) this.rows++;
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
