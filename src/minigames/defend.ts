import Phaser from 'phaser';
import { MiniGame } from './base';

interface Enemy {
  o: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  hp: number;
  speed: number;
  big: boolean;
}
interface Arrow {
  o: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** 성문 수비: 오른쪽 성문으로 밀려오는 공성 병기를 클릭(화살)으로 막아라. 1~3 키로 궁수 탑을 배치하면 자동 사격. 성문이 뚫리면 목숨. */
export class DefendGame extends MiniGame {
  enemies: Enemy[] = [];
  arrows: Arrow[] = [];
  towers: { y: number; cd: number; o: Phaser.GameObjects.Graphics }[] = [];
  spawnT = 1;
  shotCd = 0;
  kills = 0;
  gateHp = 3;
  label!: Phaser.GameObjects.Text;
  gate!: Phaser.GameObjects.Graphics;
  readonly gateX = 560;
  readonly lanes = [90, 170, 250];

  create() {
    const bg = this.gfx();
    bg.fillGradientStyle(0x5a5560, 0x5a5560, 0x2b2530, 0x2b2530, 1);
    bg.fillRect(0, 0, 640, 340);
    bg.fillStyle(0x3b2a22, 1);
    bg.fillRect(0, 300, 640, 40);
    for (const y of this.lanes) {
      bg.fillStyle(0x4a3a30, 0.6);
      bg.fillRect(0, y + 10, this.gateX, 4);
    }
    this.gate = this.gfx();
    this.drawGate();
    this.player(600, 60, 36);
    for (let i = 0; i < 3; i++) this.text(this.gateX + 30, this.lanes[i] - 20, `${i + 1}`, 10, '#ffd84b');
    this.label = this.text(320, 12, '', 10, '#d9a066');
  }

  drawGate() {
    const g = this.gate;
    g.clear();
    g.fillStyle(0x6b6b78, 1);
    g.fillRect(this.gateX, 40, 80, 260);
    g.fillStyle(0x4a4a58, 1);
    for (let i = 0; i < 6; i++) g.fillRect(this.gateX + (i % 2) * 20, 50 + i * 40, 60, 10);
    g.fillStyle(this.gateHp >= 3 ? 0x8a5a2a : this.gateHp === 2 ? 0x7a4a2a : 0x5a2a2a, 1);
    g.fillRect(this.gateX + 10, 160, 60, 140);
    for (const t of this.towers) {
      t.o.clear();
      t.o.fillStyle(0xd9a066, 1);
      t.o.fillRect(this.gateX - 16, t.y - 16, 16, 26);
      t.o.fillStyle(0xffd84b, 1);
      t.o.fillTriangle(this.gateX - 18, t.y - 16, this.gateX + 2, t.y - 16, this.gateX - 8, t.y - 26);
    }
  }

  spawn() {
    const d = this.h.difficulty;
    const big = this.h.rng() < Math.min(0.35, 0.1 + this.h.t * 0.005 + (d - 1) * 0.1);
    const y = this.lanes[Math.floor(this.h.rng() * 3)];
    const o = this.gfx();
    if (big) {
      o.fillStyle(0x5a3a2a, 1);
      o.fillRect(-22, -22, 44, 30);
      o.fillStyle(0x8a6a4a, 1);
      o.fillRect(-26, -8, 52, 8);
      o.fillStyle(0x2b2530, 1);
      o.fillCircle(-14, 6, 6);
      o.fillCircle(14, 6, 6);
    } else {
      o.fillStyle(0x7a5a3a, 1);
      o.fillRect(-14, -14, 28, 20);
      o.fillStyle(0x2b2530, 1);
      o.fillCircle(-8, 8, 5);
      o.fillCircle(8, 8, 5);
      o.fillStyle(0xd9a066, 1);
      o.fillRect(-4, -22, 8, 8);
    }
    o.setPosition(-30, y);
    this.add(o);
    this.enemies.push({ o, x: -30, y, hp: big ? 3 : 1, speed: (big ? 28 : 48) * this.ramp(0.014, 2), big });
  }

