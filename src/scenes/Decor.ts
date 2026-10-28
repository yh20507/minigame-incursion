import Phaser from 'phaser';
import { App, C, H, W, hexNum } from '../core/app';
import { audio } from '../core/audio';
import { RARITY_COLORS, fitImage, placeholderFull } from '../core/art';
import { ACCENTS, applyAccent, lobbyMusicName, playLobbyMusic } from '../core/lobby';
import type { LobbyConfig } from '../core/types';
import { T, bg, button, charSlot, fadeIn, go, panel, toast, topBar } from '../core/ui';

type Tab = 'bg' | 'walk' | 'music' | 'color';
type BgItem = LobbyConfig['bgs'][number];

/** 로비 꾸미기 */
export class DecorScene extends Phaser.Scene {
  constructor() {
    super('Decor');
  }

  get lb() {
    return App.store.save.extra.lobby;
  }

  save() {
    App.store.saveMeta();
  }

  create(data: { tab?: Tab; page?: number }) {
    fadeIn(this);
    bg(this, 'rift', 0.65);
    const tab: Tab = data?.tab ?? 'bg';
    const page = data?.page ?? 0;
    topBar(this, '로비 꾸미기', () => go(this, 'Lobby'));
    const tabs: [Tab, string][] = [
      ['bg', '배경'],
      ['walk', '캐릭터'],
      ['music', '음악'],
      ['color', '색'],
    ];
    tabs.forEach(([k, label], i) => {
      button(this, 10 + i * 84, 32, 80, 24, label, () => go(this, 'Decor', { tab: k }), { size: 10 });
      if (k === tab) {
        const g = this.add.graphics();
        g.lineStyle(2, 0xffffff);
        g.strokeRect(9 + i * 84, 31, 82, 26);
      }
    });
    button(this, W - 130, 32, 120, 24, '로비에서 보기 ▶', () => go(this, 'Lobby'), { size: 10, color: C.accent });
    if (tab === 'bg') this.bgTab(page);
    if (tab === 'walk') this.walkTab(page);
    if (tab === 'music') this.musicTab(page);
    if (tab === 'color') this.colorTab();
  }

  // ------------------------------------------------ 배경
  bgCandidates(): (BgItem & { label: string; color: string })[] {
    const st = App.store;
    const out: (BgItem & { label: string; color: string })[] = [];
    for (const c of st.ownedChars().sort((a, b) => b.rarity - a.rarity)) {
      if (c.rarity >= 4) out.push({ k: 'full', id: c.id, label: c.name, color: RARITY_COLORS[c.rarity] });
      out.push({ k: 'art', id: c.id, label: c.name, color: RARITY_COLORS[c.rarity] });
    }
    for (const d of App.content.domains) if (st.isDomainUnlocked(d)) out.push({ k: 'bg', id: d.id, label: d.name, color: d.color });
    out.push({ k: 'bg', id: 'rift', label: '균열', color: '#b48cff' });
    for (const w of App.store.visibleWorlds()) out.push({ k: 'bg', id: w.id, label: w.name, color: w.color });
    return out;
  }

