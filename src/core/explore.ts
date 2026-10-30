import { App } from './app';
import type { RunResult } from '../scenes/Play';
import type { FrontierDef } from './types';

/** 새 대륙 탐사가 열렸는지 (최종장 이후) */
export function exploreOpen() {
  const f = App.content.frontier;
  return !!f && f.list.length > 0 && !!App.store.save.cleared[f.list[0].unlockAfter];
}

export function landedIds() {
  return App.store.save.extra.explore.landed;
}
export function isLanded(id: string) {
  return landedIds().includes(id);
}

/** 지금 좌표를 모으는 대륙. 전부 상륙했으면 마지막 대륙 */
export function currentFrontier(): FrontierDef {
  const list = App.content.frontier.list;
  return list.find((f) => !isLanded(f.id)) ?? list[list.length - 1];
}
/** 현재 대륙 탐사가 열렸나 (이전 대륙 해방) */
export function frontierOpen(f = currentFrontier()) {
  return !!App.store.save.cleared[f.unlockAfter];
}

export function exploreProgress(f = currentFrontier()) {
  const e = App.store.save.extra.explore;
  return Math.min(1, e.shards / f.need);
}

/** 현재 목표 대륙에 상륙했나 */
export function landed(f = currentFrontier()) {
  return isLanded(f.id);
}

/** 상륙 처리: 조각을 소모하고 기록 */
export function markLanded(f: FrontierDef) {
  const e = App.store.save.extra.explore;
  if (!e.landed.includes(f.id)) e.landed.push(f.id);
  e.shards = Math.max(0, e.shards - f.need);
}

/** 게임 결과로 얻는 좌표 조각 수 */
export function shardsFor(r: RunResult, stars = 0) {
  if (!exploreOpen()) return 0;
  const cur = currentFrontier();
  if (landed(cur) || !frontierOpen(cur)) return 0;
  const s = App.content.frontier.shards;
  switch (r.mode) {
    case 'normal':
      return stars * s.normalPerStar + (r.success ? s.normalClear : 0);
    case 'boss':
    case 'final':
      return r.success ? s.boss : 1;
    case 'daily':
      return r.success ? s.daily : 0;
    case 'micro':
      return Math.floor(r.microCleared / s.microPer);
    case 'marathon':
      return r.segments.filter((x) => x.passed).length * s.marathonPerSeg;
  }
  return 0;
}

export async function addShards(n: number) {
  if (n <= 0) return;
  App.store.save.extra.explore.shards += n;
  await App.store.saveMeta();
}

/** 원정 보상 계산 */
export function expeditionReward(members: string[], hours: number) {
  const ex = App.content.frontier.expedition;
  const rsum = members.reduce((a, id) => a + (App.content.hasChar(id) ? App.content.char(id).rarity : 1), 0);
  const mult = 1 + rsum / 10;
  return {
    shards: Math.round(hours * ex.shardsPerHour * mult),
    coins: Math.round(hours * ex.coinsPerHour * mult),
    items: Math.floor(hours / ex.itemEvery),
  };
}
