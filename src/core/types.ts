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
  pity: { legend: number; ultra: number };
  tenPullGuarantee: number;
  pickupChance: number;
  cost: { single: number; ten: number };
  maxBreakthrough: number;
  startCoins: number;
}

export interface BannerDef {
  id: string;
  name: string;
  type: 'all' | 'pickup';
  domain?: string;
  desc: string;
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
  b: number; // 돌파 수
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
  r: number;
  banner: string;
  at: number;
}

export interface PullResult {
  id: string;
  rarity: number;
  isNew: boolean;
  b: number;
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
