/** 모험: 조각세계 지도 → 영역 → 준비 → (미니게임) → 결과 */
import { App } from '../../core/app';
import { audio } from '../../core/audio';
import { addShards, currentFrontier, exploreOpen, exploreProgress, frontierOpen, isLanded, landed, markLanded, shardsFor } from '../../core/explore';
import { nextStoryHint, pendingDomainStory, pendingMapStory, rollRecord, storyProgress } from '../../core/storyflow';
import { USABLE, modeInfo } from '../../core/modes';
import type { DomainDef } from '../../core/types';
import type { RunResult } from '../../scenes/Play';
import { bestArt, bgArt, ui, type Screen } from '../app';
import { RC, badge, bar, btn, charImg, itemIcon, stars, topBar } from '../components';
import { countUp, fmt, h, svg, wait } from '../dom';
import { fx } from '../fx';
import { I } from '../icons';
import { teamStrip } from './misc';

// ---------------------------------------------------------------- 지도
export function worldMapScreen(data: { part?: 1 | 2 } = {}): Screen {
  const st = App.store;
  audio.bgm('map', 50, 'dorian', 92);
  const beyond = exploreOpen();
  const pm = pendingMapStory();
  if (pm) {
    // 2부 프롤로그는 지도에 처음 들어올 때 한 번
    setTimeout(() => ui.show('Story', { id: pm, next: 'WorldMap', nextData: { part: 2 } }), 50);
  }
  if ((data.part ?? 1) === 2 && beyond) return beyondMap();
  const doms = App.content.domainsOf(1);
  // 1920×1080 기준 섬 위치
  const POS: Record<string, [number, number]> = { ashen: [430, 420], neon: [960, 300], nebula: [1480, 430] };
  const center: [number, number] = [960, 720];
  const posOf = (d: DomainDef): [number, number] => POS[d.id] ?? [d.mapPos[0] * 3, d.mapPos[1] * 3];

  // 꿰맨 실 (SVG)
  const svgNS = 'http://www.w3.org/2000/svg';
  const lines = document.createElementNS(svgNS, 'svg');
  lines.setAttribute('class', 'map-lines');
  lines.setAttribute('viewBox', '0 0 1920 1080');
  const stitch = (a: [number, number], b: [number, number], on: boolean) => {
    const l = document.createElementNS(svgNS, 'line');
    l.setAttribute('x1', String(a[0]));
    l.setAttribute('y1', String(a[1]));
    l.setAttribute('x2', String(b[0]));
    l.setAttribute('y2', String(b[1]));
    l.setAttribute('class', on ? 'on' : '');
    lines.appendChild(l);
  };
  for (let i = 0; i < doms.length - 1; i++) stitch(posOf(doms[i]), posOf(doms[i + 1]), st.isDomainUnlocked(doms[i + 1]));
  for (const d of doms) stitch(posOf(d), center, st.finalUnlocked());

  const island = (d: DomainDef, i: number) => {
    const open = st.isDomainUnlocked(d);
    const cleared = !!st.save.cleared[d.id];
    const [x, y] = posOf(d);
    const bgA = bgArt(d.id);
    const bgUrl = bgA.url;
    const s = st.domainStars(d.id);
    const max = d.games.length * 3;
    const status = cleared ? '해방됨' : st.bossUnlocked(d.id) ? '보스 도전 가능' : open ? '탐험 중' : `${d.unlockAfter ? App.content.domainName(d.unlockAfter) : ''} 해방 후`;
    return h(
      'button',
      {
        class: 'island enter' + (open ? '' : ' locked') + (cleared ? ' cleared' : ''),
        vars: { c: d.color, i },
        style: { left: x + 'px', top: y + 'px', ['--i' as any]: String(i) },
        onclick: () => {
          if (!open) {
            audio.sfx('cancel');
            return ui.toast('아직 열리지 않은 영역이에요', 'bad');
          }
          audio.sfx('confirm');
          const arrive = d.id + '_arrive';
          if (!st.save.story[arrive]) ui.show('Story', { id: arrive, next: 'Domain', nextData: { id: d.id } });
          else ui.show('Domain', { id: d.id });
        },
      },
      h('div', { class: 'island-card float', style: { animationDelay: i * 0.7 + 's' } }, h('div', { class: 'island-img' + (bgA.pixel ? ' pixel' : ''), style: bgUrl ? { backgroundImage: `url(${bgUrl})` } : {} }), h('div', { class: 'island-shade' }), !open ? h('div', { class: 'island-lock' }, svg(I.lock)) : null, h('div', { class: 'island-text' }, h('div', { class: 'eyebrow' }, open ? d.subtitle : 'LOCKED'), h('b', null, open ? d.name : '???'), open ? h('div', { class: 'island-stars' }, svg(I.star), h('span', { class: 'num' }, `${s} / ${max}`)) : null), h('div', { class: 'island-status ' + (cleared ? 'good' : st.bossUnlocked(d.id) ? 'hot' : '') }, status)),
      h('div', { class: 'island-pin' }),
    );
  };

  const open = st.finalUnlocked();
  const done = !!st.save.cleared['final'];
  const centerNode = h(
    'button',
    {
      class: 'rift-node enter' + (open ? ' open' : ''),
      style: { left: center[0] + 'px', top: center[1] + 'px' },
      onclick: () => {
        if (!open) {
          audio.sfx('cancel');
          return ui.toast('세 영역을 모두 해방하면 열려요', 'bad');
        }
        audio.sfx('confirm');
        const playData = { mode: 'final', domain: 'rift' };
        if (!st.save.story['final_boss']) ui.show('Story', { id: 'final_boss', next: 'Prep', nextData: playData });
        else ui.show('Prep', playData);
      },
    },
    h('div', { class: 'rift-core' }, h('i'), h('i'), svg(open ? I.rift : I.lock)),
    h('div', { class: 'rift-label' }, h('b', null, open ? (done ? '중심부 · 놀이터' : '조각세계의 중심') : '???'), h('small', null, open ? (done ? '설계자와 다시 놀기' : '최종장 · 설계자') : '세 영역 해방 후')),
  );

  let frontier: HTMLElement | null = null;
  if (exploreOpen()) {
    const f = currentFrontier();
    const p = exploreProgress();
    frontier = h(
      'button',
      { class: 'frontier-node enter', style: { left: '1700px', top: '760px' }, vars: { c: f.color }, onclick: () => ui.show('Expedition') },
      h('div', { class: 'fn-fog' }),
      h('div', { class: 'fn-q' }, landed() ? '◆' : '?'),
      h('div', { class: 'rift-label' }, h('b', null, p >= 0.5 ? f.name : '균열 너머'), h('small', null, landed() ? '상륙 완료' : `탐사 ${Math.round(p * 100)}%`)),
    );
  }

  const leader = st.save.team.leader;
  const last = [...doms].reverse().find((d) => st.isDomainUnlocked(d)) ?? doms[0];
  const [lx, ly] = posOf(last);
  const avatar = h('div', { class: 'map-avatar float', style: { left: lx - 150 + 'px', top: ly - 60 + 'px' } }, charImg(leader, 'sprite', { class: 'pixel' }));

  const el = h(
    'div',
    { class: 'worldmap' },
    topBar('조각세계', { back: () => ui.show('Lobby'), sub: '꿰매어진 세 영역과 그 중심', right: [h('div', { class: 'star-pill' }, svg(I.star), h('b', { class: 'num' }, String(st.totalStars())))] }),
    lines as unknown as HTMLElement,
    ...doms.map(island),
    centerNode,
    frontier,
    avatar,
    h('div', { class: 'map-foot enter' }, btn('편성', () => ui.show('Team', { back: { scene: 'WorldMap' } }), { cls: 'sm ghost', icon: I.team }), btn('도전', () => (st.modeUnlocked('micro') ? ui.show('Challenge') : ui.toast('잿빛 왕관을 해방하면 열려요')), { cls: 'sm ghost', icon: I.bolt })),
    beyond ? mapTabs(1) : null,
  );
  return { el, back: () => ui.show('Lobby') };
}

