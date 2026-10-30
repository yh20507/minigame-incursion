/** 시즌 패스 · 주간/일일 미션 */
import { App } from '../../core/app';
import { audio } from '../../core/audio';
import type { MissionDef, PassLevel } from '../../core/types';
import { ui, type Screen } from '../app';
import { RC, bar, btn, charCard, itemIcon, topBar } from '../components';
import { fmt, h, svg } from '../dom';
import { fx } from '../fx';
import { I } from '../icons';

const PASS_COL = '#ffc845';

export function passScreen(data: { tab?: 'daily' | 'weekly' }): Screen {
  const st = App.store;
  const p = App.content.pass;
  const tab = data?.tab ?? (st.content.pass.daily.some((m) => st.missionProgress(m).ready) || !st.content.pass.weekly.some((m) => st.missionProgress(m).ready) ? 'daily' : 'weekly');
  const reopen = (o: Partial<typeof data> = {}) => ui.show('Pass', { tab, ...o }, { instant: true });
  let busy = false;

  const lv = st.passLevel();
  const xpIn = st.passXpInLevel();
  const claimable = st.passClaimable();
  const daysLeft = Math.max(0, Math.ceil((Date.parse(p.end) - Date.now()) / 86400000));

  // ---------- 왼쪽: 레벨 트랙
  const track = h(
    'div',
    { class: 'pass-track' },
    p.levels.map((l, i) => {
      const got = st.save.extra.pass.claimed.includes(l.lv);
      const open = l.lv <= lv;
      const big = !!l.ticket || l.lv % 10 === 0;
      return h(
        'button',
        {
          class: 'pass-node' + (got ? ' got' : open ? ' ready' : '') + (big ? ' big' : '') + (l.lv === lv + 1 ? ' next' : ''),
          style: { animationDelay: i * 18 + 'ms' },
          onclick: () => (open && !got ? claim(l) : ui.toast(got ? '이미 받았어요' : `레벨 ${l.lv}에 열려요 (XP ${l.lv * p.xpPerLevel - st.save.extra.pass.xp} 남음)`)),
          onpointerenter: () => audio.sfx('select'),
        },
        h('span', { class: 'pn-lv num' }, String(l.lv)),
        h('div', { class: 'pn-reward' }, rewardIcon(l)),
        h('small', { class: 'pn-label' }, rewardLabel(l)),
        got ? h('span', { class: 'pn-check' }, svg(I.check)) : open ? h('span', { class: 'pn-dot' }) : h('span', { class: 'pn-lock' }, svg(I.lock)),
      );
    }),
  );
  // 다음 레벨 근처로 스크롤
  setTimeout(() => {
    const n = track.querySelector('.pass-node.next, .pass-node.ready') as HTMLElement | null;
    if (n) track.scrollLeft = Math.max(0, n.offsetLeft - track.clientWidth / 2 + n.offsetWidth / 2);
  }, 50);

  const head = h(
    'div',
    { class: 'pass-head panel pad' },
    h('div', { class: 'pass-emblem' }, svg(I.crown)),
    h(
      'div',
      { class: 'pass-head-text' },
      h('div', { class: 'eyebrow' }, p.sub),
      h('h2', null, p.name),
      h('p', { class: 'dim' }, `주간·일일 미션으로 XP를 모아 레벨을 올려요 · 마지막 레벨에서 `, h('b', { style: { color: RC[5] } }, '★5 선택권'), ` · 시즌 종료까지 ${daysLeft}일`),
    ),
    h(
      'div',
      { class: 'pass-level' },
      h('div', { class: 'pl-top' }, h('span', { class: 'eyebrow' }, 'LEVEL'), h('b', { class: 'num' }, String(lv)), h('small', { class: 'dim num' }, `/ ${p.maxLevel}`)),
      bar(xpIn / p.xpPerLevel, PASS_COL),
      h('div', { class: 'pl-xp num dim' }, lv >= p.maxLevel ? 'MAX' : `${xpIn} / ${p.xpPerLevel} XP`),
    ),
    claimable.length
      ? btn(`전부 받기 (${claimable.length})`, claimAll, { cls: 'primary gold pulse', icon: I.gift })
      : h('div', { class: 'pass-noclaim dim' }, '받을 보상이 생기면 여기서 모아 받을 수 있어요'),
  );

  // ---------- 오른쪽: 미션
  const list = tab === 'daily' ? p.daily : p.weekly;
  const reset = tab === 'daily' ? '매일 0시 초기화' : '매주 월요일 초기화';
  const missions = h(
    'aside',
    { class: 'pass-missions panel' },
    h(
      'div',
      { class: 'pm-tabs' },
      (['daily', 'weekly'] as const).map((t) => {
        const n = (t === 'daily' ? p.daily : p.weekly).filter((m) => st.missionProgress(m).ready).length;
        return h('button', { class: 'pm-tab' + (t === tab ? ' on' : ''), onclick: () => reopen({ tab: t }) }, t === 'daily' ? '일일 미션' : '주간 미션', n ? h('i', { class: 'badge' }, String(n)) : null);
      }),
    ),
    h('div', { class: 'pm-reset dim' }, svg(I.clock), ' ', reset),
    h(
      'div',
      { class: 'pm-list' },
      list.map((m, i) => missionRow(m, i)),
    ),
  );

  function missionRow(m: MissionDef, i: number) {
    const pr = st.missionProgress(m);
    return h(
      'div',
      { class: 'pm-row' + (pr.done ? ' done' : pr.ready ? ' ready' : ''), style: { animationDelay: i * 40 + 'ms' } },
      h('div', { class: 'pm-text' }, h('b', null, m.name), h('div', { class: 'pm-prog' }, bar(pr.cur / pr.need, pr.ready || pr.done ? PASS_COL : undefined, 'thin'), h('span', { class: 'num dim' }, `${fmt(pr.cur)} / ${fmt(pr.need)}`))),
      h('div', { class: 'pm-xp' }, h('b', { class: 'num' }, `+${m.xp}`), h('small', null, 'XP')),
      pr.done
        ? h('span', { class: 'pm-done' }, svg(I.check))
        : btn(pr.ready ? '받기' : '진행 중', () => claimMission(m), { cls: 'sm' + (pr.ready ? ' primary gold pulse' : ''), disabled: !pr.ready }),
    );
  }

  async function claimMission(m: MissionDef) {
    if (busy) return;
    busy = true;
    try {
      const xp = await st.claimMission(m.id);
      audio.sfx('coin');
      fx.burst(1400, 400, { n: 30, color: [PASS_COL, '#fff'], speed: 450, size: 5, life: 0.9, shape: 'star' });
      const nl = st.passLevel();
      ui.toast(nl > lv ? `레벨 업! Lv.${nl} · XP +${xp}` : `XP +${xp}`, 'gold');
      if (nl > lv) audio.sfx('legend');
    } catch (e: any) {
      ui.toast(e?.message ?? '실패', 'bad');
    }
    busy = false;
    reopen();
  }

  async function claim(l: PassLevel) {
    if (busy) return;
    busy = true;
    try {
      await st.claimPassLevel(l.lv);
      audio.sfx(l.ticket ? 'ultra' : 'coin');
      fx.burst(700, 760, { n: l.ticket ? 120 : 36, color: l.ticket ? ['#ff5fd2', '#5fd3e0', PASS_COL, '#fff'] : [PASS_COL, '#fff'], speed: l.ticket ? 900 : 480, size: 6, life: 1.2, shape: l.ticket ? 'shard' : 'star' });
      ui.toast(`Lv.${l.lv} 보상 · ${rewardLabel(l)}`, 'gold');
      if (l.ticket) {
        ui.modal({
          title: '★5 선택권 획득!',
          body: h('p', null, '보상 › 선택권 탭에서 원하는 ★5 하나를 골라 데려올 수 있어요.'),
          buttons: [{ label: '보러 가기', primary: true, onClick: () => ui.show('Rewards', { tab: 'tickets' }) }, { label: '나중에' }],
        });
      }
    } catch (e: any) {
      ui.toast(e?.message ?? '실패', 'bad');
    }
    busy = false;
    reopen();
  }

  async function claimAll() {
    if (busy) return;
    busy = true;
    const got = st.passClaimable();
    let coins = 0;
    let ticket = false;
    for (const l of got) {
      try {
        await st.claimPassLevel(l.lv);
        coins += l.coins ?? 0;
        ticket ||= !!l.ticket;
      } catch {}
    }
    audio.sfx(ticket ? 'ultra' : 'coin');
    fx.burst(700, 760, { n: 80, color: [PASS_COL, '#fff', '#ff5fd2'], speed: 700, size: 6, life: 1.2, shape: 'star' });
    ui.toast(`${got.length}개 보상 수령${coins ? ` · 코인 +${fmt(coins)}` : ''}${ticket ? ' · ★5 선택권!' : ''}`, 'gold');
    busy = false;
    reopen();
  }

  const el = h(
    'div',
    { class: 'pass' },
    topBar('시즌 패스', { back: () => ui.show('Lobby'), color: PASS_COL, sub: `${p.sub} · ${p.name} · ~${p.end.replace(/-/g, '.')}` }),
    h(
      'div',
      { class: 'pass-body' },
      h(
        'div',
        { class: 'pass-left enter' },
        head,
        h('div', { class: 'pass-track-wrap panel' }, h('div', { class: 'pt-head' }, h('span', { class: 'eyebrow' }, 'REWARD TRACK'), h('span', { class: 'dim' }, '레벨마다 보상 · 눌러서 받기')), track),
        h(
          'div',
          { class: 'pass-info' },
          h(
            'div',
            { class: 'panel' },
            h('span', { class: 'eyebrow' }, 'HOW TO EARN XP'),
            h(
              'ul',
              { class: 'pi-list' },
              h('li', null, h('b', null, `+${p.daily.reduce((a, m) => a + m.xp, 0)} XP`), '일일 미션 전부 (매일 0시 새로)'),
              h('li', null, h('b', null, `+${p.weekly.reduce((a, m) => a + m.xp, 0)} XP`), '주간 미션 전부 (월요일 새로)'),
              h('li', null, h('b', null, `${p.xpPerLevel} XP`), `= 1 레벨 · 최대 ${p.maxLevel} 레벨`),
              h('li', null, h('b', null, '완주'), `≈ 매일 일일 미션 + 주간 미션 ${Math.ceil((p.maxLevel * p.xpPerLevel) / (p.weekly.reduce((a, m) => a + m.xp, 0) + 7 * p.daily.reduce((a, m) => a + m.xp, 0)))}주`),
            ),
          ),
          h(
            'div',
            { class: 'panel', vars: { c: RC[5] } },
            h('span', { class: 'eyebrow' }, 'FINAL REWARD · ★5 SELECTOR'),
            h('p', { class: 'dim', style: { margin: '0', fontSize: '14px' } }, `레벨 ${p.maxLevel} 보상. 모든 세계의 ★5 중 하나를 골라 데려와요.`),
            h('div', { class: 'pi-feat' }, App.content.chars.filter((c) => c.rarity === 5 && c.pool).slice(0, 7).map((c) => charCard(c.id, { size: 'sm', owned: true }))),
          ),
        ),
      ),
      missions,
    ),
  );
  return { el, back: () => ui.show('Lobby') };
}

function rewardIcon(l: PassLevel) {
  if (l.ticket) return h('span', { class: 'pn-ticket', vars: { c: RC[5] } }, svg(I.ticket));
  if (l.items) return itemIcon(Object.keys(l.items)[0]);
  if (l.skinShards) return h('span', { class: 'pn-skin' }, svg(I.shard));
  return h('span', { class: 'pn-coin' }, svg(I.coin));
}
function rewardLabel(l: PassLevel) {
  if (l.ticket) return '★5 선택권';
  const parts: string[] = [];
  if (l.items) parts.push(...Object.entries(l.items).map(([id, n]) => `${App.content.item(id)?.name ?? id}${n > 1 ? ' ×' + n : ''}`));
  if (l.skinShards) parts.push(`의상 조각 ${l.skinShards}`);
  if (l.coins) parts.push(`${fmt(l.coins)} 코인`);
  return parts.join(' · ');
}
