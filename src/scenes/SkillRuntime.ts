/** 리더 고유 스킬의 실제 동작. Play 씬이 각 시점에 호출한다. 미니게임 쪽 코드는 손대지 않는다. */
import Phaser from 'phaser';
import { App, C, W, hexNum } from '../core/app';
import { audio } from '../core/audio';
import { skillParams, type SkillDef } from '../core/skills';
import { T } from '../core/ui';

const ROULETTE = [
  { kind: 'start_boost', name: '돌격', p: { dur: 8, mult: 2 } },
  { kind: 'extra_life', name: '여분 목숨', p: { n: 1 } },
  { kind: 'periodic', name: '주기 폭발', p: { every: 15, dur: 5, mult: 2 } },
  { kind: 'time_bank', name: '시간 환급', p: { per: 100, sec: 0.3 } },
  { kind: 'crit', name: '행운', p: { chance: 15, mult: 2 } },
] as const;

interface PlayLike {
  sc: Phaser.Scene;
  lives: number;
  shields: number;
  segDur: number;
  segT: number;
  timeAdj: number;
  segScore: number;
  refreshHud(): void;
  float(text: string, x: number, y: number, color?: string): void;
}

export class SkillRuntime {
  readonly def: SkillDef;
  readonly p: Record<string, number>;
  readonly color: string;
  /** 룰렛으로 뽑힌 실제 동작 (한 판 더) */
  kind: string;
  revives = 0;
  rewrites = 0;
  // 타이머들 (초)
  invulnT = 0; // 무적 남은 시간
  invulnMult = 1;
  boostT = 0; // 시작/주기 버프 남은 시간
  periodT = 0;
  regenT = 0;
  cdT = 0; // 액티브 쿨타임
  slowT = 0;
  stopT = 0;
  stopUsed = false;
  lastStandT = -1; // -1 아님 = 발동 중
  encoreUsed = false;
  encoreT = 0;
  combo = 0; // combo / rhythm 콤보 수
  rhythmT = 0;
  bankAcc = 0;
  huntAcc = 0;
  huntLv = 0;
  active = false; // 액티브 발동 중 표시
  // HUD
  box!: Phaser.GameObjects.Container;
  fill!: Phaser.GameObjects.Graphics;
  label!: Phaser.GameObjects.Text;
  state!: Phaser.GameObjects.Text;

  constructor(
    private play: PlayLike,
    def: SkillDef,
    level: number,
    private rng: () => number = Math.random,
  ) {
    this.def = def;
    this.p = skillParams(def, level);
    this.kind = def.kind;
    this.color = '#ffc845';
    if (def.kind === 'roulette') {
      const r = ROULETTE[Math.floor(this.rng() * ROULETTE.length)];
      this.kind = r.kind;
      Object.assign(this.p, r.p);
      (this as any).rouletteName = r.name;
      this.revives = 1;
    }
    if (def.kind === 'revive_plus' || def.kind === 'live_start') this.revives = 1;
    if (def.kind === 'rewrite') this.rewrites = this.p.n ?? 1;
  }

  get isActive() {
    return !!this.def.active;
  }
  get displayName() {
    return this.def.name + ((this as any).rouletteName ? ` · ${(this as any).rouletteName}` : '');
  }

  /** 판 시작 (목숨 등 초기화 뒤) */
  onRunStart() {
    if (this.kind === 'extra_life') this.play.lives += this.p.n ?? 1;
  }

  /** 구간(미니게임) 시작 */
  onSegment() {
    this.invulnT = 0;
    this.invulnMult = 1;
    this.boostT = 0;
    this.periodT = 0;
    this.regenT = 0;
    this.slowT = 0;
    this.stopT = 0;
    this.stopUsed = false;
    this.lastStandT = -1;
    this.encoreUsed = false;
    this.encoreT = 0;
    this.combo = 0;
    this.rhythmT = 0;
    this.bankAcc = 0;
    this.huntAcc = 0;
    this.huntLv = 0;
    this.active = false;
    if (this.kind === 'start_boost') this.boostT = this.p.dur;
    if (this.kind === 'live_start') {
      this.invulnT = this.p.dur;
      this.invulnMult = this.p.mult;
    }
    this.buildHud();
    this.announce(this.displayName, false);
  }

