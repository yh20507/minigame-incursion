/** 스토리: 배경 + 큰 캐릭터 + 대화창 */
import { App } from '../../core/app';
import { audio } from '../../core/audio';
import { RC, btn } from '../components';
import { bestArt, ui, type Screen } from '../app';
import { h, svg } from '../dom';
import { I } from '../icons';

export function storyScreen(data: { id: string; next: string; nextData?: object }): Screen {
  const sc = App.content.story.scenes[data.id];
  const bgKey = sc?.bg ?? 'rift';
  const d = App.content.domain(bgKey);
  if (d) audio.bgm(d.id, d.music.root, d.music.scale, d.music.tempo, ['story', d.id]);
  else audio.bgm('rift', 50, 'minor', 80, ['story', 'rift']);

  const done = () => {
    App.store.markStory(data.id);
    ui.show(data.next, data.nextData);
  };
  if (!sc) {
    setTimeout(done, 0);
    return { el: h('div'), bg: bgKey };
  }

  const figBox = h('div', { class: 'story-fig' });
  const nameEl = h('div', { class: 'story-name' });
  const textEl = h('div', { class: 'story-text' });
  const more = h('div', { class: 'story-more blink' }, '▼');
  const box = h('div', { class: 'story-box panel' }, nameEl, textEl, more);
  const counter = h('div', { class: 'story-counter num' });
  const el = h(
    'div',
    { class: 'story', onclick: () => advance() },
    figBox,
    h('div', { class: 'story-letterbox top' }),
    h('div', { class: 'story-letterbox bottom' }),
    box,
    h('div', { class: 'story-hud' }, counter, btn('건너뛰기', done, { cls: 'sm ghost', icon: I.skip, silent: true })),
  );

  let idx = -1;
  let full = '';
  let shown = 0;
  let typing = false;
  let timer = 0;
  let lastChar = '';

  const showLine = () => {
    const line = sc.lines[idx];
    const sp = App.content.story.speakers[line.s] ?? { name: line.s };
    counter.textContent = `${idx + 1} / ${sc.lines.length}`;
    nameEl.textContent = sp.name;
    nameEl.style.display = sp.name ? '' : 'none';
    const col = sp.char ? App.content.domainColor(App.content.char(sp.char).domain) : 'var(--accent)';
    nameEl.style.setProperty('--c', col);
    box.style.setProperty('--c', col);
    if (sp.char && sp.char !== lastChar) {
      lastChar = sp.char;
      const art = bestArt(sp.char);
      const ch = App.content.char(sp.char);
      figBox.innerHTML = '';
      figBox.appendChild(
        h(
          'div',
          { class: 'story-char ' + (art.kind === 'spr' ? 'is-sprite' : 'is-art'), vars: { c: RC[ch.rarity] } },
          h('img', { src: art.url, class: art.pixel ? 'pixel' : '', alt: '' }),
        ),
      );
    } else if (!sp.char) {
      figBox.querySelector('.story-char')?.classList.add('dim');
    }
    if (sp.char) figBox.querySelector('.story-char')?.classList.remove('dim');
    box.classList.toggle('narr', line.s === 'narr');
    full = line.t;
    shown = 0;
    typing = true;
    textEl.textContent = '';
    more.style.visibility = 'hidden';
    if (sp.char) audio.voice(sp.char, full);
    clearInterval(timer);
    timer = window.setInterval(() => {
      shown++;
      textEl.textContent = full.slice(0, shown);
      if (!sp.char && shown % 3 === 0 && full[shown - 1] !== ' ') audio.sfx('text');
      if (shown >= full.length) {
        typing = false;
        more.style.visibility = '';
        clearInterval(timer);
      }
    }, 26);
  };

  const advance = () => {
    if (typing) {
      typing = false;
      clearInterval(timer);
      textEl.textContent = full;
      more.style.visibility = '';
      return;
    }
    idx++;
    if (idx >= sc.lines.length) done();
    else showLine();
  };
  setTimeout(advance, 350);

  return {
    el,
    bg: bgKey,
    primary: advance,
    back: done,
    onLeave: () => clearInterval(timer),
  };
}

export const storySkipIcon = svg(I.skip);
