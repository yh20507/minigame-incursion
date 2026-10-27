import Phaser from 'phaser';
import { App, C, H, W, hexNum } from '../core/app';
import { audio } from '../core/audio';
import { RARITY_COLORS, fitImage, portraitKey } from '../core/art';
import { passiveLabel } from '../core/store';
import type { CharDef } from '../core/types';
import { showFullArt } from '../core/viewer';
import { T, bg, button, charSlot, fadeIn, go, panel, rarityName, toast, topBar } from '../core/ui';

interface Tab {
  id: string;
  name: string;
  color: string;
  chars: CharDef[];
}

export class CollectionScene extends Phaser.Scene {
  constructor() {
    super('Collection');
  }

  tabs(): Tab[] {
    const all = App.content.chars;
    const tabs: Tab[] = [
      { id: 'original', name: '오리지널', color: C.accent, chars: all.filter((c) => c.origin === 'original') },
      { id: 'special', name: '특별', color: '#b48cff', chars: all.filter((c) => c.origin === 'special') },
    ];
    for (const w of App.store.visibleWorlds()) {
      tabs.push({ id: w.id, name: w.name, color: w.color, chars: all.filter((c) => c.origin === 'world' && c.domain === w.id) });
    }
    return tabs;
  }

  create(data: { tab?: string; sel?: string; page?: number }) {
    fadeIn(this);
    bg(this, 'rift', 0.6);
    const st = App.store;
    const total = App.content.chars.length;
    const owned = st.ownedChars().length;
    topBar(this, `도감  ${owned}/${total}`, () => go(this, 'WorldMap'));

    const tabs = this.tabs();
    const tab = tabs.find((t) => t.id === data?.tab) ?? tabs[0];
    const page = data?.page ?? 0;
    const tw = Math.min(88, Math.floor((W - 20) / tabs.length) - 4);
    tabs.forEach((t, i) => {
      const have = t.chars.filter((c) => st.owns(c.id)).length;
      button(this, 10 + i * (tw + 4), 32, tw, 26, t.name, () => go(this, 'Collection', { tab: t.id }), {
        size: 10,
        color: t.color,
        sub: `${have}/${t.chars.length}`,
      });
      if (t.id === tab.id) {
        const g = this.add.graphics();
        g.lineStyle(2, 0xffffff);
        g.strokeRect(9 + i * (tw + 4), 31, tw + 2, 28);
      }
    });

    const list = [...tab.chars].sort((a, b) => b.rarity - a.rarity);
    const per = 18,
      cols = 6,
      size = 46,
      gap = 12;
    const pages = Math.max(1, Math.ceil(list.length / per));
    const shown = list.slice(page * per, page * per + per);
    const sel = data?.sel ?? shown.find((c) => st.owns(c.id))?.id ?? shown[0]?.id;
    shown.forEach((c, i) => {
      const x = 12 + (i % cols) * (size + gap),
        y = 68 + Math.floor(i / cols) * (size + 22);
      charSlot(this, x, y, size, c.id, {
        owned: st.owns(c.id),
        selected: c.id === sel,
        label: true,
        onClick: () => go(this, 'Collection', { tab: tab.id, sel: c.id, page }),
      });
    });
    if (pages > 1) {
      button(this, 12, 278, 40, 20, '◀', () => go(this, 'Collection', { tab: tab.id, page: (page + pages - 1) % pages }), { size: 10 });
      T(this, 72, 282, `${page + 1}/${pages}`, { size: 10, align: 'center' });
      button(this, 92, 278, 40, 20, '▶', () => go(this, 'Collection', { tab: tab.id, page: (page + 1) % pages }), { size: 10 });
    }

    // 세트 진행
    let setText = '';
    if (tab.id === 'original') {
      const lines = App.content.domains.map((d) => {
        const cs = App.content.chars.filter((c) => c.origin === 'original' && c.domain === d.id);
        return `${d.name} ${cs.filter((c) => st.owns(c.id)).length}/${cs.length}`;
      });
      setText = `영역 세트 (그 영역 게임 코인 +${App.content.synergies.set.value}%): ` + lines.join(' · ');
    } else if (tab.id !== 'special') {
      const have = tab.chars.filter((c) => st.owns(c.id)).length;
      setText = `${App.content.synergies.worldSet.desc} (${have}/${tab.chars.length})`;
    }
    if (setText) T(this, 12, 308, setText, { size: 10, color: C.dim, wrap: 360 });
    T(this, 12, H - 18, `만능 조각 ${st.itemCount('shard')}개`, { size: 10, color: '#b48cff' });

    if (sel) this.detail(sel, tab.id, page);
  }

