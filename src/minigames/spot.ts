import Phaser from 'phaser';
import { MiniGame } from './base';

interface Prop {
  kind: number; // 0 선인장 1 바위 2 별 3 오아시스 4 야자 5 해골
  x: number;
  y: number;
  col: number;
  scale: number;
  flip: boolean;
}

/** 신기루 찾기: 왼쪽(진짜)과 오른쪽(신기루) 그림의 다른 점을 찾아 오른쪽에서 클릭. 틀린 곳을 찍으면 시간이 깎인다. */
export class SpotGame extends MiniGame {
  props: Prop[] = [];
  diffs: { idx: number; found: boolean }[] = [];
  left!: Phaser.GameObjects.Graphics;
  right!: Phaser.GameObjects.Graphics;
  mark!: Phaser.GameObjects.Graphics;
  round = 0;
  found = 0;
  label!: Phaser.GameObjects.Text;
  readonly W = 290;
  readonly H = 220;
  readonly LX = 20;
  readonly RX = 330;
  readonly Y = 60;

  create() {
    const bg = this.gfx();
    bg.fillGradientStyle(0x5a3f6e, 0x5a3f6e, 0x1a1022, 0x1a1022, 1);
    bg.fillRect(0, 0, 640, 340);
    this.left = this.gfx();
    this.right = this.gfx();
    this.mark = this.gfx().setDepth(3);
    this.text(this.LX + this.W / 2, 44, '진짜', 10, '#ffffff');
    this.text(this.RX + this.W / 2, 44, '신기루 — 다른 곳을 클릭', 10, '#f2c4ff');
    this.label = this.text(320, 14, '', 10, '#f2c4ff');
    this.newRound();
  }

  newRound() {
    const d = this.h.difficulty;
    const n = this.h.micro ? 6 : Math.min(14, 7 + this.round + Math.round((d - 1) * 2));
    this.props = [];
    for (let i = 0; i < n; i++) {
      this.props.push({ kind: Math.floor(this.h.rng() * 6), x: this.rnd(20, this.W - 20), y: this.rnd(30, this.H - 16), col: Math.floor(this.h.rng() * 4), scale: this.rnd(0.8, 1.3), flip: this.h.rng() < 0.5 });
    }
    const nd = this.h.micro ? 1 : Math.min(4, 2 + Math.floor(this.round / 2));
    const idxs = [...Array(n).keys()].sort(() => this.h.rng() - 0.5).slice(0, nd);
    this.diffs = idxs.map((idx) => ({ idx, found: false }));
    this.round++;
    this.mark.clear();
    this.draw();
  }

  drawScene(g: Phaser.GameObjects.Graphics, ox: number, mirage: boolean) {
    g.fillStyle(0xf7e3b5, 1);
    g.fillRect(ox, this.Y, this.W, this.H);
    g.fillStyle(0xe8c98a, 1);
    g.fillRect(ox, this.Y + this.H * 0.55, this.W, this.H * 0.45);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(ox + 40, this.Y + 30, 14);
    for (let i = 0; i < this.props.length; i++) {
      const p = { ...this.props[i] };
      const diff = this.diffs.find((d) => d.idx === i);
      if (mirage && diff) {
        // 변형: 색 바꾸기 / 사라짐 / 뒤집기 / 크기
        const mode = i % 4;
        if (mode === 0) p.col = (p.col + 2) % 4;
        else if (mode === 1) continue;
        else if (mode === 2) p.flip = !p.flip;
        else p.scale *= 0.6;
      }
      this.drawProp(g, ox + p.x, this.Y + p.y, p);
    }
  }

