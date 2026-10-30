/** 화면들이 같이 쓰는 UI 부품 */
import { App } from '../core/app';
import { RARITY_COLORS } from '../core/art';
import { audio } from '../core/audio';
import type { PullResult } from '../core/types';
import { bestArt, portraitArt, artUrl, ui } from './app';
import { h, svg, fmt, countUp, type Attrs } from './dom';
import { I, ITEM_ICON } from './icons';

export const RC = RARITY_COLORS;
export const rarityName = (r: number) => (r <= 0 ? '아이템' : '★'.repeat(r));

// ---------------------------------------------------------------- 버튼
export function btn(
  label: string | Node,
  onClick: () => void,
  o: { cls?: string; sub?: string; icon?: string; disabled?: boolean; color?: string; silent?: boolean; title?: string } = {},
) {
  const b = h(
    'button',
    {
      class: 'btn ' + (o.cls ?? ''),
      disabled: o.disabled,
      title: o.title,
      vars: o.color ? { c: o.color } : undefined,
      onclick: () => {
        if (b.disabled) return;
        if (!o.silent) audio.sfx('confirm');
        onClick();
      },
      onpointerenter: () => !b.disabled && !o.silent && audio.sfx('select'),
    },
    o.icon ? svg(o.icon, 'btn-ico') : null,
    h('span', { class: 'btn-label' }, h('b', null, label), o.sub ? h('small', null, o.sub) : null),
  );
  return b;
}

export function iconBtn(icon: string, onClick: () => void, o: { cls?: string; title?: string; badge?: number } = {}) {
  return h(
    'button',
    {
      class: 'ibtn ' + (o.cls ?? ''),
      title: o.title,
      onclick: () => {
        audio.sfx('confirm');
        onClick();
      },
    },
    svg(icon),
    o.badge ? h('i', { class: 'badge' }, String(o.badge)) : null,
  );
}

// ---------------------------------------------------------------- 상단 바
export function topBar(title: string, o: { sub?: string; back?: () => void; color?: string; right?: (Node | null)[]; coins?: boolean } = {}) {
  return h(
    'header',
    { class: 'topbar enter', vars: o.color ? { c: o.color } : undefined },
    h(
      'div',
      { class: 'tb-left' },
      o.back ? iconBtn(I.back, o.back, { cls: 'back', title: '뒤로 (ESC)' }) : null,
      h('div', { class: 'tb-title' }, h('h1', null, title), o.sub ? h('p', null, o.sub) : null),
    ),
    h('div', { class: 'tb-right' }, ...(o.right ?? []), o.coins === false ? null : coinPill()),
  );
}

/** 코인 표시. 저장소가 바뀌면 숫자가 굴러간다 */
export function coinPill() {
  const num = h('b', null, fmt(App.store.coins));
  const el = h('div', { class: 'coin-pill' }, svg(I.coin, 'coin-ico'), num);
  let last = App.store.coins;
  const off = App.store.onChange(() => {
    if (!el.isConnected) return off();
    const now = App.store.coins;
    if (now !== last) {
      countUp(num, last, now, 600);
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
      last = now;
    }
  });
  return el;
}

// ---------------------------------------------------------------- 패널·제목
export function panel(cls: string, ...children: (Node | string | null | false)[]) {
  return h('div', { class: 'panel ' + cls }, ...children);
}

export function sectionTitle(text: string, sub?: string) {
  return h('div', { class: 'sec-title' }, h('b', null, text), sub ? h('span', null, sub) : null);
}

export function tabs<T extends string>(items: { id: T; label: string; sub?: string; color?: string; badge?: number }[], active: T, onPick: (id: T) => void, cls = '') {
  return h(
    'nav',
    { class: 'tabs ' + cls },
    items.map((t) =>
      h(
        'button',
        {
          class: 'tab' + (t.id === active ? ' on' : ''),
          vars: t.color ? { c: t.color } : undefined,
          onclick: () => {
            if (t.id === active) return;
            audio.sfx('select');
            onPick(t.id);
          },
        },
        h('b', null, t.label),
        t.sub ? h('small', null, t.sub) : null,
        t.badge ? h('i', { class: 'badge' }, String(t.badge)) : null,
      ),
    ),
  );
}

export function bar(ratio: number, color?: string, cls = '') {
  return h('div', { class: 'bar ' + cls, vars: color ? { c: color } : undefined }, h('i', { style: { width: Math.max(0, Math.min(1, ratio)) * 100 + '%' } }));
}

