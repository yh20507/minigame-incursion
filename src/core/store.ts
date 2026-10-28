import type { Backend, SaveEvent } from './backend';
import type { Content } from './content';
import { addDupe, rollPulls } from './gacha';
import type { BannerDef, Bonus, CharDef, DomainDef, ItemDef, PullResult, SaveData } from './types';
import { todayKey } from './rng';

export function defaultSave(content: Content): SaveData {
  return {
    version: 1,
    coins: content.gacha.startCoins,
    pity: { legend: 0, ultra: 0 },
    totalPulls: 0,
    owned: { teumsae: { b: 0, d: 0, at: Date.now() } },
    items: {},
    scores: {},
    team: { leader: 'teumsae', supports: [null, null] },
    story: {},
    cleared: {},
    extra: {
      daily: { date: '', cleared: false, best: 0 },
      microBest: 0,
      marathonBest: 0,
      settings: { sfx: 0.7, bgm: 0.5, theme: 0.8 },
      log: [],
      lobby: { bgs: [{ k: 'bg', id: 'rift' }], interval: 8, walkers: [], bgm: '', accent: '#ff5fd2' },
      seenNews: [],
      explore: { shards: 0, landed: [] },
      expedition: null,
    },
  };
}

type Listener = () => void;

/** 진행 상황과 그 저장을 담당한다. 모든 화면은 여기서 읽고 쓴다. */
export class Store {
  save!: SaveData;
  private listeners: Listener[] = [];

  constructor(
    public content: Content,
    public backend: Backend,
  ) {}

  async init() {
    this.save = await this.backend.load(defaultSave(this.content));
    this.sanitize();
  }

  /** 데이터 파일이 바뀌어 사라진 캐릭터 등을 정리 */
  private sanitize() {
    for (const id of Object.keys(this.save.owned)) if (!this.content.hasChar(id)) delete this.save.owned[id];
    const max = this.content.gacha.enhance.max;
    for (const o of Object.values(this.save.owned)) {
      o.b = Math.min(o.b ?? 0, max);
      o.d = o.d ?? 0;
    }
    this.save.items = this.save.items ?? {};
    if (!this.save.owned[this.save.team.leader]) this.save.team.leader = 'teumsae';
    this.save.team.supports = [0, 1].map((i) => {
      const id = this.save.team.supports[i];
      return id && this.save.owned[id] && id !== this.save.team.leader ? id : null;
    });
  }

