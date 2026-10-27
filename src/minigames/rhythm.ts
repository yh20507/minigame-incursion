import Phaser from 'phaser';
import { MiniGame } from './base';

interface Note {
  lane: number;
  y: number;
  o: Phaser.GameObjects.Container;
  done: boolean;
}

const LANE_COLORS = [0xff4fa8, 0x5fd3e0, 0x4be37a, 0xffd84b];
const ARROWS = ['◀', '▼', '▲', '▶'];

/** 클럽 리듬: 4줄 화살표를 판정선에서 누르기 */
export class RhythmGame extends MiniGame {
  lineY = 290;
  laneX = [242, 290, 338, 386].map((x) => x + 6);
  notes: Note[] = [];
  beatT = 0;
  beat = 0.5;
  combo = 0;
  misses = 0;
  hits = 0;
  spawned = 0;
  keys: Phaser.GameObjects.Rectangle[] = [];
  comboT!: Phaser.GameObjects.Text;
  judgeT!: Phaser.GameObjects.Text;
  dancer!: Phaser.GameObjects.Image;

  create() {
    const g = this.gfx();
    g.fillStyle(0x07060f, 0.7);
    g.fillRect(this.laneX[0] - 26, 0, 48 * 4 + 4, this.h.H);
    this.laneX.forEach((x, k) => {
      g.lineStyle(1, LANE_COLORS[k], 0.25);
      g.lineBetween(x, 0, x, this.h.H);
    });
    g.lineStyle(2, 0xffffff, 0.8);
    g.lineBetween(this.laneX[0] - 24, this.lineY, this.laneX[3] + 24, this.lineY);
    this.laneX.forEach((x, k) => {
      const r = this.rect(x, this.lineY, 40, 14, LANE_COLORS[k], 0.25).setStrokeStyle(1, LANE_COLORS[k]);
      this.keys.push(r);
      this.text(x, this.lineY + 22, ARROWS[k], 10, '#a69fd0');
    });
    this.text(this.laneX[0] - 24, this.lineY + 36, 'D F J K 도 가능', 10, '#6d669a', [0, 0.5]);
    this.dancer = this.player(110, 300, 64);
    this.comboT = this.text(530, 120, '', 24, '#ff5fd2');
    this.judgeT = this.text(530, 160, '', 12, '#ffffff');
    this.beat = this.h.micro ? 0.55 : 0.5 / (1 + (this.h.difficulty - 1) * 0.15);
    this.beatT = this.h.micro ? 0.2 : 0.8;
  }

  noteSpeed() {
    return 230 * this.ramp(0.008, 1.7);
  }

  spawn(lane: number) {
    const c = this.s.add.container(this.laneX[lane], -20);
    const g = this.s.add.graphics();
    g.fillStyle(0x0d0a16);
    g.fillRect(-19, -8, 38, 16);
    g.fillStyle(LANE_COLORS[lane]);
    g.fillRect(-18, -7, 36, 14);
    c.add(g);
    c.add(this.s.add.text(0, 0, ARROWS[lane], { fontFamily: 'Galmuri11', fontSize: '12px', color: '#0d0a16' }).setOrigin(0.5));
    this.add(c);
    this.notes.push({ lane, y: -20, o: c, done: false });
    this.spawned++;
  }

  judge(text: string, color: string) {
    this.judgeT.setText(text).setColor(color).setScale(1.3);
    this.s.tweens.add({ targets: this.judgeT, scale: 1, duration: 120 });
  }

  update(dt: number) {
    const sp = this.noteSpeed();
    const i = this.h.inp;
    this.beatT -= dt;
    const limit = this.h.micro ? 3 : Infinity;
    if (this.beatT <= 0 && this.spawned < limit) {
      this.beatT += this.beat;
      const r = this.h.rng();
      const density = Math.min(0.85, 0.55 + this.h.t * 0.008 + (this.h.difficulty - 1) * 0.1);
      if (r < density || this.h.micro) {
        const lane = Math.floor(this.h.rng() * 4);
        this.spawn(lane);
        if (!this.h.micro && this.h.rng() < Math.min(0.25, this.h.t * 0.006)) this.spawn((lane + 1 + Math.floor(this.h.rng() * 3)) % 4);
      }
      this.s.tweens.add({ targets: this.dancer, y: 296, yoyo: true, duration: 80 });
    }

    const pressed = [
      i.leftP || i.codes.has('KeyD'),
      i.downP || i.codes.has('KeyF'),
      i.upP || i.codes.has('KeyJ'),
      i.rightP || i.codes.has('KeyK'),
    ];
    pressed.forEach((p, k) => {
      if (!p) return;
      this.keys[k].setFillStyle(LANE_COLORS[k], 0.8);
      this.s.time.delayedCall(80, () => this.keys[k].setFillStyle(LANE_COLORS[k], 0.25));
      let best: Note | null = null;
      for (const n of this.notes) {
        if (n.done || n.lane !== k) continue;
        if (!best || Math.abs(n.y - this.lineY) < Math.abs(best.y - this.lineY)) best = n;
      }
      if (!best) return;
      const err = Math.abs(best.y - this.lineY) / sp;
      if (err <= 0.13) {
        best.done = true;
        const perfect = err <= 0.06;
        this.combo++;
        this.hits++;
        const mult = 1 + Math.min(this.combo, 50) / 50;
        this.h.addScore(Math.round((perfect ? 100 : 50) * mult));
        this.judge(perfect ? 'PERFECT' : 'GOOD', perfect ? '#ffd84b' : '#5fd3e0');
        this.h.sfx(perfect ? 'good' : 'score');
        this.s.tweens.add({
          targets: best.o,
          scale: 1.6,
          alpha: 0,
          duration: 150,
          onComplete: () => best!.o.destroy(),
        });
      }
    });

    for (const n of [...this.notes]) {
      if (!n.done) {
        n.y += sp * dt;
        n.o.y = n.y;
        if ((n.y - this.lineY) / sp > 0.13) {
          n.done = true;
          this.combo = 0;
          this.misses++;
          this.judge('MISS', '#ff4b6e');
          n.o.setAlpha(0.3);
          this.s.time.delayedCall(200, () => n.o.destroy());
          if (this.h.micro || this.misses % 2 === 0) {
            if (!this.h.hit(n.o.x, this.lineY)) return;
          } else this.h.sfx('bad');
        }
      }
      if (n.done && !n.o.active) this.notes.splice(this.notes.indexOf(n), 1);
    }
    this.comboT.setText(this.combo >= 3 ? `${this.combo} COMBO` : '');
  }

  microDone() {
    return this.hits >= 2 && this.notes.every((n) => n.done);
  }
  microSuccess() {
    return this.hits >= 2;
  }
}
