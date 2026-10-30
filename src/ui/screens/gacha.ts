/** 차원 균열: 배너 고르기 → 카드팩 찢기 → 카드 뒤집기 → ★4·★5 등장 */
import { App } from '../../core/app';
import { audio } from '../../core/audio';
import type { BannerDef, PullResult } from '../../core/types';
import { bestArt, bgArt, ui, type Screen } from '../app';
import { RC, bar, btn, charCard, charImg, dupText, iconBtn, itemIcon, rarityName, rarityStars, topBar } from '../components';
import { fmt, h, svg, wait } from '../dom';
import { fx } from '../fx';
import { I } from '../icons';
import { showReveal } from '../reveal';
import { armSummaryKeys, runPull, sumChip, type PullCard } from '../pullfx';

const RAR_COL = (r: number) => (r <= 0 ? '#5fd3e0' : RC[r]);

export function gachaScreen(data: { banner?: string }): Screen {
  const st = App.store;
  const cfg = App.content.gacha;
  const banners = st.availableBanners();
  const banner = banners.find((b) => b.id === data?.banner) ?? banners[0];
  const color = (b: BannerDef) => (b.type === 'world' && b.world ? App.content.domainColor(b.world) : '#b48cff');
  const col = color(banner);
  const period = st.bannerPeriod(banner);
  const bf = ['gacha_' + banner.id, ...(banner.world ? ['gacha_' + banner.world] : []), 'gacha'];
  audio.bgm('gacha', 55, 'lydian', 100, bf);
  let busy = false;

  // ---------- 왼쪽: 배너 목록
  const skinEntry = h(
    'button',
    { class: 'gb-item skin-entry', vars: { c: '#b48cff' }, onclick: () => { if (busy) return; audio.sfx('select'); ui.show('SkinGacha'); } },
    h('div', { class: 'gb-art skin-ico' }, svg(I.palette)),
    h('div', { class: 'gb-text' }, h('div', { class: 'gb-tags' }, h('span', { class: 'tag' }, '스킨'), st.skinPool().some((s) => st.skinPickup(s)) ? h('span', { class: 'tag hot' }, 'PICK UP') : null), h('b', null, '의상 균열'), h('small', null, `보유 스킨 ${st.save.extra.skins.owned.length} · 조각 ${st.save.extra.skins.shards}`)),
  );
  const list = h(
    'div',
    { class: 'gb-list enter-left' },
    banners.map((b) => {
      const pr = st.bannerPeriod(b);
      const c = color(b);
      const feat = st.gachaPool(b.id).filter((x) => x.rarity === 5)[0];
      return h(
        'button',
        {
          class: 'gb-item' + (b.id === banner.id ? ' on' : ''),
          vars: { c },
          onclick: () => {
            if (b.id === banner.id || busy) return;
            audio.sfx('select');
            ui.show('Gacha', { banner: b.id }, { instant: true });
          },
        },
        h('div', { class: 'gb-art' }, feat ? charImg(feat.id, 'portrait') : null),
        h(
          'div',
          { class: 'gb-text' },
          h('div', { class: 'gb-tags' }, h('span', { class: 'tag ' + (b.type === 'standard' ? 'dimmed' : pr?.rerun ? 'good' : 'hot') }, b.type === 'standard' ? '상시' : pr?.rerun ? '복각' : '한정'), st.isFirstMulti(b.id) ? h('span', { class: 'tag gold' }, '첫 확정') : null, b.type === 'standard' && st.freePullLeft() ? h('span', { class: 'tag free' }, '무료 1회') : null),
          h('b', null, b.name),
          h('small', null, pr?.end ? `~ ${pr.end}` : '기간 제한 없음'),
        ),
      );
    }),
    skinEntry,
  );

  // ---------- 가운데: 선택한 배너
  const pool = st.gachaPool(banner.id);
  const feat = [...pool].sort((a, b) => b.rarity - a.rarity).slice(0, 3);
  const top5 = feat.find((c) => c.rarity === 5);
  const bgKey = banner.world ?? 'rift';
  const bgA = bgArt(bgKey);
  const bgUrl = bgA.url;
  const toL = Math.max(0, cfg.pity.legend - st.save.pity.legend);
  const toU = Math.max(0, cfg.pity.ultra - st.save.pity.ultra);
  const first = st.isFirstMulti(banner.id);
  const fg = Math.max(cfg.multiGuarantee, cfg.firstMultiGuarantee ?? 4);

  const hero = h(
    'section',
    { class: 'gb-hero panel enter', vars: { c: col } },
    h('div', { class: 'gb-hero-bg' + (bgA.pixel ? ' pixel' : ''), style: bgUrl ? { backgroundImage: `url(${bgUrl})` } : {} }),
    h('div', { class: 'gb-hero-rays' }, fx.rays(col)),
    top5 ? h('div', { class: 'gb-hero-art ' + (bestArt(top5.id).kind === 'spr' ? 'is-sprite' : 'is-art') }, charImg(top5.id, 'best', { class: 'breathe' })) : null,
    h(
      'div',
      { class: 'gb-hero-text' },
      h('div', { class: 'eyebrow' }, banner.type === 'standard' ? 'STANDARD RIFT' : period?.rerun ? 'RERUN · LIMITED' : 'LIMITED RIFT'),
      h('h2', null, banner.name),
      h('p', { class: 'gb-period' }, svg(I.calendar), ' ', period?.end ? `${period.start ?? ''} ~ ${period.end}` : '상시 개방'),
      h('p', { class: 'gb-desc' }, banner.desc),
      h(
        'div',
        { class: 'gb-feat' },
        h('div', { class: 'eyebrow' }, 'FEATURED'),
        h('div', { class: 'gb-feat-row' }, feat.map((c) => charCard(c.id, { size: 'sm', owned: true, dim: !st.owns(c.id), sub: st.owns(c.id) ? '보유' : undefined }))),
      ),
    ),
    h(
      'div',
      { class: 'gb-pity' },
      pityRow('★4 확정까지', toL, cfg.pity.legend, RC[4]),
      pityRow('★5 확정까지', toU, cfg.pity.ultra, RC[5]),
      h('div', { class: 'gb-pity-note' }, `천장은 모든 균열 공통 · 총 ${fmt(st.save.totalPulls)}회 소환`, h('button', { class: 'link', onclick: () => ratesModal() }, svg(I.info), ' 상세 확률')),
    ),
  );

  function pityRow(label: string, left: number, max: number, c: string) {
    return h('div', { class: 'pity-row', vars: { c } }, h('div', { class: 'pity-label' }, h('span', null, label), h('b', { class: 'num' }, `${left}회`)), bar(1 - left / max, c, 'thin'));
  }

  // ---------- 아래: 소환 버튼
  const freeNow = banner.type === 'standard' && st.freePullLeft();
  const single = freeNow
    ? btn('무료 소환', () => doPull(false, true), { cls: 'big primary pull-btn free pulse', sub: '오늘의 무료 1회 · 매일 0시 충전', icon: I.gift, color: '#4be37a', disabled: !pool.length })
    : btn('1회 소환', () => doPull(false), { cls: 'big ghost pull-btn', sub: `${fmt(cfg.cost.single)} 코인`, icon: I.coin, disabled: st.coins < cfg.cost.single || !pool.length });
  const multi = btn(`${cfg.cost.multiCount - 1}+1회 소환`, () => doPull(true), {
    cls: 'big primary pull-btn' + (first ? ' gold pulse' : ''),
    sub: first ? `${fmt(cfg.cost.multi)} 코인 · ★${fg} 이상 확정!` : `${fmt(cfg.cost.multi)} 코인 · ★${cfg.multiGuarantee} 이상 1개 보장`,
    icon: I.sparkle,
    disabled: st.coins < cfg.cost.multi || !pool.length,
  });
  const pr = period;
  const eventBtn =
    pr?.event && App.content.story.scenes[pr.event]
      ? (() => {
          const ev = pr.event!;
          const seen = !!st.save.story[ev];
          const got = st.save.extra.eventRewards.includes(ev);
          if (seen && !got) st.claimEventReward(ev, 1000).then((ok) => ok && ui.toast('이벤트 스토리 보상 · 코인 +1,000', 'gold'));
          return btn('이벤트 스토리', () => ui.show('Story', { id: ev, next: 'Gacha', nextData: { banner: banner.id } }), { cls: 'sm' + (seen ? ' ghost' : ' pulse'), color: '#7dffb0', icon: I.book, sub: got || seen ? '다시 보기' : '처음 보면 1,000 코인' });
        })()
      : null;
  const bottom = h(
    'div',
    { class: 'gb-bottom enter' },
    h('div', { class: 'gb-bottom-left' }, btn('기록', () => historyModal(), { cls: 'sm ghost', icon: I.history }), btn('가방', () => ui.show('Bag', { back: 'Gacha' }), { cls: 'sm ghost', icon: I.bag }), eventBtn),
    h('div', { class: 'gb-bottom-right' }, first ? h('div', { class: 'first-tag float' }, svg(I.sparkle), ` 이 균열 첫 ${cfg.cost.multiCount - 1}+1 · ★${fg} 이상 확정`) : null, single, multi),
  );

  const el = h('div', { class: 'gacha' }, topBar('차원 균열', { back: () => ui.show('Lobby'), color: col, sub: '조각세계 곳곳에 열린 균열에서 동료를 부른다' }), h('div', { class: 'gacha-body' }, list, hero), bottom);

  // ---------------------------------------------------------------- 소환
  async function doPull(isMulti: boolean, free = false) {
    if (busy) return;
    busy = true;
    let res: PullResult[];
    try {
      res = await st.pull(banner.id, isMulti, free);
    } catch (e: any) {
      busy = false;
      ui.toast(e?.message ?? '소환 실패', 'bad');
      return;
    }
    await animate(res);
  }

  async function animate(res: PullResult[]) {
    const top = Math.max(0, ...res.map((r) => r.rarity));
    const topCol = top >= 5 ? '#ff5fd2' : RAR_COL(top);
    audio.stopBgm();
    audio.bgm('gacha_open', 55, 'lydian', 110, ['gacha']);
    const cards: PullCard[] = res.map((r) => {
      const c = r.kind === 'char' ? App.content.char(r.id) : null;
      const rc = RAR_COL(r.rarity);
      const face = c
        ? h(
            'div',
            { class: 'cf', vars: { c: rc } },
            h('div', { class: 'cf-art' }, charImg(c.id, 'portrait')),
            h('div', { class: 'cf-shade' }),
            h('div', { class: 'cf-top' }, rarityStars(c.rarity), r.isNew ? h('span', { class: 'tag hot' }, 'NEW') : null),
            h('div', { class: 'cf-name' }, h('b', null, c.name), h('small', { class: r.isNew ? 'accent' : 'gold' }, dupText(r, true))),
          )
        : h(
            'div',
            { class: 'cf item', vars: { c: rc } },
            h('div', { class: 'cf-item-ico' }, itemIcon(r.id)),
            h('div', { class: 'cf-name' }, h('b', null, App.content.item(r.id)?.name ?? r.id), h('small', { class: 'dim' }, App.content.item(r.id)?.effect === 'instant' ? `+${App.content.item(r.id)!.value} 코인` : '아이템')),
          );
      return {
        face,
        glow: r.kind === 'char' ? r.rarity : 0,
        sfx: r.rarity === 3 ? 'hero' : undefined,
        onFlip: r.kind === 'char' && r.rarity >= 4 ? () => showReveal(r.id, { note: dupText(r), tag: r.isNew ? 'NEW' : undefined, quick: true }) : undefined,
      };
    });
    const { ov, done } = runPull({ host: el, packName: banner.name, color: col, topColor: topCol, top, bgUrl, bgPixel: bgA.pixel, cards, countLabel: res.length > 1 ? `${res.length} CARDS` : '1 CARD' });
    await done;

    const nNew = res.filter((r) => r.isNew).length;
    const nUp = res.filter((r) => r.levelUp).length;
    const nItem = res.filter((r) => r.kind === 'item').length;
    const toU = Math.max(0, cfg.pity.ultra - st.save.pity.ultra);
    const toL = Math.max(0, cfg.pity.legend - st.save.pity.legend);
    const isMulti = res.length > 1;
    const again = isMulti ? cfg.cost.multi : cfg.cost.single;
    const close = () => {
      ov.classList.add('out');
      setTimeout(() => {
        busy = false;
        ui.show('Gacha', { banner: banner.id }, { instant: true });
      }, 300);
    };
    ov.appendChild(
      h(
        'div',
        { class: 'gov-sum' },
        h('div', { class: 'gov-sum-chips' }, sumChip('NEW', nNew, 'hot'), sumChip('강화', nUp, 'gold'), sumChip('아이템', nItem, 'cyan')),
        h('div', { class: 'gov-sum-pity' }, h('span', null, '★4 확정까지 ', h('b', { class: 'num' }, `${toL}`)), h('span', null, '★5 확정까지 ', h('b', { class: 'num' }, `${toU}`))),
        h(
          'div',
          { class: 'gov-sum-btns' },
          btn(isMulti ? '한 번 더 10+1' : '한 번 더', () => {
            ov.remove();
            busy = false;
            doPull(isMulti);
          }, { cls: 'ghost', icon: I.rift, sub: `${fmt(again)} 코인`, disabled: st.coins < again }),
          btn('확인', close, { cls: 'primary', sub: 'SPACE' }),
        ),
      ),
    );
    armSummaryKeys(close);
  }

  // ---------------------------------------------------------------- 모달
  function ratesModal() {
    const rows = [...cfg.rarities].reverse().map((r) => {
      const n = pool.filter((c) => c.rarity === r.id).length;
      return h('tr', { vars: { c: r.color } }, h('td', null, rarityName(r.id)), h('td', { class: 'num' }, `${r.rate}%`), h('td', { class: 'dim' }, `${n}종`), h('td', { class: 'dim' }, n ? pool.filter((c) => c.rarity === r.id).map((c) => c.name).join(', ') : '-'));
    });
    ui.modal({
      title: '상세 확률',
      wide: true,
      body: h(
        'div',
        null,
        h('table', { class: 'rates' }, h('thead', null, h('tr', null, h('th', null, '등급'), h('th', null, '확률'), h('th', null, '종류'), h('th', null, '캐릭터'))), h('tbody', null, rows, h('tr', { vars: { c: '#5fd3e0' } }, h('td', null, '아이템'), h('td', { class: 'num' }, `${cfg.itemRate}%`), h('td', { class: 'dim' }, `${App.content.items.length}종`), h('td', { class: 'dim' }, App.content.items.map((i) => i.name).join(', '))))),
        h('ul', { class: 'rates-notes' }, h('li', null, `10+1회는 마지막 장에서 ★${cfg.multiGuarantee} 이상 1개를 보장해요. 균열마다 첫 10+1회는 ★${fg} 이상 확정.`), h('li', null, `★4 천장 ${cfg.pity.legend}회 · ★5 천장 ${cfg.pity.ultra}회. 천장 카운트는 모든 균열이 함께 쌓이고, 해당 등급이 나오면 0으로 돌아가요.`), h('li', null, `중복 캐릭터는 강화 재료가 돼요 (1강 1개 · 2강 2개 · 3강 3개). 3강 뒤 중복은 코인으로 환급.`)),
      ),
    });
  }

  function historyModal() {
    const log = st.save.extra.log.slice(0, 60);
    ui.modal({
      title: '최근 소환 기록',
      wide: true,
      body: log.length
        ? h(
            'div',
            { class: 'hist' },
            log.map((e) => {
              const isChar = e.r > 0 && App.content.hasChar(e.id);
              const name = isChar ? App.content.char(e.id).name : (App.content.item(e.id)?.name ?? e.id);
              const d = new Date(e.at);
              return h('div', { class: 'hist-row r' + e.r, vars: { c: RAR_COL(e.r) } }, h('span', { class: 'num dim' }, `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`), h('b', null, isChar ? rarityName(e.r) : '아이템'), h('span', null, name), h('small', { class: 'dim' }, App.content.banners.find((b) => b.id === e.banner)?.name ?? e.banner));
            }),
          )
        : h('p', { class: 'dim' }, '아직 기록이 없어요'),
    });
  }

  return { el, bg: bgKey, back: () => !busy && ui.show('Lobby') };
}

export const _icons = iconBtn;
