/** 도감 */
import { App } from '../../core/app';
import { audio } from '../../core/audio';
import { passiveLabel, skinEffectLabel } from '../../core/store';
import type { CharDef } from '../../core/types';
import { bestArt, ui, type Screen } from '../app';
import { RC, badge, bar, btn, charCard, charImg, itemIcon, pager, rarityName, rarityStars, skillCard, tabs, topBar } from '../components';
import { fmt, h, svg } from '../dom';
import { I } from '../icons';
import { showReveal } from '../reveal';
import { SKIN_COL, skinCard } from './skins';
import { hasRecord, personalStories, recordsOf } from '../../core/storyflow';

interface Tab {
  id: string;
  name: string;
  color: string;
  chars: CharDef[];
}

export function collectionScreen(data: { tab?: string; sel?: string; page?: number }): Screen {
  const st = App.store;
  const all = App.content.chars;
  const tabList: Tab[] = [
    { id: 'original', name: '오리지널', color: '#ff5fd2', chars: all.filter((c) => c.origin === 'original') },
    { id: 'special', name: '특별', color: '#b48cff', chars: all.filter((c) => c.origin === 'special') },
    ...st.visibleWorlds().map((w) => ({ id: w.id, name: w.name, color: w.color, chars: all.filter((c) => c.origin === 'world' && c.domain === w.id) })),
  ];
  const RECORDS_TAB: Tab = { id: 'records', name: '기록', color: '#ffe08a', chars: [] };
  if (App.content.records.length) tabList.push(RECORDS_TAB);
  const tab = tabList.find((t) => t.id === data?.tab) ?? tabList[0];
  if (tab.id === 'records') return recordsView();
  const page = data?.page ?? 0;
  const list = [...tab.chars].sort((a, b) => b.rarity - a.rarity);
  const per = 15;
  const pages = Math.max(1, Math.ceil(list.length / per));
  const shown = list.slice(page * per, page * per + per);
  const sel = data?.sel && shown.some((c) => c.id === data.sel) ? data.sel : (shown.find((c) => st.owns(c.id))?.id ?? shown[0]?.id);
  const reopen = (o: Partial<typeof data> = {}) => ui.show('Collection', { tab: tab.id, sel, page, ...o }, { instant: true });

  const owned = st.ownedChars().length;
  const grid = h(
    'div',
    { class: 'col-grid' },
    shown.map((c, i) => {
      const card = charCard(c.id, { selected: c.id === sel, onClick: () => reopen({ sel: c.id }), size: 'md' });
      card.classList.add('enter');
      card.style.setProperty('--i', String(i));
      return card;
    }),
  );

  // 세트 진행
  let setEl: HTMLElement | null = null;
  if (tab.id === 'original') {
    setEl = h(
      'div',
      { class: 'col-set' },
      h('span', { class: 'dim' }, `영역 세트 (그 영역 게임 코인 +${App.content.synergies.set.value}%)`),
      App.content.domains.map((d) => {
        const cs = all.filter((c) => c.origin === 'original' && c.domain === d.id);
        const have = cs.filter((c) => st.owns(c.id)).length;
        return h('span', { class: 'set-chip', vars: { c: d.color } }, h('b', null, d.name), h('i', { class: 'num' }, `${have}/${cs.length}`));
      }),
    );
  } else if (tab.id !== 'special') {
    const have = tab.chars.filter((c) => st.owns(c.id)).length;
    setEl = h('div', { class: 'col-set' }, h('span', { class: 'dim' }, App.content.synergies.worldSet.desc), h('span', { class: 'set-chip', vars: { c: tab.color } }, h('b', null, tab.name), h('i', { class: 'num' }, `${have}/${tab.chars.length}`)));
  }

  const left = h(
    'div',
    { class: 'col-left' },
    tabs(
      tabList.map((t) => ({ id: t.id, label: t.name, color: t.color, sub: t.id === 'records' ? `${st.save.extra.records.length}/${App.content.records.length}` : `${t.chars.filter((c) => st.owns(c.id)).length}/${t.chars.length}` })),
      tab.id,
      (id) => ui.show('Collection', { tab: id }, { instant: true }),
      'enter',
    ),
    grid,
    h('div', { class: 'col-foot enter' }, setEl, pager(page, pages, (p) => reopen({ page: p, sel: undefined }))),
  );

  const el = h(
    'div',
    { class: 'collection' },
    topBar('도감', { back: () => ui.show('Lobby'), sub: `${owned} / ${all.length} 동료`, right: [h('div', { class: 'shard-pill' }, itemIcon('shard'), h('b', { class: 'num' }, String(st.itemCount('shard'))), h('small', null, '만능 조각'))] }),
    h('div', { class: 'col-body' }, left, sel ? detail(sel) : h('div')),
  );

  function detail(id: string) {
    const c = App.content.char(id);
    const own = st.owns(id);
    const enh = App.content.gacha.enhance;
    const col = RC[c.rarity];
    const art = bestArt(id);
    const o = st.save.owned[id];
    const mult = o ? 1 + enh.bonusPerLevel * o.b : 1;
    const maxed = !!o && o.b >= enh.max;
    const need = o ? (enh.need[o.b] ?? 0) : 0;
    const actions: HTMLElement[] = [];
    if (own) {
      if (st.save.team.leader !== id)
        actions.push(
          btn('리더로', async () => {
            const sup = st.save.team.supports.map((s) => (s === id ? st.save.team.leader : s));
            await st.setTeam(id, sup);
            ui.toast(`${c.name}이(가) 리더가 됐어요`, 'good');
            reopen();
          }, { cls: 'sm', icon: I.crown }),
        );
      else actions.push(badge('현재 리더', 'hot'));
      if (c.rarity <= 3 && !maxed && st.itemCount('shard') > 0)
        actions.push(
          btn('만능 조각 사용', async () => {
            const r = await st.useShard(id);
            if (r?.levelUp) {
              audio.sfx('legend');
              ui.toast(`${c.name} 강화 +${st.save.owned[id].b}!`, 'gold');
            } else ui.toast('중복 +1');
            reopen();
          }, { cls: 'sm', icon: I.shard, color: '#b48cff', sub: `${st.itemCount('shard')}개 보유` }),
        );
      if (c.rarity >= 4) actions.push(btn('일러스트 감상', () => showReveal(id), { cls: 'sm', icon: I.image, color: col }));
      actions.push(
        btn('로비 캐릭터로', async () => {
          st.save.extra.lobby.walkers = [id];
          await st.saveMeta();
          ui.toast(`로비에 ${c.name}이(가) 서 있어요`, 'good');
        }, { cls: 'sm ghost', icon: I.home }),
      );
    }
    return h(
      'aside',
      { class: `col-detail panel r${c.rarity}` + (own ? '' : ' locked'), vars: { c: col, dc: App.content.domainColor(c.domain) } },
      h('div', { class: 'cd-art ' + (art.kind === 'spr' ? 'is-sprite' : 'is-art') }, h('img', { src: art.url, class: art.pixel ? 'pixel' : '', alt: '' })),
      h('div', { class: 'cd-shade' }),
      h(
        'div',
        { class: 'cd-text' },
        h('div', { class: 'cd-top' }, rarityStars(c.rarity), h('span', { class: 'tag dimmed' }, App.content.domainName(c.domain)), o && o.b > 0 ? h('span', { class: 'tag gold' }, `+${o.b} 강화`) : null),
        h('h2', null, own ? c.name : '???'),
        h('p', { class: 'cd-title' }, own ? c.title : rarityName(c.rarity)),
        own ? skillCard(id) : null,
        own
          ? h(
              'div',
              { class: 'cd-pass' },
              c.passives.map((p) => {
                const v = p.type === 'shield' ? p.value + (maxed ? 1 : 0) : Math.round(p.value * mult * 10) / 10;
                return h('div', { class: 'cd-pass-row' }, svg(I.sparkle), h('span', null, passiveLabel({ ...p, value: v }, App.content.domainName(p.domain ?? ''))));
              }),
            )
          : null,
        h('p', { class: 'cd-desc' }, own ? c.desc : c.origin === 'special' ? `획득 조건: ${c.unlock ?? '스토리'}` : c.origin === 'world' ? `${App.content.domainName(c.domain)} 한정 균열에서 만날 수 있어요.` : '상시 균열에서 만날 수 있어요.'),
        own && o
          ? h(
              'div',
              { class: 'cd-enh' },
              h('div', { class: 'cd-enh-label' }, h('span', null, '강화'), h('b', { class: 'num' }, `${o.b} / ${enh.max}`), h('small', null, maxed ? '최대' : `다음 강화까지 중복 ${o.d ?? 0}/${need}`)),
              bar(maxed ? 1 : (o.d ?? 0) / Math.max(1, need), '#ffc845', 'thin'),
              h('div', { class: 'cd-meta' }, `획득 ${new Date(o.at).toLocaleDateString('ko-KR')}`),
            )
          : null,
        h('div', { class: 'cd-actions' }, actions),
        storiesRow(id),
        skinsRow(id, own),
      ),
    );
  }

  function storiesRow(id: string) {
    const list = personalStories(id);
    if (!list.length) return null;
    return h(
      'div',
      { class: 'cd-stories' },
      h('div', { class: 'cd-skins-head' }, h('span', { class: 'eyebrow' }, 'STORY'), h('span', { class: 'dim' }, '동료 개인 이야기')),
      h(
        'div',
        { class: 'cd-stories-row' },
        list.map((s) =>
          h(
            'button',
            { class: 'story-btn' + (s.open ? '' : ' locked') + (s.isNew ? ' new' : '') + (st.save.story[s.id] ? ' seen' : ''), onclick: () => { if (!s.open) return ui.toast(`${s.need} 열려요`); audio.sfx('confirm'); ui.show('Story', { id: s.id, next: 'Collection', nextData: { tab: tab.id, sel: id, page } }); } },
            svg(s.open ? I.book : I.lock),
            h('span', null, `이야기 ${s.n}`),
            h('small', null, s.open ? (st.save.story[s.id] ? '다시 보기' : 'NEW') : s.need),
          ),
        ),
      ),
    );
  }

  function recordsView(): Screen {
    const doms = App.content.domains;
    const selDom = doms.find((d) => d.id === data?.sel) ?? doms.find((d) => recordsOf(d.id).some((r) => hasRecord(r.id))) ?? doms[0];
    const list = recordsOf(selDom.id);
    const got = list.filter((r) => hasRecord(r.id)).length;
    const left = h(
      'div',
      { class: 'col-left' },
      tabs(
        tabList.map((t) => ({ id: t.id, label: t.name, color: t.color, sub: t.id === 'records' ? `${st.save.extra.records.length}/${App.content.records.length}` : `${t.chars.filter((c) => st.owns(c.id)).length}/${t.chars.length}` })),
        'records',
        (id) => ui.show('Collection', { tab: id }, { instant: true }),
        'enter',
      ),
      h('div', { class: 'rec-doms enter' }, doms.map((d) => h('button', { class: 'rec-dom' + (d.id === selDom.id ? ' on' : ''), vars: { c: d.color }, onclick: () => ui.show('Collection', { tab: 'records', sel: d.id }, { instant: true }) }, h('b', null, d.name), h('small', { class: 'num' }, `${recordsOf(d.id).filter((r) => hasRecord(r.id)).length}/${recordsOf(d.id).length}`)))),
      h(
        'div',
        { class: 'rec-list' },
        list.map((r, i) => {
          const own = hasRecord(r.id);
          return h('article', { class: 'rec-item panel enter' + (own ? '' : ' locked'), style: { ['--i' as any]: String(i) }, vars: { c: selDom.color } }, h('div', { class: 'rec-no num' }, String(i + 1).padStart(2, '0')), h('div', { class: 'rec-text' }, h('b', null, own ? r.title : '???'), h('p', null, own ? r.text : '이 영역의 미니게임을 플레이하면 가끔 발견돼요. 어려움 모드에서 두 배.')));
        }),
      ),
    );
    const el = h(
      'div',
      { class: 'collection' },
      topBar('도감 · 기록', { back: () => ui.show('Lobby'), sub: `${selDom.name} · ${got}/${list.length} · 관측자가 남긴 메모` }),
      h('div', { class: 'col-body records' }, left),
    );
    return { el, back: () => ui.show('Lobby') };
  }

  function skinsRow(id: string, own: boolean) {
    const list = App.content.skinsOf(id);
    if (!list.length) return null;
    const eq = st.equippedSkin(id);
    return h(
      'div',
      { class: 'cd-skins' },
      h('div', { class: 'cd-skins-head' }, h('span', { class: 'eyebrow' }, 'SKINS'), h('span', { class: 'dim' }, eq ? `입은 의상: ${eq.name}` : '기본 의상'), eq ? h('span', { class: 'tag', style: { color: SKIN_COL(eq.grade), borderColor: SKIN_COL(eq.grade) } }, `${eq.grade} · ${skinEffectLabel(App.content, eq.grade)}`) : null, eq && own ? h('button', { class: 'link', onclick: async () => { await st.equipSkin(id, null); reopen(); } }, '기본으로') : null),
      h('div', { class: 'cd-skins-eff' }, (['A', 'S', 'SS'] as const).map((g) => h('span', { style: { color: SKIN_COL(g) } }, `${g} ${skinEffectLabel(App.content, g)}`)), h('small', { class: 'dim' }, App.content.skins.config.effectNote)),
      h(
        'div',
        { class: 'cd-skins-row' },
        list.map((s) =>
          h(
            'div',
            { class: 'cd-skin' },
            skinCard(s, { size: 'sm', selected: eq?.id === s.id, showOwner: false, onClick: async () => {
              if (!st.ownsSkin(s.id)) return ui.toast(st.skinAvailable(s) ? `의상 균열에서 뽑거나 조각 ${App.content.skins.config.exchange[s.grade]}개로 교환할 수 있어요` : '그림을 넣으면 열려요');
              if (!own) return ui.toast('이 동료를 만나면 입힐 수 있어요');
              await st.equipSkin(id, eq?.id === s.id ? null : s.id);
              reopen();
            } }),
            h('small', { style: { color: SKIN_COL(s.grade) } }, `${s.grade} · ${s.name}`),
          ),
        ),
      ),
    );
  }

  return { el, back: () => ui.show('Lobby') };
}

export const _ci = charImg;
export const _f = fmt;
