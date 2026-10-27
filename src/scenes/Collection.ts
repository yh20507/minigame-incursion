import Phaser from 'phaser';
import { App, C, W, hexNum } from '../core/app';
import { RARITY_COLORS, fitImage } from '../core/art';
import { passiveLabel } from '../core/store';
import { T, bg, button, charSlot, fadeIn, go, panel, rarityName, topBar } from '../core/ui';

export class CollectionScene extends Phaser.Scene {
  constructor() {
    super('Collection');
  }

  create(data: { tab?: string; sel?: string }) {
    fadeIn(this);
    bg(this, 'rift', 0.6);
    const st = App.store;
    const total = App.content.chars.length;
    const owned = st.ownedChars().length;
    topBar(this, `도감  ${owned}/${total}`, () => go(this, 'WorldMap'));

    const tabs = [...App.content.domains.map((d) => ({ id: d.id, name: d.name, color: d.color })), { id: 'rift', name: '균열', color: '#b48cff' }];
    const tab = data?.tab ?? tabs[0].id;
    tabs.forEach((t, i) => {
      const chars = App.content.chars.filter((c) => c.domain === t.id);
      const have = chars.filter((c) => st.owns(c.id)).length;
      const b = button(this, 10 + i * 94, 32, 90, 26, t.name, () => go(this, 'Collection', { tab: t.id }), {
        size: 10,
        color: t.color,
        sub: `${have}/${chars.length}`,
      });
      if (t.id === tab) {
        const g = this.add.graphics();
        g.lineStyle(2, 0xffffff);
        g.strokeRect(9 + i * 94, 31, 92, 28);
        void b;
      }
    });

    const list = App.content.chars.filter((c) => c.domain === tab).sort((a, b) => b.rarity - a.rarity || (a.pool === b.pool ? 0 : a.pool ? 1 : -1));
    const sel = data?.sel ?? list.find((c) => st.owns(c.id))?.id ?? list[0]?.id;
    const size = 52,
      gap = 10,
      cols = 6;
    list.forEach((c, i) => {
      const x = 12 + (i % cols) * (size + gap),
        y = 68 + Math.floor(i / cols) * (size + 20);
      charSlot(this, x, y, size, c.id, {
        owned: st.owns(c.id),
        selected: c.id === sel,
        label: true,
        onClick: () => go(this, 'Collection', { tab, sel: c.id }),
      });
    });

    // 세트 진행
    if (tab !== 'rift') {
      const poolChars = App.content.chars.filter((c) => c.pool && c.domain === tab);
      const have = poolChars.filter((c) => st.owns(c.id)).length;
      const done = have === poolChars.length;
      T(this, 12, 318, `세트 보너스 (뽑기 캐릭터 ${have}/${poolChars.length})`, { size: 10, color: done ? C.good : C.dim });
      T(this, 12, 332, App.content.synergies.set.desc, { size: 10, color: done ? C.good : C.faint });
    }

    if (sel) this.detail(sel);
  }

  detail(id: string) {
    const st = App.store;
    const c = App.content.char(id);
    const own = st.owns(id);
    const x = 392,
      y = 66,
      w = W - x - 10,
      h = 284;
    const col = RARITY_COLORS[c.rarity];
    panel(this, x, y, w, h, { border: hexNum(col) });
    const img = this.add.image(x + w / 2, y + 128, 'art_' + id).setOrigin(0.5, 1);
    fitImage(img, w - 20, 120);
    if (!own) img.setTintFill(0x1a1630);
    T(this, x + 10, y + 134, own ? c.name : '???', { size: 24, color: '#ffffff' });
    T(this, x + 10, y + 162, `${rarityName(c.rarity)} · ${App.content.domainName(c.domain)}${own ? ' · ' + c.title : ''}`, { size: 10, color: col });
    let ty = y + 180;
    if (own) {
      const o = st.save.owned[id];
      for (const p of c.passives) {
        T(this, x + 10, ty, '◆ ' + passiveLabel(p, App.content.domainName(p.domain ?? '')), { size: 10, color: C.good });
        ty += 13;
      }
      T(this, x + 10, ty + 2, c.desc, { size: 10, color: C.text, wrap: w - 20 });
      ty += 46;
      const d = new Date(o.at);
      T(this, x + 10, y + h - 30, `돌파 ${o.b}/${App.content.gacha.maxBreakthrough} · 패시브 x${(1 + 0.2 * o.b).toFixed(1)}`, { size: 10, color: C.gold });
      T(this, x + 10, y + h - 16, `획득 ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, { size: 10, color: C.faint });
      if (st.save.team.leader !== id)
        button(this, x + w - 86, y + h - 30, 78, 22, '리더로', () => {
          const sup = st.save.team.supports.map((s) => (s === id ? st.save.team.leader : s));
          st.setTeam(id, sup).then(() => go(this, 'Collection', { tab: c.domain, sel: id }));
        }, { size: 10 });
      else T(this, x + w - 10, y + h - 24, '현재 리더', { size: 10, color: C.accent, align: 'right' });
    } else {
      T(this, x + 10, ty, c.pool ? '차원 균열에서 만날 수 있다.' : `획득 조건: ${c.unlock ?? '???'}`, { size: 10, color: C.dim, wrap: w - 20 });
    }
    void Phaser;
  }
}
