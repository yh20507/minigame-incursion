import type { CharDef, GachaConfig, ItemDef, PullResult, SaveData } from './types';

/** 중복 1개를 더했을 때의 강화 처리. 반환: 레벨업 여부와 환급 코인 */
export function addDupe(save: SaveData, cfg: GachaConfig, ch: CharDef) {
  const o = save.owned[ch.id];
  const max = cfg.enhance.max;
  if (o.b >= max) {
    const refund = cfg.rarities.find((r) => r.id === ch.rarity)?.refund ?? 0;
    save.coins += refund;
    return { levelUp: false, refund };
  }
  o.d = (o.d ?? 0) + 1;
  const need = cfg.enhance.need[o.b] ?? 1;
  if (o.d >= need) {
    o.b += 1;
    o.d = 0;
    return { levelUp: true, refund: 0 };
  }
  return { levelUp: false, refund: 0 };
}

/** 가중치로 아이템 하나 고르기 */
export function rollItem(items: ItemDef[], rng: () => number) {
  const total = items.reduce((a, i) => a + i.weight, 0);
  let x = rng() * total;
  for (const it of items) {
    if (x < it.weight) return it;
    x -= it.weight;
  }
  return items[items.length - 1];
}

/**
 * 뽑기 판정 (로컬 모드). 온라인 모드에서는 같은 규칙을 Supabase 의 mi_pull() 이 처리한다.
 * - 한 번 뽑을 때 별1~5 캐릭터 또는 아이템이 나온다.
 * - 천장(전설 = ★4, 초레어 = ★5) 카운터는 모든 균열 공통이고, 아이템이 나와도 쌓인다.
 * - 10+1회는 마지막 칸에서 ★2 이상 캐릭터 1개 보장.
 * - 중복 캐릭터는 강화 재료가 되고, 최대 강화 뒤의 중복은 코인으로 환급.
 */
export function rollPulls(
  save: SaveData,
  pool: CharDef[],
  cfg: GachaConfig,
  items: ItemDef[],
  count: number,
  rng: () => number = Math.random,
): PullResult[] {
  const results: PullResult[] = [];
  const byRarity = (r: number) => pool.filter((c) => c.rarity === r);
  const multi = count > 1;
  let gotGuarantee = false;

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
      let x = rng() * 100;
      for (const r of [...cfg.rarities].sort((a, b) => b.id - a.id)) {
        if (x < r.rate) {
          rarity = r.id;
          break;
        }
        x -= r.rate;
      }
      if (multi && i === count - 1 && !gotGuarantee && rarity < cfg.multiGuarantee) rarity = cfg.multiGuarantee;
    }
    while (rarity > 0 && byRarity(rarity).length === 0) rarity--;
    if (rarity >= cfg.multiGuarantee) gotGuarantee = true;
    if (rarity === 5) save.pity.ultra = 0;
    if (rarity === 4) save.pity.legend = 0;
    save.totalPulls += 1;

    if (rarity === 0) {
      const it = rollItem(items, rng);
      if (it.effect === 'instant') save.coins += it.value;
      else save.items[it.id] = (save.items[it.id] ?? 0) + 1;
      results.push({ kind: 'item', id: it.id, rarity: 0, isNew: false, b: 0, d: 0, levelUp: false, refund: 0, pity: false });
      continue;
    }

    const cands = byRarity(rarity);
    const ch = cands[Math.floor(rng() * cands.length)];
    let isNew = false;
    let levelUp = false;
    let refund = 0;
    if (!save.owned[ch.id]) {
      save.owned[ch.id] = { b: 0, d: 0, at: Date.now() };
      isNew = true;
    } else {
      const r = addDupe(save, cfg, ch);
      levelUp = r.levelUp;
      refund = r.refund;
    }
    const o = save.owned[ch.id];
    results.push({ kind: 'char', id: ch.id, rarity, isNew, b: o.b, d: o.d ?? 0, levelUp, refund, pity });
  }
  return results;
}
