import type {
  BannerDef,
  Challenges,
  CharDef,
  DomainDef,
  GachaConfig,
  GameDef,
  ItemDef,
  StoryData,
  WorldDef,
  Season,
  Frontier,
  Synergies,
  RewardsDef,
  SkinDef,
  SkinsData, PassDef } from './types';

/** 게임 콘텐츠(데이터 파일). public/data/*.json 에서 불러온다. */
export class Content {
  domains: DomainDef[] = [];
  games: GameDef[] = [];
  chars: CharDef[] = [];
  gacha!: GachaConfig;
  banners: BannerDef[] = [];
  synergies!: Synergies;
  challenges!: Challenges;
  story!: StoryData;
  worlds: WorldDef[] = [];
  items: ItemDef[] = [];
  updates: Season[] = [];
  frontier!: Frontier;
  rewards!: RewardsDef;
  skins!: SkinsData;
  pass!: PassDef;
  /** 실제 그림 파일이 있는 스킨 id (Boot 이 채움) */
  skinFiles = new Set<string>();
  private skinMap = new Map<string, SkinDef>();

  private charMap = new Map<string, CharDef>();
  private gameMap = new Map<string, GameDef>();
  private domainMap = new Map<string, DomainDef>();

  static fromCache(cache: Phaser.Cache.BaseCache): Content {
    const c = new Content();
    c.domains = cache.get('domains');
    c.games = cache.get('minigames');
    c.chars = cache.get('characters');
    c.gacha = cache.get('gacha');
    c.banners = cache.get('banners');
    c.synergies = cache.get('synergies');
    c.challenges = cache.get('challenges');
    c.story = cache.get('story');
    c.worlds = cache.get('worlds');
    c.items = cache.get('items');
    c.updates = cache.get('updates') ?? [];
    c.frontier = cache.get('frontier');
    c.rewards = cache.get('rewards') ?? { attendance: [], titles: [], tickets: [] };
    c.skins = cache.get('skins') ?? { config: {}, grades: {}, skins: [] };
    c.pass = cache.get('pass') ?? { season: '', name: '', sub: '', start: '', end: '', xpPerLevel: 100, maxLevel: 0, levels: [], weekly: [], daily: [] };
    c.index();
    return c;
  }

  index() {
    this.chars.forEach((ch) => this.charMap.set(ch.id, ch));
    this.games.forEach((g) => this.gameMap.set(g.id, g));
    this.domains.forEach((d) => this.domainMap.set(d.id, d));
    this.skins.skins.forEach((s) => this.skinMap.set(s.id, s));
  }

  char(id: string): CharDef {
    const c = this.charMap.get(id);
    if (!c) throw new Error('unknown character ' + id);
    return c;
  }
  skin(id: string): SkinDef | undefined {
    return this.skinMap.get(id);
  }
  skinsOf(charId: string) {
    return this.skins.skins.filter((s) => s.char === charId);
  }
  hasChar(id: string) {
    return this.charMap.has(id);
  }
  game(id: string): GameDef {
    const g = this.gameMap.get(id);
    if (!g) throw new Error('unknown game ' + id);
    return g;
  }
  domain(id: string): DomainDef | undefined {
    return this.domainMap.get(id);
  }
  rarity(r: number) {
    return this.gacha.rarities.find((x) => x.id === r)!;
  }
  world(id: string) {
    return this.worlds.find((w) => w.id === id);
  }
  item(id: string) {
    return this.items.find((i) => i.id === id);
  }
  domainName(id: string) {
    if (id === 'rift') return '균열';
    return this.domain(id)?.name ?? this.world(id)?.name ?? id;
  }
  domainColor(id: string) {
    if (id === 'rift') return '#b48cff';
    return this.domain(id)?.color ?? this.world(id)?.color ?? '#ffffff';
  }
}
