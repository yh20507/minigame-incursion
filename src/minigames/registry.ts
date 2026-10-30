import type { GameCtor } from './base';
import { JumpGame } from './jump';
import { MemoryGame } from './memory';
import { ThrowGame } from './throw';
import { ShuffleGame } from './shuffle';
import { RunnerGame } from './runner';
import { RhythmGame } from './rhythm';
import { StroopGame } from './stroop';
import { HockeyGame } from './hockey';
import { DodgeGame } from './dodge';
import { StackGame } from './stack';
import { TargetGame } from './target';
import { OrdersGame } from './orders';
import { PendulumGame } from './pendulum';
import { GearsGame } from './gears';
import { IcicleGame } from './icicle';
import { SnowballGame } from './snowball';
import { SonarGame } from './sonar';
import { LighthouseGame } from './lighthouse';
import { DiveGame } from './dive';
import { CipherGame } from './cipher';

/** 미니게임 id → 구현. 새 게임은 여기에 한 줄 추가하고 minigames.json 에 항목을 넣으면 된다. */
export const GAMES: Record<string, GameCtor> = {
  jump: JumpGame,
  memory: MemoryGame,
  throw: ThrowGame,
  shuffle: ShuffleGame,
  runner: RunnerGame,
  rhythm: RhythmGame,
  stroop: StroopGame,
  hockey: HockeyGame,
  dodge: DodgeGame,
  stack: StackGame,
  target: TargetGame,
  orders: OrdersGame,
  pendulum: PendulumGame,
  gears: GearsGame,
  icicle: IcicleGame,
  snowball: SnowballGame,
  sonar: SonarGame,
  lighthouse: LighthouseGame,
  dive: DiveGame,
  cipher: CipherGame,
};