  // ---------- HUD ----------
  buildHud() {
    this.box?.destroy();
    const sc = this.play.sc;
    const box = sc.add.container(4, 24).setDepth(120);
    const bg = sc.add.graphics();
    bg.fillStyle(0x07060f, 0.8);
    bg.fillRect(0, 0, 96, 16);
    bg.lineStyle(1, hexNum(this.color), 0.9);
    bg.strokeRect(0.5, 0.5, 95, 15);
    this.fill = sc.add.graphics();
    this.label = T(sc, 4, 3, this.def.name, { size: 10, color: this.color });
    this.state = T(sc, 92, 3, '', { size: 10, align: 'right', color: C.dim });
    box.add([bg, this.fill, this.label, this.state]);
    if (this.isActive) {
      box.setInteractive(new Phaser.Geom.Rectangle(0, 0, 96, 16), Phaser.Geom.Rectangle.Contains);
      box.on('pointerdown', () => this.activate());
    }
    this.box = box;
  }

  drawHud() {
    if (!this.fill) return;
    this.fill.clear();
    let ratio = 0;
    let text = '';
    if (this.isActive) {
      if (this.kind === 'time_stop') {
        ratio = this.stopUsed ? 0 : 1;
        text = this.stopT > 0 ? '정지' : this.stopUsed ? '사용함' : 'SHIFT';
      } else if (this.cdT > 0) {
        ratio = 1 - this.cdT / this.p.cd;
        text = Math.ceil(this.cdT) + 's';
      } else {
        ratio = 1;
        text = this.active ? 'ON' : 'SHIFT';
      }
    } else {
      switch (this.kind) {
        case 'start_boost':
          ratio = this.boostT / this.p.dur;
          text = this.boostT > 0 ? `×${this.p.mult}` : '';
          break;
        case 'periodic':
          ratio = this.boostT > 0 ? this.boostT / this.p.dur : this.periodT / this.p.every;
          text = this.boostT > 0 ? `×${this.p.mult}!` : Math.ceil(this.p.every - this.periodT) + 's';
          break;
        case 'combo':
          ratio = Math.min(1, (this.comboMult() - 1) / (this.p.max - 1));
          text = `×${this.comboMult().toFixed(1)}`;
          break;
        case 'rhythm':
          ratio = Math.min(1, (this.combo * this.p.step) / this.p.max);
          text = `+${Math.min(this.p.max, this.combo * this.p.step)}%`;
          break;
        case 'hunt':
          ratio = this.huntLv / this.p.max;
          text = `Lv${this.huntLv}`;
          break;
        case 'shield_regen':
          ratio = this.regenT / this.p.every;
          text = Math.ceil(this.p.every - this.regenT) + 's';
          break;
        case 'late_bloom': {
          const left = this.play.segDur + this.play.timeAdj - this.play.segT;
          ratio = left <= this.p.last ? 1 : 0;
          text = left <= this.p.last ? `×${this.p.mult}!` : '';
          break;
        }
        case 'last_stand':
          ratio = this.lastStandT >= 0 ? this.lastStandT / this.p.dur : 0;
          text = this.lastStandT >= 0 ? '버티는 중!' : '';
          break;
        case 'live_start':
        case 'revive_plus':
          ratio = this.invulnT > 0 ? Math.min(1, this.invulnT / this.p.dur) : 0;
          text = this.invulnT > 0 ? '무적' : this.revives ? '부활 1' : '';
          break;
        case 'rewrite':
          text = `${this.rewrites}회`;
          ratio = this.rewrites > 0 ? 1 : 0;
          break;
        case 'encore':
          ratio = this.encoreT > 0 ? this.encoreT / this.p.dur : 0;
          text = this.encoreT > 0 ? '앙코르!' : '';
          break;
        case 'time_bank':
          ratio = (this.bankAcc % this.p.per) / this.p.per;
          break;
        default:
          ratio = 0;
      }
    }
    this.fill.fillStyle(hexNum(this.color), 0.22);
    this.fill.fillRect(1, 1, 94 * Math.max(0, Math.min(1, ratio)), 14);
    this.state.setText(text);
  }