function mapTabs(cur: 1 | 2) {
  return h(
    'div',
    { class: 'map-tabs enter' },
    h('button', { class: 'map-tab' + (cur === 1 ? ' on' : ''), onclick: () => ui.show('WorldMap', { part: 1 }, { instant: true }) }, svg(I.map), ' 조각세계'),
    h('button', { class: 'map-tab' + (cur === 2 ? ' on' : ''), onclick: () => ui.show('WorldMap', { part: 2 }, { instant: true }) }, svg(I.compass), ' 균열 너머'),
  );
}

/** 2부 지도: 균열 너머 대륙들 */
function beyondMap(): Screen {
  const st = App.store;
  const doms = App.content.domainsOf(2);
  const POS: Record<string, [number, number]> = { frost: [330, 330], abyss: [700, 620], sky: [1060, 280], glass: [1420, 560], paper: [1680, 260], library: [1130, 790] };
  const posOf = (d: DomainDef): [number, number] => POS[d.id] ?? [d.mapPos[0], d.mapPos[1]];
  const svgNS = 'http://www.w3.org/2000/svg';
  const lines = document.createElementNS(svgNS, 'svg');
  lines.setAttribute('class', 'map-lines');
  lines.setAttribute('viewBox', '0 0 1920 1080');
  const stitch = (a: [number, number], b: [number, number], on: boolean) => {
    const l = document.createElementNS(svgNS, 'line');
    l.setAttribute('x1', String(a[0]));
    l.setAttribute('y1', String(a[1]));
    l.setAttribute('x2', String(b[0]));
    l.setAttribute('y2', String(b[1]));
    l.setAttribute('class', on ? 'on' : '');
    lines.appendChild(l);
  };
  for (let i = 0; i < doms.length - 1; i++) stitch(posOf(doms[i]), posOf(doms[i + 1]), st.isDomainUnlocked(doms[i + 1]));
  const cur = currentFrontier();
  const node = (d: DomainDef, i: number) => {
    const open = st.isDomainUnlocked(d);
    const here = isLanded(d.id);
    const cleared = !!st.save.cleared[d.id];
    const isCur = cur.id === d.id && !here;
    const p = isCur ? exploreProgress(cur) : 0;
    const known = here || (isCur && frontierOpen(cur) && p >= 0.5);
    const [x, y] = posOf(d);
    const bgA = bgArt(d.id);
    const s = d.final ? 0 : st.domainStars(d.id);
    const max = d.final ? 0 : d.games.length * 3;
    const sp = storyProgress(d.id);
    const status = cleared ? '해방됨' : open ? (d.final ? '마지막 장' : st.bossUnlocked(d.id) ? '보스 도전 가능' : '탐험 중') : here ? '상륙 완료' : isCur ? (frontierOpen(cur) ? `탐사 ${Math.round(p * 100)}%` : `${App.content.domainName(cur.unlockAfter)} 해방 후`) : '미발견';
    return h(
      'button',
      {
        class: 'island beyond enter' + (open ? '' : ' locked') + (cleared ? ' cleared' : '') + (d.final ? ' final' : ''),
        vars: { c: d.color, i },
        style: { left: x + 'px', top: y + 'px', ['--i' as any]: String(i) },
        onclick: () => {
          if (!open) {
            audio.sfx('select');
            if (isCur) return ui.show('Expedition');
            return ui.toast(here ? '이전 대륙을 먼저 해방하세요' : '아직 발견하지 못한 대륙이에요', 'bad');
          }
          audio.sfx('confirm');
          ui.show('Domain', { id: d.id });
        },
      },
      h('div', { class: 'island-card float', style: { animationDelay: i * 0.7 + 's' } }, h('div', { class: 'island-img' + (bgA.pixel ? ' pixel' : ''), style: bgA.url ? { backgroundImage: `url(${bgA.url})` } : {} }), h('div', { class: 'island-shade' }), !open ? h('div', { class: 'island-lock' }, isCur ? h('span', { class: 'fn-q' }, '?') : svg(I.lock)) : null, h('div', { class: 'island-text' }, h('div', { class: 'eyebrow' }, known ? d.subtitle : 'UNKNOWN'), h('b', null, known ? d.name : '???'), open && !d.final ? h('div', { class: 'island-stars' }, svg(I.star), h('span', { class: 'num' }, `${s} / ${max}`), h('span', { class: 'dim', style: { marginLeft: '12px', fontSize: '14px' } }, `이야기 ${sp.seen}/${sp.total}`)) : null), h('div', { class: 'island-status ' + (cleared ? 'good' : open && (d.final || st.bossUnlocked(d.id)) ? 'hot' : '') }, status)),
      h('div', { class: 'island-pin' }),
    );
  };
  const leader = st.save.team.leader;
  const last = [...doms].reverse().find((d) => st.isDomainUnlocked(d)) ?? doms[0];
  const [lx, ly] = posOf(last);
  const avatar = h('div', { class: 'map-avatar float', style: { left: lx - 150 + 'px', top: ly - 60 + 'px' } }, charImg(leader, 'sprite', { class: 'pixel' }));
  const el = h(
    'div',
    { class: 'worldmap beyond-map' },
    topBar('균열 너머', { back: () => ui.show('Lobby'), sub: '2부 · 닫히지 않은 책 — 원정대가 찾아낸 대륙들', right: [h('div', { class: 'star-pill' }, svg(I.star), h('b', { class: 'num' }, String(st.totalStars())))] }),
    lines as unknown as HTMLElement,
    ...doms.map(node),
    avatar,
    h('div', { class: 'map-foot enter' }, btn('원정대', () => ui.show('Expedition'), { cls: 'sm ghost', icon: I.compass }), btn('편성', () => ui.show('Team', { back: { scene: 'WorldMap', data: { part: 2 } } }), { cls: 'sm ghost', icon: I.team })),
    mapTabs(2),
  );
  return { el, back: () => ui.show('Lobby') };
}

