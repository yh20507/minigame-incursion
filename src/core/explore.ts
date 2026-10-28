import { App } from './app';
import type { RunResult } from '../scenes/Play';

/** 새 대륙 탐사가 열렸는지 (최종장 이후) */
export function exploreOpen() {
  const f = App.content.frontier;
  return !!f && !!App.store.save.cleared[f.unlockAfter];
}

export function exploreProgress() {
  const f = App.content.frontier;
  const e = App.store.save.extra.explore;
  return Math.min(1, e.shards / f.need);
}

export function landed() {
  return App.store.save.extra.explore.landed.includes(App.content.frontier.id);
}

/** 게임 결과로 얻는 좌표 조각 수 */
export function shardsFor(r: RunResult, stars = 0) {
  if (!exploreOpen() || landed()) return 0;
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
