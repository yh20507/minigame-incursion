import Phaser from 'phaser';
import { App, C, H, W, hexNum } from './app';
import { audio } from './audio';
import { RARITY_COLORS, fitImage } from './art';

export type TextOpts = {
  size?: 10 | 12 | 24 | 36;
  color?: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  origin?: [number, number];
  stroke?: boolean;
};

export function T(scene: Phaser.Scene, x: number, y: number, text: string, o: TextOpts = {}) {
  const size = o.size ?? 12;
  const family = size === 10 ? 'Galmuri9' : o.bold || size >= 24 ? 'Galmuri11Bold' : 'Galmuri11';
  const t = scene.add.text(Math.round(x), Math.round(y), text, {
    fontFamily: family,
    fontSize: size + 'px',
    color: o.color ?? C.text,
    align: o.align ?? 'left',
    lineSpacing: size >= 24 ? 2 : 4,
    wordWrap: o.wrap ? { width: o.wrap, useAdvancedWrap: true } : undefined,
    stroke: o.stroke ? '#0b0918' : undefined,
    strokeThickness: o.stroke ? (size >= 24 ? 4 : 2) : 0,
  });
  if (o.origin) t.setOrigin(o.origin[0], o.origin[1]);
  else if (o.align === 'center') t.setOrigin(0.5, 0);
  else if (o.align === 'right') t.setOrigin(1, 0);
  return t;
}

export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  o: { fill?: number; border?: number; alpha?: number } = {},
) {
  const g = scene.add.graphics();
  g.fillStyle(0x07060f, o.alpha ?? 1);
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(o.fill ?? C.panel, o.alpha ?? 1);
  g.fillRect(x, y, w, h);
  g.lineStyle(1, o.border ?? C.line, 1);
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  return g;
}