// ---------------------------------------------------------------- 영역
export function domainScreen(data: { id: string }): Screen {
  const st = App.store;
  const d = App.content.domain(data.id)!;
  const pend = pendingDomainStory(d.id);
  if (pend) setTimeout(() => ui.show('Story', { id: pend, next: 'Domain', nextData: { id: d.id } }), 30);
  audio.bgm(d.id, d.music.root, d.music.scale, d.music.tempo);
  const gk = App.content.char(d.gatekeeper);
  const unlocked = st.bossUnlocked(d.id);
  const cleared = !!st.save.cleared[d.id];
  const cfg = App.content.challenges.boss;
  const gkArt = bestArt(gk.id);

  const games = d.games.map((gid, i) => {
    const g = App.content.game(gid);
    const rec = st.save.scores[gid];
    return h(
      'button',
      { class: 'game-card panel enter' + (App.content.playable(gid) ? '' : ' soon'), vars: { c: d.color }, style: { ['--i' as any]: String(i) }, onclick: () => { if (!App.content.playable(gid)) return ui.toast('준비 중인 미니게임이에요'); audio.sfx('confirm'); ui.show('Prep', { mode: 'normal', game: gid, domain: d.id }); } },
      h('div', { class: 'gc-head' }, h('span', { class: 'tag' }, g.genre), stars(rec?.stars ?? 0, 3, 16)),
      h('h3', null, g.name),
      h('p', null, g.rule),
      h('div', { class: 'gc-foot' }, h('span', { class: rec ? 'num' : 'faint' }, rec ? `최고 ${fmt(rec.best)}${rec.hardBest ? ` · H ${fmt(rec.hardBest)}` : ''}` : '도전 전'), h('span', { class: 'gc-go' }, svg(I.play), ' 플레이')),
      st.hardUnlocked(gid) ? h('span', { class: 'tag hard gc-hard' }, 'HARD') : null,
    );
  });

  const boss = h(
    'section',
    { class: 'boss-card panel enter' + (unlocked ? ' open' : '') + (cleared ? ' cleared' : ''), vars: { c: d.color } },
    h('div', { class: 'boss-art ' + (gkArt.kind === 'spr' ? 'is-sprite' : 'is-art') }, h('img', { src: gkArt.url, class: gkArt.pixel ? 'pixel' : '', alt: '' })),
    h(
      'div',
      { class: 'boss-text' },
      h('div', { class: 'eyebrow' }, 'BOSS STAGE'),
      h('h3', null, d.final ? `마지막 장 · ${gk.name}` : `시련의 문지기 · ${gk.name}`),
      h('p', null, d.final ? `아홉 대륙의 규칙이 페이지마다 바뀌는 '페이지 넘기기' ${cfg.segments}장을 읽어 내라. 목숨 ${cfg.lives}개 공유.` : `이 영역의 시련 ${cfg.segments}개를 ${cfg.duration}초씩 연달아 버텨라. 목숨 ${cfg.lives}개 공유.`),
      h('p', { class: cleared ? 'good' : 'gold' }, cleared ? '해방 완료! 다시 도전하면 코인 보상을 받을 수 있다.' : `첫 클리어 보상: ${gk.name} 합류 + ${fmt(cfg.reward)} 코인`),
    ),
    h(
      'div',
      { class: 'boss-side' },
      h('div', { class: 'boss-status ' + (cleared ? 'good' : unlocked ? 'hot' : 'dim') }, cleared ? '해방됨' : unlocked ? '도전 가능!' : `★ ${st.domainStars(d.id)} / ${d.bossStars} 필요`),
      unlocked
        ? btn(cleared ? '다시 도전' : '도전하기', () => { audio.sfx('confirm'); const sid = d.id + '_boss'; const playData = { mode: 'boss', domain: d.id }; if (!st.save.story[sid]) ui.show('Story', { id: sid, next: 'Prep', nextData: playData }); else ui.show('Prep', playData); }, { cls: 'primary' + (cleared ? '' : ' pulse'), color: d.color, icon: I.sword })
        : h('div', { class: 'boss-lockbar' }, bar(st.domainStars(d.id) / d.bossStars, d.color, 'thin'), h('small', { class: 'dim' }, `이 영역에서 별을 ${d.bossStars}개 모으면 도전할 수 있어요`)),
    ),
  );

  const el = h(
    'div',
    { class: 'domain' },
    topBar(d.name, { back: () => ui.show('WorldMap', { part: d.part ?? 1 }), color: d.color, sub: d.subtitle }),
    h('p', { class: 'domain-desc enter' }, d.desc),
    (() => {
      const hint = nextStoryHint(d.id);
      const sp = storyProgress(d.id);
      return hint || sp.total ? h('div', { class: 'story-hint enter' }, svg(I.book), h('b', null, `이야기 ${sp.seen}/${sp.total}`), hint ? h('span', null, hint) : h('span', { class: 'dim' }, '이 영역의 이야기를 전부 봤어요')) : null;
    })(),
    d.final ? null : h('div', { class: 'game-grid' }, games),
    boss,
    teamStrip(d.id, { scene: 'Domain', data: { id: d.id } }),
  );
  return { el, bg: d.id, back: () => ui.show('WorldMap', { part: d.part ?? 1 }) };
}

