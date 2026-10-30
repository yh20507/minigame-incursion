/**
 * 고해상도 UI 셸. 1920×1080 기준으로 그린 뒤 창 크기에 맞춰 통째로 축소/확대한다.
 * 미니게임(Phaser, 픽셀) 화면을 제외한 모든 화면이 여기서 돌아간다.
 */
import Phaser from 'phaser';
import { App } from '../core/app';
import { audio } from '../core/audio';
import { h, svg, wait } from './dom';
import { I } from './icons';

export const UW = 1920;
export const UH = 1080;

export interface Screen {
  el: HTMLElement;
  /** 화면을 떠날 때 (타이머 정리 등) */
  onLeave?: () => void;
  /** ESC */
  back?: () => void;
  /** 스페이스 / 엔터 */
  primary?: () => void;
  /** 배경 종류 ('rift' | 영역 id | 세계관 id | 'none') */
  bg?: string;
}

type ScreenFactory = (data: any) => Screen;

class UI {
  root!: HTMLElement;
  stage!: HTMLElement;
  layer!: HTMLElement; // 화면이 들어가는 곳
  bgLayer!: HTMLElement; // 공용 배경
  topLayer!: HTMLElement; // 모달·토스트
  game!: Phaser.Game;
  scale = 1;
  private screens = new Map<string, ScreenFactory>();
  current: Screen | null = null;
  currentKey = '';
  private busy = false;
  private modals: HTMLElement[] = [];
  private pointer = { x: UW / 2, y: UH / 2 };

  init(game: Phaser.Game) {
    this.game = game;
    this.root = document.getElementById('ui')!;
    this.stage = document.getElementById('stage')!;
    this.bgLayer = h('div', { class: 'bg-layer' });
    this.layer = h('div', { class: 'screen-layer' });
    this.topLayer = h('div', { class: 'top-layer' });
    this.stage.append(this.bgLayer, this.layer, this.topLayer);
    this.fit();
    window.addEventListener('resize', () => this.fit());
    document.addEventListener('keydown', (e) => this.onKey(e));
    this.stage.addEventListener('pointermove', (e) => {
      const r = this.stage.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * UW;
      this.pointer.y = ((e.clientY - r.top) / r.height) * UH;
      this.stage.style.setProperty('--mx', String((this.pointer.x / UW - 0.5) * 2));
      this.stage.style.setProperty('--my', String((this.pointer.y / UH - 0.5) * 2));
    });
    this.autoLowFx();
    // 첫 입력에서 오디오 켜기
    const arm = () => audio.ensure();
    this.stage.addEventListener('pointerdown', arm);
    document.addEventListener('keydown', arm);
  }

  /** 효과 줄이기: 저장된 설정 > 기기 추정 */
  setLowFx(on: boolean) {
    this.stage.classList.toggle('lowfx', on);
  }
  autoLowFx() {
    if (/[?&]lowfx/.test(location.search)) return this.setLowFx(true);
    const saved = App.store?.save?.extra?.settings?.lowfx;
    if (saved !== undefined) return this.setLowFx(saved);
    const weak = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;
    this.setLowFx(weak);
  }

  fit() {
    const s = Math.min(window.innerWidth / UW, window.innerHeight / UH);
    this.scale = s;
    this.stage.style.transform = `scale(${s})`;
    document.documentElement.style.setProperty('--ui-scale', String(s));
  }

