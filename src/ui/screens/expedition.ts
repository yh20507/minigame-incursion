/** 원정대 · 새 대륙 탐사 */
import { App } from '../../core/app';
import { audio } from '../../core/audio';
import { currentFrontier, exploreOpen, exploreProgress, expeditionReward, frontierOpen, landed } from '../../core/explore';
import { rollItem } from '../../core/gacha';
import { ui, type Screen } from '../app';
import { bar, btn, charCard, itemIcon, pager, topBar } from '../components';
import { fmt, h, svg } from '../dom';
import { fx } from '../fx';
import { I } from '../icons';

export function expeditionScreen(data: { sel?: string[]; hours?: number; page?: number }): Screen {
  const st = App.store;
  const f = currentFrontier();
  audio.bgm('expedition', 50, 'lydian', 84, ['expedition', 'map']);
  const timers: number[] = [];
  const reopen = (o: Partial<typeof data> = {}) => ui.show('Expedition', { ...data, ...o }, { instant: true });

  if (!exploreOpen()) {
    return { el: h('div', null, topBar('원정대', { back: () => ui.show('Lobby') }), h('p', { class: 'dim', style: { padding: '200px', textAlign: 'center', fontSize: '26px' } }, '최종장을 깨면 균열 너머 탐사가 시작돼요.')), back: () => ui.show('Lobby') };
  }

  // ---------- 왼쪽: 균열 너머 해역
  const p = exploreProgress();
  const e = st.save.extra.explore;
  const stage = [...f.stages].reverse().find((s) => p * 100 >= s.at) ?? f.stages[0];
  const fog = h('div', { class: 'frontier-fog', vars: { c: f.color, reveal: String(p) } }, h('div', { class: 'ff-sky' }), h('div', { class: 'ff-tower' }, h('i'), h('i'), h('i'), p >= 0.75 ? h('b', { class: 'ff-clock' }) : null), h('div', { class: 'ff-mist' }), h('div', { class: 'ff-mist two' }));
  const left = h(
    'section',
    { class: 'frontier panel enter', vars: { c: f.color } },
    fog,
    h(
      'div',
      { class: 'frontier-text' },
      h('div', { class: 'eyebrow' }, 'BEYOND THE RIFT'),
      h('h2', null, p >= 0.5 ? f.name : '???'),
      p >= 0.5 ? h('p', { class: 'dim' }, f.subtitle) : null,
      h('div', { class: 'frontier-prog' }, h('div', { class: 'fp-label' }, h('span', null, '좌표 조각'), h('b', { class: 'num' }, `${Math.min(e.shards, f.need)} / ${f.need}`)), bar(p, f.color)),
      h('p', { class: 'frontier-stage' }, landed() ? f.landed : !frontierOpen(f) ? `${App.content.domainName(f.unlockAfter)}을(를) 해방하면 다음 대륙 탐사가 시작돼요.` : stage.text),
      !landed() && frontierOpen(f) ? h('p', { class: 'faint' }, '조각은 미니게임 별·클리어, 보스, 도전 모드, 원정으로 모여요.') : null,
      !landed() && frontierOpen(f) && p >= 1 ? btn('상륙전 도전!', () => ui.show('Prep', { mode: 'landing', domain: 'rift' }), { cls: 'primary pulse', color: f.color, icon: I.sword }) : null,
      h('div', { class: 'frontier-list' }, App.content.frontier.list.map((x) => h('span', { class: 'tag ' + (landed(x) ? 'good' : x.id === f.id ? 'hot' : 'dimmed') }, landed(x) ? x.name : x.id === f.id && p >= 0.5 ? x.name : '???'))),
    ),
  );

  // ---------- 오른쪽: 원정대
  const right = h('section', { class: 'exped panel pad enter' });
  const ex = st.save.extra.expedition;
  if (ex) {
    const rw = expeditionReward(ex.members, ex.hours);
    const end = ex.start + ex.hours * 3600 * 1000;
    const leftT = h('div', { class: 'exped-timer num' });
    const claim = btn('보상 받기', () => doClaim(), { cls: 'primary wide', icon: I.gift, disabled: true });
    const tick = () => {
      const ms = end - Date.now();
      if (ms <= 0) {
        leftT.textContent = '원정 완료!';
        leftT.classList.add('good');
        claim.disabled = false;
      } else {
        const hh = Math.floor(ms / 3600000),
          mm = Math.floor((ms % 3600000) / 60000),
          ss = Math.floor((ms % 60000) / 1000);
        leftT.textContent = `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      }
    };
    tick();
    timers.push(window.setInterval(tick, 1000));
    right.append(
      h('div', { class: 'sec-title' }, h('b', null, '원정 진행 중'), h('span', null, `${ex.hours}시간 원정`)),
      h('div', { class: 'exped-members' }, ex.members.map((id) => charCard(id, { size: 'sm', showLevel: false }))),
      h('div', { class: 'exped-reward dim' }, '예상 보상: ', h('b', { class: 'gold' }, `좌표 조각 ${rw.shards} · 코인 ${fmt(rw.coins)}${rw.items ? ` · 아이템 ${rw.items}개` : ''}`)),
      leftT,
      claim,
      btn('원정 취소', async () => { if (await ui.confirm('원정을 취소할까요? 보상은 받지 못해요.', '취소하기', true)) { st.save.extra.expedition = null; await st.saveMeta(); reopen(); } }, { cls: 'sm ghost', icon: I.close }),
    );
  } else {
    const sel = data.sel ?? [];
    const hours = data.hours ?? App.content.frontier.expedition.hours[0];
    const owned = st.ownedChars().sort((a, b) => b.rarity - a.rarity);
    const per = 12;
    const page = data.page ?? 0;
    const pages = Math.max(1, Math.ceil(owned.length / per));
    const rw = expeditionReward(sel, hours);
    right.append(
      h('div', { class: 'sec-title' }, h('b', null, '원정대 파견'), h('span', null, '3명 · 별이 높을수록 보상 증가')),
      h('div', { class: 'exped-pickhead' }, h('span', { class: 'num' }, `${sel.length} / 3`), pager(page, pages, (pg) => reopen({ page: pg }))),
      h(
        'div',
        { class: 'exped-grid' },
        owned.slice(page * per, page * per + per).map((c) => {
          const on = sel.includes(c.id);
          return charCard(c.id, { size: 'sm', selected: on, showLevel: false, onClick: () => { const next = on ? sel.filter((s) => s !== c.id) : sel.length >= 3 ? sel : [...sel, c.id]; if (!on && sel.length >= 3) ui.toast('3명까지예요', 'bad'); reopen({ sel: next }); } });
        }),
      ),
      h('div', { class: 'exped-hours' }, App.content.frontier.expedition.hours.map((hr) => btn(`${hr}시간`, () => reopen({ hours: hr }), { cls: 'sm' + (hours === hr ? ' primary' : ' ghost'), silent: true }))),
      h('div', { class: 'exped-reward dim' }, sel.length ? ['예상 보상: ', h('b', { class: 'gold' }, `조각 ${rw.shards} · 코인 ${fmt(rw.coins)}`)] : '보낼 동료를 고르세요'),
      btn(`원정 보내기 (${sel.length}/3)`, async () => { st.save.extra.expedition = { members: sel, start: Date.now(), hours }; await st.saveMeta(); audio.sfx('go'); reopen({ sel: [] }); }, { cls: 'primary wide', icon: I.compass, disabled: sel.length !== 3 }),
    );
  }

  async function doClaim() {
    const ex2 = st.save.extra.expedition;
    if (!ex2 || Date.now() < ex2.start + ex2.hours * 3600000) return;
    const rw = expeditionReward(ex2.members, ex2.hours);
    const items: Record<string, number> = {};
    for (let i = 0; i < rw.items; i++) {
      const it = rollItem(App.content.items.filter((x) => x.effect !== 'instant'), Math.random);
      items[it.id] = (items[it.id] ?? 0) + 1;
    }
    st.save.extra.expedition = null;
    if (!landed()) st.save.extra.explore.shards += rw.shards;
    await st.saveMeta();
    await st.addCoins(rw.coins);
    await st.addItems(items);
    audio.sfx('coin');
    fx.burst(1400, 500, { n: 60, color: [f.color, '#ffc845', '#fff'], speed: 600, size: 6, life: 1.2, shape: 'star' });
    const names = Object.entries(items).map(([k, n]) => `${App.content.item(k)?.name} ${n}`).join(', ');
    ui.toast(`좌표 조각 +${rw.shards} · 코인 +${fmt(rw.coins)}${names ? ' · ' + names : ''}`, 'gold');
    setTimeout(() => reopen(), 900);
  }

  const el = h('div', { class: 'expedition' }, topBar('원정대 · 탐사', { back: () => ui.show('Lobby'), color: f.color, sub: '균열 너머의 새 대륙을 찾아서' }), h('div', { class: 'exped-body' }, left, right));
  return { el, back: () => ui.show('Lobby'), onLeave: () => timers.forEach((t) => clearInterval(t)) };
}

export const _ii = itemIcon;
export const _s = svg;
