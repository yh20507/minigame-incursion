import Phaser from 'phaser';
import { App, C, H, W, hexNum } from '../core/app';
import { audio } from '../core/audio';
import { exploreOpen, exploreProgress, expeditionReward, landed } from '../core/explore';
import { rollItem } from '../core/gacha';
import { T, bg, button, charSlot, fadeIn, go, panel, toast, topBar } from '../core/ui';

/** 원정대 · 새 대륙 탐사 */
export class ExpeditionScene extends Phaser.Scene {
  constructor() {
    super('Expedition');
  }

  create(data: { sel?: string[]; hours?: number; page?: number }) {
    fadeIn(this);
    audio.bgm('expedition', 50, 'lydian', 84, ['expedition', 'map']);
    bg(this, 'rift', 0.55);
    topBar(this, '원정대 · 탐사', () => go(this, 'Lobby'));
    if (!exploreOpen()) {
      T(this, W / 2, 160, '최종장을 깨면 균열 너머 탐사가 시작돼요.', { align: 'center', color: C.dim });
      return;
    }
    this.frontierPanel();
    this.expeditionPanel(data ?? {});
  }

  frontierPanel() {
    const f = App.content.frontier;
    const st = App.store;
    const p = exploreProgress();
    const x = 10,
      y = 34,
      w = 300,
      h = 316;
    const col = hexNum(f.color);
    panel(this, x, y, w, h, { border: col });
    T(this, x + 12, y + 8, '균열 너머 해역', { size: 10, color: f.color });
    const name = p >= 0.5 ? f.name : '???';
    T(this, x + 12, y + 22, name, { size: 24, color: '#ffffff' });
    if (p >= 0.5) T(this, x + 12, y + 52, f.subtitle, { size: 10, color: C.dim });

    // 안개 속 실루엣
    const gx = x + 12,
      gy = y + 70,
      gw = w - 24,
      gh = 120;
    const g = this.add.graphics();
    g.fillStyle(0x0b1020, 1);
    g.fillRect(gx, gy, gw, gh);
    const reveal = p;
    g.fillStyle(Phaser.Display.Color.ValueToColor(col).darken(60 - reveal * 40).color, Math.min(1, 0.15 + reveal));
    // 탑 실루엣
    const cx = gx + gw / 2;
    g.fillRect(cx - 14, gy + 30, 28, gh - 30);
    g.fillTriangle(cx - 20, gy + 32, cx + 20, gy + 32, cx, gy + 6);
    g.fillRect(cx - 60, gy + 70, 30, gh - 70);
    g.fillRect(cx + 34, gy + 60, 26, gh - 60);
    if (reveal >= 0.75) {
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(cx, gy + 48, 7);
      g.lineStyle(1, 0x0b1020, 1);
      g.lineBetween(cx, gy + 48, cx, gy + 43);
      g.lineBetween(cx, gy + 48, cx + 4, gy + 48);
    }
    // 안개
    for (let i = 0; i < 26; i++) {
      const fog = this.add.rectangle(gx + Math.random() * gw, gy + Math.random() * gh, 30 + Math.random() * 60, 8 + Math.random() * 10, 0xc9d6ff, (1 - reveal) * 0.25);
      this.tweens.add({ targets: fog, x: fog.x + 30, yoyo: true, repeat: -1, duration: 2000 + Math.random() * 2000 });
    }
    // 게이지
    const by = gy + gh + 10;
    g.fillStyle(0x07060f, 1);
    g.fillRect(gx, by, gw, 10);
    g.fillStyle(col, 1);
    g.fillRect(gx + 1, by + 1, (gw - 2) * p, 8);
    for (const m of [0.25, 0.5, 0.75]) {
      g.fillStyle(0x07060f, 1);
      g.fillRect(gx + gw * m, by, 1, 10);
    }
    const e = st.save.extra.explore;
    T(this, gx, by + 14, `좌표 조각 ${Math.min(e.shards, f.need)}/${f.need}`, { size: 10, color: f.color });
    const stage = [...f.stages].reverse().find((s) => p * 100 >= s.at) ?? f.stages[0];
    T(this, gx, by + 30, landed() ? f.landed : stage.text, { size: 10, color: C.text, wrap: gw });
    if (!landed()) {
      T(this, gx, y + h - 40, '조각은 미니게임 별·클리어, 보스, 도전 모드, 원정으로 모여요.', { size: 10, color: C.faint, wrap: gw });
      if (p >= 1) {
        const b = button(this, gx, y + h - 22 - 6, gw, 24, '상륙전 도전!', () => go(this, 'Prep', { mode: 'landing', domain: 'rift' }), { color: f.color });
        this.tweens.add({ targets: b, alpha: 0.7, yoyo: true, repeat: -1, duration: 500 });
      }
    }
  }