// ---------------------------------------------------------------- 준비
export function prepScreen(data: { mode?: string; game?: string; domain: string; sel?: string[]; hard?: boolean }): Screen {
  const st = App.store;
  const mode = data.mode ?? 'normal';
  const info = modeInfo(mode, data.domain, data.game);
  const sel = new Set(data.sel ?? []);
  const backTo = (): [string, object] =>
    mode === 'normal' || mode === 'boss' ? ['Domain', { id: mode === 'boss' ? data.domain : App.content.game(data.game!).domain }] : mode === 'final' ? ['WorldMap', {}] : mode === 'landing' ? ['Expedition', {}] : ['Challenge', {}];
  const reopen = () => ui.show('Prep', { ...data, sel: [...sel] }, { instant: true });

  let infoCard: HTMLElement;
  if (mode === 'normal') {
    const g = App.content.game(data.game!);
    const d = App.content.domain(g.domain)!;
    const rec = st.save.scores[g.id];
    const bgA2 = bgArt(d.id);
    const bgU = bgA2.url;
    const hardOpen = st.hardUnlocked(g.id);
    const hard = !!data.hard && hardOpen;
    const thresholds = hard ? st.hardStars(g.id) : g.stars;
    infoCard = h(
      'section',
      { class: 'prep-info panel pad enter' + (hard ? ' hard' : ''), vars: { c: hard ? '#ff4b6e' : info.color } },
      h('div', { class: 'prep-art' + (bgA2.pixel ? ' pixel' : ''), style: bgU ? { backgroundImage: `url(${bgU})` } : {} }),
      h('div', { class: 'eyebrow' }, `${d.name} · ${g.genre}`),
      h('h2', null, g.name, hard ? h('span', { class: 'tag hard' }, 'HARD') : null),
      h('p', { class: 'prep-rule' }, g.rule),
      h('p', { class: 'prep-ctrl' }, svg(I.info), ' ', g.controls),
      h(
        'div',
        { class: 'mode-switch' },
        btn('보통', () => ui.show('Prep', { ...data, hard: false }, { instant: true }), { cls: 'sm' + (hard ? ' ghost' : ' primary'), silent: true }),
        btn('어려움', () => (hardOpen ? ui.show('Prep', { ...data, hard: true }, { instant: true }) : ui.toast('이 게임에서 ★3을 받으면 열려요')), { cls: 'sm' + (hard ? ' primary' : ' ghost'), color: '#ff4b6e', icon: hardOpen ? I.bolt : I.lock, silent: true, sub: hardOpen ? '코인 ×1.5 · 더 빠름' : '★3 달성 시' }),
      ),
      h('div', { class: 'prep-stars' }, h('span', { class: 'dim' }, hard ? '별 기준 (어려움)' : '별 기준'), thresholds.map((s, i) => h('span', { class: 'prep-star' }, stars(i + 1, i + 1, 14), h('b', { class: 'num' }, fmt(s))))),
      h('div', { class: 'prep-rec' }, rec ? [stars(rec.stars, 3, 18), h('span', null, `최고 ${fmt(rec.best)}점${rec.hardBest ? ` · 어려움 ${fmt(rec.hardBest)}점` : ''} · ${rec.plays}회 플레이`)] : h('span', { class: 'faint' }, '아직 도전하지 않았어요')),
      h('p', { class: 'faint' }, `목숨 ${g.lives}개 · 제한시간 45초${hard ? ' · 어려움: 속도 ↑ 보상 ×1.5' : ''}`),
    );
  } else {
    const bossId = mode === 'boss' ? App.content.domain(data.domain)?.gatekeeper : mode === 'final' ? 'architect' : null;
    const bArt = bossId ? bestArt(bossId) : null;
    infoCard = h(
      'section',
      { class: 'prep-info panel pad enter', vars: { c: info.color } },
      bArt ? h('div', { class: 'prep-art char' }, h('img', { src: bArt.url, class: bArt.pixel ? 'pixel' : '', alt: '' })) : null,
      h('div', { class: 'eyebrow' }, info.sub),
      h('h2', null, info.title),
      h('ul', { class: 'prep-lines' }, info.lines.map((l, i) => h('li', { class: i === info.lines.length - 1 ? 'gold' : '' }, l))),
    );
  }

  const itemsRow = h(
    'section',
    { class: 'prep-items panel pad enter' },
    h('div', { class: 'sec-title' }, h('b', null, '아이템 사용'), h('span', null, '눌러서 고르기 · 시작할 때 하나씩 소모')),
    h(
      'div',
      { class: 'prep-item-row' },
      USABLE.map((id) => {
        const it = App.content.item(id)!;
        const n = st.itemCount(id);
        const on = sel.has(id);
        return h(
          'button',
          { class: 'prep-item' + (on ? ' on' : '') + (n ? '' : ' none'), vars: { c: it.color }, title: it.desc, onclick: () => { if (!n) return ui.toast(it.desc); audio.sfx('select'); if (on) sel.delete(id); else sel.add(id); reopen(); } },
          itemIcon(id),
          h('b', null, it.name),
          h('small', { class: n ? 'gold num' : 'faint' }, `${n}개`),
          on ? h('i', { class: 'prep-item-check' }, svg(I.check)) : null,
        );
      }),
    ),
  );

  const start = async () => {
    const used = await st.useItems([...sel]);
    ui.startPlay({ mode, game: data.game, domain: data.domain, items: used.map((u) => u.id), hard: !!data.hard && mode === 'normal' && st.hardUnlocked(data.game!) });
  };
  const bgKey = mode === 'normal' ? App.content.game(data.game!).domain : mode === 'boss' ? data.domain : 'rift';
  const el = h(
    'div',
    { class: 'prep' },
    topBar(info.title, { back: () => ui.show(...backTo()), color: info.color, sub: mode === 'normal' ? '미니게임 준비' : info.sub }),
    h('div', { class: 'prep-body' }, h('div', { class: 'prep-left' }, infoCard, itemsRow), h('div', { class: 'prep-right' }, teamStrip(mode === 'normal' ? App.content.game(data.game!).domain : mode === 'boss' ? data.domain : null, { scene: 'Prep', data }), btn('시작!', start, { cls: 'big primary wide start-btn pulse', color: info.color, icon: I.play, sub: 'SPACE / ENTER' }))),
  );
  return { el, bg: bgKey, back: () => ui.show(...backTo()), primary: start };
}

