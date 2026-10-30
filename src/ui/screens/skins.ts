/** 의상 균열: 스킨 뽑기 · 조각 교환 */
import { App } from '../../core/app';
import { audio } from '../../core/audio';
import type { SkinDef, SkinPull } from '../../core/types';
import { bgArt, skinArt, ui, type Screen } from '../app';
import { RC, bar, btn, itemIcon, topBar } from '../components';
import { fmt, h, svg } from '../dom';
import { I } from '../icons';
import { armSummaryKeys, runPull, sumChip, type PullCard } from '../pullfx';
import { showReveal } from '../reveal';

export const SKIN_COL = (g: string) => App.content.skins.grades[g as 'A']?.color ?? '#5fd3e0';

/** 스킨 카드 */
export function skinCard(sk: SkinDef, o: { onClick?: () => void; size?: 'sm' | 'md'; selected?: boolean; showOwner?: boolean } = {}) {
  const st = App.store;
  const ch = App.content.char(sk.char);
  const art = skinArt(sk.id, 'art');
  const owned = st.ownsSkin(sk.id);
  const ready = st.skinAvailable(sk);
  const equipped = st.equippedSkin(sk.char)?.id === sk.id;
  const col = SKIN_COL(sk.grade);
  return h(
    'div',
    {
      class: `skcard ${o.size ?? 'md'} g${sk.grade}` + (owned ? ' owned' : '') + (ready ? '' : ' notready') + (o.selected ? ' sel' : '') + (o.onClick ? ' clickable' : ''),
      vars: { c: col },
      onclick: o.onClick ? () => { audio.sfx('select'); o.onClick!(); } : undefined,
    },
    h('div', { class: 'skcard-art' }, art ? h('img', { src: art.url, class: art.pixel ? 'pixel' : '', alt: '' }) : h('div', { class: 'skcard-empty' }, svg(I.image), h('span', null, '준비 중'))),
    h('div', { class: 'ccard-shade' }),
    h('div', { class: 'skcard-top' }, h('span', { class: 'tag grade' }, sk.grade), st.skinPickup(sk) && !owned ? h('span', { class: 'tag hot' }, 'PICK UP') : null, equipped ? h('span', { class: 'tag good' }, '장착') : null),
    h('div', { class: 'ccard-name' }, h('b', null, sk.name), h('small', null, o.showOwner === false ? '' : ch.name)),
    !owned && ready ? h('div', { class: 'skcard-lock' }, svg(I.lock)) : null,
  );
}

