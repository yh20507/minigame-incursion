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
  /** 그림 생성용 영어 외형 설명 (tools/comfy_gen.py 가 사용) */
  look?: string;
  /** 테마곡 하이라이트 시작 위치 (초) */
  themeStart?: number;
  line: string;
  unlock?: string;
  /** 목소리: 기본 음높이(Hz), 빠르기, 음색, 포먼트 배율 */
  voice?: { pitch: number; speed?: number; wave?: OscillatorType; formant?: number };
  /** ★4·★5 고유 스킬 (리더일 때만) */
  skill?: import('./skills').SkillDef;
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
  /** 2부 대륙: 원정대 상륙이 필요 */
  landing?: boolean;
  part?: number;
  /** 보스만 있는 최종 대륙 */
  final?: boolean;
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
  /** 균열마다 첫 10+1회에서 보장하는 최소 별 */
  firstMultiGuarantee?: number;
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
  /** 복각 기간. event 는 그 기간에 열리는 이벤트 스토리 id */
  reruns?: { start: string; end: string; event?: string }[];
  desc: string;
}

export interface TitleDef {
  id: string;
  name: string;
  desc: string;
  cond: { type: 'pulls' | 'owned' | 'rarity' | 'enhance' | 'world' | 'stars' | 'cleared' | 'attend' | 'skins' | 'hard' | 'records' | 'stories'; n?: number; min?: number; world?: string; key?: string };
  coins: number;
}

export interface RewardsDef {
  attendance: { day: number; coins?: number; items?: Record<string, number> }[];
  titles: TitleDef[];
  tickets: { id: string; world: string; rarity?: number; /** 시즌 패스 보상이면 시즌 id */ pass?: string; name?: string }[];
}

export type MissionType = 'play' | 'earn' | 'star3' | 'hard' | 'pull' | 'challenge' | 'attend' | 'skinpull';
export interface MissionDef {
  id: string;
  name: string;
  type: MissionType;
  n: number;
  xp: number;
}
export interface PassLevel {
  lv: number;
  coins?: number;
  items?: Record<string, number>;
  skinShards?: number;
  ticket?: string;
}
export interface PassDef {
  season: string;
  name: string;
  sub: string;
  start: string;
  end: string;
  xpPerLevel: number;
  maxLevel: number;
  levels: PassLevel[];
  weekly: MissionDef[];
  daily: MissionDef[];
}

export type SkinGrade = 'A' | 'S' | 'SS';
export interface SkinDef {
  id: string;
  char: string;
  name: string;
  grade: SkinGrade;
  desc: string;
  look?: string;
  /** 그림을 직접 넣는 자리 (임시 그림 없음, 파일이 생길 때까지 뽑기에서 제외) */
  manual?: boolean;
  /** 시즌 한정 (updates.json 의 시즌 id) */
  season?: string;
}
export interface SkinsData {
  config: {
    cost: { single: number; multi: number; multiCount: number };
    rates: { SS: number; S: number; A: number };
    shardRoll: [number, number];
    dupShards: Record<SkinGrade, number>;
    exchange: Record<SkinGrade, number>;
    /** S 이상 확정 */
    pity: number;
    /** SS 확정 */
    ssPity: number;
    /** 등급별 장착 효과 (%) — 출전 팀에 입힌 동료가 있으면 적용 */
    effects: Record<SkinGrade, { score?: number; coin?: number }>;
    effectNote: string;
    pickupMult: number;
    multiGuarantee: SkinGrade;
  };
  grades: Record<SkinGrade, { name: string; color: string }>;
  skins: SkinDef[];
}
export interface SkinPull {
  kind: 'skin' | 'shard';
  id: string;
  grade?: SkinGrade;
  isNew: boolean;
  shards: number;
  pity: boolean;
}

export interface WorldDef {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  desc: string;
  themeStart?: number;
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
  landing: { segments: number; duration: number; lives: number; difficulty: number; reward: number; passRatio: number };
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
  /** 어려움 모드 최고 점수 */
  hardBest?: number;
}

export interface SaveData {
  version: 1;
  coins: number;
  pity: { legend: number; ultra: number };
  totalPulls: number;
  /** 첫 10+1회 확정을 이미 쓴 균열 id */
  firstMulti: string[];
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
    settings: { sfx: number; bgm: number; theme: number; lowfx?: boolean };
    log: GachaLogEntry[];
    lobby: LobbyConfig;
    seenNews: string[];
    explore: { shards: number; landed: string[] };
    expedition: { members: string[]; start: number; hours: number } | null;
    /** 출석: 이번 주기 시작일, 마지막 출석일, 이번 주기 출석 수, 누적 */
    attend: { start: string; last: string; days: number; total: number };
    titles: { claimed: string[]; equipped: string };
    tickets: string[];
    eventRewards: string[];
    skins: { owned: string[]; equipped: Record<string, string>; shards: number; pity: number; ssPity?: number; pulls: number };
    /** 시즌 패스·미션. week/day 는 주기 키, weekly/daily 는 미션별 진행도, done 은 보상 받은 미션 */
    pass: { season: string; xp: number; claimed: number[]; week: string; weekly: Record<string, number>; day: string; daily: Record<string, number>; done: string[]; freePull: string; attendDays: string[] };
    /** 어려움 모드 최고 점수 (온라인 저장용) */
    hardBest: Record<string, number>;
    /** 모은 기록 조각 id */
    records: string[];
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

export interface LobbyConfig {
  bgs: { k: 'art' | 'full' | 'bg'; id: string }[];
  interval: number;
  walkers: string[];
  /** '' = 기본, 'bgm:<키>', 'char:<id>', 'world:<id>' */
  bgm: string;
  accent: string;
}

export interface Season {
  id: string;
  name: string;
  start: string;
  end: string | null;
  desc: string;
  highlight?: string;
  banners: string[];
  notes: string[];
}

export interface RecordDef {
  id: string;
  domain: string;
  title: string;
  text: string;
}

export interface FrontierDef {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  need: number;
  /** 이 대륙 탐사가 열리는 조건 (cleared 키) */
  unlockAfter: string;
  stages: { at: number; text: string }[];
  landed: string;
}
export interface FrontierData {
  shards: { normalPerStar: number; normalClear: number; boss: number; daily: number; microPer: number; marathonPerSeg: number };
  expedition: { hours: number[]; shardsPerHour: number; coinsPerHour: number; itemEvery: number };
  list: FrontierDef[];
}
