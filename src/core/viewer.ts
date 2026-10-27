import { App } from './app';
import { rarityName } from './ui';

/**
 * 초레어 전용 고화질 일러스트 보기.
 * 게임 화면(640x360 픽셀)이 아니라 창 해상도 그대로 보여주려고 HTML 위에 띄운다.
 * assets/chars/<id>_full.png 가 없으면 일반 일러스트를 크게 보여준다.
 */
export function showFullArt(scene: Phaser.Scene, charId: string, onClose?: () => void) {
  const ch = App.content.char(charId);
  const el = document.createElement('div');
  el.className = 'viewer';
  const img = document.createElement('img');
  let note = '';
  if (scene.textures.exists('full_' + charId)) {
    img.src = `assets/chars/${charId}_full.png`;
  } else {
    const src = scene.textures.get('art_' + charId).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
    img.src = src instanceof HTMLCanvasElement ? src.toDataURL() : src.src;
    img.className = 'pixel';
    note = `전용 일러스트 자리: assets/chars/${charId}_full.png`;
  }
  el.appendChild(img);
  const cap = document.createElement('div');
  cap.className = 'cap';
  cap.textContent = ch.name;
  el.appendChild(cap);
  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent = `${rarityName(ch.rarity)} · ${ch.title} · ${App.content.domainName(ch.domain)}`;
  el.appendChild(sub);
  if (note) {
    const n = document.createElement('div');
    n.className = 'note';
    n.textContent = note;
    el.appendChild(n);
  }
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = '클릭 또는 스페이스로 닫기';
  el.appendChild(hint);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  if (scene.input.keyboard) scene.input.keyboard.enabled = false;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    el.classList.remove('show');
    setTimeout(() => {
      el.remove();
      if (scene.input.keyboard) scene.input.keyboard.enabled = true;
      onClose?.();
    }, 300);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') {
      e.preventDefault();
      close();
    }
  };
  setTimeout(() => {
    el.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
  }, 400);
}