  bgTab(page: number) {
    const lb = this.lb;
    const all = this.bgCandidates();
    const per = 24,
      cols = 8,
      size = 54,
      gap = 10;
    const pages = Math.max(1, Math.ceil(all.length / per));
    T(this, 10, 64, `로비 배경으로 쓸 그림을 고르세요 (최대 5장, 여러 장이면 슬라이드쇼) · ${lb.bgs.length}/5`, { size: 10, color: C.dim });
    all.slice(page * per, page * per + per).forEach((it, i) => {
      const x = 10 + (i % cols) * (size + gap),
        y = 80 + Math.floor(i / cols) * (size + 22);
      const key = it.k === 'bg' ? 'bg_' + it.id : (it.k === 'full' ? 'full_' : 'art_') + it.id;
      const idx = lb.bgs.findIndex((b) => b.k === it.k && b.id === it.id);
      const g = this.add.graphics();
      g.fillStyle(0x110f20, 1);
      g.fillRect(x, y, size, size);
      g.lineStyle(idx >= 0 ? 2 : 1, idx >= 0 ? 0xffffff : hexNum(it.color), 1);
      g.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
      if (this.textures.exists(key)) {
        const img = this.add.image(x + size / 2, y + size / 2, key);
        fitImage(img, size - 4, size - 4);
      }
      if (it.k === 'full') {
        const ultra = App.content.char(it.id).rarity >= 5;
        T(this, x + 2, y + 1, ultra ? '★5 특별' : '★4 특별', { size: 10, color: ultra ? '#ff5fd2' : C.gold, stroke: true });
        if (placeholderFull.has(it.id)) T(this, x + size - 2, y + size - 12, '임시', { size: 10, align: 'right', color: C.faint, stroke: true });
      }
      if (idx >= 0) T(this, x + size - 3, y + 1, String(idx + 1), { bold: true, align: 'right', color: '#ffffff', stroke: true });
      T(this, x + size / 2, y + size + 2, it.label.length > 5 ? it.label.slice(0, 5) + '…' : it.label, { size: 10, align: 'center', color: C.text });
      const z = this.add.zone(x, y, size, size).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        audio.sfx('select');
        if (idx >= 0) lb.bgs.splice(idx, 1);
        else if (lb.bgs.length >= 5) return toast(this, '최대 5장까지 고를 수 있어요');
        else lb.bgs.push({ k: it.k, id: it.id });
        this.save();
        go(this, 'Decor', { tab: 'bg', page });
      });
    });
    if (pages > 1) {
      button(this, 10, H - 30, 40, 22, '◀', () => go(this, 'Decor', { tab: 'bg', page: (page + pages - 1) % pages }), { size: 10 });
      T(this, 70, H - 26, `${page + 1}/${pages}`, { size: 10, align: 'center' });
      button(this, 90, H - 30, 40, 22, '▶', () => go(this, 'Decor', { tab: 'bg', page: (page + 1) % pages }), { size: 10 });
    }
    T(this, 300, H - 26, '넘기는 간격', { size: 10, color: C.dim });
    [5, 8, 15, 30].forEach((s, i) => {
      button(this, 370 + i * 52, H - 30, 48, 22, `${s}초`, () => {
        lb.interval = s;
        this.save();
        go(this, 'Decor', { tab: 'bg', page });
      }, { size: 10, color: lb.interval === s ? C.accent : undefined });
    });
  }

  // ------------------------------------------------ 캐릭터
  walkTab(page: number) {
    const lb = this.lb;
    const owned = App.store.ownedChars().sort((a, b) => b.rarity - a.rarity);
    const per = 26,
      cols = 13,
      size = 40,
      gap = 8;
    const pages = Math.max(1, Math.ceil(owned.length / per));
    T(this, 10, 64, `로비를 걸어다닐 캐릭터 (최대 3명, 안 고르면 편성 팀) · ${lb.walkers.length}/3`, { size: 10, color: C.dim });
    owned.slice(page * per, page * per + per).forEach((c, i) => {
      const x = 10 + (i % cols) * (size + gap),
        y = 82 + Math.floor(i / cols) * (size + 22);
      const on = lb.walkers.includes(c.id);
      charSlot(this, x, y, size, c.id, {
        selected: on,
        label: true,
        onClick: () => {
          if (on) lb.walkers = lb.walkers.filter((w) => w !== c.id);
          else if (lb.walkers.length >= 3) return toast(this, '최대 3명까지예요');
          else lb.walkers.push(c.id);
          this.save();
          go(this, 'Decor', { tab: 'walk', page });
        },
      });
    });
    if (pages > 1) {
      button(this, 10, H - 30, 40, 22, '◀', () => go(this, 'Decor', { tab: 'walk', page: (page + pages - 1) % pages }), { size: 10 });
      T(this, 70, H - 26, `${page + 1}/${pages}`, { size: 10, align: 'center' });
      button(this, 90, H - 30, 40, 22, '▶', () => go(this, 'Decor', { tab: 'walk', page: (page + 1) % pages }), { size: 10 });
    }
    if (lb.walkers.length) button(this, W - 130, H - 30, 120, 22, '선택 비우기', () => {
      lb.walkers = [];
      this.save();
      go(this, 'Decor', { tab: 'walk', page });
    }, { size: 10 });
  }

  // ------------------------------------------------ 음악
  musicTab(page: number) {
    const lb = this.lb;
    const st = App.store;
    const opts: string[] = [''];
    for (const k of audio.files.bgm) opts.push('bgm:' + k);
    for (const c of st.ownedChars()) if (audio.files.chars.has(c.id)) opts.push('char:' + c.id);
    for (const w of App.content.worlds) if (audio.files.worlds.has(w.id)) opts.push('world:' + w.id);
    const per = 9;
    const pages = Math.max(1, Math.ceil(opts.length / per));
    T(this, 10, 64, '로비에서 틀 곡 (누르면 바로 들려줘요)', { size: 10, color: C.dim });
    opts.slice(page * per, page * per + per).forEach((o, i) => {
      const y = 82 + i * 28;
      const on = lb.bgm === o;
      button(this, 10, y, 300, 24, (on ? '▶ ' : '') + lobbyMusicName(o), () => {
        lb.bgm = o;
        this.save();
        playLobbyMusic();
        go(this, 'Decor', { tab: 'music', page });
      }, { size: 10, color: on ? C.accent : undefined, silent: true });
    });
    panel(this, 330, 82, 300, 150);
    T(this, 342, 92, '곡 넣는 법', { bold: true, color: C.accent });
    T(
      this,
      342,
      112,
      'exe 옆 assets/audio 폴더에 넣고 다시 켜면 여기 나타나요.\n\nbgm/<화면>.mp3   화면 배경음\nchars/<캐릭터id>.mp3   캐릭터 테마곡\nworlds/<세계관id>.mp3   세계관 테마곡\n\n캐릭터 테마곡은 그 캐릭터를 갖고 있어야 고를 수 있어요.',
      { size: 10, color: C.text, wrap: 276 },
    );
    if (pages > 1) {
      button(this, 10, H - 30, 40, 22, '◀', () => go(this, 'Decor', { tab: 'music', page: (page + pages - 1) % pages }), { size: 10 });
      T(this, 70, H - 26, `${page + 1}/${pages}`, { size: 10, align: 'center' });
      button(this, 90, H - 30, 40, 22, '▶', () => go(this, 'Decor', { tab: 'music', page: (page + 1) % pages }), { size: 10 });
    }
  }

  // ------------------------------------------------ 색
  colorTab() {
    const lb = this.lb;
    T(this, 10, 64, '메뉴 강조색', { size: 10, color: C.dim });
    ACCENTS.forEach((col, i) => {
      const x = 10 + i * 60,
        y = 84;
      const g = this.add.graphics();
      g.fillStyle(hexNum(col), 1);
      g.fillRect(x, y, 52, 52);
      g.lineStyle(lb.accent === col ? 3 : 1, lb.accent === col ? 0xffffff : 0x07060f, 1);
      g.strokeRect(x + 1, y + 1, 50, 50);
      const z = this.add.zone(x, y, 52, 52).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        lb.accent = col;
        applyAccent(col);
        this.save();
        audio.sfx('confirm');
        go(this, 'Decor', { tab: 'color' });
      });
    });
  }
}