export function stars(n: number, max = n, size = 18) {
  const row = h('div', { class: 'stars', style: { fontSize: size + 'px' } });
  for (let i = 0; i < max; i++) row.appendChild(svg(I.star, i < n ? 'on' : 'off'));
  return row;
}

export function rarityStars(r: number) {
  return h('div', { class: 'rstars r' + r }, Array.from({ length: r }, () => svg(I.star)));
}

export function badge(text: string, cls = '') {
  return h('span', { class: 'tag ' + cls }, text);
}

// ---------------------------------------------------------------- 캐릭터
/** 캐릭터 그림 요소. pixel 이면 또렷하게 확대 */
export function charImg(id: string, kind: 'portrait' | 'best' | 'sprite' = 'portrait', attrs: Attrs = {}) {
  const a = kind === 'portrait' ? portraitArt(id) : kind === 'best' ? bestArt(id) : { url: artUrl('spr', id) ?? '', pixel: true };
  return h('img', { ...attrs, src: a.url, alt: '', class: ((attrs.class ?? '') + (a.pixel ? ' pixel' : '')).trim(), data: { kind: (a as any).kind ?? kind } });
}

/** 도감·편성·뽑기 결과에 쓰는 캐릭터 카드 */
export function charCard(
  id: string,
  o: { owned?: boolean; selected?: boolean; onClick?: () => void; size?: 'sm' | 'md' | 'lg'; tag?: string; sub?: string; showLevel?: boolean; dim?: boolean } = {},
) {
  const c = App.content.char(id);
  const owned = o.owned ?? App.store.owns(id);
  const o2 = App.store.save.owned[id];
  const card = h(
    'div',
    {
      class: `ccard r${c.rarity} ${o.size ?? 'md'}${owned ? '' : ' locked'}${o.selected ? ' sel' : ''}${o.onClick ? ' clickable' : ''}`,
      vars: { c: RC[c.rarity] },
      onclick: o.onClick
        ? () => {
            audio.sfx('select');
            o.onClick!();
          }
        : undefined,
    },
    h('div', { class: 'ccard-art' }, charImg(id, 'portrait')),
    h('div', { class: 'ccard-shade' }),
    h('div', { class: 'ccard-top' }, rarityStars(c.rarity), o.tag ? h('span', { class: 'tag hot' }, o.tag) : null),
    h('div', { class: 'ccard-name' }, h('b', null, owned ? c.name : '???'), o.sub ? h('small', null, o.sub) : null),
    o.showLevel !== false && owned && o2 && o2.b > 0 ? h('div', { class: 'ccard-lv' }, `+${o2.b}`) : null,
    !owned ? h('div', { class: 'ccard-lock' }, svg(I.lock)) : null,
  );
  return card;
}

export function itemIcon(id: string, cls = '') {
  const it = App.content.item(id);
  return h('span', { class: 'item-ico ' + cls, vars: { c: it?.color ?? '#5fd3e0' }, html: ITEM_ICON[id] ?? I.sparkle });
}

export function dupText(r: PullResult, short = false) {
  const enh = App.content.gacha.enhance;
  if (r.isNew) return short ? '새 동료' : 'NEW · 새 동료 합류';
  if (r.levelUp) return `강화 +${r.b}`;
  if (r.refund) return short ? `+${r.refund} 코인` : `최대 강화 · ${r.refund} 코인으로 환급`;
  const need = enh.need[r.b] ?? 1;
  return short ? `중복 ${r.d}/${need}` : `중복 · 다음 강화까지 ${r.d}/${need}`;
}

export function domainColor(id: string) {
  return App.content.domainColor(id);
}

/** 바로가기: 토스트 */
export const toast = (m: string, k?: 'info' | 'good' | 'bad' | 'gold') => ui.toast(m, k);

/** 목록 페이지 넘김 */
export function pager(page: number, pages: number, onPage: (p: number) => void) {
  if (pages <= 1) return null;
  return h(
    'div',
    { class: 'pager' },
    iconBtn(I.back, () => onPage((page + pages - 1) % pages)),
    h('span', null, `${page + 1} / ${pages}`),
    iconBtn(I.fwd, () => onPage((page + 1) % pages)),
  );
}

export function keyHint(text: string) {
  return h('span', { class: 'key' }, text);
}