  drawProp(g: Phaser.GameObjects.Graphics, x: number, y: number, p: Prop) {
    const cols = [0x4b9f5a, 0x8a6a4a, 0xffd84b, 0x4fd1c5];
    const c = cols[p.col];
    const s = p.scale;
    const f = p.flip ? -1 : 1;
    g.fillStyle(c, 1);
    switch (p.kind) {
      case 0: // 선인장
        g.fillRect(x - 4 * s, y - 20 * s, 8 * s, 22 * s);
        g.fillRect(x - 12 * s * f, y - 12 * s, 8 * s, 5 * s);
        g.fillRect(x - 12 * s * f, y - 16 * s, 4 * s, 8 * s);
        break;
      case 1: // 바위
        g.fillEllipse(x, y, 22 * s, 14 * s);
        break;
      case 2: // 별
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
          const b = a + Math.PI / 5;
          g.fillTriangle(x, y, x + Math.cos(a) * 9 * s, y + Math.sin(a) * 9 * s, x + Math.cos(b) * 4 * s, y + Math.sin(b) * 4 * s);
        }
        break;
      case 3: // 오아시스
        g.fillStyle(0x4fd1c5, 1);
        g.fillEllipse(x, y, 26 * s, 10 * s);
        g.fillStyle(c, 1);
        g.fillRect(x + 8 * s * f, y - 14 * s, 3 * s, 14 * s);
        break;
      case 4: // 야자
        g.fillStyle(0x8a6a4a, 1);
        g.fillRect(x - 2 * s, y - 24 * s, 4 * s, 24 * s);
        g.fillStyle(c, 1);
        g.fillEllipse(x - 8 * s * f, y - 26 * s, 16 * s, 6 * s);
        g.fillEllipse(x + 8 * s * f, y - 24 * s, 16 * s, 6 * s);
        break;
      case 5: // 해골
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x, y - 6 * s, 7 * s);
        g.fillStyle(0x1a1022, 1);
        g.fillCircle(x - 3 * s * f, y - 7 * s, 2 * s);
        g.fillCircle(x + 3 * s * f, y - 7 * s, 2 * s);
        break;
    }
  }

  draw() {
    this.left.clear();
    this.right.clear();
    this.drawScene(this.left, this.LX, false);
    this.drawScene(this.right, this.RX, true);
    this.label.setText(`다른 곳 ${this.diffs.filter((d) => d.found).length}/${this.diffs.length} · 판 ${this.round}`);
  }

  update(_dt: number) {
    const p = this.h.inp.pointer;
    if (!p.pressed) return;
    if (p.x < this.RX || p.x > this.RX + this.W || p.y < this.Y || p.y > this.Y + this.H) return;
    const lx = p.x - this.RX,
      ly = p.y - this.Y;
    const hit = this.diffs.find((d) => !d.found && Math.hypot(this.props[d.idx].x - lx, this.props[d.idx].y - 10 - ly) < 24);
    if (hit) {
      hit.found = true;
      this.found++;
      this.h.sfx('good');
      this.h.addScore(90 + this.round * 10, p.x, p.y - 14);
      this.mark.lineStyle(3, 0x4be37a, 1);
      this.mark.strokeCircle(this.RX + this.props[hit.idx].x, this.Y + this.props[hit.idx].y - 10, 20);
      this.mark.strokeCircle(this.LX + this.props[hit.idx].x, this.Y + this.props[hit.idx].y - 10, 20);
      if (this.diffs.every((d) => d.found)) {
        this.h.addScore(100, 320, 180);
        this.h.float('전부 찾음!', 320, 160, '#ffe08a');
        this.s.time.delayedCall(600, () => !this.finished && this.newRound());
      }
    } else {
      this.h.sfx('bad');
      this.h.addTime(-2);
      this.h.float('-2초', p.x, p.y - 14, '#ff4b6e');
      const x = this.add(this.s.add.circle(p.x, p.y, 5, 0xff4b6e, 0.8));
      this.s.tweens.add({ targets: x, alpha: 0, scale: 2, duration: 300, onComplete: () => x.destroy() });
      if (++(this as any).wrong % 4 === 0) this.h.hit(p.x, p.y);
    }
    this.label.setText(`다른 곳 ${this.diffs.filter((d) => d.found).length}/${this.diffs.length} · 판 ${this.round}`);
  }

  microDone() {
    return this.found >= 1;
  }
  microSuccess() {
    return this.found >= 1;
  }
}