  expeditionPanel(data: { sel?: string[]; hours?: number; page?: number }) {
    const st = App.store;
    const f = App.content.frontier;
    const x = 320,
      y = 34,
      w = 310,
      h = 316;
    panel(this, x, y, w, h);
    T(this, x + 12, y + 8, '원정대 파견', { bold: true, color: C.accent });
    const ex = st.save.extra.expedition;
    if (ex) {
      // 진행 중
      T(this, x + 12, y + 28, `${ex.hours}시간 원정 중`, { size: 10, color: C.dim });
      ex.members.forEach((id, i) => charSlot(this, x + 12 + i * 60, y + 46, 52, id, { label: true }));
      const rw = expeditionReward(ex.members, ex.hours);
      T(this, x + 12, y + 128, `예상 보상: 좌표 조각 ${rw.shards} · 코인 ${rw.coins}${rw.items ? ` · 아이템 ${rw.items}개` : ''}`, { size: 10, color: C.gold, wrap: w - 24 });
      const left = T(this, x + 12, y + 156, '', { color: C.text });
      const end = ex.start + ex.hours * 3600 * 1000;
      const claim = button(this, x + 12, y + h - 40, w - 24, 30, '보상 받기', () => this.claim(), { color: C.accent });
      const tick = () => {
        const ms = end - Date.now();
        if (ms <= 0) {
          left.setText('원정 완료!').setColor(C.good);
          claim.setEnabled(true);
        } else {
          const hh = Math.floor(ms / 3600000),
            mm = Math.floor((ms % 3600000) / 60000),
            ss = Math.floor((ms % 60000) / 1000);
          left.setText(`남은 시간 ${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`);
          claim.setEnabled(false);
        }
      };
      tick();
      this.time.addEvent({ delay: 1000, loop: true, callback: tick });
      button(this, x + w - 92, y + 6, 80, 20, '원정 취소', async () => {
        st.save.extra.expedition = null;
        await st.saveMeta();
        go(this, 'Expedition');
      }, { size: 10 });
      return;
    }
    // 새 원정 꾸리기
    const sel = data.sel ?? [];
    const hours = data.hours ?? f.expedition.hours[0];
    T(this, x + 12, y + 28, '보낼 캐릭터 3명 (별이 높을수록 보상 증가)', { size: 10, color: C.dim });
    const owned = st.ownedChars().sort((a, b) => b.rarity - a.rarity);
    const per = 15,
      cols = 5,
      size = 40,
      gap = 16;
    const page = data.page ?? 0;
    const pages = Math.max(1, Math.ceil(owned.length / per));
    owned.slice(page * per, page * per + per).forEach((c, i) => {
      const cx = x + 12 + (i % cols) * (size + gap),
        cy = y + 44 + Math.floor(i / cols) * (size + 20);
      const on = sel.includes(c.id);
      charSlot(this, cx, cy, size, c.id, {
        selected: on,
        label: true,
        onClick: () => {
          const next = on ? sel.filter((s) => s !== c.id) : sel.length >= 3 ? sel : [...sel, c.id];
          if (!on && sel.length >= 3) toast(this, '3명까지예요');
          go(this, 'Expedition', { sel: next, hours, page });
        },
      });
    });
    if (pages > 1) {
      button(this, x + w - 70, y + 6, 26, 20, '◀', () => go(this, 'Expedition', { sel, hours, page: (page + pages - 1) % pages }), { size: 10 });
      button(this, x + w - 40, y + 6, 26, 20, '▶', () => go(this, 'Expedition', { sel, hours, page: (page + 1) % pages }), { size: 10 });
    }
    const hy = y + h - 74;
    f.expedition.hours.forEach((hr, i) => {
      button(this, x + 12 + i * 64, hy, 58, 22, `${hr}시간`, () => go(this, 'Expedition', { sel, hours: hr, page }), { size: 10, color: hours === hr ? C.accent : undefined });
    });
    const rw = expeditionReward(sel, hours);
    T(this, x + 210, hy + 4, sel.length ? `조각 ${rw.shards} · 코인 ${rw.coins}` : '', { size: 10, color: C.gold });
    const go2 = button(this, x + 12, y + h - 40, w - 24, 30, `원정 보내기 (${sel.length}/3)`, async () => {
      st.save.extra.expedition = { members: sel, start: Date.now(), hours };
      await st.saveMeta();
      audio.sfx('go');
      go(this, 'Expedition');
    }, { color: C.accent });
    if (sel.length !== 3) go2.setEnabled(false);
  }

  async claim() {
    const st = App.store;
    const ex = st.save.extra.expedition;
    if (!ex || Date.now() < ex.start + ex.hours * 3600000) return;
    const rw = expeditionReward(ex.members, ex.hours);
    const items: Record<string, number> = {};
    for (let i = 0; i < rw.items; i++) {
      const it = rollItem(App.content.items.filter((x) => x.effect !== 'instant'), Math.random);
      items[it.id] = (items[it.id] ?? 0) + 1;
    }
    st.save.extra.expedition = null;
    if (!landed()) st.save.extra.explore.shards += rw.shards;
    await st.saveMeta();
    await st.addCoins(rw.coins);
    await st.addItems(items);
    audio.sfx('coin');
    const names = Object.entries(items).map(([k, n]) => `${App.content.item(k)?.name} ${n}`).join(', ');
    toast(this, `좌표 조각 +${rw.shards} · 코인 +${rw.coins}${names ? ' · ' + names : ''}`, C.gold);
    this.time.delayedCall(1200, () => go(this, 'Expedition'));
  }
}
