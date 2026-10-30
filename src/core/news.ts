import { App } from './app';
import { todayKey } from './rng';
import type { Season } from './types';

/** 지금 진행 중인 시즌 (가장 최근에 시작한 것) */
export function currentSeason(): Season | null {
  const today = todayKey();
  const live = App.content.updates.filter((s) => s.start <= today && (!s.end || s.end >= today));
  return live.sort((a, b) => b.start.localeCompare(a.start))[0] ?? null;
}

export function unseenNews() {
  const s = currentSeason();
  return !!s && !App.store.save.extra.seenNews.includes(s.id);
}

export function markNewsSeen() {
  const s = currentSeason();
  if (s && !App.store.save.extra.seenNews.includes(s.id)) {
    App.store.save.extra.seenNews.push(s.id);
    App.store.saveMeta();
  }
}
