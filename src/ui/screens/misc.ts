/** 가방 · 설정 · 도전 */
import { App } from '../../core/app';
import { audio } from '../../core/audio';
import { USABLE, bonusLines } from '../../core/modes';
import { dailySetup } from '../../scenes/Play';
import { ui, type Screen } from '../app';
import { btn, charCard, charImg, itemIcon, topBar } from '../components';
import { fmt, h, svg } from '../dom';
import { I } from '../icons';

// ---------------------------------------------------------------- 가방
export function bagScreen(data: { back?: string }): Screen {
  const st = App.store;
  const back = data?.back ?? 'Lobby';
  const items = App.content.items.filter((i) => i.effect !== 'instant');
  const el = h(
    'div',
    { class: 'bag' },
    topBar('가방', { back: () => ui.show(back), sub: '균열에서 얻은 소모성 아이템' }),
    h(
      'div',
      { class: 'bag-grid' },
      items.map((it, i) => {
        const n = st.itemCount(it.id);
        return h(
          'div',
          { class: 'bag-item panel enter' + (n ? '' : ' empty'), vars: { c: it.color, i }, style: { ['--i' as any]: String(i) } },
          h('div', { class: 'bag-ico' }, itemIcon(it.id)),
          h('div', { class: 'bag-text' }, h('b', null, it.name), h('p', null, it.desc), h('small', { class: 'dim' }, USABLE.includes(it.id) ? '게임 시작 전 준비 화면에서 사용' : it.id === 'shard' ? '도감에서 ★1~★3 동료에게 사용' : '')),
          h('div', { class: 'bag-count' }, h('b', { class: 'num' }, String(n)), h('small', null, '개')),
        );
      }),
    ),
  );
  return { el, back: () => ui.show(back) };
}

// ---------------------------------------------------------------- 설정
export function settingsScreen(): Screen {
  const st = App.store;
  const s = st.save.extra.settings;
  const slider = (label: string, key: 'sfx' | 'bgm' | 'theme', icon: string) => {
    if (s[key] === undefined) s[key] = 0.8;
    const val = h('b', { class: 'num' }, String(Math.round(s[key] * 100)));
    const input = h('input', { type: 'range', class: 'slider', min: '0', max: '100', step: '5', value: String(Math.round(s[key] * 100)) });
    input.addEventListener('input', () => {
      s[key] = Number(input.value) / 100;
      val.textContent = input.value;
      audio.setVolumes(s.sfx, s.bgm, s.theme);
    });
    input.addEventListener('change', () => {
      audio.sfx('select');
      st.setSettings({});
    });
    return h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, svg(icon), h('span', null, label)), input, val);
  };
  const lowfx = h('input', { type: 'checkbox', checked: !!s.lowfx || ui.stage.classList.contains('lowfx') });
  lowfx.addEventListener('change', () => {
    s.lowfx = lowfx.checked;
    ui.setLowFx(lowfx.checked);
    st.setSettings({});
  });
  const el = h(
    'div',
    { class: 'settings' },
    topBar('설정', { back: () => ui.show('Lobby') }),
    h(
      'div',
      { class: 'set-grid' },
      h(
        'section',
        { class: 'panel pad enter' },
        h('div', { class: 'sec-title' }, h('b', null, '소리')),
        slider('효과음', 'sfx', I.volume),
        slider('배경음', 'bgm', I.music),
        slider('테마곡', 'theme', I.sparkle),
        h('div', { class: 'sec-title', style: { marginTop: '22px' } }, h('b', null, '화면')),
        h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, svg(I.expand), h('span', null, '전체화면')), btn('전환 (F11)', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }, { cls: 'sm ghost' })),
        h('label', { class: 'set-row check' }, h('div', { class: 'set-label' }, svg(I.bolt), h('span', null, '효과 줄이기')), lowfx, h('small', { class: 'dim' }, '빛살·파티클을 줄여 느린 기기에서도 부드럽게')),
      ),
      h(
        'section',
        { class: 'panel pad enter' },
        h('div', { class: 'sec-title' }, h('b', null, '저장')),
        h('p', { class: 'set-save' }, App.backend.label()),
        h('p', { class: 'dim' }, `코인 ${fmt(st.coins)} · 별 ${st.totalStars()} · 동료 ${st.ownedChars().length}명 · 소환 ${fmt(st.save.totalPulls)}회`),
        App.online
          ? btn('로그아웃', async () => { if (await ui.confirm('로그아웃할까요?')) { await App.backend.logout(); location.reload(); } }, { cls: 'sm ghost', icon: I.logout })
          : h('div', null, h('p', { class: 'faint', style: { marginBottom: '14px' } }, '온라인 저장을 쓰려면 exe 옆 config.json 에 Supabase 주소와 키를 넣으세요.'), btn('진행 초기화', async () => { if (await ui.confirm('정말 모든 진행을 지울까요?\n되돌릴 수 없어요.', '초기화', true)) { localStorage.removeItem('mi_save_v1'); location.reload(); } }, { cls: 'sm danger', icon: I.trash })),
        h('div', { class: 'sec-title', style: { marginTop: '26px' } }, h('b', null, '조작')),
        h('ul', { class: 'set-help' }, h('li', null, '미니게임: 방향키 · 스페이스(또는 Z) · 마우스'), h('li', null, 'ESC: 게임 중 일시정지 / 메뉴에서 뒤로'), h('li', null, '스페이스·엔터: 확인 / 소환 연출 넘기기'), h('li', null, '그림은 assets/chars · assets/bg, 음원은 assets/audio 에 넣으면 다음 실행 때 바뀌어요')),
        h('p', { class: 'faint', style: { marginTop: '20px', fontSize: '14px' } }, '미니게임-인커젼 v0.4 · 글꼴: Pretendard, Rajdhani, 갈무리 (OFL)'),
      ),
    ),
  );
  return { el, back: () => ui.show('Lobby') };
}