export interface Btn extends Phaser.GameObjects.Container {
  setEnabled(v: boolean): Btn;
  setLabel(s: string): Btn;
  label: Phaser.GameObjects.Text;
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  o: { color?: string; disabled?: boolean; size?: 10 | 12 | 24; sub?: string; silent?: boolean } = {},
): Btn {
  const c = scene.add.container(x, y) as Btn;
  const g = scene.add.graphics();
  const accent = hexNum(o.color ?? '#6b5bd6');
  let enabled = !o.disabled;
  let hover = false;
  const draw = () => {
    g.clear();
    g.fillStyle(0x07060f, 1);
    g.fillRect(-1, -1, w + 2, h + 2);
    g.fillStyle(!enabled ? 0x14121f : hover ? Phaser.Display.Color.ValueToColor(accent).darken(35).color : C.panel2, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(1, enabled ? accent : 0x2c2845, 1);
    g.strokeRect(0.5, 0.5, w - 1, h - 1);
    if (enabled) {
      g.fillStyle(accent, hover ? 1 : 0.6);
      g.fillRect(1, h - 3, w - 2, 2);
    }
  };
  const size = o.size ?? 12;
  const ty = o.sub ? Math.max(2, h / 2 - 14) : h / 2 - size / 2 - 1;
  const t = T(scene, w / 2, ty, label, { size, align: 'center', color: enabled ? C.text : C.faint });
  c.add([g, t]);
  let sub: Phaser.GameObjects.Text | null = null;
  if (o.sub) {
    sub = T(scene, w / 2, h - 15, o.sub, { size: 10, align: 'center', color: C.dim });
    c.add(sub);
  }
  c.label = t;
  draw();
  c.setSize(w, h);
  const zone = scene.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  c.add(zone);
  zone.on('pointerover', () => {
    if (!enabled) return;
    hover = true;
    draw();
    if (!o.silent) audio.sfx('select');
  });
  zone.on('pointerout', () => {
    hover = false;
    draw();
  });
  zone.on('pointerup', () => {
    if (!enabled) return;
    audio.sfx('confirm');
    onClick();
  });
  c.setEnabled = (v: boolean) => {
    enabled = v;
    t.setColor(v ? C.text : C.faint);
    draw();
    return c;
  };
  c.setLabel = (s: string) => {
    t.setText(s);
    return c;
  };
  return c;
}

/** 화면 전환 (짧은 페이드) */
export function go(scene: Phaser.Scene, key: string, data?: object) {
  if ((scene as any).__leaving) return;
  (scene as any).__leaving = true;
  scene.cameras.main.fadeOut(140, 7, 6, 15);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}

export function fadeIn(scene: Phaser.Scene) {
  (scene as any).__leaving = false;
  scene.cameras.main.fadeIn(160, 7, 6, 15);
}

export function coinLabel(scene: Phaser.Scene, x: number, y: number) {
  const c = scene.add.container(x, y);
  const ic = scene.add.image(0, 7, 'ic_coin').setOrigin(1, 0.5).setScale(2);
  const t = T(scene, -16, 0, '', { align: 'right', color: C.gold });
  const update = () => t.setText(App.store.coins.toLocaleString());
  update();
  c.add([ic, t]);
  const off = App.store.onChange(update);
  scene.events.once('shutdown', off);
  return c;
}

/** 상단 제목줄 + 뒤로 가기 + 코인 */
export function topBar(scene: Phaser.Scene, title: string, back?: () => void, color = C.accent) {
  const g = scene.add.graphics();
  g.fillStyle(0x07060f, 0.85);
  g.fillRect(0, 0, W, 26);
  g.fillStyle(hexNum(color), 1);
  g.fillRect(0, 26, W, 1);
  let x = 10;
  if (back) {
    button(scene, 6, 4, 44, 18, '◀ 뒤로', back, { size: 10, silent: true });
    x = 58;
    scene.input.keyboard?.on('keydown-ESC', back);
  }
  T(scene, x, 6, title, { bold: true, color });
  coinLabel(scene, W - 10, 6);
}

export function toast(scene: Phaser.Scene, msg: string, color = C.text) {
  const t = T(scene, W / 2, H - 46, msg, { align: 'center', color, stroke: true }).setDepth(1000);
  const bg = scene.add
    .rectangle(W / 2, H - 40, t.width + 20, 22, 0x07060f, 0.9)
    .setStrokeStyle(1, C.lineHi)
    .setDepth(999);
  scene.tweens.add({
    targets: [t, bg],
    alpha: 0,
    delay: 1400,
    duration: 300,
    onComplete: () => {
      t.destroy();
      bg.destroy();
    },
  });
}

/** 캐릭터 슬롯 (테두리 = 등급 색) */
export function charSlot(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  charId: string | null,
  o: { owned?: boolean; onClick?: () => void; selected?: boolean; label?: boolean } = {},
) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const ch = charId ? App.content.char(charId) : null;
  const owned = o.owned ?? true;
  const col = ch ? hexNum(RARITY_COLORS[ch.rarity]) : 0x3a3270;
  g.fillStyle(0x07060f, 1);
  g.fillRect(-1, -1, size + 2, size + 2);
  g.fillStyle(ch && owned ? Phaser.Display.Color.ValueToColor(col).darken(70).color : 0x110f20, 1);
  g.fillRect(0, 0, size, size);
  g.lineStyle(o.selected ? 2 : 1, o.selected ? 0xffffff : owned ? col : 0x2c2845, 1);
  g.strokeRect(o.selected ? 1 : 0.5, o.selected ? 1 : 0.5, size - (o.selected ? 2 : 1), size - (o.selected ? 2 : 1));
  c.add(g);
  if (ch) {
    const img = scene.add.image(size / 2, size / 2, 'spr_' + ch.id);
    fitImage(img, size - 6, size - 6);
    if (!owned) img.setTintFill(0x231f3d);
    c.add(img);
    if (ch.rarity === 5 && owned) {
      const tw = scene.tweens.addCounter({
        from: 0,
        to: 360,
        duration: 2400,
        repeat: -1,
        onUpdate: (tw) => {
          const hue = (tw.getValue() ?? 0) / 360;
          g.lineStyle(1, Phaser.Display.Color.HSVToRGB(hue, 0.6, 1).color as number, 1);
          g.strokeRect(0.5, 0.5, size - 1, size - 1);
        },
      });
      c.once('destroy', () => tw.remove());
    }
    const b = App.store.save.owned[ch.id]?.b ?? 0;
    if (owned && b > 0) c.add(T(scene, size - 3, size - 12, '+' + b, { size: 10, align: 'right', color: C.gold, stroke: true }));
    if (o.label) {
      c.add(T(scene, size / 2, size + 2, owned ? ch.name : '???', { size: 10, align: 'center', color: owned ? C.text : C.faint }));
    }
  }
  if (o.onClick) {
    const z = scene.add.zone(0, 0, size, size).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => {
      audio.sfx('select');
      o.onClick!();
    });
    c.add(z);
  }
  return c;
}

export function starsRow(scene: Phaser.Scene, x: number, y: number, n: number, max = 3, scale = 1) {
  const c = scene.add.container(x, y);
  for (let i = 0; i < max; i++) {
    c.add(scene.add.image(i * 11 * scale, 0, i < n ? 'ic_star' : 'ic_star_empty').setOrigin(0, 0).setScale(scale));
  }
  return c;
}

export function rarityName(r: number) {
  return App.content.rarity(r)?.name ?? '';
}

/** 화면 배경 (영역 배경 + 어둡게) */
export function bg(scene: Phaser.Scene, key: string, dim = 0.45) {
  scene.add.image(0, 0, 'bg_' + key).setOrigin(0).setDisplaySize(W, H);
  if (dim > 0) scene.add.rectangle(0, 0, W, H, 0x07060f, dim).setOrigin(0);
}