export function skinGachaScreen(): Screen {
  const st = App.store;
  const cfg = App.content.skins.config;
  const sk = st.save.extra.skins;
  const pool = st.skinPool();
  const all = App.content.skins.skins;
  const col = '#b48cff';
  audio.bgm('gacha', 55, 'lydian', 100, ['gacha_skin', 'gacha']);
  let busy = false;
  const bgA = bgArt('rift');

  const owned = all.filter((s) => st.ownsSkin(s.id)).length;
  const pickups = pool.filter((s) => st.skinPickup(s));
  const showcase = [...pool].sort((a, b) => Number(st.skinPickup(b)) - Number(st.skinPickup(a)) || gradeRank(b.grade) - gradeRank(a.grade)).slice(0, 12);

  const hero = h(
    'section',
    { class: 'sk-hero panel enter', vars: { c: col } },
    h('div', { class: 'gb-hero-bg' + (bgA.pixel ? ' pixel' : ''), style: bgA.url ? { backgroundImage: `url(${bgA.url})` } : {} }),
    h(
      'div',
      { class: 'sk-hero-text' },
      h('div', { class: 'eyebrow' }, 'WARDROBE RIFT'),
      h('h2', null, '의상 균열'),
      h('p', { class: 'gb-desc' }, '동료들의 새 의상이 나오는 균열. 꽝은 없어요 — 스킨이 아니면 스킨 조각이 나오고, 조각을 모으면 원하는 스킨과 바꿀 수 있어요. 아직 없는 동료의 스킨도 나오며, 그 동료를 만나면 바로 입힐 수 있어요.'),
      h('div', { class: 'sk-rates' }, rateChip('S · SS', `${cfg.rates.S}%`, SKIN_COL('S')), rateChip('A', `${cfg.rates.A}%`, SKIN_COL('A')), rateChip('조각', `${100 - cfg.rates.S - cfg.rates.A}%`, '#b48cff'), h('span', { class: 'dim' }, `10+1회는 A 이상 1개 보장 · ${cfg.pity}회 안에 S 이상 확정`)),
      pickups.length ? h('div', { class: 'sk-pickup' }, h('span', { class: 'tag hot' }, 'PICK UP'), h('span', null, `열린 세계관 균열의 스킨 ${pickups.length}종은 확률 ${cfg.pickupMult}배 (${[...new Set(pickups.map((s) => App.content.domainName(App.content.char(s.char).domain)))].join(' · ')})`)) : null,
    ),
    h('div', { class: 'sk-showcase' }, showcase.map((s) => skinCard(s, { size: 'sm', onClick: () => detail(s) }))),
    h(
      'div',
      { class: 'gb-pity' },
      h('div', { class: 'pity-row', vars: { c: SKIN_COL('S') } }, h('div', { class: 'pity-label' }, h('span', null, 'S 이상 확정까지'), h('b', { class: 'num' }, `${Math.max(0, cfg.pity - sk.pity)}회`)), bar(sk.pity / cfg.pity, SKIN_COL('S'), 'thin')),
      h('div', { class: 'gb-pity-note' }, `보유 스킨 ${owned} / ${all.length} · 소환 ${fmt(sk.pulls)}회`, h('button', { class: 'link', onclick: () => exchangeModal() }, svg(I.swap), ' 조각 교환')),
    ),
  );

  const single = btn('1회 소환', () => doPull(false), { cls: 'big ghost pull-btn', sub: `${fmt(cfg.cost.single)} 코인`, icon: I.coin, disabled: st.coins < cfg.cost.single || !pool.length });
  const multi = btn(`${cfg.cost.multiCount - 1}+1회 소환`, () => doPull(true), { cls: 'big primary pull-btn', color: col, sub: `${fmt(cfg.cost.multi)} 코인 · A 이상 1개 보장`, icon: I.sparkle, disabled: st.coins < cfg.cost.multi || !pool.length });
  const bottom = h(
    'div',
    { class: 'gb-bottom enter' },
    h('div', { class: 'gb-bottom-left' }, btn('캐릭터 균열로', () => ui.show('Gacha'), { cls: 'sm ghost', icon: I.rift }), btn('보유 스킨', () => wardrobeModal(), { cls: 'sm ghost', icon: I.palette, sub: `${owned}개` })),
    h('div', { class: 'gb-bottom-right' }, h('div', { class: 'shard-pill big' }, itemIcon('shard'), h('b', { class: 'num' }, fmt(sk.shards)), h('small', null, '스킨 조각')), single, multi),
  );
  const el = h('div', { class: 'gacha skins' }, topBar('의상 균열', { back: () => ui.show('Gacha'), color: col, sub: '동료들의 새 의상 · 스킨 뽑기' }), h('div', { class: 'sk-body' }, hero), bottom);

  function rateChip(label: string, v: string, c: string) {
    return h('span', { class: 'rate-chip', vars: { c } }, h('b', null, label), h('i', { class: 'num' }, v));
  }
  function gradeRank(g: string) {
    return g === 'SS' ? 3 : g === 'S' ? 2 : 1;
  }

  // ---------------------------------------------------------------- 뽑기
  async function doPull(isMulti: boolean) {
    if (busy) return;
    busy = true;
    let res: SkinPull[];
    try {
      res = await st.pullSkins(isMulti);
    } catch (e: any) {
      busy = false;
      ui.toast(e?.message ?? '소환 실패', 'bad');
      return;
    }
    const topGrade = res.some((r) => r.grade === 'SS') ? 5 : res.some((r) => r.grade === 'S') ? 4 : res.some((r) => r.kind === 'skin') ? 3 : 2;
    const topCol = topGrade === 5 ? '#ff5fd2' : topGrade === 4 ? '#ffc845' : topGrade === 3 ? '#4aa3ff' : '#b48cff';
    audio.stopBgm();
    audio.bgm('gacha_open', 55, 'lydian', 110, ['gacha']);
    const cards: PullCard[] = res.map((r) => {
      if (r.kind === 'shard') {
        return {
          face: h('div', { class: 'cf item', vars: { c: '#b48cff' } }, h('div', { class: 'cf-item-ico' }, itemIcon('shard')), h('div', { class: 'cf-name' }, h('b', null, `스킨 조각 +${r.shards}`), h('small', { class: 'dim' }, '교환용'))),
          glow: 0,
        };
      }
      const sd = App.content.skin(r.id)!;
      const ch = App.content.char(sd.char);
      const art = skinArt(sd.id, 'art');
      const c = SKIN_COL(sd.grade);
      const face = h(
        'div',
        { class: 'cf', vars: { c } },
        h('div', { class: 'cf-art' }, art ? h('img', { src: art.url, class: art.pixel ? 'pixel' : '', alt: '' }) : null),
        h('div', { class: 'cf-shade' }),
        h('div', { class: 'cf-top' }, h('span', { class: 'tag grade', style: { background: c, borderColor: c, color: '#111' } }, sd.grade), r.isNew ? h('span', { class: 'tag hot' }, 'NEW') : null),
        h('div', { class: 'cf-name' }, h('b', null, sd.name), h('small', { class: r.isNew ? 'accent' : 'gold' }, r.isNew ? ch.name : `중복 · 조각 +${r.shards}`)),
      );
      const glow = sd.grade === 'SS' ? 5 : sd.grade === 'S' ? 4 : 3;
      return { face, glow, sfx: 'hero', onFlip: sd.grade !== 'A' ? () => showReveal(sd.char, { skin: sd, note: r.isNew ? '새 의상 획득' : `중복 · 스킨 조각 +${r.shards}`, tag: r.isNew ? 'NEW' : undefined, quick: true }) : undefined };
    });
    const { ov, done } = runPull({ host: el, packName: '의상 균열', color: col, topColor: topCol, top: topGrade, bgUrl: bgA.url, bgPixel: bgA.pixel, cards, countLabel: res.length > 1 ? `${res.length} OUTFITS` : '1 OUTFIT', ultraText: '한 정 의 상' });
    await done;
    const nNew = res.filter((r) => r.isNew).length;
    const nDup = res.filter((r) => r.kind === 'skin' && !r.isNew).length;
    const shards = res.reduce((a, r) => a + r.shards, 0);
    const again = isMulti ? cfg.cost.multi : cfg.cost.single;
    const close = () => {
      ov.classList.add('out');
      setTimeout(() => {
        busy = false;
        ui.show('SkinGacha', {}, { instant: true });
      }, 300);
    };
    ov.appendChild(
      h(
        'div',
        { class: 'gov-sum' },
        h('div', { class: 'gov-sum-chips' }, sumChip('NEW', nNew, 'hot'), sumChip('중복', nDup, 'gold'), sumChip('조각', shards, 'cyan')),
        h('div', { class: 'gov-sum-pity' }, h('span', null, '보유 조각 ', h('b', { class: 'num' }, fmt(st.save.extra.skins.shards))), h('span', null, 'S 확정까지 ', h('b', { class: 'num' }, `${Math.max(0, cfg.pity - st.save.extra.skins.pity)}`))),
        h('div', { class: 'gov-sum-btns' }, btn(isMulti ? '한 번 더 10+1' : '한 번 더', () => { ov.remove(); busy = false; doPull(isMulti); }, { cls: 'ghost', icon: I.palette, sub: `${fmt(again)} 코인`, disabled: st.coins < again }), btn('확인', close, { cls: 'primary', sub: 'SPACE' })),
      ),
    );
    armSummaryKeys(close);
  }

  // ---------------------------------------------------------------- 상세 · 교환 · 보유
  function detail(s: SkinDef) {
    const ch = App.content.char(s.char);
    const owned = st.ownsSkin(s.id);
    const need = cfg.exchange[s.grade];
    const art = skinArt(s.id, 'full') ?? skinArt(s.id, 'art');
    const close = ui.modal({
      cls: 'skin-modal',
      wide: true,
      body: h(
        'div',
        { class: 'skin-detail' },
        h('div', { class: 'skin-detail-art', vars: { c: SKIN_COL(s.grade) } }, art ? h('img', { src: art.url, class: art.pixel ? 'pixel' : '', alt: '' }) : h('div', { class: 'skcard-empty' }, svg(I.image), h('span', null, '준비 중'))),
        h(
          'div',
          { class: 'skin-detail-text' },
          h('div', { class: 'eyebrow', style: { color: SKIN_COL(s.grade) } }, `${s.grade} · ${App.content.skins.grades[s.grade].name}${s.season ? ' · 시즌 한정' : ''}`),
          h('h2', null, s.name),
          h('p', { class: 'dim' }, `${ch.name} · ${ch.title}`),
          h('p', { class: 'skin-desc' }, s.desc),
          h('div', { class: 'skin-detail-btns' },
            owned
              ? st.owns(s.char)
                ? st.equippedSkin(s.char)?.id === s.id
                  ? btn('기본 의상으로', async () => { await st.equipSkin(s.char, null); close(); ui.show('SkinGacha', {}, { instant: true }); }, { cls: 'ghost' })
                  : btn('입히기', async () => { await st.equipSkin(s.char, s.id); ui.toast(`${ch.name}에게 「${s.name}」을 입혔어요`, 'good'); close(); ui.show('SkinGacha', {}, { instant: true }); }, { cls: 'primary', icon: I.check })
                : h('span', { class: 'tag dimmed' }, `${ch.name}을(를) 만나면 입힐 수 있어요`)
              : st.skinAvailable(s)
                ? btn(`조각 ${need}개로 교환`, async () => { try { await st.exchangeSkin(s.id); audio.sfx('legend'); close(); await showReveal(s.char, { skin: s, note: '조각 교환', tag: 'NEW' }); ui.show('SkinGacha', {}, { instant: true }); } catch (e: any) { ui.toast(e?.message ?? '실패', 'bad'); } }, { cls: 'primary', icon: I.swap, disabled: sk.shards < need, sub: `보유 ${fmt(sk.shards)}개` })
                : h('span', { class: 'tag dimmed' }, '그림을 넣으면 열려요'),
          ),
        ),
      ),
      buttons: [],
    });
  }

  function exchangeModal() {
    const list = all.filter((s) => !st.ownsSkin(s.id) && st.skinAvailable(s)).sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade));
    ui.modal({
      title: `조각 교환 · 보유 ${fmt(sk.shards)}개`,
      wide: true,
      body: list.length
        ? h('div', { class: 'skin-grid' }, list.map((s) => h('div', { class: 'skin-ex' }, skinCard(s, { size: 'sm', onClick: () => detail(s) }), h('div', { class: 'skin-ex-cost' + (sk.shards >= cfg.exchange[s.grade] ? ' ok' : '') }, itemIcon('shard'), h('b', { class: 'num' }, String(cfg.exchange[s.grade]))))))
        : h('p', { class: 'dim' }, '교환할 수 있는 스킨이 없어요'),
    });
  }

  function wardrobeModal() {
    const list = all.filter((s) => st.ownsSkin(s.id));
    ui.modal({
      title: `보유 스킨 ${list.length}개`,
      wide: true,
      body: list.length ? h('div', { class: 'skin-grid' }, list.map((s) => skinCard(s, { size: 'sm', onClick: () => detail(s) }))) : h('p', { class: 'dim' }, '아직 스킨이 없어요. 의상 균열에서 뽑거나 조각으로 교환하세요.'),
    });
  }

  return { el, bg: 'rift', back: () => !busy && ui.show('Gacha') };
}

export const _rc = RC;
