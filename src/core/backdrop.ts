import { App } from './app';
import { placeholderFull } from './art';

/**
 * 로비 배경. 게임 캔버스(640x360 픽셀) 뒤에 창 해상도 그대로 그림을 깐다.
 * 고화질 일러스트가 뭉개지지 않게 하려고 HTML 로 그린다.
 */
export interface BackdropItem {
  /** art = 기본 일러스트, full = ★4·★5 특별 일러스트, bg = 영역·세계관 배경 */
  k: 'art' | 'full' | 'bg';
  id: string;
}

let timer: number | null = null;

function srcOf(scene: Phaser.Scene, it: BackdropItem): { src: string; pixel: boolean } | null {
  const key = it.k === 'bg' ? 'bg_' + it.id : it.k === 'full' ? 'full_' + it.id : 'art_' + it.id;
  if (!scene.textures.exists(key)) return null;
  const img = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  if (img instanceof HTMLCanvasElement) return { src: img.toDataURL(), pixel: true };
  const file = it.k === 'bg' ? `assets/bg/${it.id}.png` : `assets/chars/${it.id}_${it.k}.png`;
  return { src: file, pixel: it.k !== 'full' };
}

function slide(scene: Phaser.Scene, it: BackdropItem) {
  const s = srcOf(scene, it);
  const el = document.createElement('div');
  el.className = 'slide';
  if (!s) return el;
  const blur = document.createElement('div');
  blur.className = 'blur';
  blur.style.backgroundImage = `url("${s.src}")`;
  el.appendChild(blur);
  const pic = document.createElement('div');
  const isBg = it.k === 'bg';
  const ch = !isBg && App.content.hasChar(it.id) ? App.content.char(it.id) : null;
  const special = it.k === 'full' && ch && !placeholderFull.has(it.id);
  pic.className = 'pic ' + (isBg ? 'cover' : 'left') + (it.k === 'full' && ch ? (ch.rarity >= 5 ? ' ultra' : ' legend') : '');
  const frame = document.createElement('div');
  frame.className = 'frame';
  const img = document.createElement('img');
  img.src = s.src;
  if (s.pixel) img.className = 'pixel';
  frame.appendChild(img);
  if (it.k === 'full' && ch && ch.rarity >= 5) {
    const holo = document.createElement('div');
    holo.className = 'holo';
    frame.appendChild(holo);
    for (let i = 0; i < 22; i++) {
      const sp = document.createElement('div');
      sp.className = 'spark';
      sp.style.left = `${Math.random() * 100}%`;
      sp.style.top = `${Math.random() * 100}%`;
      sp.style.animationDelay = `${Math.random() * 1.8}s`;
      sp.style.animationDuration = `${1.2 + Math.random() * 1.4}s`;
      el.appendChild(sp);
    }
  }
  void special;
  pic.appendChild(frame);
  el.appendChild(pic);
  return el;
}

export function showBackdrop(scene: Phaser.Scene, items: BackdropItem[], intervalSec = 8) {
  hideBackdrop();
  const root = document.getElementById('backdrop')!;
  root.innerHTML = '';
  const list = items.length ? items : [{ k: 'bg', id: 'rift' } as BackdropItem];
  const slides = list.map((it) => slide(scene, it));
  slides.forEach((s) => root.appendChild(s));
  root.classList.add('show');
  let i = 0;
  requestAnimationFrame(() => slides[0].classList.add('on'));
  if (slides.length > 1) {
    timer = window.setInterval(() => {
      slides[i].classList.remove('on');
      i = (i + 1) % slides.length;
      slides[i].classList.add('on');
    }, Math.max(3, intervalSec) * 1000);
  }
  scene.events.once('shutdown', hideBackdrop);
}

export function hideBackdrop() {
  if (timer) clearInterval(timer);
  timer = null;
  const root = document.getElementById('backdrop');
  if (!root) return;
  root.classList.remove('show');
  root.innerHTML = '';
}
