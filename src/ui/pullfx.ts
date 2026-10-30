/** 소환 연출 공용: 팩 떨어짐 → 찢기 → 카드 펼치기 → 뒤집기. 캐릭터 뽑기와 스킨 뽑기가 같이 쓴다. */
import { audio } from '../core/audio';
import { ui } from './app';
import { btn } from './components';
import { h, svg, wait } from './dom';
import { fx } from './fx';
import { I } from './icons';

export interface PullCard {
  /** 앞면 요소 (.cf) */
  face: HTMLElement;
  /** 뒷면 빛 효과 등급: 0~3 없음, 4 금색, 5 무지개 */
  glow: number;
  /** 뒤집힌 뒤 추가 연출 (★4·★5 등장 등) */
  onFlip?: () => Promise<void>;
  /** 뒤집을 때 효과음 */
  sfx?: string;
}

export interface PullOpts {
  host: HTMLElement;
  packName: string;
  color: string;
  /** 가장 높은 등급 색 (찢을 때 새는 빛) */
  topColor: string;
  /** 0~5. 4 이상이면 큰 폭발, 5 면 '균열 이변' */
  top: number;
  bgUrl: string | null;
  bgPixel: boolean;
  cards: PullCard[];
  /** 팩 위에 쓰는 카운트 글자 */
  countLabel: string;
  ultraText?: string;
}

