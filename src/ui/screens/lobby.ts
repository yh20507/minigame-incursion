/** 로비: 큰 캐릭터 + 메뉴. 꾸미기로 캐릭터·배경·음악·색을 바꿀 수 있다. */
import { App } from '../../core/app';
import { audio } from '../../core/audio';
import { lobbyMusicName, playLobbyMusic } from '../../core/lobby';
import { currentSeason, unseenNews } from '../../core/news';
import { unreadPersonal } from '../../core/storyflow';
import { bestArt, bgArt, ui, type Screen } from '../app';
import { RC, btn, coinPill, iconBtn, itemIcon, rarityStars, stars } from '../components';
import { fmt, h, svg } from '../dom';
import { fx } from '../fx';
import { I } from '../icons';
import { showNews } from './news';

export function lobbyScreen(): Screen {
  const st = App.store;
  const lb = st.save.extra.lobby;
  ui.accent(lb.accent);
  playLobbyMusic();
  const timers: number[] = [];

  // ---------- 보여줄 장면들 (꾸미기에서 고른 것, 없으면 리더)
  type Scene = { char: string; bg: string };
  const scenes: Scene[] = [];
  for (const b of lb.bgs) {
    if (b.k === 'bg') scenes.push({ char: lb.walkers[0] ?? st.save.team.leader, bg: b.id });
    else if (st.owns(b.id)) scenes.push({ char: b.id, bg: App.content.char(b.id).domain });
  }
  if (!scenes.length) {
    const c = lb.walkers[0] ?? st.save.team.leader;
    scenes.push({ char: c, bg: App.content.char(c).domain });
  }
  let si = 0;

  const stage = h('div', { class: 'lobby-stage' });
  const renderScene = (s: Scene, first: boolean) => {
    const ch = App.content.char(s.char);
    const art = bestArt(s.char);
    const bgA = bgArt(s.bg);
    const bgUrl = bgA.url;
    const bgFile = !bgA.pixel;
    const col = App.content.domainColor(ch.domain);
    const fig = h(
      'div',
      { class: 'lobby-fig ' + (art.kind === 'spr' ? 'is-sprite' : art.kind === 'art' ? 'is-art' : 'is-full'), vars: { c: col, rc: RC[ch.rarity] } },
      h('div', { class: 'fig-glow' }),
      h('img', { src: art.url, class: (art.pixel ? 'pixel ' : '') + 'breathe', alt: '' }),
      h('div', { class: 'fig-floor' }),
    );
    const plate = h(
      'div',
      { class: 'lobby-plate', vars: { c: RC[ch.rarity] } },
      rarityStars(ch.rarity),
      h('b', null, ch.name),
      h('span', null, ch.title),
      h('small', null, App.content.domainName(ch.domain)),
    );
    const bubble = h('div', { class: 'lobby-bubble' });
    fig.addEventListener('click', () => {
      const text = ch.line || `${ch.title}!`;
      bubble.textContent = text;
      bubble.classList.remove('show');
      void bubble.offsetWidth;
      bubble.classList.add('show');
      fig.classList.remove('poke');
      void fig.offsetWidth;
      fig.classList.add('poke');
      if (ch.line) audio.voice(ch.id, ch.line);
      else audio.sfx('text');
      fx.sparkles(fig.offsetLeft + 100, 200, 400, 600, { n: 10, color: [RC[ch.rarity], '#fff'], life: 1.2 });
    });
    const layer = h(
      'div',
      { class: 'lobby-scene' + (first ? ' first' : ''), vars: { c: col } },
      h('div', { class: 'lobby-bg' + (bgFile ? '' : ' pixel'), style: bgUrl ? { backgroundImage: `url(${bgUrl})` } : {} }),
      h('div', { class: 'lobby-rays' }, fx.rays(col)),
      fig,
      plate,
      bubble,
    );
    return layer;
  };
  let cur = renderScene(scenes[0], true);
  stage.appendChild(cur);
  if (scenes.length > 1) {
    timers.push(
      window.setInterval(() => {
        si = (si + 1) % scenes.length;
        const next = renderScene(scenes[si], false);
        stage.appendChild(next);
        const old = cur;
        cur = next;
        old.classList.add('out');
        setTimeout(() => old.remove(), 900);
      }, Math.max(3, lb.interval) * 1000),
    );
  }

  // ---------- 상단
  const season = currentSeason();
  const title = st.equippedTitle();
  const nTitle = st.claimableTitles().length;
  const nTicket = st.availableTickets().filter((t) => !st.save.extra.tickets.includes(t.id)).length;
  const top = h(
    'div',
    { class: 'lobby-top enter' },
    h(
      'div',
      { class: 'player-plate' },
      h('div', { class: 'pp-ico' }, svg(I.user)),
      h(
        'div',
        { class: 'pp-text' },
        h('b', null, title ? `「${title.name}」` : '방랑자'),
        h('span', null, stars(1, 1, 14), ' ', h('i', { class: 'num' }, String(st.totalStars())), '  ·  동료 ', h('i', { class: 'num' }, `${st.ownedChars().length}/${App.content.chars.length}`)),
      ),
    ),
    season
      ? h(
          'button',
          { class: 'season-chip' + (unseenNews() ? ' new' : ''), onclick: () => showNews(true) },
          h('span', { class: 'eyebrow' }, 'SEASON'),
          h('b', null, season.name),
          svg(I.bell),
        )
      : null,
    h('div', { class: 'grow' }),
    h('div', { class: 'shard-pill' }, itemIcon('shard'), h('b', { class: 'num' }, String(st.itemCount('shard')))),
    coinPill(),
    iconBtn(I.gear, () => ui.show('Settings'), { title: '설정' }),
  );

  // ---------- 메뉴
  const explore = !!st.save.cleared['final'];
  const challengeOpen = st.modeUnlocked('micro');
  const rewardSub = nTicket ? `선택권 ${nTicket}장` : nTitle ? `받을 칭호 ${nTitle}개` : '출석 · 칭호';
  const rewardTab = nTicket ? 'tickets' : nTitle ? 'titles' : 'attend';
  const locked = (msg: string) => () => ui.toast(msg);
  function passStrip() {
    const p = App.content.pass;
    const lv = st.passLevel();
    const n = st.passBadge();
    return h(
      'button',
      { class: 'pass-strip enter' + (n ? ' hot' : ''), onclick: () => { audio.sfx('confirm'); ui.show('Pass'); }, onpointerenter: () => audio.sfx('select') },
      h('span', { class: 'ps-ico' }, svg(I.crown)),
      h('span', { class: 'ps-text' }, h('b', null, `시즌 패스 · ${p.name}`), h('small', null, n ? `받을 보상 ${n}개` : '주간·일일 미션 → ★5 선택권')),
      h('span', { class: 'ps-lv' }, h('small', null, 'Lv'), h('b', { class: 'num' }, String(lv)), h('i', { class: 'ps-bar' }, h('i', { style: { width: (st.passXpInLevel() / p.xpPerLevel) * 100 + '%' } }))),
      n ? h('i', { class: 'badge' }, String(n)) : null,
    );
  }
  const tile = (icon: string, label: string, sub: string, fn: () => void, o: { lock?: boolean; badge?: number; hot?: boolean } = {}) =>
    h(
      'button',
      {
        class: 'tile' + (o.lock ? ' locked' : '') + (o.hot ? ' hot' : ''),
        onclick: () => {
          audio.sfx(o.lock ? 'cancel' : 'confirm');
          fn();
        },
        onpointerenter: () => audio.sfx('select'),
      },
      svg(o.lock ? I.lock : icon, 'tile-ico'),
      h('span', { class: 'tile-text' }, h('b', null, label), h('small', null, sub)),
      o.badge ? h('i', { class: 'badge' }, String(o.badge)) : null,
    );
  const menu = h(
    'nav',
    { class: 'lobby-menu' },
    btn('모험', () => ui.show('WorldMap'), { cls: 'big primary menu-main enter', icon: I.map, sub: '조각세계 지도 · 미니게임' }),
    btn('차원 균열', () => ui.show('Gacha'), { cls: 'big primary menu-main gacha enter' + (st.freePullLeft() && st.freePullBanner() ? ' has-free' : ''), icon: I.rift, sub: st.save.totalPulls === 0 ? '첫 소환 ★4 이상 확정!' : st.freePullLeft() && st.freePullBanner() ? '오늘 무료 소환 1회 남음!' : '소환 · 한정 균열' }),
    st.passActive() ? passStrip() : null,
    h(
      'div',
      { class: 'tile-grid enter' },
      tile(I.book, '도감', unreadPersonal() ? `새 이야기 ${unreadPersonal()}개` : `${st.ownedChars().length}/${App.content.chars.length}`, () => ui.show('Collection'), { badge: unreadPersonal() }),
      tile(I.team, '편성', '팀 · 패시브', () => ui.show('Team', { back: { scene: 'Lobby' } })),
      tile(I.bolt, '도전', challengeOpen ? '번개 · 오늘 · 마라톤' : '잿빛 왕관 해방 후', challengeOpen ? () => ui.show('Challenge') : locked('잿빛 왕관을 해방하면 열려요'), { lock: !challengeOpen }),
      tile(I.compass, '원정대', explore ? '탐사 · 파견' : '최종장 이후', explore ? () => ui.show('Expedition') : locked('최종장을 깨면 열려요'), { lock: !explore }),
      tile(I.gift, '보상', rewardSub, () => ui.show('Rewards', { tab: rewardTab }), { badge: nTitle + nTicket, hot: nTicket > 0 }),
      tile(I.bag, '가방', '아이템', () => ui.show('Bag', { back: 'Lobby' })),
      tile(I.palette, '꾸미기', '캐릭터 · 배경 · 음악', () => ui.show('Decor')),
      tile(I.gear, '설정', '소리 · 저장', () => ui.show('Settings')),
    ),
  );

  const foot = h(
    'div',
    { class: 'lobby-foot enter' },
    h('span', { class: 'now-playing' }, svg(I.music), ' ', lobbyMusicName(lb.bgm)),
    h('span', { class: 'faint' }, '미니게임-인커젼'),
  );

  const el = h('div', { class: 'lobby' }, stage, top, menu, foot);

  // ---------- 출석 → 소식
  st.checkAttendance().then((r) => {
    if (r) attendPopup(r);
    else if (unseenNews()) timers.push(window.setTimeout(() => showNews(false), 600));
  });

  function attendPopup(r: { day: number; coins: number; items: Record<string, number> }) {
    audio.sfx('coin');
    const parts = [
      ...(r.coins ? [h('div', { class: 'reward-chip gold' }, svg(I.coin), h('b', { class: 'num' }, `+${fmt(r.coins)}`))] : []),
      ...Object.entries(r.items).map(([k, n]) => h('div', { class: 'reward-chip' }, itemIcon(k), h('b', null, `${App.content.item(k)?.name ?? k}${n > 1 ? ' ×' + n : ''}`))),
    ];
    const left = 28 - r.day;
    ui.modal({
      cls: 'attend-modal',
      body: h(
        'div',
        { class: 'attend-pop' },
        h('div', { class: 'eyebrow' }, 'DAILY LOGIN'),
        h('div', { class: 'attend-day' }, h('b', { class: 'num' }, String(r.day)), h('span', null, '일째 출석')),
        h('div', { class: 'reward-row' }, parts),
        h('p', { class: 'dim' }, left ? `28일 보상까지 ${left}일` : '이번 주기 개근!'),
      ),
      buttons: [
        { label: '달력 보기', onClick: () => ui.show('Rewards', { tab: 'attend' }) },
        { label: '확인', primary: true },
      ],
      onClose: () => {
        if (unseenNews()) setTimeout(() => showNews(false), 300);
      },
    });
    fx.burst(960, 420, { n: 50, color: ['#ffc845', '#fff'], speed: 500, size: 6, life: 1.2, shape: 'star' });
  }

  return {
    el,
    bg: 'none',
    onLeave: () => timers.forEach((t) => clearTimeout(t)),
  };
}
