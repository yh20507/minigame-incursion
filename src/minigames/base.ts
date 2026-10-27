import Phaser from 'phaser';
import { fitImage } from '../core/art';

export interface Ptr {
  x: number;
  y: number;
  down: boolean;
  pressed: boolean;
  released: boolean;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;
  leftP: boolean;
  rightP: boolean;
  upP: boolean;
  downP: boolean;
  actionP: boolean;
  actionR: boolean;
  /** 이번 프레임에 눌린 키 코드 (예: 'KeyD', 'KeyX') */
  codes: Set<string>;
  pointer: Ptr;
}

/** 미니게임이 진행자(PlayScene)에게 받는 것들 */
export interface Host {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Container;
  /** 플레이 영역 크기 (상단 HUD 아래) */
  W: number;
  H: number;
  difficulty: number;
  micro: boolean;
  rng: () => number;
  inp: InputState;
  /** 이 구간이 시작된 뒤 흐른 시간 (초, 속도 배율 반영) */
  t: number;
  color: number;
  leaderKey: string;
  addScore(n: number, x?: number, y?: number): void;
  /** 맞았을 때. 아직 살아있으면 true */
  hit(x?: number, y?: number): boolean;
  addTime(sec: number): void;
  sfx(name: string): void;
  float(text: string, x: number, y: number, color?: string): void;
  shake(intensity?: number): void;
}

export abstract class MiniGame {
  /** true 로 두면 구간이 즉시 끝난다 (게임 자체 종료) */
  finished = false;
  constructor(public h: Host) {}
  abstract create(): void;
  abstract update(dt: number): void;
  /** 번개 모드 판정. 기본: 끝까지 살아남으면 성공 */
  microSuccess(): boolean {
    return true;
  }
  /** 번개 모드에서 목표를 이미 달성했으면 true (일찍 성공 처리) */
  microDone(): boolean {
    return false;
  }

  // ---- 공용 도우미 ----
  get s() {
    return this.h.scene;
  }
  add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.h.layer.add(o);
    return o;
  }
  rect(x: number, y: number, w: number, h: number, color: number, alpha = 1) {
    return this.add(this.s.add.rectangle(x, y, w, h, color, alpha));
  }
  gfx() {
    return this.add(this.s.add.graphics());
  }
  text(x: number, y: number, str: string, size = 12, color = '#eae6ff', origin: [number, number] = [0.5, 0.5]) {
    const family = size === 10 ? 'Galmuri9' : size >= 24 ? 'Galmuri11Bold' : 'Galmuri11';
    return this.add(
      this.s.add
        .text(Math.round(x), Math.round(y), str, {
          fontFamily: family,
          fontSize: size + 'px',
          color,
          stroke: '#0b0918',
          strokeThickness: size >= 24 ? 4 : 2,
          align: 'center',
        })
        .setOrigin(origin[0], origin[1]),
    );
  }
  /** 리더 캐릭터 (발 기준 원점) */
  player(x: number, y: number, size = 40) {
    const img = this.s.add.image(x, y, this.h.leaderKey).setOrigin(0.5, 1);
    fitImage(img, size, size);
    (img as any).baseScale = img.scaleX;
    return this.add(img);
  }
  squash(img: Phaser.GameObjects.Image, sx = 1.25, sy = 0.75) {
    const b = (img as any).baseScale ?? 1;
    this.s.tweens.add({
      targets: img,
      scaleX: { from: b * sx, to: b },
      scaleY: { from: b * sy, to: b },
      duration: 180,
      ease: 'Back.Out',
    });
  }
  rnd(a: number, b: number) {
    return a + this.h.rng() * (b - a);
  }
  /** 뒤로 갈수록 빨라지는 배율 */
  ramp(per = 0.02, cap = 2.2) {
    const base = 1 + (this.h.difficulty - 1) * 0.3;
    return Math.min(cap, base + this.h.t * per);
  }
}

export function overlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export type GameCtor = new (h: Host) => MiniGame;
