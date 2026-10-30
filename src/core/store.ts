import type { Backend, SaveEvent } from './backend';
import type { Content } from './content';
import { addDupe, rollPulls } from './gacha';
import type { BannerDef, Bonus, CharDef, DomainDef, ItemDef, MissionDef, MissionType, PullResult, SaveData, SkinDef, SkinGrade, SkinPull, TitleDef } from './types';
import { todayKey, weekKey } from './rng';

export function defaultSave(content: Content): SaveData {
  return {
    version: 1,
    coins: content.gacha.startCoins,
    pity: { legend: 0, ultra: 0 },
    totalPulls: 0,
    firstMulti: [],
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
      attend: { start: '', last: '', days: 0, total: 0 },
      titles: { claimed: [], equipped: '' },
      tickets: [],
      eventRewards: [],
      skins: { owned: [], equipped: {}, shards: 0, pity: 0, pulls: 0 },
      pass: { season: '', xp: 0, claimed: [], week: '', weekly: {}, day: '', daily: {}, done: [], freePull: '', attendDays: [] },
      hardBest: {},
      records: [],
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
    for (const [g, n] of Object.entries(this.save.extra.hardBest ?? {})) {
      const rec = (this.save.scores[g] ??= { best: 0, stars: 0, plays: 0 });
      rec.hardBest = Math.max(rec.hardBest ?? 0, n);
    }
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
    if (d.unlockAfter && !this.save.cleared[d.unlockAfter]) return false;
    if (d.landing && !this.save.extra.explore.landed.includes(d.id)) return false;
    return true;
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
    return this.content.domainsOf(1).every((d) => this.save.cleared[d.id]);
  }
  /** 2부 최종(서재) 입장: 다섯 대륙 해방 + 상륙 */
  library() {
    return this.content.domains.find((d) => d.final) ?? null;
  }
  modeUnlocked(mode: 'micro' | 'daily' | 'marathon') {
    return !!this.save.cleared[this.content.challenges.unlock[mode]];
  }
  /** 플레이 가능한(구현된) 열린 미니게임 */
  unlockedGames() {
    return this.unlockedDomains().filter((d) => !d.final).flatMap((d) => d.games).filter((g) => this.content.playable(g));
  }
  /** 균열별 캐릭터 풀: 상시 = 오리지널, 세계관 = 그 세계관 */
  gachaPool(bannerId: string): CharDef[] {
    const b = this.content.banners.find((x) => x.id === bannerId);
    if (!b) return [];
    if (b.type === 'world') return this.content.chars.filter((c) => c.pool && c.origin === 'world' && c.domain === b.world);
    return this.content.chars.filter((c) => c.pool && c.origin === 'original');
  }
  /** 지금 열려 있는 기간 (첫 기간 또는 복각). 닫혀 있으면 null */
  bannerPeriod(b: BannerDef): { start?: string | null; end?: string | null; rerun: boolean; event?: string } | null {
    const today = todayKey();
    if ((!b.start || today >= b.start) && (!b.end || today <= b.end)) return { start: b.start, end: b.end, rerun: false };
    const r = (b.reruns ?? []).find((x) => today >= x.start && today <= x.end);
    return r ? { start: r.start, end: r.end, rerun: true, event: r.event } : null;
  }
  bannerActive(b: BannerDef) {
    return !!this.bannerPeriod(b);
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
  /** 어려움 모드 별 기준 (일반의 1.5배) */
  hardStars(gameId: string): [number, number, number] {
    return this.content.game(gameId).stars.map((s) => Math.round(s * 1.5)) as [number, number, number];
  }
  hardUnlocked(gameId: string) {
    return (this.save.scores[gameId]?.stars ?? 0) >= 3;
  }
  /** 어려움 모드에서 ★3 기준을 넘긴 게임 수 */
  hardCleared() {
    return this.content.games.filter((g) => (this.save.scores[g.id]?.hardBest ?? 0) >= this.hardStars(g.id)[2]).length;
  }
  async recordResult(gameId: string, score: number, domainId: string, extraCoinPct = 0, hard = false) {
    const g = this.content.game(gameId);
    const rec = this.save.scores[gameId] ?? { best: 0, stars: 0, plays: 0 };
    const thresholds = hard ? this.hardStars(gameId) : g.stars;
    const stars = thresholds.filter((s) => score >= s).length;
    const newStars = Math.max(0, stars - rec.stars);
    const newBest = hard ? score > (rec.hardBest ?? 0) : score > rec.best;
    const bonus = this.bonus(domainId);
    const coins = Math.floor(score * g.coinRate * (hard ? 1.5 : 1) * (1 + (bonus.coin + extraCoinPct) / 100)) + newStars * 100;
    if (hard) {
      rec.hardBest = Math.max(rec.hardBest ?? 0, score);
      this.save.extra.hardBest[gameId] = rec.hardBest;
    }
    else rec.best = Math.max(rec.best, score);
    rec.stars = Math.max(rec.stars, stars);
    rec.plays += 1;
    this.save.scores[gameId] = rec;
    this.save.coins += coins;
    await this.commit({ t: 'result', game: gameId, score: hard ? 0 : score, stars, coins });
    this.passTrack('play', 1);
    this.passTrack('earn', coins);
    if (stars >= 3) this.passTrack('star3', 1);
    if (hard) this.passTrack('hard', 1);
    if (hard) await this.saveMeta();
    return { stars, newStars, newBest, coins, best: hard ? (rec.hardBest ?? 0) : rec.best, coinBonus: bonus.coin + extraCoinPct };
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

  // ---------- 출석 ----------
  /** 오늘 첫 접속이면 도장을 찍고 보상을 준다. 28일이 지나면 새 주기 */
  async checkAttendance(): Promise<{ day: number; coins: number; items: Record<string, number> } | null> {
    const a = this.save.extra.attend;
    const today = todayKey();
    const daysSince = (from: string) => Math.floor((Date.parse(today) - Date.parse(from)) / 86400000);
    if (!a.start || daysSince(a.start) >= 28 || a.days >= 28 && a.last !== today) {
      a.start = today;
      a.days = 0;
    }
    if (a.last === today) return null;
    a.days = Math.min(28, a.days + 1);
    a.total += 1;
    a.last = today;
    this.passTrack('attend', 1);
    const r = this.content.rewards.attendance[a.days - 1] ?? { day: a.days };
    await this.saveMeta();
    if (r.coins) await this.addCoins(r.coins);
    if (r.items) await this.addItems(r.items);
    return { day: a.days, coins: r.coins ?? 0, items: r.items ?? {} };
  }

  // ---------- 칭호 ----------
  titleProgress(t: TitleDef): { cur: number; need: number } {
    const c = t.cond;
    const owned = this.ownedChars();
    switch (c.type) {
      case 'pulls':
        return { cur: this.save.totalPulls, need: c.n! };
      case 'owned':
        return { cur: owned.length, need: c.n! };
      case 'rarity':
        return { cur: owned.filter((x) => x.rarity >= (c.min ?? 5)).length, need: c.n! };
      case 'enhance':
        return { cur: Math.max(0, ...Object.values(this.save.owned).map((o) => o.b)), need: c.n! };
      case 'world': {
        const all = this.content.chars.filter((x) => x.domain === c.world && x.pool);
        return { cur: all.filter((x) => this.owns(x.id)).length, need: all.length };
      }
      case 'stars':
        return { cur: this.totalStars(), need: c.n! };
      case 'cleared':
        return { cur: this.save.cleared[c.key!] ? 1 : 0, need: 1 };
      case 'attend':
        return { cur: this.save.extra.attend.total, need: c.n! };
      case 'skins':
        return { cur: this.save.extra.skins.owned.length, need: c.n! };
      case 'hard':
        return { cur: this.hardCleared(), need: c.n! };
      case 'records':
        return { cur: this.save.extra.records.length, need: c.n! };
      case 'stories':
        return { cur: Object.keys(this.save.story).filter((k) => k.startsWith('p_')).length, need: c.n! };
    }
    return { cur: 0, need: 1 };
  }
  titleDone(t: TitleDef) {
    const p = this.titleProgress(t);
    return p.cur >= p.need;
  }
  claimableTitles() {
    return this.content.rewards.titles.filter((t) => this.titleDone(t) && !this.save.extra.titles.claimed.includes(t.id));
  }
  async claimTitle(id: string) {
    const t = this.content.rewards.titles.find((x) => x.id === id);
    if (!t || !this.titleDone(t) || this.save.extra.titles.claimed.includes(id)) return 0;
    this.save.extra.titles.claimed.push(id);
    if (!this.save.extra.titles.equipped) this.save.extra.titles.equipped = id;
    await this.saveMeta();
    await this.addCoins(t.coins);
    return t.coins;
  }
  async equipTitle(id: string) {
    this.save.extra.titles.equipped = id;
    await this.saveMeta();
  }
  equippedTitle() {
    const id = this.save.extra.titles.equipped;
    return this.content.rewards.titles.find((t) => t.id === id) ?? null;
  }

  // ---------- ★5 선택권 ----------
  ticketChoices(ticketId: string) {
    const tk = this.content.rewards.tickets.find((t) => t.id === ticketId);
    if (!tk) return [];
    return this.content.chars.filter((c) => (tk.world === 'any' || c.domain === tk.world) && c.rarity === (tk.rarity ?? 5) && c.pool);
  }
  /** 선택권을 쓸 수 있는 세계관 = 균열이 한 번이라도 열린 곳 */
  availableTickets() {
    const seen = new Set(this.visibleWorlds().map((w) => w.id));
    return this.content.rewards.tickets.filter((t) => (t.pass ? this.passTicketUnlocked(t.id) : seen.has(t.world)));
  }
  async claimTicket(ticketId: string, charId: string) {
    if (this.save.extra.tickets.includes(ticketId)) throw new Error('이미 쓴 선택권이에요');
    const ch = this.ticketChoices(ticketId).find((c) => c.id === charId);
    if (!ch) throw new Error('고를 수 없는 캐릭터예요');
    let isNew = false;
    let r = { levelUp: false, refund: 0 };
    if (!this.save.owned[charId]) {
      this.save.owned[charId] = { b: 0, d: 0, at: Date.now() };
      isNew = true;
    } else r = addDupe(this.save, this.content.gacha, ch);
    this.save.extra.tickets.push(ticketId);
    await this.commit({ t: 'ticket', ticket: ticketId, char: charId });
    await this.saveMeta();
    return { isNew, ...r };
  }

  // ---------- 시즌 패스 · 미션 ----------
  passActive() {
    const p = this.content.pass;
    const t = todayKey();
    return !!p.season && p.start <= t && t <= p.end;
  }
  /** 주기 키가 바뀌었으면 진행도를 비운다 (시즌·주·일) */
  private passRoll() {
    const ps = this.save.extra.pass;
    const p = this.content.pass;
    if (ps.season !== p.season) {
      ps.season = p.season;
      ps.xp = 0;
      ps.claimed = [];
      ps.done = [];
    }
    const wk = weekKey();
    if (ps.week !== wk) {
      ps.week = wk;
      ps.weekly = {};
      ps.attendDays = [];
      ps.done = ps.done.filter((id) => !id.startsWith('w_'));
    }
    const dk = todayKey();
    if (ps.day !== dk) {
      ps.day = dk;
      ps.daily = {};
      ps.done = ps.done.filter((id) => !id.startsWith('d_'));
    }
    return ps;
  }
  /** 미션 진행도 올리기. 보상은 화면에서 받는다 */
  passTrack(type: MissionType, n: number) {
    if (!this.passActive()) return;
    const ps = this.passRoll();
    if (type === 'attend') {
      const t = todayKey();
      if (ps.attendDays.includes(t)) return;
      ps.attendDays.push(t);
      n = 1;
    }
    for (const m of this.content.pass.weekly) if (m.type === type) ps.weekly[m.id] = Math.min(m.n, (ps.weekly[m.id] ?? 0) + n);
    for (const m of this.content.pass.daily) if (m.type === type) ps.daily[m.id] = Math.min(m.n, (ps.daily[m.id] ?? 0) + n);
    this.emit();
  }
  missionProgress(m: MissionDef) {
    const ps = this.passRoll();
    const cur = m.id.startsWith('w_') ? (ps.weekly[m.id] ?? 0) : (ps.daily[m.id] ?? 0);
    return { cur: Math.min(cur, m.n), need: m.n, done: ps.done.includes(m.id), ready: cur >= m.n && !ps.done.includes(m.id) };
  }
  claimableMissions() {
    if (!this.passActive()) return 0;
    return [...this.content.pass.weekly, ...this.content.pass.daily].filter((m) => this.missionProgress(m).ready).length;
  }
  async claimMission(id: string) {
    const m = [...this.content.pass.weekly, ...this.content.pass.daily].find((x) => x.id === id);
    if (!m) throw new Error('없는 미션');
    const ps = this.passRoll();
    const p = this.missionProgress(m);
    if (!p.ready) throw new Error('아직이에요');
    ps.done.push(id);
    ps.xp = Math.min(this.content.pass.maxLevel * this.content.pass.xpPerLevel, ps.xp + m.xp);
    await this.saveMeta();
    return m.xp;
  }
  passLevel() {
    const p = this.content.pass;
    const ps = this.passRoll();
    return Math.min(p.maxLevel, Math.floor(ps.xp / p.xpPerLevel));
  }
  passXpInLevel() {
    const p = this.content.pass;
    const ps = this.passRoll();
    return this.passLevel() >= p.maxLevel ? p.xpPerLevel : ps.xp % p.xpPerLevel;
  }
  passClaimable() {
    const lv = this.passLevel();
    const ps = this.passRoll();
    return this.content.pass.levels.filter((l) => l.lv <= lv && !ps.claimed.includes(l.lv));
  }
  passTicketUnlocked(ticketId: string) {
    const ps = this.save.extra.pass;
    return this.content.pass.levels.some((l) => l.ticket === ticketId && ps.claimed.includes(l.lv));
  }
  async claimPassLevel(lv: number) {
    const l = this.content.pass.levels.find((x) => x.lv === lv);
    const ps = this.passRoll();
    if (!l || lv > this.passLevel() || ps.claimed.includes(lv)) throw new Error('아직 받을 수 없어요');
    ps.claimed.push(lv);
    if (l.skinShards) this.save.extra.skins.shards += l.skinShards;
    await this.saveMeta();
    if (l.coins) await this.addCoins(l.coins);
    if (l.items) await this.addItems(l.items);
    return l;
  }
  /** 패스에서 아직 안 받은 것 + 받을 수 있는 미션 수 (로비 배지) */
  passBadge() {
    if (!this.passActive()) return 0;
    return this.passClaimable().length + this.claimableMissions();
  }

  // ---------- 코인 쓰기 ----------
  async spendCoins(n: number, reason: string) {
    if (this.save.coins < n) throw new Error('코인이 부족해요');
    this.save.coins -= n;
    await this.commit({ t: 'spend', n, reason });
  }

  // ---------- 스킨 ----------
  /** 그림이 준비된 스킨인가 (직접 넣는 자리는 파일이 있어야, 나머지는 임시 그림 허용) */
  skinAvailable(sk: SkinDef) {
    return this.content.skinFiles.has(sk.id) || !sk.manual;
  }
  /** 지금 뽑힐 수 있는 스킨 (준비됨 + 시즌 한정이면 그 시즌 진행 중) */
  skinInPool(sk: SkinDef) {
    if (!this.skinAvailable(sk)) return false;
    if (sk.season) {
      const today = todayKey();
      const s = this.content.updates.find((u) => u.id === sk.season);
      if (!s || s.start > today || (s.end && s.end < today)) return false;
    }
    return true;
  }
  skinPool() {
    return this.content.skins.skins.filter((s) => this.skinInPool(s));
  }
  ownsSkin(id: string) {
    return this.save.extra.skins.owned.includes(id);
  }
  equippedSkin(charId: string): SkinDef | null {
    const id = this.save.extra.skins.equipped[charId];
    if (!id || !this.ownsSkin(id)) return null;
    return this.content.skin(id) ?? null;
  }
  async equipSkin(charId: string, skinId: string | null) {
    if (skinId && !this.ownsSkin(skinId)) return;
    if (skinId) this.save.extra.skins.equipped[charId] = skinId;
    else delete this.save.extra.skins.equipped[charId];
    await this.saveMeta();
  }
  /** 픽업: 지금 열린 세계관 균열의 스킨은 가중치 ×pickupMult */
  skinPickup(sk: SkinDef) {
    const ch = this.content.char(sk.char);
    return this.content.banners.some((b) => b.type === 'world' && b.world === ch.domain && this.bannerActive(b));
  }
  rollSkins(count: number, rng: () => number = Math.random): SkinPull[] {
    const cfg = this.content.skins.config;
    const pool = this.skinPool();
    const sk = this.save.extra.skins;
    const out: SkinPull[] = [];
    const pick = (grades: SkinGrade[]) => {
      const cands = pool.filter((s) => grades.includes(s.grade));
      if (!cands.length) return null;
      const w = cands.map((s) => (this.skinPickup(s) ? cfg.pickupMult : 1));
      let x = rng() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < cands.length; i++) {
        if (x < w[i]) return cands[i];
        x -= w[i];
      }
      return cands[cands.length - 1];
    };
    let gotA = false;
    for (let i = 0; i < count; i++) {
      sk.pity += 1;
      sk.pulls += 1;
      let grade: SkinGrade | null = null;
      let pity = false;
      if (sk.pity >= cfg.pity && pick(['S', 'SS'])) {
        grade = 'S';
        pity = true;
      } else {
        const x = rng() * 100;
        if (x < cfg.rates.S) grade = 'S';
        else if (x < cfg.rates.S + cfg.rates.A) grade = 'A';
      }
      if (count > 1 && i === count - 1 && !gotA && !grade) grade = 'A';
      const chosen = grade === 'S' ? pick(['S', 'SS']) : grade === 'A' ? pick(['A']) : null;
      if (!chosen) {
        const n = cfg.shardRoll[0] + Math.floor(rng() * (cfg.shardRoll[1] - cfg.shardRoll[0] + 1));
        sk.shards += n;
        out.push({ kind: 'shard', id: 'shard', isNew: false, shards: n, pity: false });
        continue;
      }
      gotA = true;
      if (chosen.grade !== 'A') sk.pity = 0;
      const isNew = !sk.owned.includes(chosen.id);
      let shards = 0;
      if (isNew) sk.owned.push(chosen.id);
      else {
        shards = cfg.dupShards[chosen.grade];
        sk.shards += shards;
      }
      out.push({ kind: 'skin', id: chosen.id, grade: chosen.grade, isNew, shards, pity });
    }
    return out;
  }
  async pullSkins(multi: boolean): Promise<SkinPull[]> {
    const cfg = this.content.skins.config;
    const cost = multi ? cfg.cost.multi : cfg.cost.single;
    if (!this.skinPool().length) throw new Error('지금 뽑을 수 있는 스킨이 없어요');
    await this.spendCoins(cost, 'skin');
    const res = this.rollSkins(multi ? cfg.cost.multiCount : 1);
    this.passTrack('skinpull', res.length);
    await this.saveMeta();
    return res;
  }
  async exchangeSkin(id: string) {
    const skd = this.content.skin(id);
    if (!skd || this.ownsSkin(id) || !this.skinAvailable(skd)) throw new Error('교환할 수 없어요');
    const need = this.content.skins.config.exchange[skd.grade];
    if (this.save.extra.skins.shards < need) throw new Error(`스킨 조각이 ${need}개 필요해요`);
    this.save.extra.skins.shards -= need;
    this.save.extra.skins.owned.push(id);
    await this.saveMeta();
  }

  // ---------- 이벤트 ----------
  async claimEventReward(eventId: string, coins: number) {
    if (this.save.extra.eventRewards.includes(eventId)) return false;
    this.save.extra.eventRewards.push(eventId);
    await this.saveMeta();
    await this.addCoins(coins);
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

  /** 이 균열의 첫 10+1회 확정이 아직 남았나 */
  isFirstMulti(bannerId: string) {
    return !(this.save.firstMulti ?? []).includes(bannerId);
  }

  /** 오늘의 무료 소환(상시 균열 1회)이 남았나 */
  freePullLeft() {
    return this.save.extra.pass.freePull !== todayKey();
  }
  freePullBanner() {
    return this.content.banners.find((b) => b.type === 'standard' && this.bannerActive(b)) ?? null;
  }
  async pull(bannerId: string, multi: boolean, free = false): Promise<PullResult[]> {
    const cfg = this.content.gacha;
    const banner = this.content.banners.find((b) => b.id === bannerId)!;
    free = free && !multi && banner.type === 'standard' && this.freePullLeft();
    const cost = free ? 0 : multi ? cfg.cost.multi : cfg.cost.single;
    const count = multi ? cfg.cost.multiCount : 1;
    if (this.save.coins < cost) throw new Error('코인이 부족해요');
    if (!this.bannerActive(banner)) throw new Error('지금은 닫힌 균열이에요');
    const pool = this.gachaPool(bannerId);
    if (free) this.save.extra.pass.freePull = todayKey();

    const online = await this.backend.pull(bannerId, pool.map((c) => c.id), multi, free);
    let results: PullResult[];
    if (online) {
      results = online.results;
      this.save.coins = online.coins;
      this.save.pity = online.pity;
      this.save.totalPulls = online.totalPulls;
      this.save.items = online.items;
      this.save.firstMulti = online.firstMulti;
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
      const first = this.isFirstMulti(bannerId) && multi;
      results = rollPulls(this.save, pool, cfg, this.content.items, count, Math.random, first);
      if (first) this.save.firstMulti = [...this.save.firstMulti, bannerId];
    }
    const now = Date.now();
    this.save.extra.log = [
      ...results.map((r) => ({ id: r.id, r: r.rarity, banner: bannerId, at: now })).reverse(),
      ...this.save.extra.log,
    ].slice(0, 300);
    this.passTrack('pull', count);
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
    this.passTrack('challenge', 1);
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