  /** 스테이지 좌표 (1920×1080) */
  pos(e: { clientX: number; clientY: number }) {
    const r = this.stage.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * UW, y: ((e.clientY - r.top) / r.height) * UH };
  }

  register(key: string, f: ScreenFactory) {
    this.screens.set(key, f);
  }

  has(key: string) {
    return this.screens.has(key);
  }

  /** 화면 전환. 사선 와이프가 지나가는 동안 내용을 갈아끼운다. */
  async show(key: string, data?: any, opts: { instant?: boolean } = {}) {
    const f = this.screens.get(key);
    if (!f) throw new Error('unknown screen ' + key);
    if (this.busy) {
      await wait(50);
      if (this.busy) return;
    }
    this.busy = true;
    this.closeModals();
    this.root.classList.remove('hidden');
    this.phaserVisible(false);
    const sameKey = this.currentKey === key;
    if (!opts.instant && !sameKey) {
      const w = h('div', { class: 'wipe' });
      this.topLayer.appendChild(w);
      await wait(230);
      this.swap(key, f, data);
      await wait(260);
      w.remove();
    } else {
      this.swap(key, f, data);
    }
    this.busy = false;
  }

  private swap(key: string, f: ScreenFactory, data: any) {
    this.current?.onLeave?.();
    this.current?.el.remove();
    const scr = f(data ?? {});
    scr.el.classList.add('screen');
    scr.el.dataset.key = key;
    this.layer.appendChild(scr.el);
    this.current = scr;
    this.currentKey = key;
    this.setBg(scr.bg ?? 'rift');
    // 자식 요소 순서대로 나타나기
    let i = 0;
    scr.el.querySelectorAll<HTMLElement>('.enter').forEach((el) => el.style.setProperty('--i', String(i++)));
  }

  /** 공용 배경: 성운 + 떠다니는 조각 + (있으면) 영역 그림 */
  private bgKey = '';
  setBg(key: string) {
    if (key === this.bgKey) return;
    this.bgKey = key;
    this.bgLayer.innerHTML = '';
    if (key === 'none') return;
    const theme = App.content.domain(key) ?? App.content.world(key);
    const col = (theme as any)?.color ?? '#b48cff';
    const bgA = bgArt(key);
    const parts: HTMLElement[] = [h('div', { class: 'nebula', vars: { c: col } }, h('i'), h('i'), h('i'), h('i'))];
    if (bgA.url) parts.push(h('div', { class: 'bg-img' + (bgA.pixel ? ' pixel' : ''), style: { backgroundImage: `url(${bgA.url})` } }));
    parts.push(h('div', { class: 'grid-fx' }), shards(col), h('div', { class: 'vignette' }));
    this.bgLayer.append(...parts);
  }

  /** 미니게임(Phaser) 으로 넘어갈 때: UI 를 숨긴다 */
  async startPlay(data: object) {
    this.closeModals();
    this.current?.onLeave?.();
    const w = h('div', { class: 'wipe' });
    this.topLayer.appendChild(w);
    await wait(230);
    this.current?.el.remove();
    this.current = null;
    this.currentKey = '';
    this.root.classList.add('hidden');
    w.remove();
    this.phaserVisible(true);
    this.game.scene.stop('Blank');
    this.game.scene.start('Play', data);
  }

  /** DOM 화면이 떠 있는 동안은 Phaser 캔버스를 숨기고 루프를 재운다 (합성 비용 절약) */
  private phaserVisible(on: boolean) {
    const g = document.getElementById('game');
    if (g) g.style.display = on ? '' : 'none';
    if (on) this.game.loop.wake();
    else setTimeout(() => this.root.classList.contains('hidden') || this.game.loop.sleep(), 300);
  }

  /** Phaser 쪽에서 DOM 화면으로 돌아올 때 (core/ui.go 가 호출) */
  fromPhaser(key: string, data?: object) {
    this.show(key, data);
  }

  // ---------------------------------------------------------------- 공용 위젯
  toast(msg: string, kind: 'info' | 'good' | 'bad' | 'gold' = 'info') {
    let box = this.topLayer.querySelector<HTMLElement>('.toasts');
    if (!box) {
      box = h('div', { class: 'toasts' });
      this.topLayer.appendChild(box);
    }
    const t = h('div', { class: 'toast ' + kind }, msg);
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 1900);
    setTimeout(() => t.remove(), 2300);
  }

  modal(opts: { title?: string; body: HTMLElement | HTMLElement[]; cls?: string; buttons?: { label: string; primary?: boolean; onClick?: () => void | Promise<void>; keep?: boolean; danger?: boolean }[]; onClose?: () => void; noClose?: boolean; wide?: boolean }) {
    const close = () => {
      if (!box.isConnected) return;
      box.classList.add('out');
      setTimeout(() => box.remove(), 180);
      this.modals = this.modals.filter((m) => m !== box);
      opts.onClose?.();
    };
    const btns = (opts.buttons ?? [{ label: '확인', primary: true }]).map((b) =>
      h(
        'button',
        {
          class: 'btn ' + (b.primary ? 'primary' : b.danger ? 'danger' : 'ghost'),
          onclick: async () => {
            await b.onClick?.();
            if (!b.keep) close();
          },
        },
        h('span', null, b.label),
      ),
    );
    const box = h(
      'div',
      { class: 'modal-wrap' + (opts.cls ? ' ' + opts.cls : '') },
      h('div', { class: 'modal-shade', onclick: () => !opts.noClose && close() }),
      h(
        'div',
        { class: 'modal panel' + (opts.wide ? ' wide' : '') },
        opts.title ? h('div', { class: 'modal-title' }, opts.title) : null,
        !opts.noClose ? h('button', { class: 'modal-x', onclick: close }, svg(I.close)) : null,
        h('div', { class: 'modal-body' }, opts.body),
        btns.length ? h('div', { class: 'modal-btns' }, btns) : null,
      ),
    );
    this.topLayer.appendChild(box);
    this.modals.push(box);
    audio.sfx('select');
    return close;
  }

  confirm(text: string, okLabel = '확인', danger = false) {
    return new Promise<boolean>((resolve) => {
      let ok = false;
      this.modal({
        body: h('div', { class: 'confirm-text' }, text),
        buttons: [
          { label: '취소' },
          {
            label: okLabel,
            primary: !danger,
            danger,
            onClick: () => {
              ok = true;
            },
          },
        ],
        onClose: () => resolve(ok),
      });
    });
  }

  closeModals() {
    for (const m of this.modals) m.remove();
    this.modals = [];
  }

  get modalOpen() {
    return this.modals.length > 0;
  }

  private onKey(e: KeyboardEvent) {
    if (this.root.classList.contains('hidden')) return;
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.code === 'Escape') {
      if (this.modals.length) {
        this.modals[this.modals.length - 1].remove();
        this.modals.pop();
        return;
      }
      this.current?.back?.();
    } else if (e.code === 'Space' || e.code === 'Enter') {
      if (this.modals.length) return;
      if (this.current?.primary) {
        e.preventDefault();
        this.current.primary();
      }
    }
  }

  /** 강조색 바꾸기 (로비 꾸미기) */
  accent(color: string) {
    this.stage.style.setProperty('--accent', color);
  }
}

