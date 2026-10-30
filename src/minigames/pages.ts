import Phaser from 'phaser';
import { MiniGame, type Host } from './base';
import { GAMES } from './registry';

/** 페이지 넘기기 (관측자의 서재): 몇 초마다 책장이 넘어가며 아홉 대륙의 미니게임 중 하나로 규칙이 바뀐다. 읽고, 적응하고, 버텨라. */
export class PagesGame extends MiniGame {
  inner: MiniGame | null = null;
  child!: Phaser.GameObjects.Container;
  proxy!: Host;
  pageT = 0;
  pageLen = 9;
  page = 0;
  pool: string[] = [];
  flash!: Phaser.GameObjects.Rectangle;
  label!: Phaser.GameObjects.Text;
  turning = false;

  create() {
    // 서재 배경은 각 페이지 뒤에 깔린다
    const bg = this.gfx();
    bg.fillGradientStyle(0x3a2f18, 0x3a2f18, 0x120e06, 0x120e06, 1);
    bg.fillRect(0, 0, 640, 340);
    this.pool = Object.keys(GAMES).filter((k) => k !== 'pages');
    this.child = this.add(this.s.add.container(0, 0));
    this.flash = this.add(this.s.add.rectangle(320, 170, 640, 340, 0xffe08a, 0)).setDepth(50);
    // 쪽 번호 띠는 맨 아래에 (안쪽 게임의 안내문과 겹치지 않게)
    this.add(this.s.add.rectangle(320, 334, 640, 12, 0x120e06, 0.8)).setDepth(55);
    this.label = this.text(320, 334, '', 10, '#ffe08a').setDepth(60);
    this.pageLen = this.h.micro ? 5 : Math.max(6, 10 - (this.h.difficulty - 1) * 2);
    this.turn(true);
  }

  turn(first = false) {
    this.turning = true;
    const next = () => {
      if (this.inner) {
        this.child.removeAll(true);
        this.inner = null;
      }
      const id = this.pool[Math.floor(this.h.rng() * this.pool.length)];
      this.page++;
      const self = this;
      this.proxy = {
        ...this.h,
        layer: this.child,
        t: 0,
        get inp() {
          return self.h.inp;
        },
        addScore: (n, x, y) => this.h.addScore(Math.round(n * 1.2), x, y),
        hit: (x, y) => this.h.hit(x, y),
        addTime: (s) => this.h.addTime(s),
        sfx: (n) => this.h.sfx(n),
        float: (t, x, y, c) => this.h.float(t, x, y, c),
        shake: (i) => this.h.shake(i),
      } as Host;
      const Ctor = GAMES[id];
      this.inner = new Ctor(this.proxy);
      this.inner.create();
      this.pageT = 0;
      const name = this.gameName(id);
      this.label.setText(`${this.page}쪽 · ${name}`);
      this.h.float(`${this.page}쪽 — ${name}`, 320, 60, '#ffe08a');
      this.turning = false;
    };
    if (first) next();
    else {
      this.h.sfx('flip');
      this.s.tweens.add({ targets: this.flash, alpha: 0.95, duration: 160, yoyo: true, onYoyo: next });
    }
  }

  gameName(id: string) {
    try {
      const games = (window as any).__app?.content?.games as { id: string; name: string }[] | undefined;
      return games?.find((g) => g.id === id)?.name ?? id;
    } catch {
      return id;
    }
  }

  update(dt: number) {
    if (this.turning || !this.inner) return;
    this.proxy.t += dt;
    this.inner.update(dt);
    this.pageT += dt;
    if (this.pageT >= this.pageLen) this.turn();
    // 남은 시간 표시
    const left = Math.max(0, this.pageLen - this.pageT);
    if (left < 2) this.label.setColor(Math.floor(left * 6) % 2 ? '#ff4b6e' : '#ffe08a');
    else this.label.setColor('#ffe08a');
  }

  microDone() {
    return this.inner?.microDone() ?? false;
  }
  microSuccess() {
    return true;
  }
}
