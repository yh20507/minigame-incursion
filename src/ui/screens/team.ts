/** 편성 */
import { App } from '../../core/app';
import { bonusLines } from '../../core/modes';
import { passiveLabel } from '../../core/store';
import { ui, type Screen } from '../app';
import { RC, btn, charCard, charImg, pager, rarityStars, topBar, skillCard } from '../components';
import { h, svg } from '../dom';
import { I } from '../icons';

type Slot = 'leader' | 0 | 1;

export function teamScreen(data: { back?: { scene: string; data?: object }; slot?: Slot; page?: number }): Screen {
  const st = App.store;
  const back = data?.back ?? { scene: 'Lobby' };
  const slot: Slot = data?.slot ?? 'leader';
  const page = data?.page ?? 0;
  const reopen = (o: Partial<typeof data> = {}) => ui.show('Team', { back, slot, page, ...o }, { instant: true });
  const lead = App.content.char(st.save.team.leader);

  const slotCard = (id: string | null, kind: Slot) => {
    const on = slot === kind;
    const c = id ? App.content.char(id) : null;
    return h(
      'button',
      {
        class: 'tslot' + (on ? ' on' : '') + (kind === 'leader' ? ' leader' : '') + (c ? '' : ' empty'),
        vars: c ? { c: RC[c.rarity] } : undefined,
        onclick: () => reopen({ slot: kind }),
      },
      c ? charImg(id!, 'portrait') : h('div', { class: 'tslot-plus' }, svg(I.plus)),
      h('div', { class: 'tslot-shade' }),
      h('div', { class: 'tslot-label' }, kind === 'leader' ? '리더' : `서포트 ${(kind as number) + 1}`),
      c ? h('div', { class: 'tslot-name' }, rarityStars(c.rarity), h('b', null, c.name)) : h('div', { class: 'tslot-name' }, h('b', { class: 'dim' }, '비어 있음')),
    );
  };

  const b = st.bonus(null);
  const active = st.activeCrossovers();
  const crossRows = App.content.synergies.crossovers
    .filter((cx) => active.includes(cx) || cx.members.some((m) => st.owns(m)))
    .map((cx) => {
      const on = active.includes(cx);
      return h(
        'div',
        { class: 'cross-row' + (on ? ' on' : '') },
        h('b', null, cx.name),
        h('span', { class: 'cross-members' }, cx.members.map((m) => h('i', { class: st.teamIds().includes(m) ? 'in' : st.owns(m) ? '' : 'no' }, st.owns(m) ? App.content.char(m).name : '???'))),
        h('small', null, cx.desc),
      );
    });

  const owned = st.ownedChars().sort((a, c) => c.rarity - a.rarity || a.domain.localeCompare(c.domain));
  const per = 16;
  const pages = Math.max(1, Math.ceil(owned.length / per));
  const slotName = slot === 'leader' ? '리더' : `서포트 ${slot + 1}`;

  const el = h(
    'div',
    { class: 'team' },
    topBar('편성', { back: () => ui.show(back.scene, back.data), sub: '리더는 조작 캐릭터 · 패시브 100%, 서포트는 패시브 50% (보호막 제외)' }),
    h(
      'div',
      { class: 'team-top enter' },
      h('div', { class: 'team-slots' }, slotCard(st.save.team.leader, 'leader'), slotCard(st.save.team.supports[0], 0), slotCard(st.save.team.supports[1], 1)),
      h(
        'div',
        { class: 'team-info panel pad' },
        h('div', { class: 'sec-title' }, h('b', null, lead.name), h('span', null, lead.title)),
        skillCard(lead.id),
        h('div', { class: 'team-pass' }, lead.passives.map((p) => h('div', null, svg(I.sparkle), ' ', passiveLabel(p, App.content.domainName(p.domain ?? ''))))),
        h('div', { class: 'sec-title', style: { marginTop: '18px' } }, h('b', null, '팀 보너스'), h('span', null, '모든 영역 공통분')),
        h('div', { class: 'bonus-chips' }, bonusLines(b).map((l) => h('span', { class: 'tag good' }, l))),
        h('div', { class: 'sec-title', style: { marginTop: '18px' } }, h('b', null, '크로스오버'), h('span', null, '특정 조합을 함께 편성하면 발동')),
        crossRows.length ? h('div', { class: 'cross-list' }, crossRows) : h('p', { class: 'faint' }, '아직 발견한 조합이 없어요.'),
      ),
    ),
    h(
      'div',
      { class: 'team-pick enter' },
      h('div', { class: 'team-pick-head' }, h('span', { class: 'accent' }, svg(I.fwd), ` ${slotName} 자리에 넣을 동료를 고르세요`), slot !== 'leader' && st.save.team.supports[slot] ? btn('이 자리 비우기', async () => { const sup = [...st.save.team.supports]; sup[slot] = null; await st.setTeam(st.save.team.leader, sup); reopen(); }, { cls: 'sm ghost', icon: I.close }) : null, pager(page, pages, (p) => reopen({ page: p }))),
      h(
        'div',
        { class: 'team-grid' },
        owned.slice(page * per, page * per + per).map((c) => {
          const inTeam = st.teamIds().includes(c.id);
          return charCard(c.id, { size: 'sm', tag: inTeam ? '출전' : undefined, onClick: () => assign(slot, c.id) });
        }),
      ),
    ),
  );

  async function assign(slotK: Slot, id: string) {
    let leader = st.save.team.leader;
    const sup = [...st.save.team.supports];
    if (slotK === 'leader') {
      if (id === leader) return;
      const i = sup.indexOf(id);
      if (i >= 0) sup[i] = leader;
      leader = id;
    } else {
      if (id === leader) return ui.toast('리더는 서포트로 넣을 수 없어요', 'bad');
      const other = slotK === 0 ? 1 : 0;
      if (sup[other] === id) sup[other] = sup[slotK];
      sup[slotK] = id;
    }
    await st.setTeam(leader, sup);
    reopen();
  }

  return { el, back: () => ui.show(back.scene, back.data) };
}
