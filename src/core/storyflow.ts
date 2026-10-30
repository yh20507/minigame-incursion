/** 스토리 해금 규칙. 장면 id 가 story.json 에 있고 조건을 채웠고 아직 안 봤으면 '보여 줄 차례'. */
import { App } from './app';
import { exploreOpen } from './explore';

function has(id: string) {
  return !!App.content.story.scenes[id];
}
function seen(id: string) {
  return !!App.store.save.story[id];
}

/** 영역 d 의 동료(오리지널·특별) 중 보유 수 */
export function ownedInDomain(domainId: string) {
  return App.content.chars.filter((c) => c.origin !== 'world' && c.domain === domainId && App.store.owns(c.id)).length;
}

/** 영역 화면에 들어왔을 때 먼저 보여 줄 장면 */
export function pendingDomainStory(domainId: string): string | null {
  const st = App.store;
  const d = App.content.domain(domainId);
  if (!d) return null;
  const arrive = `${domainId}_arrive`;
  if (has(arrive) && !seen(arrive)) return arrive;
  if (d.final) return null;
  const recs = d.games.map((g) => st.save.scores[g]);
  const step = `${domainId}_step`;
  if (has(step) && !seen(step) && recs.some((r) => (r?.stars ?? 0) >= 1)) return step;
  const rift = `${domainId}_rift`;
  if (has(rift) && !seen(rift) && recs.filter((r) => (r?.stars ?? 0) >= 2).length >= 2) return rift;
  const inter = `${domainId}_inter`;
  if (has(inter) && !seen(inter) && ownedInDomain(domainId) >= 3) return inter;
  const after = `${domainId}_after`;
  if (has(after) && !seen(after) && st.save.cleared[domainId] && d.games.some((g) => (st.save.scores[g]?.hardBest ?? 0) >= st.hardStars(g)[2])) return after;
  return null;
}

/** 지도에 들어왔을 때 (2부 프롤로그) */
export function pendingMapStory(): string | null {
  if (has('part2_prologue') && !seen('part2_prologue') && exploreOpen()) return 'part2_prologue';
  return null;
}

/** 동료 개인 이야기: [1장 id, 2장 id] 중 볼 수 있는 것과 새 것 */
export function personalStories(charId: string) {
  const st = App.store;
  const o = st.save.owned[charId];
  const list: { id: string; n: number; open: boolean; isNew: boolean; need: string }[] = [];
  for (const n of [1, 2]) {
    const id = `p_${charId}_${n}`;
    if (!has(id)) continue;
    const open = !!o && (n === 1 || o.b >= 1);
    list.push({ id, n, open, isNew: open && !seen(id), need: n === 1 ? '동료 합류 시' : '+1 강화 시' });
  }
  return list;
}

/** 아직 안 읽은 개인 이야기 수 (도감 배지) */
export function unreadPersonal() {
  let n = 0;
  for (const c of App.content.chars) for (const s of personalStories(c.id)) if (s.isNew) n++;
  return n;
}

/** 영역의 다음 스토리 힌트 (영역 화면에 표시) */
export function nextStoryHint(domainId: string): string | null {
  const st = App.store;
  const d = App.content.domain(domainId);
  if (!d || d.final) return null;
  const recs = d.games.map((g) => st.save.scores[g]);
  const chk = (id: string) => has(id) && !seen(id);
  if (chk(`${domainId}_step`)) return '이야기 ② — 이 영역 미니게임에서 ★1 받기';
  if (chk(`${domainId}_rift`)) return `이야기 ③ — 미니게임 2개에서 ★2 이상 (지금 ${recs.filter((r) => (r?.stars ?? 0) >= 2).length}/2)`;
  if (chk(`${domainId}_inter`)) return `이야기 ④ — 이 영역 동료 3명 모으기 (지금 ${ownedInDomain(domainId)}/3)`;
  if (chk(`${domainId}_boss`)) return '이야기 ⑤ — 보스 도전';
  if (chk(`${domainId}_clear`)) return '이야기 ⑥ — 보스 해방';
  if (chk(`${domainId}_after`)) return st.save.cleared[domainId] ? '이야기 ⑦ — 어려움 모드에서 ★3 기준 넘기기' : '이야기 ⑦ — 해방 뒤, 어려움 모드 ★3';
  return null;
}

/** 영역 스토리 진행 (본 장면 수 / 전체) */
export function storyProgress(domainId: string) {
  const ids = ['arrive', 'step', 'rift', 'inter', 'boss', 'clear', 'after'].map((k) => `${domainId}_${k}`).filter(has);
  return { seen: ids.filter(seen).length, total: ids.length };
}

// ---------------- 기록 조각
export function recordsOf(domainId: string) {
  return App.content.records.filter((r) => r.domain === domainId);
}
export function hasRecord(id: string) {
  return App.store.save.extra.records.includes(id);
}
/** 미니게임 결과에서 기록 조각 드롭 시도. 얻은 기록을 돌려준다 */
export function rollRecord(domainId: string, hard: boolean, success: boolean) {
  const chance = (hard ? 0.5 : 0.25) * (success ? 1 : 0.5);
  if (Math.random() > chance) return null;
  const pool = recordsOf(domainId).filter((r) => !hasRecord(r.id));
  if (!pool.length) return null;
  const r = pool[Math.floor(Math.random() * pool.length)];
  App.store.save.extra.records.push(r.id);
  return r;
}