export const ui = new UI();

// ---------------------------------------------------------------- 그림 주소
const urlCache = new Map<string, string | null>();

/** Phaser 텍스처에서 DOM 에 쓸 그림 주소를 얻는다. 파일이면 그 주소, 임시 그림(canvas)이면 data URL */
export function artUrl(kind: 'spr' | 'art' | 'full' | 'bg' | 'it', id: string): string | null {
  const key = `${kind}_${id}`;
  if (urlCache.has(key)) return urlCache.get(key)!;
  const tm = ui.game.textures;
  if (!tm.exists(key)) {
    urlCache.set(key, null);
    return null;
  }
  const src = tm.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  let url: string | null = null;
  if (src instanceof HTMLImageElement) url = src.src;
  else if (src instanceof HTMLCanvasElement) url = src.toDataURL();
  urlCache.set(key, url);
  return url;
}

/** 아무 텍스처 키의 그림 주소 */
export function texUrl(key: string) {
  return texInfo(key)?.url ?? null;
}

/** 실제 파일 그림인가 (임시 그림이 아닌가) */
export function artIsFile(kind: 'spr' | 'art' | 'full' | 'bg' | 'it', id: string) {
  const key = `${kind}_${id}`;
  const tm = ui.game.textures;
  if (!tm.exists(key)) return false;
  return tm.get(key).getSourceImage() instanceof HTMLImageElement;
}