  announce(text: string, big = true) {
    const sc = this.play.sc;
    const t = T(sc, W / 2, big ? 150 : 40, text, { size: big ? 24 : 10, align: 'center', color: this.color, stroke: true }).setDepth(190).setAlpha(0);
    sc.tweens.add({ targets: t, alpha: 1, y: t.y - 10, duration: 180, yoyo: true, hold: big ? 500 : 700, onComplete: () => t.destroy() });
    if (big) {
      audio.sfx('legend');
      sc.cameras.main.flash(200, 255, 200, 69);
    }
  }

  // ---------- 매 프레임 ----------
  update(dt: number) {
    if (this.invulnT > 0) this.invulnT = Math.max(0, this.invulnT - dt);
    if (this.invulnT === 0) this.invulnMult = 1;
    if (this.boostT > 0) this.boostT = Math.max(0, this.boostT - dt);
    if (this.cdT > 0) this.cdT = Math.max(0, this.cdT - dt);
    if (this.slowT > 0) {
      this.slowT = Math.max(0, this.slowT - dt);
      if (this.slowT === 0) this.active = false;
    }
    if (this.stopT > 0) this.stopT = Math.max(0, this.stopT - dt);
    if (this.encoreT > 0) this.encoreT = Math.max(0, this.encoreT - dt);
    if (this.kind === 'periodic' && this.boostT <= 0) {
      this.periodT += dt;
      if (this.periodT >= this.p.every) {
        this.periodT = 0;
        this.boostT = this.p.dur;
        this.announce(`${this.def.name}! ×${this.p.mult}`);
      }
    }
    if (this.kind === 'shield_regen') {
      this.regenT += dt;
      if (this.regenT >= this.p.every) {
        this.regenT = 0;
        this.play.shields++;
        this.play.refreshHud();
        this.play.float('보호막 +1', W / 2, 60, C.cyan);
        audio.sfx('shield');
      }
    }
    if (this.kind === 'rhythm' && this.combo > 0) {
      this.rhythmT -= dt;
      if (this.rhythmT <= 0) this.combo = 0;
    }
    if (this.lastStandT >= 0) this.lastStandT -= dt;
    this.drawHud();
  }

  /** 게임 속도 배율 (슬로우·정지·사냥 본능) */
  speedMult() {
    if (this.stopT > 0) return 0;
    let m = 1;
    if (this.slowT > 0) m *= this.p.factor;
    if (this.kind === 'hunt') m *= 1 + 0.1 * this.huntLv;
    return m;
  }
  /** 타이머까지 멈추는가 */
  timerFrozen() {
    return this.stopT > 0;
  }
  /** 쓰러진 뒤 버티기 시간이 끝났나 */
  lastStandOver() {
    return this.kind === 'last_stand' && this.lastStandT < 0 && this.play.lives <= 0 && (this as any).lastStandStarted;
  }

  comboMult() {
    return Math.min(this.p.max, 1 + this.combo * this.p.step);
  }

  /** 득점 배율 */
  scoreMult() {
    let m = 1;
    if (this.boostT > 0 && (this.kind === 'start_boost' || this.kind === 'periodic')) m *= this.p.mult;
    if (this.invulnT > 0 && this.invulnMult > 1) m *= this.invulnMult;
    if (this.kind === 'combo') m *= this.comboMult();
    if (this.kind === 'rhythm') m *= 1 + Math.min(this.p.max, this.combo * this.p.step) / 100;
    if (this.kind === 'hunt') m *= 1 + 0.2 * this.huntLv;
    if (this.kind === 'late_bloom' && this.play.segDur + this.play.timeAdj - this.play.segT <= this.p.last) m *= this.p.mult;
    if (this.lastStandT >= 0) m *= this.p.mult;
    if (this.kind === 'crit' && this.rng() * 100 < this.p.chance) {
      m *= this.p.mult;
      (this as any).critNow = true;
    }
    return m;
  }

