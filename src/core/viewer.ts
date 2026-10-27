import { App } from './app';
import { audio } from './audio';
import { placeholderFull } from './art';
import { rarityName } from './ui';

/**
 * ★4·★5 고화질 일러스트 보기.
 * 게임 화면(640x360 픽셀)이 아니라 창 해상도 그대로 보여주려고 HTML 위에 띄운다.
 * ★4: 금빛 테두리. ★5: 무지개 테두리 + 홀로그램 광택 + 반짝이.
 */
export function showFullArt(scene: Phaser.Scene, charId: string, onClose?: () => void) {
  const ch = App.content.char(charId);
  const ultra = ch.rarity >= 5;
  const el = document.createElement('div');
  el.className = 'viewer ' + (ultra ? 'ultra' : 'legend');

  const frame = document.createElement('div');
  frame.className = 'frame';
  const img = document.createElement('img');
  let note = '';
  const key = 'full_' + charId;
  if (scene.textures.exists(key) && !placeholderFull.has(charId)) {
    img.src = `assets/chars/${charId}_full.png`;
  } else if (scene.textures.exists(key)) {
    img.src = (scene.textures.get(key).getSourceImage() as HTMLCanvasElement).toDataURL();
    img.className = 'pixel';
    note = `전용 일러스트 자리: assets/chars/${charId}_full.png`;
  }
  frame.appendChild(img);
  if (ultra) {
    const holo = document.createElement('div');
    holo.className = 'holo';
    frame.appendChild(holo);
  }
  el.appendChild(frame);

  if (ultra) {
    for (let i = 0; i < 28; i++) {
      const s = document.createElement('div');
      s.className = 'spark';
      s.style.left = `${5 + Math.random() * 90}%`;
      s.style.top = `${5 + Math.random() * 90}%`;
      s.style.animationDelay = `${Math.random() * 1.8}s`;
      s.style.animationDuration = `${1.2 + Math.random() * 1.4}s`;
      const sc = 0.5 + Math.random() * 1.2;
      s.style.width = s.style.height = `${14 * sc}px`;
      el.appendChild(s);
    }
  }

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
  audio.sfx(ultra ? 'star' : 'legend');
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