// ---------------------------------------------------------------- 결과
export function resultScreen(r: RunResult): Screen {
  const st = App.store;
  const ch = App.content.challenges;
  audio.stopBgm();
  const bgKey = r.mode === 'normal' || r.mode === 'boss' ? (r.mode === 'boss' ? r.domain : App.content.game(r.game ?? r.segments[0]?.game ?? 'jump').domain) : 'rift';

  const titleEl = h('h1', { class: 'res-title' });
  const scoreEl = h('div', { class: 'res-score num' }, '0');
  const starsBox = h('div', { class: 'res-stars' });
  const coinEl = h('div', { class: 'res-coins' });
  const linesEl = h('ul', { class: 'res-lines' });
  const joinBox = h('div', { class: 'res-join' });
  const btns = h('div', { class: 'res-btns' });
  const el = h('div', { class: 'result' }, h('div', { class: 'res-card panel' }, h('div', { class: 'eyebrow res-label' }, 'RESULT'), titleEl, h('div', { class: 'res-score-label dim' }, '점수'), scoreEl, starsBox, coinEl, linesEl, btns), joinBox);
  let next: { key: string; data?: object } = { key: 'WorldMap' };
  let retry: { key: string; data?: object } | null = null;

  (async () => {
    let title = '';
    let titleCls = '';
    let scoreLabel = '점수';
    const lines: { t: string; c?: string }[] = [];
    let coins = 0;
    let starsN = -1;
    let newBest = false;
    let joined: string | null = null;
    const boost = (n: number) => Math.floor(n * (1 + (r.coinPct ?? 0) / 100));

    switch (r.mode) {
      case 'normal': {
        const g = App.content.game(r.game!);
        const res = await st.recordResult(g.id, r.score, g.domain, r.coinPct, !!r.hard);
        title = (r.hard ? '[어려움] ' : '') + (r.success ? '타임 업!' : '게임 오버');
        titleCls = r.success ? 'good' : 'bad';
        coins = res.coins;
        starsN = res.stars;
        newBest = res.newBest;
        if (res.newStars) lines.push({ t: `새 별 ${res.newStars}개! (+${res.newStars * 100} 코인 포함)`, c: 'gold' });
        lines.push({ t: `최고 기록 ${fmt(res.best)}`, c: 'dim' });
        if (res.coinBonus) lines.push({ t: `편성 코인 보너스 +${res.coinBonus}%`, c: 'good' });
        const d = App.content.domain(g.domain)!;
        const rec = rollRecord(d.id, !!r.hard, r.success);
        if (rec) {
          await st.saveMeta();
          lines.push({ t: `기록 조각 발견 · 「${rec.title}」 (도감 › 기록)`, c: 'gold' });
        }
        if (st.bossUnlocked(d.id) && !st.save.cleared[d.id]) lines.push({ t: `${d.name}의 보스 스테이지에 도전할 수 있어요!`, c: 'accent' });
        next = { key: 'Domain', data: { id: g.domain } };
        retry = { key: 'Prep', data: { mode: 'normal', game: g.id, domain: g.domain, hard: !!r.hard } };
        break;
      }
      case 'boss':
      case 'final': {
        const isFinal = r.mode === 'final';
        const key = isFinal ? 'final' : r.domain;
        const cfg = isFinal ? ch.final : ch.boss;
        if (r.success) {
          const first = await st.markCleared(key);
          title = isFinal ? '설계자와의 놀이, 승리!' : App.content.domain(r.domain)?.final ? '마지막 장을 읽어 냈다!' : '문지기 해방!';
          titleCls = 'gold';
          coins = boost(first ? cfg.reward : Math.round(cfg.reward * 0.2));
          await st.addCoins(coins);
          if (first) {
            const gk = isFinal ? 'architect' : App.content.domain(r.domain)!.gatekeeper;
            await st.grant(gk);
            joined = gk;
            const dd = App.content.domain(r.domain);
            next = { key: 'Story', data: { id: isFinal ? 'final_clear' : r.domain + '_clear', next: 'WorldMap', nextData: { part: dd?.part ?? 1 } } };
            if (!isFinal) {
              const nd = App.content.domains.find((d) => d.unlockAfter === r.domain);
              if (nd) lines.push({ t: nd.landing ? `원정대가 다음 대륙 '${nd.name}'의 좌표를 모을 수 있어요!` : `새 영역 '${nd.name}'이(가) 열렸다!`, c: 'accent' });
            }
          } else next = { key: isFinal ? 'WorldMap' : 'Domain', data: isFinal ? {} : { id: r.domain } };
        } else {
          title = '도전 실패...';
          titleCls = 'bad';
          coins = boost(Math.floor(r.score * 0.03));
          await st.addCoins(coins);
          lines.push({ t: '편성을 바꾸거나, 미니게임에서 실력을 쌓고 다시 도전하자.', c: 'dim' });
          next = { key: isFinal ? 'WorldMap' : 'Domain', data: isFinal ? {} : { id: r.domain } };
        }
        retry = { key: 'Prep', data: { mode: r.mode, domain: r.domain } };
        r.segments.forEach((s, i) => lines.push({ t: `${i + 1}. ${App.content.game(s.game).name}  ${fmt(s.score)}점  ${s.passed ? '통과' : '실패'}`, c: s.passed ? '' : 'bad' }));
        break;
      }
      case 'landing': {
        const f = currentFrontier();
        const cfg = ch.landing;
        if (r.success) {
          const first = !landed(f);
          if (first) {
            markLanded(f);
            await st.saveMeta();
          }
          title = '상륙 성공!';
          titleCls = 'gold';
          coins = boost(first ? cfg.reward : Math.round(cfg.reward * 0.1));
          await st.addCoins(coins);
          if (first) lines.push({ t: f.landed, c: 'accent' });
        } else {
          title = '상륙 실패...';
          titleCls = 'bad';
          coins = boost(Math.floor(r.score * 0.03));
          await st.addCoins(coins);
        }
        r.segments.forEach((sg, i) => lines.push({ t: `${i + 1}. ${App.content.game(sg.game).name}  ${fmt(sg.score)}점  ${sg.passed ? '통과' : '실패'}`, c: sg.passed ? '' : 'bad' }));
        next = { key: 'Expedition' };
        retry = { key: 'Prep', data: { mode: 'landing', domain: 'rift' } };
        break;
      }
      case 'micro': {
        title = '번개 모드 종료';
        scoreLabel = '성공한 게임';
        coins = boost(r.microCleared * ch.micro.coinPerClear);
        await st.addCoins(coins);
        newBest = await st.setBest('microBest', r.microCleared);
        lines.push({ t: `최고 기록 ${st.save.extra.microBest}개`, c: 'dim' });
        next = { key: 'Challenge' };
        retry = { key: 'Prep', data: { mode: 'micro', domain: 'rift' } };
        break;
      }
      case 'marathon': {
        title = '마라톤 종료';
        coins = boost(Math.floor(r.score * ch.marathon.coinRate));
        await st.addCoins(coins);
        newBest = await st.setBest('marathonBest', r.score);
        lines.push({ t: `버틴 시련 ${r.segments.filter((s) => s.passed).length}개 · 최고 ${fmt(st.save.extra.marathonBest)}점`, c: 'dim' });
        next = { key: 'Challenge' };
        retry = { key: 'Prep', data: { mode: 'marathon', domain: 'rift' } };
        break;
      }
      case 'daily': {
        const firstClear = await st.updateDaily(r.score, r.success);
        title = r.success ? '오늘의 도전 클리어!' : '오늘의 도전 실패';
        titleCls = r.success ? 'good' : 'bad';
        coins = boost(Math.floor(r.score * 0.05)) + (firstClear ? ch.daily.reward : 0);
        await st.addCoins(coins);
        if (firstClear) lines.push({ t: `첫 클리어 보상 +${ch.daily.reward} 코인`, c: 'gold' });
        lines.push({ t: `규칙: ${r.modifier} · 오늘 최고 ${fmt(st.dailyToday().best)}점`, c: 'dim' });
        next = { key: 'Challenge' };
        retry = { key: 'Prep', data: { mode: 'daily', domain: 'rift' } };
        break;
      }
    }
    const shards = shardsFor(r, Math.max(0, starsN));
    if (shards > 0) {
      await addShards(shards);
      lines.push({ t: `좌표 조각 +${shards}  (탐사 ${Math.round(exploreProgress() * 100)}%)`, c: 'accent' });
    }
    if (r.items?.length) lines.push({ t: '사용한 아이템: ' + r.items.map((i) => App.content.item(i)?.name ?? i).join(', '), c: 'dim' });

    // ---- 화면
    titleEl.textContent = title;
    titleEl.className = 'res-title ' + titleCls;
    el.classList.add('show');
    (el.querySelector('.res-score-label') as HTMLElement).textContent = scoreLabel;
    const scoreV = r.mode === 'micro' ? r.microCleared : r.score;
    countUp(scoreEl, 0, scoreV, Math.min(1200, 300 + scoreV / 4));
    if (newBest) scoreEl.appendChild(h('span', { class: 'res-new' }, 'NEW RECORD'));
    if (starsN >= 0) {
      const row = stars(0, 3, 40);
      starsBox.appendChild(row);
      const ics = row.querySelectorAll('.ico');
      for (let i = 0; i < starsN; i++) setTimeout(() => { ics[i].classList.replace('off', 'on'); ics[i].classList.add('pop'); audio.sfx('star'); fx.burst(960 - 60 + i * 60, 440, { n: 14, color: ['#ffc845', '#fff'], speed: 300, size: 5, life: 0.7, shape: 'star' }); }, 700 + i * 300);
    }
    coinEl.append(svg(I.coin), h('b', { class: 'num' }, `+${fmt(coins)}`), h('span', null, '코인'));
    setTimeout(() => coins && audio.sfx('coin'), 500);
    for (const l of lines.slice(0, 7)) linesEl.appendChild(h('li', { class: l.c ?? '' }, l.t));
    if (joined) {
      const c = App.content.char(joined);
      const art = bestArt(joined);
      joinBox.append(h('div', { class: 'join-art ' + (art.kind === 'spr' ? 'is-sprite' : 'is-art'), vars: { c: RC[c.rarity] } }, h('img', { src: art.url, class: art.pixel ? 'pixel' : '', alt: '' })), h('div', { class: 'join-text' }, badge('JOINED', 'gold'), h('b', null, c.name), h('span', null, '합류!')));
      setTimeout(() => { joinBox.classList.add('show'); audio.sfx('legend'); fx.burst(1450, 500, { n: 60, color: [RC[c.rarity], '#fff'], speed: 700, size: 7, life: 1.3, shape: 'shard' }); }, 900);
    }
    await wait(100);
    if (retry) btns.appendChild(btn('다시 하기', () => ui.show(retry!.key, retry!.data), { cls: 'ghost', icon: I.history }));
    btns.appendChild(btn(next.key === 'Story' ? '계속' : '나가기', () => ui.show(next.key, next.data), { cls: 'primary', icon: next.key === 'Story' ? I.fwd : I.home, sub: 'SPACE' }));
  })();

  return { el, bg: bgKey, primary: () => ui.show(next.key, next.data), back: () => ui.show(next.key, next.data) };
}
