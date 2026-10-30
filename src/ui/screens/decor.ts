/** 로비 꾸미기: 캐릭터 · 배경 · 음악 · 색 */
import { App } from '../../core/app';
import { audio } from '../../core/audio';
import { ACCENTS, applyAccent, lobbyMusicName, playLobbyMusic } from '../../core/lobby';
import type { LobbyConfig } from '../../core/types';
import { artIsFile, artUrl, bgArt, ui, type Screen } from '../app';
import { RC, btn, charCard, pager, tabs, topBar } from '../components';
import { h, svg } from '../dom';
import { I } from '../icons';

type Tab = 'char' | 'bg' | 'music' | 'color';
type BgItem = LobbyConfig['bgs'][number];

export function decorScreen(data: { tab?: Tab; page?: number }): Screen {
  const st = App.store;
  const lb = st.save.extra.lobby;
  const tab: Tab = data?.tab ?? 'char';
  const page = data?.page ?? 0;
  const save = () => st.saveMeta();
  const reopen = (o: Partial<typeof data> = {}) => ui.show('Decor', { tab, page, ...o }, { instant: true });

  const body = h('div', { class: 'decor-body' });
  if (tab === 'char') body.appendChild(charTab());
  if (tab === 'bg') body.appendChild(bgTab());
  if (tab === 'music') body.appendChild(musicTab());
  if (tab === 'color') body.appendChild(colorTab());

  const el = h(
    'div',
    { class: 'decor' },
    topBar('로비 꾸미기', { back: () => ui.show('Lobby'), sub: '로비에 세울 캐릭터와 배경, 음악, 강조색', right: [btn('로비에서 보기', () => ui.show('Lobby'), { cls: 'sm', icon: I.home })] }),
    tabs<Tab>([{ id: 'char', label: '캐릭터' }, { id: 'bg', label: '배경 · 슬라이드' }, { id: 'music', label: '음악' }, { id: 'color', label: '강조색' }], tab, (id) => ui.show('Decor', { tab: id }, { instant: true }), 'enter'),
    body,
  );

  // ---------------- 캐릭터
  function charTab() {
    const owned = st.ownedChars().sort((a, b) => b.rarity - a.rarity);
    const per = 24;
    const pages = Math.max(1, Math.ceil(owned.length / per));
    const cur = lb.walkers[0] ?? st.save.team.leader;
    return h(
      'div',
      { class: 'decor-tab enter' },
      h('div', { class: 'decor-head' }, h('span', null, '로비에 서 있을 캐릭터 · ★4·★5는 특별 일러스트가 크게 나와요'), h('span', { class: 'dim' }, `지금: ${App.content.char(cur).name}`), lb.walkers.length ? btn('리더 따라가기', async () => { lb.walkers = []; await save(); reopen(); }, { cls: 'sm ghost' }) : h('span', { class: 'tag dimmed' }, '편성 리더 따라가는 중'), pager(page, pages, (p) => reopen({ page: p }))),
      h(
        'div',
        { class: 'decor-grid' },
        owned.slice(page * per, page * per + per).map((c) =>
          charCard(c.id, {
            size: 'sm',
            selected: c.id === cur,
            onClick: async () => {
              lb.walkers = [c.id];
              await save();
              ui.toast(`로비에 ${c.name}이(가) 서 있어요`, 'good');
              reopen();
            },
          }),
        ),
      ),
    );
  }

  // ---------------- 배경 슬라이드
  function bgTab() {
    const cands: (BgItem & { label: string; color: string; sub: string })[] = [];
    for (const c of st.ownedChars().sort((a, b) => b.rarity - a.rarity)) {
      if (c.rarity >= 4 && artIsFile('full', c.id)) cands.push({ k: 'full', id: c.id, label: c.name, color: RC[c.rarity], sub: '특별 일러스트' });
      else if (c.rarity >= 4) cands.push({ k: 'art', id: c.id, label: c.name, color: RC[c.rarity], sub: '일러스트' });
    }
    for (const d of App.content.domains) if (st.isDomainUnlocked(d)) cands.push({ k: 'bg', id: d.id, label: d.name, color: d.color, sub: '영역 배경' });
    cands.push({ k: 'bg', id: 'rift', label: '균열', color: '#b48cff', sub: '배경' });
    for (const w of st.visibleWorlds()) cands.push({ k: 'bg', id: w.id, label: w.name, color: w.color, sub: '세계관 배경' });
    return h(
      'div',
      { class: 'decor-tab enter' },
      h(
        'div',
        { class: 'decor-head' },
        h('span', null, `로비에 번갈아 보여줄 장면 (최대 5개) · `, h('b', { class: 'num gold' }, `${lb.bgs.length}/5`)),
        h('span', { class: 'dim' }, '캐릭터 일러스트를 고르면 그 캐릭터가 로비에 서요'),
        h('div', { class: 'interval' }, h('span', { class: 'dim' }, '넘기는 간격'), [5, 8, 15, 30].map((sec) => btn(`${sec}초`, async () => { lb.interval = sec; await save(); reopen(); }, { cls: 'sm' + (lb.interval === sec ? ' primary' : ' ghost'), silent: true }))),
      ),
      h(
        'div',
        { class: 'bg-grid' },
        cands.map((it) => {
          const idx = lb.bgs.findIndex((b) => b.k === it.k && b.id === it.id);
          const url = it.k === 'bg' ? bgArt(it.id).url : artUrl(it.k, it.id);
          const pixel = it.k === 'bg' ? bgArt(it.id).pixel : !artIsFile(it.k, it.id);
          return h(
            'button',
            {
              class: 'bg-cell' + (idx >= 0 ? ' on' : ''),
              vars: { c: it.color },
              onclick: async () => {
                audio.sfx('select');
                if (idx >= 0) lb.bgs.splice(idx, 1);
                else if (lb.bgs.length >= 5) return ui.toast('최대 5개까지 고를 수 있어요', 'bad');
                else lb.bgs.push({ k: it.k, id: it.id });
                await save();
                reopen();
              },
            },
            url ? h('img', { src: url, class: pixel ? 'pixel' : '', alt: '' }) : null,
            h('div', { class: 'bg-cell-shade' }),
            h('div', { class: 'bg-cell-text' }, h('b', null, it.label), h('small', null, it.sub)),
            idx >= 0 ? h('div', { class: 'bg-cell-num num' }, String(idx + 1)) : null,
          );
        }),
      ),
    );
  }

  // ---------------- 음악
  function musicTab() {
    const opts: string[] = [''];
    for (const k of audio.files.bgm) opts.push('bgm:' + k);
    for (const c of st.ownedChars()) if (audio.files.chars.has(c.id)) opts.push('char:' + c.id);
    for (const w of App.content.worlds) if (audio.files.worlds.has(w.id)) opts.push('world:' + w.id);
    return h(
      'div',
      { class: 'decor-tab enter' },
      h('div', { class: 'decor-head' }, h('span', null, '로비에서 틀 곡 · 누르면 바로 들려줘요'), h('span', { class: 'dim' }, '짧은 테마곡은 한 번 재생 뒤 기본 곡으로 돌아가요')),
      h(
        'div',
        { class: 'music-wrap' },
        h(
          'div',
          { class: 'music-list' },
          opts.map((o) => {
            const on = lb.bgm === o;
            return h(
              'button',
              {
                class: 'music-row' + (on ? ' on' : ''),
                onclick: async () => {
                  lb.bgm = o;
                  await save();
                  playLobbyMusic();
                  reopen();
                },
              },
              svg(on ? I.play : I.music),
              h('span', null, lobbyMusicName(o)),
              on ? h('span', { class: 'tag hot' }, '재생 중') : null,
            );
          }),
        ),
        h(
          'aside',
          { class: 'panel pad music-help' },
          h('div', { class: 'sec-title' }, h('b', null, '곡 넣는 법')),
          h('p', null, 'exe 옆 ', h('code', null, 'assets/audio'), ' 폴더에 mp3 를 넣고 다시 켜면 여기 나타나요.'),
          h('ul', null, h('li', null, h('code', null, 'bgm/<화면>.mp3'), ' 화면 배경음'), h('li', null, h('code', null, 'chars/<캐릭터id>.mp3'), ' 캐릭터 테마곡 (뽑기 연출·도감)'), h('li', null, h('code', null, 'worlds/<세계관id>.mp3'), ' 세계관 테마곡'), h('li', null, h('code', null, 'bgm/gacha_<세계관id>.mp3'), ' 그 균열 화면 배경음')),
          h('p', { class: 'dim' }, '캐릭터 테마곡은 그 캐릭터를 갖고 있어야 고를 수 있어요.'),
        ),
      ),
    );
  }

  // ---------------- 색
  function colorTab() {
    return h(
      'div',
      { class: 'decor-tab enter' },
      h('div', { class: 'decor-head' }, h('span', null, '메뉴와 강조 요소의 색')),
      h(
        'div',
        { class: 'swatches' },
        ACCENTS.map((col) =>
          h('button', {
            class: 'swatch' + (lb.accent === col ? ' on' : ''),
            style: { background: col },
            onclick: async () => {
              lb.accent = col;
              applyAccent(col);
              ui.accent(col);
              await save();
              audio.sfx('confirm');
              reopen();
            },
          }),
        ),
      ),
      h('div', { class: 'swatch-preview panel pad' }, h('div', { class: 'sec-title' }, h('b', null, '미리보기')), h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, btn('기본 버튼', () => {}, { silent: true }), btn('강조 버튼', () => {}, { cls: 'primary', silent: true }), h('span', { class: 'tag hot' }, 'TAG'), h('span', { class: 'accent', style: { fontSize: '22px', fontWeight: '800' } }, '강조 글자'))),
    );
  }

  return { el, back: () => ui.show('Lobby') };
}
