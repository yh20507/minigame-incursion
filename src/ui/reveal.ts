/** ★4·★5 등장 연출 (뽑기·도감·선택권에서 공용). 끝나면 resolve. */
import { App } from '../core/app';
import { audio } from '../core/audio';
import { bestArt, ui } from './app';
import { RC, rarityName } from './components';
import { h, svg, wait } from './dom';
import { fx } from './fx';
import { skillDesc } from '../core/skills';
import { I } from './icons';

export function showReveal(charId: string, o: { note?: string; tag?: string; quick?: boolean; skin?: import('../core/types').SkinDef } = {}) {
  return new Promise<void>((resolve) => {
    const ch = App.content.char(charId);
    const ultra = o.skin ? o.skin.grade === 'SS' : ch.rarity >= 5;
    const col = o.skin ? App.content.skins.grades[o.skin.grade].color : RC[ch.rarity];
    const art = bestArt(charId, true, o.skin ? o.skin.id : undefined);
    const world = App.content.world(ch.domain);
    const domCol = App.content.domainColor(ch.domain);

    const nameEl = h('h2', { class: 'rv-name' }, ...[...ch.name].map((c, i) => h('span', { style: { animationDelay: 600 + i * 60 + 'ms' } }, c)));
    const lineEl = h('p', { class: 'rv-line' });
    const el = h(
      'div',
      { class: `reveal r${ch.rarity}` + (ultra ? ' ultra' : ''), vars: { c: col, dc: domCol } },
      h('div', { class: 'rv-bg' }),
      h('div', { class: 'rv-rays' }, fx.rays(col)),
      ultra ? h('div', { class: 'rv-prism' }) : null,
      h('div', { class: 'rv-lines' }, h('i'), h('i'), h('i')),
      h('div', { class: 'rv-art ' + (art.kind === 'spr' ? 'is-sprite' : art.kind === 'art' ? 'is-art' : 'is-full') }, h('img', { src: art.url, class: art.pixel ? 'pixel' : '', alt: '' }), ultra ? h('div', { class: 'rv-holo' }) : null),
      h(
        'div',
        { class: 'rv-text' },
        h('div', { class: 'rv-rarity' }, h('span', { class: 'eyebrow' }, o.skin ? `${o.skin.grade} SKIN` : ultra ? 'ULTRA RARE' : 'LEGENDARY'), h('b', null, o.skin ? App.content.skins.grades[o.skin.grade].name : rarityName(ch.rarity))),
        nameEl,
        h('div', { class: 'rv-title' }, h('span', null, o.skin ? o.skin.name : ch.title), h('i', null, ' · '), h('span', { class: 'rv-dom' }, o.skin ? ch.title : App.content.domainName(ch.domain))),
        lineEl,
        ch.skill && !o.skin ? h('div', { class: 'rv-skill' }, svg(I.bolt), h('b', null, ch.skill.name), h('span', null, skillDesc(ch.skill))) : null,
        o.note ? h('div', { class: 'rv-note' }, o.tag ? h('span', { class: 'tag hot' }, o.tag) : null, h('span', null, o.note)) : null,
      ),
      h('div', { class: 'rv-hint' }, h('span', { class: 'key' }, 'SPACE'), ' 또는 클릭으로 계속'),
      h('div', { class: 'rv-stamp' }, o.skin ? h('b', null, o.skin.grade) : [svg(I.star), h('b', null, String(ch.rarity))]),
    );
    ui.topLayer.appendChild(el);

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      el.classList.add('out');
      audio.stopTheme();
      setTimeout(() => {
        el.remove();
        resolve();
      }, 350);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        if (armed) close();
      }
    };
    let armed = false;
    document.addEventListener('keydown', onKey);
    el.addEventListener('click', () => armed && close());

    (async () => {
      const played = audio.playTheme(audio.themeUrl(charId, world?.id), ch.themeStart ?? (audio.files.chars.has(charId) ? 0 : world?.themeStart ?? 0));
      if (!played) audio.sfx(ultra ? 'ultra' : 'legend');
      await wait(30);
      el.classList.add('show');
      fx.flash(ultra ? '#fff' : col, ultra ? 700 : 450, 0.9);
      fx.shake(ui.stage, ultra ? 3 : 1.5, ultra ? 600 : 400);
      await wait(250);
      el.classList.add('art');
      const cx = 1250,
        cy = 560;
      fx.burst(cx, cy, { n: ultra ? 140 : 70, color: ultra ? ['#ff5fd2', '#5fd3e0', '#ffc845', '#fff', '#b48cff'] : [col, '#fff'], speed: ultra ? 1100 : 700, size: ultra ? 9 : 7, life: 1.6, shape: 'shard', g: 300 });
      if (ultra) {
        const spark = setInterval(() => {
          if (closed) return clearInterval(spark);
          fx.sparkles(900, 80, 900, 900, { n: 6, color: ['#fff', '#ff5fd2', '#5fd3e0', '#ffc845'], life: 1.8, size: 6 });
        }, 220);
      } else {
        fx.sparkles(950, 100, 800, 900, { n: 24, color: [col, '#fff'], life: 1.8 });
      }
      await wait(500);
      el.classList.add('text');
      if (ch.line) {
        const chars = [...`“${ch.line}”`];
        let i = 0;
        const t = setInterval(() => {
          if (closed) return clearInterval(t);
          lineEl.textContent = chars.slice(0, ++i).join('');
          if (i >= chars.length) clearInterval(t);
        }, 45);
        setTimeout(() => !closed && audio.voice(charId, ch.line), 300);
      }
      await wait(o.quick ? 300 : 900);
      armed = true;
      el.classList.add('armed');
    })();
  });
}