// ---------------------------------------------------------------- 도전
export function challengeScreen(): Screen {
  const st = App.store;
  const ch = App.content.challenges;
  audio.bgm('challenge', 50, 'dorian', 92, ['challenge', 'map']);
  const cards: { key: 'micro' | 'daily' | 'marathon'; title: string; en: string; color: string; icon: string; lines: string[]; best: string }[] = [
    { key: 'micro', title: '번개 모드', en: 'LIGHTNING', color: '#ffd84b', icon: I.bolt, lines: [`${ch.micro.duration}초짜리 초간단 시련이 쉬지 않고 랜덤으로 이어진다.`, `${ch.micro.speedUpEvery}개마다 빨라지고, 목숨 ${ch.micro.lives}개.`, `성공 1개당 ${ch.micro.coinPerClear} 코인`], best: `최고 ${st.save.extra.microBest}개` },
    { key: 'daily', title: '오늘의 도전', en: 'DAILY', color: '#ff5fd2', icon: I.calendar, lines: [], best: '' },
    { key: 'marathon', title: '마라톤', en: 'MARATHON', color: '#5fd3e0', icon: I.flag, lines: [`열린 미니게임이 ${ch.marathon.duration}초씩 랜덤 순서로 이어진다. 점점 어려워진다.`, `목숨 ${ch.marathon.lives}개를 다 잃으면 끝.`, `점수의 ${Math.round(ch.marathon.coinRate * 100)}%를 코인으로`], best: `최고 ${fmt(st.save.extra.marathonBest)}점` },
  ];
  if (st.modeUnlocked('daily')) {
    const d = dailySetup();
    const today = st.dailyToday();
    cards[1].lines = [`오늘의 규칙: ${d.mod.name} — ${d.mod.desc}`, ...d.games.map((g, i) => `${i + 1}. ${App.content.game(g).name}`), today.cleared ? '오늘 클리어 완료!' : `첫 클리어 보상 ${ch.daily.reward} 코인`];
    cards[1].best = `오늘 최고 ${fmt(today.best)}점`;
  }
  const el = h(
    'div',
    { class: 'challenge' },
    topBar('도전', { back: () => ui.show('Lobby'), sub: '실력을 겨루는 특별 모드' }),
    h(
      'div',
      { class: 'ch-cards' },
      cards.map((c, i) => {
        const open = st.modeUnlocked(c.key);
        return h(
          'section',
          { class: 'ch-card panel enter' + (open ? '' : ' locked'), vars: { c: c.color }, style: { ['--i' as any]: String(i) } },
          h('div', { class: 'ch-head' }, svg(open ? c.icon : I.lock, 'ch-ico'), h('div', null, h('div', { class: 'eyebrow' }, c.en), h('h2', null, c.title))),
          open ? h('ul', { class: 'ch-lines' }, c.lines.map((l, k) => h('li', { class: k === 0 && c.key === 'daily' ? 'gold' : '' }, l))) : h('p', { class: 'faint ch-lock' }, `${App.content.domainName(ch.unlock[c.key])} 해방 후 열린다.`),
          h('div', { class: 'ch-foot' }, h('span', { class: 'dim num' }, c.best), btn(open ? '시작' : '잠김', () => ui.show('Prep', { mode: c.key, domain: 'rift' }), { cls: 'primary', color: c.color, disabled: !open, icon: I.play })),
        );
      }),
    ),
    teamStrip(null, { scene: 'Challenge' }),
  );
  return { el, back: () => ui.show('Lobby') };
}

/** 준비·도전 화면 아래의 출전 팀 요약 */
export function teamStrip(domainId: string | null, back: { scene: string; data?: object }) {
  const st = App.store;
  const b = st.bonus(domainId);
  const lead = App.content.char(st.save.team.leader);
  return h(
    'div',
    { class: 'team-strip panel enter' },
    h('div', { class: 'ts-slots' }, charCard(lead.id, { size: 'sm', showLevel: false }), ...st.save.team.supports.map((s) => (s ? charCard(s, { size: 'sm', showLevel: false }) : h('div', { class: 'ts-empty' }, svg(I.plus))))),
    h('div', { class: 'ts-text' }, h('div', { class: 'sec-title' }, h('b', null, '출전 팀'), h('span', null, `리더 ${lead.name} · ${lead.title}`)), h('div', { class: 'bonus-chips' }, bonusLines(b).map((l) => h('span', { class: 'tag good' }, l)), b.notes.map((n) => h('span', { class: 'tag gold' }, n)))),
    btn('편성 변경', () => ui.show('Team', { back }), { cls: 'sm ghost', icon: I.team }),
  );
}

export const _ci = charImg;
