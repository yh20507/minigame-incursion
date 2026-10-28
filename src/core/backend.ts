import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import type { PullResult, SaveData } from './types';

export type SaveEvent =
  | { t: 'result'; game: string; score: number; stars: number; coins: number }
  | { t: 'coins'; n: number }
  | { t: 'grant'; id: string }
  | { t: 'items'; used: string[] }
  | { t: 'additems'; items: Record<string, number> }
  | { t: 'shard'; char: string }
  | { t: 'meta' };

export interface PullResponse {
  results: PullResult[];
  coins: number;
  pity: { legend: number; ultra: number };
  totalPulls: number;
  items: Record<string, number>;
  firstMulti: string[];
}

export interface Backend {
  mode: 'local' | 'online';
  label(): string;
  load(def: SaveData): Promise<SaveData>;
  commit(save: SaveData, ev: SaveEvent): Promise<void>;
  /** 온라인 모드 전용. 로컬 모드는 null 을 돌려주고 Store 가 직접 판정한다. */
  pull(bannerId: string, poolIds: string[], multi: boolean): Promise<PullResponse | null>;
  logout(): Promise<void>;
}

const LOCAL_KEY = 'mi_save_v1';

export class LocalBackend implements Backend {
  mode = 'local' as const;
  label() {
    return '오프라인 저장 (이 PC)';
  }
  async load(def: SaveData) {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return mergeSave(def, JSON.parse(raw));
    } catch (e) {
      console.warn('save load failed', e);
    }
    return def;
  }
  async commit(save: SaveData) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(save));
    } catch (e) {
      console.warn('save failed', e);
    }
  }
  async pull() {
    return null;
  }
  async logout() {}
}

/** 기본값에 저장본을 덮어써서, 데이터 구조가 늘어나도 예전 저장이 깨지지 않게 한다. */
export function mergeSave(def: SaveData, raw: Partial<SaveData>): SaveData {
  const s = structuredClone(def);
  Object.assign(s, raw);
  s.pity = { ...def.pity, ...(raw.pity ?? {}) };
  s.team = { ...def.team, ...(raw.team ?? {}) };
  s.extra = {
    ...def.extra,
    ...(raw.extra ?? {}),
    daily: { ...def.extra.daily, ...(raw.extra?.daily ?? {}) },
    settings: { ...def.extra.settings, ...(raw.extra?.settings ?? {}) },
    lobby: { ...def.extra.lobby, ...(raw.extra?.lobby ?? {}) },
    explore: { ...def.extra.explore, ...(raw.extra?.explore ?? {}) },
  };
  s.extra.log = raw.extra?.log ?? [];
  s.owned = { ...def.owned, ...(raw.owned ?? {}) };
  s.items = { ...(raw.items ?? {}) };
  s.firstMulti = Array.isArray(raw.firstMulti) ? [...raw.firstMulti] : [];
  return s;
}

export interface OnlineConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/**
 * Supabase 백엔드. 모든 쓰기는 데이터베이스 함수(RPC)로 하고,
 * 실패한 쓰기는 PC에 대기열로 남겨 다음 접속 때 다시 보낸다.
 */
export class SupabaseBackend implements Backend {
  mode = 'online' as const;
  sb: SupabaseClient;
  session: Session | null = null;

