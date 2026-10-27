export type PassiveType = 'coin' | 'score' | 'time' | 'shield';

export interface Passive {
  type: PassiveType;
  value: number;
  domain?: string;
}

export interface CharDef {
  id: string;
  name: string;
  title: string;
  /** original = 게임 오리지널(상시 균열), special = 스토리·실력 해금, world = 세계관 한정 */
  origin: 'original' | 'special' | 'world';
  /** 오리지널·특별은 영역 id, 세계관 캐릭터는 세계관 id */
  domain: string;
  rarity: number;
  pool: boolean;
  passives: Passive[];
  desc: string;
  line: string;
  unlock?: string;
}

export interface DomainDef {
  id: string;
  name: string;
  subtitle: string;
  desc: string;
  color: string;
  dark: string;
  sky: [string, string];
  games: string[];
  bossStars: number;
  gatekeeper: string;
  unlockAfter: string | null;
  mapPos: [number, number];
  music: { root: number; scale: string; tempo: number };
}

export interface GameDef {
  id: string;
  domain: string;
  genre: string;
  name: string;
  controls: string;
  rule: string;
  lives: number;
  stars: [number, number, number];
  coinRate: number;
  micro: string;
}

export interface RarityDef {
  id: number;
  name: string;
  rate: number;
  color: string;
  refund: number;
}

export interface GachaConfig {
  rarities: RarityDef[];
  /** 아이템이 나올 확률(%) */
  itemRate: number;
  pity: { legend: number; ultra: number };
  /** 10+1회에서 보장하는 최소 별 */
  multiGuarantee: number;
  cost: { single: number; multi: number; multiCount: number };
  /** need[i] = i강 → i+1강에 필요한 중복 수 */
  enhance: { max: number; need: number[]; bonusPerLevel: number };
  startCoins: number;
}

export interface BannerDef {
  id: string;
  name: string;
  type: 'standard' | 'world';
  world?: string;
  start?: string | null;
  end?: string | null;
  desc: string;
}

export interface WorldDef {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  desc: string;
}

export type ItemEffect = 'instant' | 'shield' | 'time' | 'score' | 'coin' | 'revive' | 'shard';

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  weight: number;
  effect: ItemEffect;
  value: number;
  color: string;
}

export interface Crossover {
  id: string;
  name: string;
  members: string[];
  effect: { type: PassiveType; value: number };
  desc: string;
}

export interface Synergies {
  set: { type: PassiveType; value: number; desc: string };
  worldSet: { type: PassiveType; value: number; desc: string };
  crossovers: Crossover[];
}

export interface Modifier {
  id: string;
  name: string;
  desc: string;
}

export interface Challenges {
  daily: { games: number; duration: number; reward: number; modifiers: Modifier[] };
  micro: { duration: number; lives: number; speedUpEvery: number; speedStep: number; coinPerClear: number };
  marathon: { duration: number; lives: number; coinRate: number };
  boss: { segments: number; duration: number; lives: number; difficulty: number; reward: number; passRatio: number };
  final: { segments: number; duration: number; lives: number; difficulty: number; reward: number; passRatio: number };
  unlock: { micro: string; daily: string; marathon: string };
}

export interface StoryLine {
  s: string;
  t: string;
}

export interface StoryData {
  speakers: Record<string, { name: string; char?: string }>;
  scenes: Record<string, { bg: string; lines: StoryLine[] }>;
}

export interface OwnedChar {
  b: number; // 강화 단계 (0~3)
  d?: number; // 다음 강화를 위해 모은 중복 수
  at: number; // 최초 획득 시각 (ms)
}

export interface ScoreRec {
  best: number;
  stars: number;
  plays: number;
}

export interface SaveData {
  version: 1;
  coins: number;
  pity: { legend: number; ultra: number };
  totalPulls: number;
  owned: Record<string, OwnedChar>;
  items: Record<string, number>;
  scores: Record<string, ScoreRec>;
  team: { leader: string; supports: (string | null)[] };
  story: Record<string, boolean>;
  cleared: Record<string, boolean>;
  extra: {
    daily: { date: string; cleared: boolean; best: number };
    microBest: number;
    marathonBest: number;
    settings: { sfx: number; bgm: number };
    log: GachaLogEntry[];
  };
}

export interface GachaLogEntry {
  id: string;
  /** 별 수. 아이템이면 0 */
  r: number;
  banner: string;
  at: number;
}

export interface PullResult {
  kind: 'char' | 'item';
  id: string;
  /** 캐릭터 별 수 (아이템은 0) */
  rarity: number;
  isNew: boolean;
  /** 강화 단계 */
  b: number;
  /** 모은 중복 수 */
  d: number;
  levelUp: boolean;
  refund: number;
  pity: boolean;
}

export interface Bonus {
  coin: number; // %
  score: number; // %
  time: number; // 초
  shield: number;
  notes: string[];
}