  shoot(x: number, y: number, tx: number, ty: number) {
    const dx = tx - x,
      dy = ty - y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 520;
    const o = this.add(this.s.add.rectangle(x, y, 14, 3, 0xffe8a0));
    o.setRotation(Math.atan2(dy, dx));
    this.arrows.push({ o, x, y, vx: (dx / d) * sp, vy: (dy / d) * sp });
    this.h.sfx('shoot');
  }

  update(dt: number) {
    const inp = this.h.inp;
    this.shotCd -= dt;
    if (inp.pointer.pressed && this.shotCd <= 0) {
      this.shoot(600, 60, inp.pointer.x, inp.pointer.y);
      this.shotCd = 0.28;
    }
    // 궁수 배치
    for (let i = 0; i < 3; i++) {
      if ((inp.codes.has('Digit' + (i + 1)) || inp.codes.has('Numpad' + (i + 1))) && !this.towers.some((t) => t.y === this.lanes[i]) && this.kills >= (this.towers.length + 1) * 3) {
        this.towers.push({ y: this.lanes[i], cd: 0, o: this.gfx() });
        this.h.sfx('good');
        this.h.float('궁수 배치!', this.gateX - 20, this.lanes[i] - 40, '#ffd84b');
        this.drawGate();
      }
    }
    for (const t of this.towers) {
      t.cd -= dt;
      const target = this.enemies.filter((e) => e.y === t.y).sort((a, b) => b.x - a.x)[0];
      if (target && t.cd <= 0) {
        this.shoot(this.gateX - 10, t.y - 10, target.x, target.y);
        t.cd = 0.9;
      }
    }
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawn();
      this.spawnT = (this.h.micro ? 0.7 : Math.max(0.5, 1.6 / this.ramp(0.015, 2.4))) * this.rnd(0.7, 1.3);
    }
    for (const a of [...this.arrows]) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.o.setPosition(a.x, a.y);
      const hit = this.enemies.find((e) => Math.abs(e.x - a.x) < (e.big ? 24 : 16) && Math.abs(e.y - a.y) < 22);
      if (hit) {
        hit.hp--;
        a.o.destroy();
        this.arrows.splice(this.arrows.indexOf(a), 1);
        hit.o.setAlpha(0.6);
        this.s.time.delayedCall(80, () => hit.o.setAlpha(1));
        if (hit.hp <= 0) {
          this.kills++;
          this.h.sfx('good');
          this.h.addScore(hit.big ? 150 : 60, hit.x, hit.y - 24);
          hit.o.destroy();
          this.enemies.splice(this.enemies.indexOf(hit), 1);
        }
        continue;
      }
      if (a.x < -20 || a.x > 660 || a.y < -20 || a.y > 360) {
        a.o.destroy();
        this.arrows.splice(this.arrows.indexOf(a), 1);
      }
    }
    for (const e of [...this.enemies]) {
      e.x += e.speed * dt;
      e.o.setPosition(e.x, e.y + Math.sin(this.h.t * 10 + e.y) * 1.5);
      if (e.x >= this.gateX - 10) {
        this.gateHp--;
        e.o.destroy();
        this.enemies.splice(this.enemies.indexOf(e), 1);
        this.h.sfx('hit');
        this.h.float('성문 피해!', this.gateX, e.y - 20, '#ff4b6e');
        if (this.gateHp <= 0) {
          this.gateHp = 3;
          this.h.hit(this.gateX, 200);
        }
        this.drawGate();
      }
    }
    const nextTower = this.towers.length < 3 ? ` · 궁수 ${this.towers.length}/3 (처치 ${(this.towers.length + 1) * 3}마다 1~3키로 배치)` : ' · 궁수 완비';
    this.label.setText(`처치 ${this.kills} · 성문 ${'■'.repeat(this.gateHp)}${nextTower}`);
  }

  microDone() {
    return this.kills >= 3;
  }
  microSuccess() {
    return this.kills >= 3;
  }
}
