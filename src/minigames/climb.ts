import Phaser from 'phaser';
import { MiniGame } from './base';

interface Rung {
  y: number; // 월드 y (위로 갈수록 작아짐)
  broken: boolean;
  o: Phaser.GameObjects.Graphics;
}

/** 구름 사다리: ←→를 번갈아 눌러 올라간다 (왼손·오른손). 끊어진 칸은 같은 손을 두 번 눌러 건너뛴다. 밑에서 안개가 올라온다. */
export class ClimbGame extends MiniGame {
  rungs: Rung[] = [];
  world!: Phaser.GameObjects.Container;
  pl!: Phaser.GameObjects.Image;
  idx = 0; // 서 있는 칸
  lastHand: 'L' | 'R' | null = null;
  fogY = 420; // 월드 y
  camY = 0;
  fog!: Phaser.GameObjects.Graphics;
  height = 0;
  label!: Phaser.GameObjects.Text;
  readonly step = 34;
  readonly x = 320;

  create() {
    const bg = this.gfx();
    bg.fillGradientStyle(0x2d5a8a, 0x2d5a8a, 0x6fb0e8, 0x6fb0e8, 1);
    bg.fillRect(0, 0, 640, 340);
    this.world = this.add(this.s.add.container(0, 0));
    // 세로 기둥
    const pole = this.s.add.graphics();
    pole.fillStyle(0xffffff, 0.5);
    pole.fillRect(this.x - 44, -5000, 6, 5400);
    pole.fillRect(this.x + 38, -5000, 6, 5400);
    this.world.add(pole);
    for (let i = 0; i < 16; i++) this.addRung();
    this.pl = this.s.add.image(this.x, 300, this.h.leaderKey).setOrigin(0.5, 1);
    this.pl.setScale(40 / Math.max(this.pl.width, this.pl.height));
    this.world.add(this.pl);
    this.fog = this.gfx().setDepth(4);
    this.label = this.text(320, 12, '← → 번갈아 · 끊어진 칸은 같은 손 두 번', 10, '#ffffff').setDepth(5);
    this.place();
  }

  addRung() {
    const i = this.rungs.length;
    const y = 300 - i * this.step;
    const d = this.h.difficulty;
    const broken = i > 3 && this.h.rng() < Math.min(0.35, 0.1 + i * 0.006 + (d - 1) * 0.1) && !(this.rungs[i - 1]?.broken);
    const o = this.s.add.graphics();
    if (broken) {
      o.fillStyle(0xcfe6ff, 0.5);
      o.fillRect(this.x - 40, y - 3, 18, 6);
      o.fillRect(this.x + 22, y - 3, 18, 6);
    } else {
      o.fillStyle(0xffffff, 1);
      o.fillRoundedRect(this.x - 40, y - 4, 80, 8, 4);
    }
    this.world.add(o);
    this.rungs.push({ y, broken, o });
  }

  place() {
    const r = this.rungs[this.idx];
    this.pl.setPosition(this.x + (this.lastHand === 'L' ? -6 : this.lastHand === 'R' ? 6 : 0), r.y + 2);
  }

  update(dt: number) {
    const inp = this.h.inp;
    let hand: 'L' | 'R' | null = null;
    if (inp.leftP || (inp.pointer.pressed && inp.pointer.x < 320)) hand = 'L';
    if (inp.rightP || (inp.pointer.pressed && inp.pointer.x >= 320)) hand = 'R';
    if (hand) {
      const next = this.rungs[this.idx + 1];
      const alternate = hand !== this.lastHand;
      if (next.broken) {
        // 끊어진 칸: 같은 손 두 번이면 두 칸 건너뜀
        if (!alternate && this.lastHand) {
          this.idx += 2;
          this.h.addScore(40, this.x + 60, this.rungs[this.idx].y - 10);
          this.h.sfx('jump');
        } else {
          // 잘못 잡음 → 미끄러짐
          this.slip();
        }
      } else if (alternate || !this.lastHand) {
        this.idx += 1;
        this.h.addScore(15, this.x + 60, next.y - 10);
        this.h.sfx('tick');
      } else {
        this.slip();
      }
      this.lastHand = hand;
      this.height = Math.max(this.height, this.idx);
      while (this.rungs.length < this.idx + 16) this.addRung();
      this.place();
      this.squash(this.pl, 1.1, 0.9);
    }
    // 안개 상승
    const fogSpeed = (this.h.micro ? 40 : 26) * this.ramp(0.02, 2.4);
    this.fogY -= fogSpeed * dt;
    const r = this.rungs[this.idx];
    if (this.fogY <= r.y + 10) {
      if (this.h.hit(this.x, 300)) {
        this.fogY = r.y + 150; // 밀려남
      }
    }
    // 카메라
    const target = r.y - 220;
    this.camY += (target - this.camY) * Math.min(1, dt * 8);
    this.world.y = -this.camY;
    const g = this.fog;
    g.clear();
    const fy = this.fogY - this.camY;
    g.fillStyle(0xe8f4ff, 0.85);
    g.fillRect(0, fy, 640, 400);
    g.fillStyle(0xe8f4ff, 0.4);
    g.fillRect(0, fy - 18, 640, 18);
    this.label.setText(`높이 ${this.idx} · ← → 번갈아 · 끊어진 칸은 같은 손 두 번`);
    // 옛 칸 정리
    while (this.rungs.length > 40 && this.idx > 20) {
      const old = this.rungs.shift()!;
      old.o.destroy();
      this.idx--;
    }
  }

  slip() {
    this.h.sfx('bad');
    this.idx = Math.max(0, this.idx - 2);
    this.h.float('미끄러짐!', this.x + 70, this.rungs[this.idx].y - 10, '#ff4b6e');
    this.lastHand = null;
  }

  microDone() {
    return this.height >= 6;
  }
  microSuccess() {
    return this.height >= 6;
  }
}