/** 팩 연출 뒤 카드가 다 뒤집히면 resolve. 반환한 ov 에 요약을 붙이면 된다. */
export function runPull(o: PullOpts): { ov: HTMLElement; done: Promise<void> } {
  const multiPull = o.cards.length > 1;
  const top = o.top;
  const topCol = o.topColor;
  const col = o.color;
  const bgUrl = o.bgUrl;
  const bgA = { pixel: o.bgPixel };
  const el = o.host;
  const banner = { name: o.packName };
  const res = o.cards;
  const ov = h('div', { class: 'gacha-ov', vars: { c: col, tc: topCol } }, h('div', { class: 'gov-bg' + (bgA.pixel ? ' pixel' : ''), style: bgUrl ? { backgroundImage: `url(${bgUrl})` } : {} }), h('div', { class: 'gov-shade' }));
  el.appendChild(ov);
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));

  (async () => {
    // ----- 팩
  const strip = h('div', { class: 'pk-strip' }, h('div', { class: 'pk-zig' }));
  const tearLine = h('div', { class: 'pk-tear' });
  const pack = h(
    'div',
    { class: 'pack' + (multiPull ? ' multi' : '') },
    h('div', { class: 'pk-body' }, h('div', { class: 'pk-shine' }), h('div', { class: 'pk-emblem' }, svg(I.rift)), h('div', { class: 'pk-name' }, banner.name), h('div', { class: 'pk-count' }, o.countLabel), h('div', { class: 'pk-lines' })),
    strip,
    h('div', { class: 'pk-dash' }),
    tearLine,
    h('div', { class: 'pk-beam' }),
  );
  const hint = h('div', { class: 'pk-hint blink' }, '팩 윗부분을 옆으로 끌어서 찢기  ', h('span', { class: 'key' }, 'SPACE'), ' 길게');
  let progress = 0;
  const skip = btn('건너뛰기', () => (progress = 1), { cls: 'sm ghost gov-skip', icon: I.skip, silent: true });
  ov.append(pack, hint, skip);
  audio.sfx('pack');
  await wait(650);
  pack.classList.add('idle');

  // ----- 찢기 (드래그 / 스페이스)
  let dragging = false;
  let lastTick = 0;
  const packRect = () => pack.getBoundingClientRect();
  const onDown = (e: PointerEvent) => {
    const r = packRect();
    if (e.clientY < r.top + r.height * 0.3) dragging = true;
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const r = packRect();
    const k = (e.clientX - r.left) / r.width;
    progress = Math.max(progress, Math.min(1, Math.max(k, 1 - k) > 0.5 ? Math.abs(k - 0.5) * 2 : 0));
  };
  const onUp = () => (dragging = false);
  let spaceDown = false;
  const kd = (e: KeyboardEvent) => e.code === 'Space' && (spaceDown = true);
  const ku = (e: KeyboardEvent) => e.code === 'Space' && (spaceDown = false);
  ov.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  document.addEventListener('keydown', kd);
  document.addEventListener('keyup', ku);
  await new Promise<void>((resolve) => {
    let raf = 0;
    let lastLeak = 0;
    let lastT = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.3, (t - lastT) / 1000);
      lastT = t;
      if (spaceDown) progress = Math.min(1, progress + dt * 1.1);
      tearLine.style.width = progress * 100 + '%';
      if (progress > 0 && progress < 1) {
        if (Math.floor(progress * 12) !== lastTick) {
          lastTick = Math.floor(progress * 12);
          audio.sfx('tick');
        }
        if (t - lastLeak > 60) {
          lastLeak = t;
          const r = pack.getBoundingClientRect();
          const sr = ui.stage.getBoundingClientRect();
          const x = ((r.left + r.width * progress - sr.left) / sr.width) * 1920;
          const y = ((r.top + 54 - sr.top) / sr.height) * 1080;
          fx.burst(x, y, { n: 3, color: [topCol, '#fff'], speed: 220, size: 4, life: 0.6, g: -200, spread: Math.PI, angle: -Math.PI / 2, glow: true });
        }
      }
      if (progress >= 1) return resolve();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    void raf;
  });
  ov.removeEventListener('pointerdown', onDown);
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  document.removeEventListener('keydown', kd);
  document.removeEventListener('keyup', ku);
  hint.remove();
  skip.remove();
  pack.classList.remove('idle');

  // ----- 띠 날아가고 빛
  audio.sfx('tear');
  pack.classList.add('torn');
  const pr = pack.getBoundingClientRect();
  const sr = ui.stage.getBoundingClientRect();
  const px = ((pr.left + pr.width / 2 - sr.left) / sr.width) * 1920;
  const py = ((pr.top + 40 - sr.top) / sr.height) * 1080;
  fx.burst(px, py, { n: top >= 4 ? 120 : 60, color: [topCol, '#fff'], speed: top >= 4 ? 900 : 500, size: 6, life: 1.3, shape: 'spark', g: 400 });
  fx.shake(ui.stage, top >= 4 ? 3 : 1.2, top >= 4 ? 500 : 250);
  audio.sfx(top >= 4 ? 'legend' : top === 3 ? 'hero' : 'rare');
  await wait(top >= 4 ? 900 : 600);
  if (top >= 5) {
    const warn = h('div', { class: 'gov-warn' }, h('div', { class: 'gov-warn-text' }, o.ultraText ?? '균 열 이 변'), h('div', { class: 'eyebrow' }, 'RIFT ANOMALY DETECTED'));
    ov.appendChild(warn);
    await wait(1300);
    audio.sfx('ultra');
    warn.classList.add('burst');
    fx.flash('#fff', 700, 1);
    fx.shake(ui.stage, 5, 700);
    fx.burst(960, 540, { n: 200, color: ['#ff5fd2', '#5fd3e0', '#ffc845', '#fff', '#b48cff', '#4be37a'], speed: 1400, size: 9, life: 1.8, shape: 'shard', g: 200 });
    await wait(600);
    warn.remove();
  }
  pack.classList.add('gone');
  await wait(400);
  pack.remove();
  // ----- 카드
  const single = res.length === 1;
  type Card = { el: HTMLElement; r: PullCard; open: boolean };
  const cards: Card[] = [];
  const grid = h('div', { class: 'cards' + (single ? ' single' : '') });
  ov.appendChild(grid);
  const row1 = h('div', { class: 'cards-row' });
  const row2 = h('div', { class: 'cards-row' });
  grid.append(row1, row2);
  res.forEach((r, i) => {
    const back = h('div', { class: 'cb' }, h('div', { class: 'cb-pattern' }), h('div', { class: 'cb-emblem' }, svg(I.rift)));
    const card = h('div', { class: `card r${r.glow}`, style: { animationDelay: i * 70 + 'ms' } }, h('div', { class: 'card-inner' }, back, r.face));
    (i < 6 ? row1 : row2).appendChild(card);
    const cd: Card = { el: card, r, open: false };
    cards.push(cd);
    card.addEventListener('click', () => flip(cd));
    setTimeout(() => audio.sfx('select'), i * 70);
  });
  let flipping = false;
  const flip = async (cd: Card) => {
    if (cd.open || flipping) return;
    flipping = true;
    cd.open = true;
    audio.sfx('flip');
    cd.el.classList.add('open');
    if (cd.r.onFlip) {
      await wait(350);
      await cd.r.onFlip();
    } else {
      if (cd.r.sfx) audio.sfx(cd.r.sfx);
      await wait(220);
    }
    flipping = false;
    if (cards.every((c) => c.open)) finish();
  };
  const flipAll = async () => {
    for (const c of cards) {
      if (c.open) continue;
      while (flipping) await wait(40);
      await flip(c);
    }
  };
  const allBtn = btn('전부 뒤집기', flipAll, { cls: 'primary gov-all', icon: I.sparkle, sub: 'SPACE' });
  ov.appendChild(allBtn);
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !cards.every((c) => c.open)) {
      e.preventDefault();
      flipAll();
    }
  };
  document.addEventListener('keydown', onKey);

  const finish = () => {
    document.removeEventListener('keydown', onKey);
    allBtn.remove();
    resolveDone();
  };
  })();
  return { ov, done };
}

/** 요약 바 칩 */
export function sumChip(label: string, n: number, cls: string) {
  return h('span', { class: 'sum-chip' + (n ? ' ' + cls : '') }, h('b', { class: 'num' }, String(n)), h('small', null, label));
}

/** 요약 바의 닫기/한 번 더 공용 키 처리 */
export function armSummaryKeys(close: () => void) {
  const onSpace = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      document.removeEventListener('keydown', onSpace);
      close();
    }
  };
  setTimeout(() => document.addEventListener('keydown', onSpace), 300);
}

export const _b = btn;
export const _ui = ui;
export const _fx = fx;