  /** 점수가 실제로 들어간 뒤 */
  onScore(v: number) {
    if (this.kind === 'combo') this.combo++;
    if (this.kind === 'rhythm') {
      this.combo++;
      this.rhythmT = this.p.window;
    }
    if (this.kind === 'time_bank') {
      this.bankAcc += v;
      while (this.bankAcc >= this.p.per) {
        this.bankAcc -= this.p.per;
        this.play.timeAdj += this.p.sec;
      }
    }
    if (this.kind === 'hunt') {
      this.huntAcc += v;
      const lv = Math.min(this.p.max, Math.floor(this.huntAcc / this.p.per));
      if (lv > this.huntLv) {
        this.huntLv = lv;
        this.announce(`사냥 본능 Lv${lv}`);
      }
    }
  }

  /**
   * 피격 판정 전에 호출. 'ignore' 면 피격 무효, 'time' 이면 목숨 대신 시간 차감, null 이면 평소대로.
   */
  onHit(): 'ignore' | 'time' | null {
    if (this.encoreT > 0 || this.invulnT > 0 || this.stopT > 0) return 'ignore';
    if (this.lastStandT >= 0) return 'ignore';
    if (this.kind === 'dodge' && this.rng() * 100 < this.p.chance) return 'ignore';
    if (this.kind === 'warp') {
      this.play.timeAdj += this.p.refund;
      if (this.rng() * 100 < this.p.chance) return 'ignore';
    }
    if (this.kind === 'rewrite' && this.rewrites > 0) {
      this.rewrites--;
      return 'ignore';
    }
    if (this.kind === 'rift_armor') return 'time';
    return null;
  }

  /** 실제로 목숨이 깎인 뒤 */
  afterHit() {
    if (this.kind === 'combo') this.combo = 0;
    if (this.kind === 'rhythm') this.combo = 0;
    if (this.kind === 'endure') {
      this.invulnT = this.p.dur;
      this.play.timeAdj += this.p.refund;
    }
  }

  /** 목숨이 0 이 된 뒤 (아이템 부활 다음). true 면 아직 안 끝남 */
  onFatal(): boolean {
    if (this.revives > 0) {
      this.revives--;
      this.play.lives = 1;
      if (this.kind === 'revive_plus' || this.kind === 'live_start') {
        this.invulnT = this.p.dur;
        this.invulnMult = this.kind === 'revive_plus' ? this.p.mult : 1;
      }
      this.announce(`${this.def.name} — 부활!`);
      return true;
    }
    if (this.kind === 'last_stand' && !(this as any).lastStandStarted) {
      (this as any).lastStandStarted = true;
      this.lastStandT = this.p.dur;
      this.announce(`${this.def.name}! ${this.p.dur}초 더`);
      return true;
    }
    return false;
  }

  /** 타임 업 순간. 추가 시간을 돌려주면 계속 진행 */
  onTimeUp(): number {
    if (this.kind === 'encore' && !this.encoreUsed) {
      this.encoreUsed = true;
      this.encoreT = this.p.dur;
      this.announce('앙코르!');
      return this.p.dur;
    }
    return 0;
  }

  /** 액티브 발동 (Shift / 버튼) */
  activate() {
    if (!this.isActive) return;
    if (this.kind === 'time_stop') {
      if (this.stopUsed) return;
      this.stopUsed = true;
      this.stopT = this.p.dur;
      this.announce('시간 정지');
      return;
    }
    if (this.cdT > 0 || this.active) return;
    this.cdT = this.p.cd;
    this.active = true;
    if (this.kind === 'slow') this.slowT = this.p.dur;
    if (this.kind === 'invuln') {
      this.invulnT = this.p.dur;
      this.invulnMult = this.p.mult;
      this.play.sc.time.delayedCall(this.p.dur * 1000, () => (this.active = false));
    }
    this.announce(this.def.name + '!');
  }

  destroy() {
    this.box?.destroy();
  }
}

export const _app = App;
