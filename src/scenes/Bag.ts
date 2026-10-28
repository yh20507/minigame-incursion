import Phaser from 'phaser';
import { App, C, W } from '../core/app';
import { fitImage } from '../core/art';
import { T, bg, fadeIn, go, panel, topBar } from '../core/ui';

/** 가방: 뽑기로 얻은 소모성 아이템 목록 */
export class BagScene extends Phaser.Scene {
  constructor() {
    super('Bag');
  }

  create(data: { back?: string }) {
    fadeIn(this);
    bg(this, 'rift', 0.6);
    const back = data?.back ?? 'Lobby';
    topBar(this, '가방', () => go(this, back));
    const st = App.store;
    const items = App.content.items.filter((i) => i.effect !== 'instant');
    items.forEach((it, i) => {
      const col = i % 2,
        row = Math.floor(i / 2);
      const x = 16 + col * 308,
        y = 38 + row * 66;
      const n = st.itemCount(it.id);
      panel(this, x, y, 300, 58, { border: n ? Phaser.Display.Color.HexStringToColor(it.color).color : C.line });
      const icon = this.add.image(x + 30, y + 29, 'it_' + it.id);
      fitImage(icon, 36, 36);
      if (!n) icon.setAlpha(0.35);
      T(this, x + 58, y + 8, it.name, { bold: true, color: n ? C.text : C.faint });
      T(this, x + 58, y + 26, it.desc, { size: 10, color: C.dim, wrap: 190 });
      T(this, x + 290, y + 8, `${n}개`, { align: 'right', color: n ? C.gold : C.faint, bold: true });
    });
    T(this, 16, 38 + Math.ceil(items.length / 2) * 66 + 4, '물약·부적·깃털·모래시계는 게임 시작 전 준비 화면에서 고른다. 만능 조각은 도감에서 쓴다.', {
      size: 10,
      color: C.faint,
      wrap: W - 32,
    });
  }
}
