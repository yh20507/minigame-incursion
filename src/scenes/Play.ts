import Phaser from 'phaser';
import { App, C, H, W, hexNum } from '../core/app';
import { audio } from '../core/audio';
import { fitImage } from '../core/art';
import { hashStr, pick, seeded, shuffle, todayKey } from '../core/rng';
import type { Bonus, GameDef } from '../core/types';
import { T, button, fadeIn, go } from '../core/ui';
import type { Host, InputState, MiniGame } from '../minigames/base';
import { GAMES } from '../minigames/registry';

export type Mode = 'normal' | 'boss' | 'final' | 'micro' | 'daily' | 'marathon';

export interface PlayData {
  mode: Mode;
  game?: string;
  domain: string;
}

export interface SegResult {
  game: string;
  score: number;
  passed: boolean;
}

export interface RunResult {
  mode: Mode;
  domain: string;
  game?: string;
  score: number;
  success: boolean;
  segments: SegResult[];
  microCleared: number;
  modifier?: string;
}

const HUD_H = 20;

/** 오늘의 도전 구성 (날짜로 고정) */
export function dailySetup() {
  const st = App.store;
  const ch = App.content.challenges.daily;
  const r = seeded(hashStr('daily-' + todayKey()));
  const games = shuffle(st.unlockedGames(), r).slice(0, ch.games);
  const mod = ch.modifiers[Math.floor(r() * ch.modifiers.length)];
  return { games, mod };
}

export class PlayScene extends Phaser.Scene {
  mode!: Mode;
  domain!: string;
  queue: string[] = [];
  segIdx = 0;
  lives = 1;
  shields = 0;
  totalScore = 0;
  segScore = 0;
  results: SegResult[] = [];
  mg: MiniGame | null = null;
  gameDef!: GameDef;
  layer!: Phaser.GameObjects.Container;
  host!: Host;
  segT = 0;
  segDur = 45;
  timeAdj = 0;
  speed = 1;
  mods = new Set<string>();
  modName = '';
  phase: 'intro' | 'play' | 'between' | 'paused' | 'over' = 'intro';
  dead = false;
  microFailed = false;
  microCleared = 0;
  bonus!: Bonus;
  segBonus!: Bonus;
  lastGame = '';

  // 입력
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  codes = new Set<string>();
  ptrPressed = false;
  ptrReleased = false;

