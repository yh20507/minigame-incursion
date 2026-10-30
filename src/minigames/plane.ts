import Phaser from 'phaser';
import { MiniGame } from './base';

interface Thing {
  o: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'updraft' | 'pole' | 'lamp' | 'star';
  t: number;
}

/** 종이비행기: 스페이스를 누르면 기수가 올라가고 놓으면 활공하며 떨어진다. 상승기류(빛 기둥)를 타고, 커튼 봉·조명을 피하라. 별은 점수. */
export class PlaneGame extends MiniGame {
  py = 150;
  vy = 0;
  ang = 0;
  pl!: Phaser.GameObjects.Graphics;
  things: Thing[] = [];
  spawnT = 0.6;
  dist = 0;
  stars = 0;
  label!: Phaser.GameObjects.Text;
  readonly px = 150;

  create() {
    const bg = this.gfx();
    bg.fillGradientStyle(0x6b3a3a, 0x6b3a3a, 0x241212, 0x241212, 1);
    bg.fillRect(0, 0, 640, 340);
    for (let i = 0; i < 30; i++) {
      bg.fillStyle(0xffe08a, 0.15);
      bg.fillCircle(this.rnd(0, 640), this.rnd(0, 340), this.rnd(1, 3));
    }
    bg.fillStyle(0x3a2222, 1);
    bg.fillRect(0, 320, 640, 20);
    this.pl = this.gfx().setDepth(3);
    this.label = this.text(320, 12, '', 10, '#ffb3a7').setDepth(5);
  }

  spawn() {
    const r = this.h.rng();
    const d = this.h.difficulty;
    let kind: Thing['kind'] = 'star';
    if (r < 0.28) kind = 'updraft';
    else if (r < 0.28 + 0.22 + (d - 1) * 0.1) kind = 'pole';
    else if (r < 0.62 + (d - 1) * 0.15) kind = 'lamp';
    const o = this.gfx();
    let w = 20,
      h = 20,
      y = this.rnd(40, 300);
    if (kind === 'updraft') {
      w = 46;
      h = 300;
      y = 170;
      o.fillStyle(0xffe08a, 0.12);
      o.fillRect(-w / 2, -h / 2, w, h);
      for (let k = 0; k < 6; k++) {
        o.fillStyle(0xffe08a, 0.5);
        o.fillTriangle(-6, -h / 2 + 40 + k * 44, 6, -h / 2 + 40 + k * 44, 0, -h / 2 + 26 + k * 44);
      }
    } else if (kind === 'pole') {
      w = 14;
      h = this.rnd(90, 160);
      y = this.h.rng() < 0.5 ? h / 2 : 320 - h / 2;
      o.fillStyle(0xd9a066, 1);
      o.fillRect(-w / 2, -h / 2, w, h);
      o.fillStyle(0xffe08a, 1);
      o.fillCircle(0, y < 170 ? h / 2 : -h / 2, 9);
    } else if (kind === 'lamp') {
      w = 36;
      h = 30;
      o.fillStyle(0x2e1f36, 1);
      o.fillRect(-4, -60, 8, 50);
      o.fillStyle(0xffe08a, 1);
      o.fillTriangle(-18, 10, 18, 10, 0, -12);
      o.fillStyle(0xffffff, 0.6);
      o.fillEllipse(0, 16, 30, 8);
    } else {
      w = 16;
      h = 16;
      o.fillStyle(0xffe08a, 1);
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
        const b = a + Math.PI / 5;
        o.fillTriangle(0, 0, Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(b) * 4, Math.sin(b) * 4);
      }
    }
    o.setPosition(680, y);
    this.add(o);
    this.things.push({ o, x: 680, y, w, h, kind, t: 0 });
  }

  update(dt: number) {
    const inp = this.h.inp;
    const ramp = this.ramp(0.012, 2);
    const up = inp.action || inp.pointer.down;
    // 활공 물리: 누르면 기수 올라감(속도 손실), 놓으면 천천히 떨어짐
    if (up) this.vy -= 420 * dt;
    this.vy += 300 * dt;
    this.vy = Phaser.Math.Clamp(this.vy, -170, 190);
    this.py += this.vy * dt;
    this.ang = Phaser.Math.Clamp(this.vy * 0.25, -35, 45);
    if (this.py < 16) {
      this.py = 16;
      this.vy = Math.max(0, this.vy);
    }
    if (this.py > 318) {
      this.py = 318;
      this.vy = 0;
      if (!(this as any).grounded) {
        (this as any).grounded = true;
        this.h.hit(this.px, this.py);
        this.h.float('바닥!', this.px, this.py - 30, '#ff4b6e');
      }
    } else (this as any).grounded = false;
    this.dist += 50 * ramp * dt;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawn();
      this.spawnT = (this.h.micro ? 0.6 : Math.max(0.45, 1.1 / ramp)) * this.rnd(0.75, 1.3);
    }
    const sp = 140 * ramp;
    for (const t of [...this.things]) {
      t.x -= sp * dt;
      t.t += dt;
      t.o.setPosition(t.x, t.y);
      const hit = Math.abs(t.x - this.px) < t.w / 2 + 10 && Math.abs(t.y - this.py) < t.h / 2 + 8;
      if (hit) {
        if (t.kind === 'updraft') {
          this.vy -= 700 * dt;
          if (Math.floor(t.t * 10) % 5 === 0) this.h.addScore(5, this.px, this.py - 20);
        } else if (t.kind === 'star') {
          this.stars++;
          this.h.sfx('coin');
          this.h.addScore(80, t.x, t.y - 12);
          t.o.destroy();
          this.things.splice(this.things.indexOf(t), 1);
          continue;
        } else {
          this.h.hit(t.x, t.y);
          this.vy = 120;
          t.o.destroy();
          this.things.splice(this.things.indexOf(t), 1);
          continue;
        }
      }
      if (t.x < -60) {
        t.o.destroy();
        this.things.splice(this.things.indexOf(t), 1);
        if (t.kind !== 'star') this.h.addScore(15);
      }
    }
    // 비행기 그리기
    const g = this.pl;
    g.clear();
    const a = Phaser.Math.DegToRad(this.ang);
    const c = Math.cos(a),
      s = Math.sin(a);
    const P = (x: number, y: number): [number, number] => [this.px + x * c - y * s, this.py + x * s + y * c];
    const nose = P(22, 0),
      tl = P(-16, -10),
      tr = P(-16, 10),
      mid = P(-8, 0);
    g.fillStyle(0xfff5e8, 1);
    g.fillTriangle(nose[0], nose[1], tl[0], tl[1], mid[0], mid[1]);
    g.fillStyle(0xe8d8c8, 1);
    g.fillTriangle(nose[0], nose[1], tr[0], tr[1], mid[0], mid[1]);
    this.label.setText(`거리 ${Math.floor(this.dist)}m · 별 ${this.stars} · 스페이스: 기수 올리기`);
  }

  microDone() {
    return this.stars >= 2;
  }
  microSuccess() {
    return this.stars >= 2;
  }
}