/** 메뉴 화면 배경: 고해상도(_hd) 파일 → 미니게임용 파일 → 임시 그림 */
export function bgArt(id: string): { url: string | null; pixel: boolean } {
  const tm = ui.game.textures;
  if (tm.exists('bghd_' + id)) {
    const src = tm.get('bghd_' + id).getSourceImage() as HTMLImageElement;
    if (src instanceof HTMLImageElement) return { url: src.src, pixel: false };
  }
  return { url: artUrl('bg', id), pixel: !artIsFile('bg', id) };
}

/** 텍스처 키로 그림 주소·파일 여부 */
function texInfo(key: string): { url: string; file: boolean } | null {
  const tm = ui.game.textures;
  if (!tm.exists(key)) return null;
  if (urlCache.has(key)) return { url: urlCache.get(key)!, file: tm.get(key).getSourceImage() instanceof HTMLImageElement };
  const src = tm.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const url = src instanceof HTMLImageElement ? src.src : src instanceof HTMLCanvasElement ? src.toDataURL() : null;
  urlCache.set(key, url);
  return url ? { url, file: src instanceof HTMLImageElement } : null;
}

/** 캐릭터의 그림 키 (입힌 스킨이 있으면 스킨 그림) */
function keysFor(id: string, kind: 'full' | 'art' | 'spr', skinId?: string | null): string[] {
  const sk = skinId === undefined ? App.store?.equippedSkin?.(id)?.id : skinId;
  const skKind = kind === 'spr' ? 'sprite' : kind;
  const out: string[] = [];
  if (sk) out.push(`skin_${sk}_${skKind}`);
  out.push(`${kind}_${id}`);
  return out;
}

/** 큰 화면에 쓸 가장 좋은 캐릭터 그림. pixel = 임시(픽셀) 그림이라 확대 시 또렷하게. skinId 를 주면 그 스킨으로 (null 이면 기본) */
export function bestArt(id: string, preferFull = true, skinId?: string | null): { url: string; pixel: boolean; kind: 'full' | 'art' | 'spr' } {
  const order: ('full' | 'art' | 'spr')[] = preferFull ? ['full', 'art', 'spr'] : ['art', 'spr'];
  // 1) 파일 그림 우선 2) 임시 그림
  for (const pass of ['file', 'any'] as const) {
    for (const kind of pass === 'file' ? order : (['spr'] as const)) {
      // 임시 그림은 도트(spr)만 크게 쓴다 (임시 art/full 카드는 글자가 박혀 있어 안 씀)
      for (const key of keysFor(id, kind, skinId)) {
        const t = texInfo(key);
        if (!t) continue;
        if (pass === 'file' && !t.file) continue;
        return { url: t.url, pixel: !t.file, kind };
      }
    }
  }
  return { url: artUrl('spr', id) ?? '', pixel: true, kind: 'spr' };
}

/** 도감·카드용 초상 (art 파일 → 임시 art) */
export function portraitArt(id: string, skinId?: string | null): { url: string; pixel: boolean } {
  for (const key of keysFor(id, 'art', skinId)) {
    const t = texInfo(key);
    if (t) return { url: t.url, pixel: !t.file };
  }
  return { url: artUrl('spr', id) ?? '', pixel: true };
}

/** 스킨 그림 (없으면 null) */
export function skinArt(skinId: string, kind: 'art' | 'full' = 'art'): { url: string; pixel: boolean } | null {
  const t = texInfo(`skin_${skinId}_${kind}`);
  return t ? { url: t.url, pixel: !t.file } : null;
}

function shards(color: string) {
  const box = h('div', { class: 'shards' });
  for (let i = 0; i < 18; i++) {
    box.appendChild(
      h('i', {
        style: {
          left: Math.random() * 100 + '%',
          animationDelay: -Math.random() * 20 + 's',
          animationDuration: 14 + Math.random() * 16 + 's',
          width: 6 + Math.random() * 22 + 'px',
          height: 6 + Math.random() * 14 + 'px',
          opacity: String(0.15 + Math.random() * 0.35),
          borderColor: Math.random() < 0.5 ? color : '#ffffff',
        },
      }),
    );
  }
  return box;
}