  onChange(fn: Listener) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }
  private async commit(ev: SaveEvent) {
    this.emit();
    await this.backend.commit(this.save, ev);
  }

  // ---------- 조회 ----------
  get coins() {
    return this.save.coins;
  }
  isDomainUnlocked(d: DomainDef) {
    return !d.unlockAfter || !!this.save.cleared[d.unlockAfter];
  }
  unlockedDomains() {
    return this.content.domains.filter((d) => this.isDomainUnlocked(d));
  }
  domainStars(domainId: string) {
    const d = this.content.domain(domainId);
    if (!d) return 0;
    return d.games.reduce((a, g) => a + (this.save.scores[g]?.stars ?? 0), 0);
  }
  totalStars() {
    return Object.values(this.save.scores).reduce((a, s) => a + s.stars, 0);
  }
  bossUnlocked(domainId: string) {
    const d = this.content.domain(domainId)!;
    return this.domainStars(domainId) >= d.bossStars;
  }
  finalUnlocked() {
    return this.content.domains.every((d) => this.save.cleared[d.id]);
  }
  modeUnlocked(mode: 'micro' | 'daily' | 'marathon') {
    return !!this.save.cleared[this.content.challenges.unlock[mode]];
  }
  unlockedGames() {
    return this.unlockedDomains().flatMap((d) => d.games);
  }
  /** 균열별 캐릭터 풀: 상시 = 오리지널, 세계관 = 그 세계관 */
  gachaPool(bannerId: string): CharDef[] {
    const b = this.content.banners.find((x) => x.id === bannerId);
    if (!b) return [];
    if (b.type === 'world') return this.content.chars.filter((c) => c.pool && c.origin === 'world' && c.domain === b.world);
    return this.content.chars.filter((c) => c.pool && c.origin === 'original');
  }
  bannerActive(b: BannerDef) {
    const today = todayKey();
    if (b.start && today < b.start) return false;
    if (b.end && today > b.end) return false;
    return true;
  }
  availableBanners() {
    return this.content.banners.filter((b) => this.bannerActive(b));
  }
  /** 도감에 보여줄 세계관: 균열이 한 번이라도 열렸던 것 */
  visibleWorlds() {
    const today = todayKey();
    return this.content.worlds.filter((w) =>
      this.content.banners.some((b) => b.world === w.id && (!b.start || b.start <= today)),
    );
  }
  itemCount(id: string) {
    return this.save.items[id] ?? 0;
  }
  owns(id: string) {
    return !!this.save.owned[id];
  }
  ownedChars(): CharDef[] {
    return this.content.chars.filter((c) => this.save.owned[c.id]);
  }
  teamIds(): string[] {
    return [this.save.team.leader, ...this.save.team.supports.filter((x): x is string => !!x)];
  }
  dailyToday() {
    const d = this.save.extra.daily;
    if (d.date !== todayKey()) return { date: todayKey(), cleared: false, best: 0 };
    return d;
  }

  /** 편성에서 나오는 보너스. domainId 가 주어지면 그 영역 전용 패시브와 세트 보너스까지 계산. */
  bonus(domainId: string | null): Bonus {
    const b: Bonus = { coin: 0, score: 0, time: 0, shield: 0, notes: [] };
    const team = [
      { id: this.save.team.leader, f: 1 },
      ...this.save.team.supports.filter((x): x is string => !!x).map((id) => ({ id, f: 0.5 })),
    ];
    for (const m of team) {
      if (!this.content.hasChar(m.id)) continue;
      const ch = this.content.char(m.id);
      const br = this.save.owned[m.id]?.b ?? 0;
      const enh = this.content.gacha.enhance;
      const mult = 1 + enh.bonusPerLevel * br;
      for (const p of ch.passives) {
        if (p.domain && p.domain !== domainId) continue;
        if (p.type === 'shield') {
          if (m.f === 1) b.shield += p.value + (br >= enh.max ? 1 : 0);
          continue;
        }
        const v = p.value * mult * m.f;
        if (p.type === 'time') b.time += Math.round(v * 2) / 2;
        else b[p.type] += Math.round(v);
      }
    }
    if (domainId) {
      const poolChars = this.content.chars.filter((c) => c.pool && c.domain === domainId);
      if (poolChars.length && poolChars.every((c) => this.save.owned[c.id])) {
        const s = this.content.synergies.set;
        b[s.type] += s.value;
        b.notes.push(`세트 보너스: ${this.content.domainName(domainId)} 코인 +${s.value}%`);
      }
    }
    for (const w of this.content.worlds) {
      const wc = this.content.chars.filter((c) => c.origin === 'world' && c.domain === w.id);
      if (wc.length && wc.every((c) => this.save.owned[c.id])) {
        const ws = this.content.synergies.worldSet;
        b[ws.type] += ws.value;
        b.notes.push(`${w.name} 완성: ${effectLabel(ws.type, ws.value)}`);
      }
    }
    const ids = new Set(this.teamIds());
    for (const cx of this.content.synergies.crossovers) {
      if (cx.members.every((m) => ids.has(m))) {
        b[cx.effect.type] += cx.effect.value;
        b.notes.push(`${cx.name}: ${effectLabel(cx.effect.type, cx.effect.value)}`);
      }
    }
    return b;
  }

  activeCrossovers() {
    const ids = new Set(this.teamIds());
    return this.content.synergies.crossovers.filter((cx) => cx.members.every((m) => ids.has(m)));
  }

  // ---------- 변경 ----------
  async recordResult(gameId: string, score: number, domainId: string, extraCoinPct = 0) {
    const g = this.content.game(gameId);
    const rec = this.save.scores[gameId] ?? { best: 0, stars: 0, plays: 0 };
    const stars = g.stars.filter((s) => score >= s).length;
    const newStars = Math.max(0, stars - rec.stars);
    const newBest = score > rec.best;
    const bonus = this.bonus(domainId);
    const coins = Math.floor(score * g.coinRate * (1 + (bonus.coin + extraCoinPct) / 100)) + newStars * 100;
    rec.best = Math.max(rec.best, score);
    rec.stars = Math.max(rec.stars, stars);
    rec.plays += 1;
    this.save.scores[gameId] = rec;
    this.save.coins += coins;
    await this.commit({ t: 'result', game: gameId, score, stars, coins });
    return { stars, newStars, newBest, coins, best: rec.best, coinBonus: bonus.coin + extraCoinPct };
  }

  async addCoins(n: number) {
    if (!n) return;
    this.save.coins += n;
    await this.commit({ t: 'coins', n });
  }

  async grant(charId: string) {
    if (this.save.owned[charId]) return false;
    this.save.owned[charId] = { b: 0, d: 0, at: Date.now() };
    await this.commit({ t: 'grant', id: charId });
    return true;
  }

  async saveMeta() {
    await this.commit({ t: 'meta' });
  }

  async setTeam(leader: string, supports: (string | null)[]) {
    this.save.team = { leader, supports };
    await this.saveMeta();
  }
  async markStory(id: string) {
    if (this.save.story[id]) return;
    this.save.story[id] = true;
    await this.saveMeta();
  }
  async markCleared(key: string) {
    const first = !this.save.cleared[key];
    this.save.cleared[key] = true;
    await this.saveMeta();
    return first;
  }

  async pull(bannerId: string, multi: boolean): Promise<PullResult[]> {
    const cfg = this.content.gacha;
    const cost = multi ? cfg.cost.multi : cfg.cost.single;
    const count = multi ? cfg.cost.multiCount : 1;
    if (this.save.coins < cost) throw new Error('코인이 부족해요');
    const banner = this.content.banners.find((b) => b.id === bannerId)!;
    if (!this.bannerActive(banner)) throw new Error('지금은 닫힌 균열이에요');
    const pool = this.gachaPool(bannerId);

    const online = await this.backend.pull(bannerId, pool.map((c) => c.id), multi);
    let results: PullResult[];
    if (online) {
      results = online.results;
      this.save.coins = online.coins;
      this.save.pity = online.pity;
      this.save.totalPulls = online.totalPulls;
      this.save.items = online.items;
      for (const r of results) {
        if (r.kind !== 'char') continue;
        const o = this.save.owned[r.id];
        if (o) {
          o.b = r.b;
          o.d = r.d;
        } else this.save.owned[r.id] = { b: r.b, d: r.d, at: Date.now() };
      }
    } else {
      this.save.coins -= cost;
      results = rollPulls(this.save, pool, cfg, this.content.items, count);
    }
    const now = Date.now();
    this.save.extra.log = [
      ...results.map((r) => ({ id: r.id, r: r.rarity, banner: bannerId, at: now })).reverse(),
      ...this.save.extra.log,
    ].slice(0, 300);
    await this.commit({ t: 'meta' });
    return results;
  }

  /** 출전 전에 아이템 사용. 실제로 쓴 아이템 목록을 돌려준다 */
  async useItems(ids: string[]): Promise<ItemDef[]> {
    const used: ItemDef[] = [];
    for (const id of ids) {
      if ((this.save.items[id] ?? 0) <= 0) continue;
      this.save.items[id] -= 1;
      const it = this.content.item(id);
      if (it) used.push(it);
    }
    if (used.length) await this.commit({ t: 'items', used: used.map((u) => u.id) });
    return used;
  }

  async addItems(items: Record<string, number>) {
    if (!Object.keys(items).length) return;
    for (const [k, n] of Object.entries(items)) this.save.items[k] = (this.save.items[k] ?? 0) + n;
    await this.commit({ t: 'additems', items });
  }

  /** 만능 조각을 ★1~★3 캐릭터의 중복 1개로 쓴다 */
  async useShard(charId: string) {
    const ch = this.content.char(charId);
    const o = this.save.owned[charId];
    if (!o || ch.rarity > 3 || o.b >= this.content.gacha.enhance.max) return null;
    if ((this.save.items['shard'] ?? 0) <= 0) return null;
    this.save.items['shard'] -= 1;
    const r = addDupe(this.save, this.content.gacha, ch);
    await this.commit({ t: 'shard', char: charId });
    return r;
  }

  async updateDaily(score: number, cleared: boolean) {
    const d = this.dailyToday();
    const firstClear = cleared && !d.cleared;
    this.save.extra.daily = { date: d.date, cleared: d.cleared || cleared, best: Math.max(d.best, score) };
    await this.saveMeta();
    return firstClear;
  }

  async setBest(key: 'microBest' | 'marathonBest', v: number) {
    const better = v > this.save.extra[key];
    if (better) {
      this.save.extra[key] = v;
      await this.saveMeta();
    }
    return better;
  }

  async setSettings(s: Partial<SaveData['extra']['settings']>) {
    Object.assign(this.save.extra.settings, s);
    await this.saveMeta();
  }
}

export function effectLabel(type: string, v: number) {
  switch (type) {
    case 'coin':
      return `코인 +${v}%`;
    case 'score':
      return `점수 +${v}%`;
    case 'time':
      return `제한시간 +${v}초`;
    case 'shield':
      return `보호막 ${v}회`;
  }
  return '';
}

export function passiveLabel(p: { type: string; value: number; domain?: string }, domainName?: string) {
  const base = effectLabel(p.type, p.value);
  return p.domain ? `${domainName ?? p.domain} 한정 ${base}` : base;
}
