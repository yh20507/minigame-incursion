import type { CharDef, GachaConfig, PullResult, SaveData } from './types';

/**
 * 뽑기 판정. 로컬 모드에서 사용하며, 온라인 모드에서는 같은 규칙을 Supabase 의 pull() 함수가 처리한다.
 * - 천장 카운터는 모든 배너 공통.
 * - 전설이 나오면 전설 카운터만, 초레어가 나오면 초레어 카운터만 0으로.
 * - 10연차는 희귀 이상 1개 보장.
 */
export function rollPulls(
  save: SaveData,
  pool: CharDef[],
  cfg: GachaConfig,
  pickupDomain: string | null,
  count: number,
  rng: () => number = Math.random,
): PullResult[] {
  const results: PullResult[] = [];
  const byRarity = (r: number) => pool.filter((c) => c.rarity === r);
  const total = cfg.rarities.reduce((a, r) => a + r.rate, 0);

  let gotRarePlus = false;
  for (let i = 0; i < count; i++) {
    save.pity.legend += 1;
    save.pity.ultra += 1;
    let rarity = 0;
    let pity = false;

    if (save.pity.ultra >= cfg.pity.ultra && byRarity(5).length) {
      rarity = 5;
      pity = true;
    } else if (save.pity.legend >= cfg.pity.legend && byRarity(4).length) {
      rarity = 4;
      pity = true;
    } else {
      let x = rng() * total;
      for (const r of [...cfg.rarities].sort((a, b) => b.id - a.id)) {
        if (x < r.rate) {
          rarity = r.id;
          break;
        }
        x -= r.rate;
      }
      if (!rarity) rarity = 1;
      if (count >= 10 && i === count - 1 && !gotRarePlus && rarity < cfg.tenPullGuarantee) {
        rarity = cfg.tenPullGuarantee;
      }
    }
    // 풀에 해당 등급이 없으면 한 단계씩 내린다
    while (rarity > 1 && byRarity(rarity).length === 0) rarity--;
    if (rarity >= cfg.tenPullGuarantee) gotRarePlus = true;
    if (rarity === 5) save.pity.ultra = 0;
    if (rarity === 4) save.pity.legend = 0;

    let candidates = byRarity(rarity);
    if (pickupDomain) {
      const picked = candidates.filter((c) => c.domain === pickupDomain);
      if (picked.length && (pity || rng() < cfg.pickupChance)) candidates = picked;
    }
    const ch = candidates[Math.floor(rng() * candidates.length)];
    const owned = save.owned[ch.id];
    let isNew = false;
    let b = 0;
    let refund = 0;
    if (!owned) {
      save.owned[ch.id] = { b: 0, at: Date.now() };
      isNew = true;
    } else if (owned.b < cfg.maxBreakthrough) {
      owned.b += 1;
      b = owned.b;
    } else {
      b = owned.b;
      refund = cfg.rarities.find((r) => r.id === rarity)!.refund;
      save.coins += refund;
    }
    save.totalPulls += 1;
    results.push({ id: ch.id, rarity, isNew, b, refund, pity });
  }
  return results;
}