  // HUD
  bgImg!: Phaser.GameObjects.Image;
  hud!: Phaser.GameObjects.Container;
  hudName!: Phaser.GameObjects.Text;
  hudScore!: Phaser.GameObjects.Text;
  hudHearts!: Phaser.GameObjects.Container;
  hudTime!: Phaser.GameObjects.Graphics;
  hudExtra!: Phaser.GameObjects.Text;
  bossBar: Phaser.GameObjects.Graphics | null = null;
  vignette: Phaser.GameObjects.Image | null = null;
  pauseLayer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Play');
  }

  create(data: PlayData) {
    fadeIn(this);
    this.mode = data.mode;
    this.domain = data.domain;
    this.segIdx = 0;
    this.totalScore = 0;
    this.results = [];
    this.microCleared = 0;
    this.speed = 1;
    this.mods = new Set();
    this.modName = '';
    this.mg = null;
    this.lastGame = '';
    this.bossBar = null;
    this.vignette = null;
    this.pauseLayer = null;
    const ch = App.content.challenges;
    const st = App.store;

    switch (this.mode) {
      case 'normal':
        this.queue = [data.game!];
        this.bonus = st.bonus(App.content.game(data.game!).domain);
        this.lives = App.content.game(data.game!).lives;
        break;
      case 'boss': {
        const d = App.content.domain(this.domain)!;
        this.queue = shuffle(d.games).slice(0, ch.boss.segments);
        this.bonus = st.bonus(this.domain);
        this.lives = ch.boss.lives;
        break;
      }
      case 'final': {
        const per = App.content.domains.map((d) => pick(d.games));
        const rest = shuffle(App.content.games.map((g) => g.id).filter((g) => !per.includes(g)));
        this.queue = shuffle([...per, ...rest]).slice(0, ch.final.segments);
        this.bonus = st.bonus(null);
        this.lives = ch.final.lives;
        break;
      }
      case 'daily': {
        const s = dailySetup();
        this.queue = s.games;
        this.mods.add(s.mod.id);
        this.modName = s.mod.name;
        this.bonus = st.bonus(null);
        this.lives = 1;
        break;
      }
      case 'marathon':
        this.queue = [];
        this.bonus = st.bonus(null);
        this.lives = ch.marathon.lives;
        break;
      case 'micro':
        this.queue = [];
        this.bonus = st.bonus(null);
        this.lives = ch.micro.lives;
        break;
    }
    this.shields = this.bonus.shield;

    this.bgImg = this.add.image(0, 0, 'bg_rift').setOrigin(0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, 0x07060f, 0.55).setOrigin(0);
    this.setupInput();
    this.buildHud();
    this.events.once('shutdown', () => {
      this.mg = null;
    });
    this.nextSegment();
  }

  // ---------------- 입력 ----------------
  setupInput() {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('LEFT,RIGHT,UP,DOWN,SPACE,Z,ENTER') as any;
    kb.addCapture('LEFT,RIGHT,UP,DOWN,SPACE');
    this.codes = new Set();
    kb.on('keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.codes.add(e.code);
    });
    kb.on('keyup', (e: KeyboardEvent) => this.codes.add('up:' + e.code));
    kb.on('keydown-ESC', () => this.togglePause());
    this.input.on('pointerdown', () => (this.ptrPressed = true));
    this.input.on('pointerup', () => (this.ptrReleased = true));
  }

  readInput(): InputState {
    const k = this.keys;
    const c = this.codes;
    const has = (...codes: string[]) => codes.some((x) => c.has(x));
    let left = k.LEFT.isDown,
      right = k.RIGHT.isDown;
    let leftP = has('ArrowLeft'),
      rightP = has('ArrowRight');
    if (this.mods.has('reverse') !== this.mods.has('mirror')) {
      [left, right] = [right, left];
      [leftP, rightP] = [rightP, leftP];
    }
    const p = this.input.activePointer;
    let px = p.x;
    if (this.mods.has('mirror')) px = W - px;
    return {
      left,
      right,
      up: k.UP.isDown,
      down: k.DOWN.isDown,
      action: k.SPACE.isDown || k.Z.isDown || k.ENTER.isDown,
      leftP,
      rightP,
      upP: has('ArrowUp'),
      downP: has('ArrowDown'),
      actionP: has('Space', 'KeyZ', 'Enter'),
      actionR: has('up:Space', 'up:KeyZ', 'up:Enter'),
      codes: c,
      pointer: { x: px, y: p.y - HUD_H, down: p.isDown, pressed: this.ptrPressed, released: this.ptrReleased },
    };
  }

  // ---------------- HUD ----------------
  buildHud() {
    this.hud = this.add.container(0, 0).setDepth(100);
    const g = this.add.graphics();
    g.fillStyle(0x07060f, 0.92);
    g.fillRect(0, 0, W, HUD_H);
    g.fillStyle(C.accentN, 1);
    g.fillRect(0, HUD_H, W, 1);
    this.hud.add(g);
    this.hudName = T(this, 6, 4, '', { size: 10, color: C.dim });
    this.hudScore = T(this, W - 8, 3, '0', { align: 'right', color: C.gold });
    this.hudHearts = this.add.container(W - 150, 6);
    this.hudTime = this.add.graphics();
    this.hudExtra = T(this, W / 2 + 108, 4, '', { size: 10, color: C.accent });
    this.hud.add([this.hudName, this.hudScore, this.hudHearts, this.hudTime, this.hudExtra]);
    if (this.mode === 'boss' || this.mode === 'final') {
      this.bossBar = this.add.graphics().setDepth(100);
      const gk = this.mode === 'boss' ? App.content.domain(this.domain)!.gatekeeper : 'architect';
      const img = this.add.image(W - 22, HUD_H + 26, 'spr_' + gk).setDepth(100);
      fitImage(img, 36, 36);
      this.tweens.add({ targets: img, y: img.y - 3, yoyo: true, repeat: -1, duration: 500 });
    }
    this.refreshHud();
  }

  refreshHud() {
    this.hudScore.setText(this.totalScore.toLocaleString());
    this.hudHearts.removeAll(true);
    const maxShow = 6;
    let x = 0;
    for (let i = 0; i < Math.min(this.lives, maxShow); i++) {
      this.hudHearts.add(this.add.image(x, 0, 'ic_heart').setOrigin(0).setScale(1));
      x += 9;
    }
    for (let i = 0; i < Math.min(this.shields, 4); i++) {
      this.hudHearts.add(this.add.image(x, 0, 'ic_shield').setOrigin(0));
      x += 9;
    }
    this.hudHearts.x = W - 80 - x;
    let extra = '';
    if (this.mode === 'micro') extra = `성공 ${this.microCleared} · 속도 x${this.speed.toFixed(2)}`;
    else if (this.mode === 'daily') extra = this.modName;
    else if (this.mode === 'marathon') extra = `${this.segIdx}번째`;
    else if (this.mode === 'boss' || this.mode === 'final') extra = `시련 ${Math.min(this.segIdx, this.queue.length)}/${this.queue.length}`;
    this.hudExtra.setText(extra);
    if (this.bossBar) {
      const n = this.queue.length;
      const passed = this.results.filter((r) => r.passed).length;
      const bw = 160;
      this.bossBar.clear();
      this.bossBar.fillStyle(0x07060f, 0.9);
      this.bossBar.fillRect(W - bw - 50, HUD_H + 18, bw + 2, 10);
      this.bossBar.fillStyle(0xff4b6e, 1);
      this.bossBar.fillRect(W - bw - 49, HUD_H + 19, bw * (1 - passed / n), 8);
      for (let i = 1; i < n; i++) {
        this.bossBar.fillStyle(0x07060f, 1);
        this.bossBar.fillRect(W - bw - 49 + (bw * i) / n, HUD_H + 19, 1, 8);
      }
    }
  }

  drawTimer() {
    const g = this.hudTime;
    g.clear();
    const left = Math.max(0, this.segDur + this.timeAdj - this.segT);
    const f = Math.min(1, left / this.segDur);
    const x = W / 2 - 100,
      y = 7,
      w = 200;
    g.fillStyle(0x1e1a3a, 1);
    g.fillRect(x, y, w, 6);
    g.fillStyle(f > 0.3 ? 0x5fd3e0 : 0xff4b6e, 1);
    g.fillRect(x, y, w * f, 6);
  }

  // ---------------- 구간 ----------------
  pickNext(): string | null {
    if (this.mode === 'micro' || this.mode === 'marathon') {
      const pool = App.store.unlockedGames().filter((g) => g !== this.lastGame);
      return pick(pool.length ? pool : App.store.unlockedGames());
    }
    return this.queue[this.segIdx] ?? null;
  }

  nextSegment() {
    const id = this.pickNext();
    if (!id) return this.finishRun(true);
    this.startSegment(id);
  }

  startSegment(id: string) {
    const ch = App.content.challenges;
    this.lastGame = id;
    this.gameDef = App.content.game(id);
    this.segBonus = App.store.bonus(this.gameDef.domain);
    this.segScore = 0;
    this.segT = 0;
    this.timeAdj = 0;
    this.dead = false;
    this.microFailed = false;
    const d = App.content.domain(this.gameDef.domain)!;
    this.bgImg.setTexture('bg_' + d.id);
    if (this.mode !== 'micro') audio.bgm(d.id, d.music.root, d.music.scale, d.music.tempo + (this.mode === 'boss' || this.mode === 'final' ? 16 : 0));
    else audio.bgm('micro', 57, 'major', Math.round(130 * this.speed));

    const timeBonus = this.segBonus.time;
    switch (this.mode) {
      case 'normal':
        this.segDur = 45 + timeBonus;
        break;
      case 'boss':
        this.segDur = ch.boss.duration;
        break;
      case 'final':
        this.segDur = ch.final.duration;
        break;
      case 'daily':
        this.segDur = ch.daily.duration + timeBonus;
        this.lives = this.gameDef.lives;
        break;
      case 'marathon':
        this.segDur = ch.marathon.duration;
        break;
      case 'micro':
        this.segDur = ch.micro.duration;
        break;
    }
    const difficulty =
      this.mode === 'boss' ? ch.boss.difficulty : this.mode === 'final' ? ch.final.difficulty : this.mode === 'marathon' ? 1 + Math.min(1, this.segIdx * 0.1) : 1;
    let gameSpeed = this.mode === 'micro' ? this.speed : 1;
    if (this.mods.has('fast')) gameSpeed *= 1.5;

    this.layer = this.add.container(0, HUD_H);
    if (this.mods.has('mirror')) {
      this.layer.setScale(-1, 1);
      this.layer.x = W;
    }
    const self = this;
    const rng = Math.random;
    this.host = {
      scene: this,
      layer: this.layer,
      W,
      H: H - HUD_H,
      difficulty,
      micro: this.mode === 'micro',
      rng,
      inp: this.readInput(),
      t: 0,
      color: hexNum(d.color),
      leaderKey: 'spr_' + App.store.save.team.leader,
      addScore: (n, x, y) => self.addScore(n, x, y),
      hit: (x, y) => self.hit(x, y),
      addTime: (s) => (self.timeAdj += s),
      sfx: (n) => audio.sfx(n),
      float: (text, x, y, color) => self.float(text, x, y, color),
      shake: (i = 0.008) => self.cameras.main.shake(120, i),
    };
    (this.host as any).gameSpeed = gameSpeed;
    const Ctor = GAMES[id];
    this.mg = new Ctor(this.host);
    this.mg.create();
    if (this.mods.has('tiny')) this.addVignette();
    this.segIdx++;
    this.refreshHud();
    this.drawTimer();
    this.hudName.setText(`${d.name} · ${this.gameDef.name}`);
    this.intro();
  }

  addVignette() {
    if (!this.textures.exists('vignette')) {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(W / 2, H / 2, 70, W / 2, H / 2, 300);
      grad.addColorStop(0, 'rgba(7,6,15,0)');
      grad.addColorStop(1, 'rgba(7,6,15,0.97)');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      this.textures.addCanvas('vignette', c);
    }
    this.vignette?.destroy();
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(50);
  }

  intro() {
    this.phase = 'intro';
    const g = this.gameDef;
    const ov = this.add.container(0, 0).setDepth(200);
    if (this.mode === 'micro') {
      const t = T(this, W / 2, H / 2 - 24, g.micro, { size: 36, align: 'center', color: '#ffffff', stroke: true });
      const sub = T(this, W / 2, H / 2 + 22, g.controls, { size: 10, align: 'center', color: C.cyan, stroke: true });
      ov.add([t, sub]);
      t.setScale(1.6);
      this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.Out' });
      audio.sfx('go');
      this.time.delayedCall(650 / Math.min(1.6, this.speed), () => {
        ov.destroy();
        this.phase = 'play';
      });
      return;
    }
    const bg = this.add.rectangle(0, 0, W, H, 0x07060f, 0.7).setOrigin(0);
    const box = this.add.graphics();
    box.fillStyle(C.panel, 1);
    box.fillRect(W / 2 - 170, 70, 340, 150);
    box.lineStyle(1, hexNum(App.content.domain(g.domain)!.color), 1);
    box.strokeRect(W / 2 - 170 + 0.5, 70.5, 339, 149);
    let label = g.genre;
    if (this.mode === 'boss' || this.mode === 'final') label = `시련 ${this.segIdx}/${this.queue.length} · ${g.genre}`;
    if (this.mode === 'daily') label = `오늘의 도전 ${this.segIdx}/${this.queue.length} · ${this.modName}`;
    if (this.mode === 'marathon') label = `마라톤 ${this.segIdx}번째`;
    const l1 = T(this, W / 2, 82, label, { size: 10, align: 'center', color: C.accent });
    const l2 = T(this, W / 2, 98, g.name, { size: 24, align: 'center' });
    const l3 = T(this, W / 2, 132, g.rule, { size: 10, align: 'center', color: C.dim, wrap: 310 });
    const l4 = T(this, W / 2, 166, g.controls, { size: 10, align: 'center', color: C.cyan, wrap: 310 });
    let need = '';
    if (this.mode === 'boss' || this.mode === 'final') {
      const ratio = this.mode === 'boss' ? App.content.challenges.boss.passRatio : App.content.challenges.final.passRatio;
      need = `통과 기준: ${this.passScore(g, ratio).toLocaleString()}점 이상`;
    }
    const l5 = T(this, W / 2, 196, need, { size: 10, align: 'center', color: C.gold });
    const count = T(this, W / 2, 238, '', { size: 36, align: 'center', color: '#ffffff', stroke: true });
    ov.add([bg, box, l1, l2, l3, l4, l5, count]);
    const steps = ['3', '2', '1', '시작!'];
    steps.forEach((s, i) => {
      this.time.delayedCall(500 + i * 450, () => {
        count.setText(s).setScale(1.5);
        this.tweens.add({ targets: count, scale: 1, duration: 150 });
        audio.sfx(i === 3 ? 'go' : 'tick');
        if (i === 3) {
          this.tweens.add({ targets: ov, alpha: 0, duration: 200, delay: 150, onComplete: () => ov.destroy() });
          this.phase = 'play';
        }
      });
    });
  }

  passScore(g: GameDef, ratio: number) {
    const ch = App.content.challenges;
    const dur = this.mode === 'boss' ? ch.boss.duration : ch.final.duration;
    return Math.round((g.stars[0] * ratio * (dur / 45)) / 10) * 10;
  }

  addScore(n: number, x?: number, y?: number) {
    if (this.phase !== 'play') return;
    const v = Math.round(n * (1 + this.segBonus.score / 100));
    this.segScore += v;
    this.totalScore += v;
    this.hudScore.setText(this.totalScore.toLocaleString());
    if (x !== undefined && y !== undefined) this.float('+' + v, x, y, C.gold);
  }

  hit(x?: number, y?: number): boolean {
    if (this.phase !== 'play') return true;
    if (this.shields > 0) {
      this.shields--;
      audio.sfx('shield');
      this.cameras.main.flash(120, 95, 211, 224);
      if (x !== undefined && y !== undefined) this.float('보호막!', x, y, C.cyan);
      this.refreshHud();
      return true;
    }
    audio.sfx('hit');
    this.cameras.main.shake(160, 0.012);
    this.cameras.main.flash(120, 255, 75, 110);
    if (this.mode === 'micro') {
      this.microFailed = true;
      return false;
    }
    this.lives--;
    this.refreshHud();
    if (this.lives <= 0) {
      this.dead = true;
      return false;
    }
    return true;
  }

  float(text: string, x: number, y: number, color = '#ffffff') {
    const sx = this.mods.has('mirror') ? W - x : x;
    const t = T(this, sx, y + HUD_H - 6, text, { size: 10, align: 'center', color, stroke: true }).setDepth(90);
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 650, onComplete: () => t.destroy() });
  }

  // ---------------- 진행 ----------------
  update(_t: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.05);
    if (this.phase === 'play' && this.mg) {
      this.segT += dt;
      const gs = (this.host as any).gameSpeed as number;
      this.host.t += dt * gs;
      this.host.inp = this.readInput();
      this.mg.update(dt * gs);
      this.drawTimer();
      const timeUp = this.segT >= this.segDur + this.timeAdj;
      if (this.mode === 'micro') {
        if (this.microFailed) this.endSegment(false);
        else if (this.mg.microDone()) this.endSegment(true);
        else if (timeUp) this.endSegment(this.mg.microSuccess());
      } else if (this.dead) this.endSegment(false);
      else if (this.mg.finished) this.endSegment(!this.dead);
      else if (timeUp) this.endSegment(true);
    }
    this.codes.clear();
    this.ptrPressed = false;
    this.ptrReleased = false;
  }

  endSegment(survived: boolean) {
    this.phase = 'between';
    const g = this.gameDef;
    const ch = App.content.challenges;
    let passed = survived;
    let label = '';
    let color = C.good;

    if (this.mode === 'micro') {
      if (survived) {
        this.microCleared++;
        label = 'OK!';
        audio.sfx('good');
        if (this.microCleared % ch.micro.speedUpEvery === 0) {
          this.speed += ch.micro.speedStep;
          label = '속도 UP!';
        }
      } else {
        if (this.shields > 0) {
          this.shields--;
          label = '보호막!';
          color = C.cyan;
          audio.sfx('shield');
        } else {
          this.lives--;
          label = '실패...';
          color = C.bad;
          audio.sfx('bad');
        }
      }
    } else if (this.mode === 'boss' || this.mode === 'final') {
      const ratio = this.mode === 'boss' ? ch.boss.passRatio : ch.final.passRatio;
      passed = survived && this.segScore >= this.passScore(g, ratio);
      label = !survived ? '쓰러졌다...' : passed ? '시련 통과!' : '점수 부족...';
      color = passed ? C.good : C.bad;
      audio.sfx(passed ? 'win' : 'lose');
    } else if (this.mode === 'normal') {
      label = survived ? '타임 업!' : '게임 오버';
      color = survived ? C.good : C.bad;
      audio.sfx(survived ? 'win' : 'lose');
    } else {
      label = survived ? '클리어!' : '게임 오버';
      color = survived ? C.good : C.bad;
      audio.sfx(survived ? 'good' : 'lose');
    }
    this.results.push({ game: g.id, score: this.segScore, passed });
    this.refreshHud();

    const banner = T(this, W / 2, H / 2 - 20, label, { size: 36, align: 'center', color, stroke: true }).setDepth(150);
    banner.setScale(0.4);
    this.tweens.add({ targets: banner, scale: 1, duration: 220, ease: 'Back.Out' });
    const wait = this.mode === 'micro' ? 550 / Math.min(1.5, this.speed) : 1100;

    this.time.delayedCall(wait, () => {
      banner.destroy();
      this.layer.destroy();
      this.vignette?.destroy();
      this.vignette = null;
      this.mg = null;
      // 다음 구간 여부
      let over = false,
        success = false;
      switch (this.mode) {
        case 'normal':
          over = true;
          success = survived;
          break;
        case 'boss':
        case 'final':
          if (!passed) over = true;
          else if (this.segIdx >= this.queue.length) {
            over = true;
            success = true;
          }
          break;
        case 'daily':
          if (!survived) over = true;
          else if (this.segIdx >= this.queue.length) {
            over = true;
            success = true;
          }
          break;
        case 'marathon':
          if (this.lives <= 0) over = true;
          break;
        case 'micro':
          if (this.lives <= 0) over = true;
          break;
      }
      if (over) this.finishRun(success);
      else this.nextSegment();
    });
  }

  finishRun(success: boolean) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    const r: RunResult = {
      mode: this.mode,
      domain: this.domain,
      game: this.mode === 'normal' ? this.queue[0] : undefined,
      score: this.mode === 'micro' ? this.microCleared : this.totalScore,
      success: this.mode === 'micro' || this.mode === 'marathon' ? true : success,
      segments: this.results,
      microCleared: this.microCleared,
      modifier: this.modName,
    };
    go(this, 'Result', r);
  }

  // ---------------- 일시정지 ----------------
  togglePause() {
    if (this.phase === 'paused') {
      this.pauseLayer?.destroy();
      this.pauseLayer = null;
      this.phase = 'play';
      this.tweens.resumeAll();
      this.time.paused = false;
      return;
    }
    if (this.phase !== 'play') return;
    this.phase = 'paused';
    this.tweens.pauseAll();
    this.time.paused = true;
    const c = this.add.container(0, 0).setDepth(300);
    c.add(this.add.rectangle(0, 0, W, H, 0x07060f, 0.8).setOrigin(0));
    c.add(T(this, W / 2, 110, '일시정지', { size: 24, align: 'center' }));
    c.add(
      button(this, W / 2 - 80, 160, 160, 28, '계속하기 (ESC)', () => this.togglePause()),
    );
    c.add(
      button(this, W / 2 - 80, 196, 160, 28, '포기하고 나가기', () => {
        this.time.paused = false;
        this.tweens.resumeAll();
        this.phase = 'over';
        const back =
          this.mode === 'normal' || this.mode === 'boss'
            ? { key: 'Domain', data: { id: App.content.game(this.queue[0] ?? this.lastGame).domain } }
            : this.mode === 'final'
              ? { key: 'WorldMap', data: {} }
              : { key: 'Challenge', data: {} };
        go(this, back.key, back.data);
      }),
    );
    this.pauseLayer = c;
  }
}