  constructor(cfg: OnlineConfig) {
    this.sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mi_auth' },
    });
  }

  label() {
    return this.session?.user.email ? `온라인 (${this.session.user.email})` : '온라인';
  }

  async restoreSession() {
    const { data } = await this.sb.auth.getSession();
    this.session = data.session;
    return !!this.session;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.session = data.session;
  }

  async signUp(email: string, password: string) {
    const { data, error } = await this.sb.auth.signUp({ email, password });
    if (error) throw error;
    this.session = data.session;
    return !!data.session;
  }

  async logout() {
    await this.sb.auth.signOut();
    this.session = null;
  }

  private get queueKey() {
    return 'mi_queue_' + (this.session?.user.id ?? 'anon');
  }
  private get cacheKey() {
    return 'mi_cache_' + (this.session?.user.id ?? 'anon');
  }
  private readQueue(): SaveEvent[] {
    try {
      return JSON.parse(localStorage.getItem(this.queueKey) ?? '[]');
    } catch {
      return [];
    }
  }
  private writeQueue(q: SaveEvent[]) {
    localStorage.setItem(this.queueKey, JSON.stringify(q));
  }

  async load(def: SaveData): Promise<SaveData> {
    try {
      await this.flush();
      const { data: prof, error } = await this.sb.rpc('mi_ensure_profile', { p_start_coins: def.coins });
      if (error) throw error;
      const uid = this.session!.user.id;
      const [scores, owned] = await Promise.all([
        this.sb.from('mi_scores').select('*').eq('user_id', uid),
        this.sb.from('mi_owned_characters').select('*').eq('user_id', uid),
      ]);
      if (scores.error) throw scores.error;
      if (owned.error) throw owned.error;
      const s = mergeSave(def, {
        coins: prof.coins,
        pity: { legend: prof.pity_legend, ultra: prof.pity_ultra },
        totalPulls: prof.total_pulls,
        firstMulti: prof.first_multi ?? [],
        team: prof.team ?? def.team,
        story: prof.story ?? {},
        cleared: prof.cleared ?? {},
        extra: prof.extra ?? def.extra,
        items: prof.items ?? {},
      });
      s.scores = {};
      for (const r of scores.data ?? []) s.scores[r.game_id] = { best: r.best_score, stars: r.stars, plays: r.plays };
      s.owned = {};
      for (const r of owned.data ?? [])
        s.owned[r.character_id] = { b: r.level, d: r.dupes, at: new Date(r.obtained_at).getTime() };
      if (!s.owned['teumsae']) {
        s.owned['teumsae'] = { b: 0, d: 0, at: Date.now() };
        await this.sb.rpc('mi_grant_character', { p_char: 'teumsae' });
      }
      localStorage.setItem(this.cacheKey, JSON.stringify(s));
      return s;
    } catch (e) {
      console.warn('online load failed, using cache', e);
      const raw = localStorage.getItem(this.cacheKey);
      if (raw) return mergeSave(def, JSON.parse(raw));
      throw e;
    }
  }

  private async send(ev: SaveEvent, save: SaveData) {
    let r;
    switch (ev.t) {
      case 'result':
        r = await this.sb.rpc('mi_submit_result', {
          p_game: ev.game,
          p_score: ev.score,
          p_stars: ev.stars,
          p_coins: ev.coins,
        });
        break;
      case 'coins':
        r = await this.sb.rpc('mi_add_coins', { p_amount: ev.n });
        break;
      case 'grant':
        r = await this.sb.rpc('mi_grant_character', { p_char: ev.id });
        break;
      case 'items':
        r = await this.sb.rpc('mi_use_items', { p_items: ev.used });
        break;
      case 'additems':
        r = await this.sb.rpc('mi_add_items', { p_items: ev.items });
        break;
      case 'shard':
        r = await this.sb.rpc('mi_use_shard', { p_char: ev.char });
        break;
      case 'meta':
        r = await this.sb.rpc('mi_save_meta', {
          p_team: save.team,
          p_story: save.story,
          p_cleared: save.cleared,
          p_extra: save.extra,
        });
        break;
    }
    if (r?.error) throw r.error;
  }

  private async flush() {
    const q = this.readQueue();
    if (!q.length) return;
    const rest: SaveEvent[] = [];
    for (const ev of q) {
      if (ev.t === 'meta') continue; // 최신 메타는 아래 load 후 다시 저장된다
      try {
        await this.send(ev, null as unknown as SaveData);
      } catch {
        rest.push(ev);
      }
    }
    this.writeQueue(rest);
  }

  async commit(save: SaveData, ev: SaveEvent) {
    localStorage.setItem(this.cacheKey, JSON.stringify(save));
    try {
      await this.send(ev, save);
    } catch (e) {
      console.warn('sync failed, queued', e);
      if (ev.t !== 'meta') {
        const q = this.readQueue();
        q.push(ev);
        this.writeQueue(q);
      }
    }
  }

  async pull(bannerId: string, poolIds: string[], multi: boolean): Promise<PullResponse> {
    const { data, error } = await this.sb.rpc('mi_pull', { p_banner: bannerId, p_pool: poolIds, p_multi: multi });
    if (error) throw error;
    return {
      results: data.results,
      coins: data.coins,
      pity: { legend: data.pity_legend, ultra: data.pity_ultra },
      totalPulls: data.total_pulls,
      items: data.items ?? {},
      firstMulti: data.first_multi ?? [],
    };
  }
}

export async function loadOnlineConfig(): Promise<OnlineConfig | null> {
  try {
    const cfg = await new Promise<OnlineConfig>((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('GET', 'config.json');
      x.onload = () => {
        try {
          resolve(JSON.parse(x.responseText));
        } catch (e) {
          reject(e);
        }
      };
      x.onerror = reject;
      x.send();
    });
    if (cfg.supabaseUrl && cfg.supabaseAnonKey) return cfg;
  } catch {
    /* 설정 파일이 없으면 오프라인 모드 */
  }
  return null;
}
