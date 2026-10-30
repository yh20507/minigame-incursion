/** 보상: 출석 · 칭호 · ★5 선택권 */
import { App } from '../../core/app';
import { audio } from '../../core/audio';
import { todayKey } from '../../core/rng';
import { ui, type Screen } from '../app';
import { RC, bar, btn, charCard, itemIcon, pager, tabs, topBar } from '../components';
import { fmt, h, svg } from '../dom';
import { fx } from '../fx';
import { I } from '../icons';
import { showReveal } from '../reveal';

type Tab = 'attend' | 'titles' | 'tickets';

export function rewardsScreen(data: { tab?: Tab; page?: number }): Screen {
  const st = App.store;
  const tab: Tab = data?.tab ?? 'attend';
  const page = data?.page ?? 0;
  const nTitle = st.claimableTitles().length;
  const nTicket = st.availableTickets().filter((t) => !st.save.extra.tickets.includes(t.id)).length;
  const reopen = (o: Partial<typeof data> = {}) => ui.show('Rewards', { tab, page, ...o }, { instant: true });
  let busy = false;

  const body = h('div', { class: 'rw-body' });
  if (tab === 'attend') body.appendChild(attend());
  if (tab === 'titles') body.appendChild(titles());
  if (tab === 'tickets') body.appendChild(tickets());

  const el = h(
    'div',
    { class: 'rewards' },
    topBar('보상', { back: () => ui.show('Lobby'), sub: '출석 · 칭호 · 선택권' }),
    tabs<Tab>(
      [
        { id: 'attend', label: '출석', sub: `${st.save.extra.attend.days}/28` },
        { id: 'titles', label: '칭호', badge: nTitle, sub: `${st.save.extra.titles.claimed.length}/${App.content.rewards.titles.length}` },
        { id: 'tickets', label: '선택권', badge: nTicket, color: RC[4] },
      ],
      tab,
      (id) => ui.show('Rewards', { tab: id }, { instant: true }),
      'rw-tabs enter',
    ),
    body,
  );

  function attend() {
    const a = st.save.extra.attend;
    const list = App.content.rewards.attendance;
    const end = a.start ? new Date(Date.parse(a.start) + 27 * 86400000) : null;
    const endKey = end ? `${end.getMonth() + 1}/${end.getDate()}` : '';
    const today = todayKey();
    return h(
      'div',
      { class: 'attend enter' },
      h('div', { class: 'attend-head' }, h('span', null, `매일 처음 접속하면 도장 한 칸 · 이번 주기 `, h('b', { class: 'num gold' }, `${a.days}/28`), `일${endKey ? ` (~${endKey}까지, 지나면 처음부터)` : ''}`), h('span', { class: 'dim' }, `누적 출석 `, h('b', { class: 'num' }, `${a.total}`), `일`)),
      h(
        'div',
        { class: 'attend-grid' },
        list.map((r, i) => {
          const done = r.day <= a.days;
          const isToday = r.day === a.days && a.last === today;
          const big = r.day % 7 === 0;
          return h(
            'div',
            { class: 'att-cell' + (done ? ' done' : '') + (isToday ? ' today' : '') + (big ? ' big' : ''), style: { animationDelay: i * 25 + 'ms' } },
            h('div', { class: 'att-day num' }, `${r.day}`),
            h('div', { class: 'att-reward' }, r.coins ? h('div', { class: 'att-coin' }, svg(I.coin), h('b', { class: 'num' }, fmt(r.coins))) : null, ...Object.entries(r.items ?? {}).map(([id, n]) => h('div', { class: 'att-item' }, itemIcon(id), h('span', null, `${App.content.item(id)?.name ?? id}${n > 1 ? ' ×' + n : ''}`)))),
            done ? h('div', { class: 'att-check' }, svg(I.check)) : null,
          );
        }),
      ),
    );
  }

  function titles() {
    const list = App.content.rewards.titles;
    const per = 8;
    const pages = Math.max(1, Math.ceil(list.length / per));
    const eq = st.equippedTitle();
    const sorted = [...list].sort((x, y) => Number(st.titleDone(y) && !st.save.extra.titles.claimed.includes(y.id)) - Number(st.titleDone(x) && !st.save.extra.titles.claimed.includes(x.id)));
    return h(
      'div',
      { class: 'titles enter' },
      h('div', { class: 'attend-head' }, h('span', null, '조건을 채우면 코인을 받고, 고른 칭호는 로비에 표시돼요'), h('span', { class: 'gold' }, `지금 칭호: ${eq ? `「${eq.name}」` : '없음'}`)),
      h(
        'div',
        { class: 'title-list' },
        sorted.slice(page * per, page * per + per).map((t) => {
          const p = st.titleProgress(t);
          const done = p.cur >= p.need;
          const claimed = st.save.extra.titles.claimed.includes(t.id);
          const equipped = eq?.id === t.id;
          return h(
            'div',
            { class: 'title-row panel' + (claimed ? ' claimed' : done ? ' ready' : '') },
            h('div', { class: 'tr-text' }, h('b', null, `「${t.name}」`), h('small', null, t.desc)),
            h('div', { class: 'tr-prog' }, bar(p.cur / p.need, done ? '#ffc845' : undefined, 'thin'), h('span', { class: 'num dim' }, `${Math.min(p.cur, p.need)} / ${p.need}`)),
            h('div', { class: 'tr-coin gold' }, svg(I.coin), h('b', { class: 'num' }, fmt(t.coins))),
            !claimed
              ? btn(done ? '받기' : '진행 중', async () => {
                  if (busy) return;
                  busy = true;
                  const n = await st.claimTitle(t.id);
                  audio.sfx('coin');
                  fx.burst(1500, 540, { n: 40, color: ['#ffc845', '#fff'], speed: 500, size: 6, life: 1, shape: 'star' });
                  ui.toast(`칭호 「${t.name}」 획득 · 코인 +${fmt(n)}`, 'gold');
                  setTimeout(() => reopen(), 500);
                }, { cls: 'sm' + (done ? ' primary gold pulse' : ''), disabled: !done })
              : equipped
                ? btn('장착 중', () => {}, { cls: 'sm', disabled: true, icon: I.check })
                : btn('장착', async () => {
                    await st.equipTitle(t.id);
                    reopen();
                  }, { cls: 'sm ghost' }),
          );
        }),
      ),
      h('div', { class: 'rw-pager' }, pager(page, pages, (p) => reopen({ page: p }))),
    );
  }

  function tickets() {
    const list = [...st.availableTickets()].sort((a, b) => Number(!!b.pass) - Number(!!a.pass));
    return h(
      'div',
      { class: 'tickets enter' },
      h('div', { class: 'attend-head' }, h('span', null, '세계관마다 한 장(★4) · 시즌 패스 완주 보상(★5). 골라서 바로 데려와요'), h('span', { class: 'dim' }, '이미 있으면 강화 재료가 돼요')),
      list.length
        ? h(
            'div',
            { class: 'ticket-grid' },
            list.map((tk) => {
              const w = App.content.world(tk.world);
              const c = tk.pass ? '#ffc845' : (w?.color ?? '#ff5fd2');
              const used = st.save.extra.tickets.includes(tk.id);
              return h(
                'div',
                { class: 'ticket panel' + (used ? ' used' : '') + (tk.pass ? ' pass-ticket' : ''), vars: { c } },
                h('div', { class: 'ticket-head' }, h('div', null, h('div', { class: 'eyebrow' }, 'SELECTOR TICKET'), h('b', null, tk.name ?? `${w?.name ?? tk.world} ★${tk.rarity ?? 5} 선택권`)), h('span', { class: 'tag ' + (used ? 'dimmed' : 'gold') }, used ? '사용함' : '1장')),
                h('div', { class: 'ticket-chars' }, st.ticketChoices(tk.id).map((ch) => charCard(ch.id, { size: 'md', owned: true, onClick: used ? undefined : () => confirmTicket(tk.id, ch.id) }))),
                !used ? h('p', { class: 'dim' }, svg(I.fwd), tk.world === 'any' ? ' 모든 세계의 ★5 중 하나 · 캐릭터를 눌러서 고르기' : ' 캐릭터를 눌러서 고르기') : null,
              );
            }),
          )
        : h('p', { class: 'faint', style: { padding: '40px' } }, '아직 열린 세계관 균열이 없어요'),
    );
  }

  async function confirmTicket(ticketId: string, charId: string) {
    if (busy) return;
    const ch = App.content.char(charId);
    const ok = await ui.confirm(`${ch.name}을(를) 데려올까요?\n선택권은 한 번만 쓸 수 있어요.`, '데려오기');
    if (!ok) return;
    busy = true;
    try {
      const r = await st.claimTicket(ticketId, charId);
      const note = r.isNew ? 'NEW · 새 동료 합류' : r.levelUp ? `강화 +${st.save.owned[charId].b}` : r.refund ? `최대 강화 · 코인 +${r.refund}` : '강화 재료 +1';
      await showReveal(charId, { note, tag: r.isNew ? 'NEW' : undefined });
    } catch (e: any) {
      ui.toast(e?.message ?? '실패', 'bad');
    }
    busy = false;
    reopen();
  }

  return { el, back: () => ui.show('Lobby') };
}