  detail(id: string, tab: string, page: number) {
    const st = App.store;
    const c = App.content.char(id);
    const own = st.owns(id);
    const enh = App.content.gacha.enhance;
    const x = 392,
      y = 66,
      w = W - x - 8,
      h = 288;
    const col = RARITY_COLORS[c.rarity];
    panel(this, x, y, w, h, { border: hexNum(col) });
    const img = this.add.image(x + w / 2, y + 116, portraitKey(this, id)).setOrigin(0.5, 1);
    fitImage(img, w - 20, 108);
    if (!own) img.setTintFill(0x1a1630);
    T(this, x + 10, y + 120, own ? c.name : '???', { size: c.name.length > 6 ? 12 : 24, color: '#ffffff', bold: true });
    T(this, x + 10, y + 148, `${rarityName(c.rarity)}  ${App.content.domainName(c.domain)}${own ? ' · ' + c.title : ''}`, { size: 10, color: col, wrap: w - 20 });
    let ty = y + 164;
    if (own) {
      const o = st.save.owned[id];
      const mult = 1 + enh.bonusPerLevel * o.b;
      for (const p of c.passives) {
        const v = p.type === 'shield' ? p.value + (o.b >= enh.max ? 1 : 0) : Math.round(p.value * mult * 10) / 10;
        T(this, x + 10, ty, '◆ ' + passiveLabel({ ...p, value: v }, App.content.domainName(p.domain ?? '')), { size: 10, color: C.good });
        ty += 12;
      }
      T(this, x + 10, ty + 2, c.desc, { size: 10, color: C.text, wrap: w - 20 });
      const maxed = o.b >= enh.max;
      const need = enh.need[o.b] ?? 0;
      T(this, x + 10, y + h - 40, `강화 ${o.b}/${enh.max}${maxed ? ' (최대)' : ` · 다음 강화 중복 ${o.d ?? 0}/${need}`}`, { size: 10, color: C.gold });
      const d = new Date(o.at);
      T(this, x + 10, y + h - 26, `획득 ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, { size: 10, color: C.faint });

      let bx = x + w - 8;
      const addBtn = (label: string, fn: () => void, color?: string) => {
        bx -= 70;
        button(this, bx, y + h - 26, 66, 20, label, fn, { size: 10, color });
        bx -= 4;
      };
      if (st.save.team.leader !== id)
        addBtn('리더로', () => {
          const sup = st.save.team.supports.map((s) => (s === id ? st.save.team.leader : s));
          st.setTeam(id, sup).then(() => go(this, 'Collection', { tab, sel: id, page }));
        });
      if (c.rarity <= 3 && !maxed && st.itemCount('shard') > 0)
        addBtn('조각 사용', async () => {
          const r = await st.useShard(id);
          if (r?.levelUp) audio.sfx('legend');
          go(this, 'Collection', { tab, sel: id, page });
        }, '#b48cff');
      if (c.rarity >= 4) addBtn('일러스트', () => showFullArt(this, id), c.rarity >= 5 ? '#ff5fd2' : '#ffc845');
    } else {
      const how = c.origin === 'special' ? `획득 조건: ${c.unlock ?? '스토리'}` : c.origin === 'world' ? `${App.content.domainName(c.domain)} 한정 균열에서 만날 수 있다.` : '상시 균열에서 만날 수 있다.';
      T(this, x + 10, ty, how, { size: 10, color: C.dim, wrap: w - 20 });
    }
    void toast;
  }
}
