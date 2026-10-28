import Phaser from 'phaser';
import { App, C, H, W, hexNum } from '../core/app';
import { audio } from '../core/audio';
import { RARITY_COLORS } from '../core/art';
import { showFullArt } from '../core/viewer';
import { T, bg, button, charSlot, fadeIn, go, panel, toast, topBar } from '../core/ui';

type Tab = 'attend' | 'titles' | 'tickets';

/** 보상: 출석 · 칭호 · ★5 선택권 */
export class RewardsScene extends Phaser.Scene {
  busy = false;
  constructor() {
    super('Rewards');
  }

  create(data: { tab?: Tab; page?: number }) {
    fadeIn(this);
    this.busy = false;
    bg(this, 'rift', 0.6);
    topBar(this, '보상', () => go(this, 'Lobby'));
    const tab: Tab = data?.tab ?? 'attend';
    const st = App.store;
    const tabs: [Tab, string, number][] = [
      ['attend', '출석', 0],
      ['titles', '칭호', st.claimableTitles().length],
      ['tickets', '★5 선택권', st.availableTickets().filter((t) => !st.save.extra.tickets.includes(t.id)).length],
    ];
    tabs.forEach(([k, label, n], i) => {
      button(this, 10 + i * 104, 32, 100, 24, n ? `${label} (${n})` : label, () => go(this, 'Rewards', { tab: k }), {
        size: 10,
        color: n ? C.gold : undefined,
      });
      if (k === tab) {
        const g = this.add.graphics();
        g.lineStyle(2, 0xffffff);
        g.strokeRect(9 + i * 104, 31, 102, 26);
      }
    });
    if (tab === 'attend') this.attendTab();
    if (tab === 'titles') this.titlesTab(data?.page ?? 0);
    if (tab === 'tickets') this.ticketsTab();
  }

  // ------------------------------------------------ 출석
  attendTab() {
    const a = App.store.save.extra.attend;
    const list = App.content.rewards.attendance;
    const end = a.start ? new Date(Date.parse(a.start) + 27 * 86400000) : null;
    const endKey = end ? `${end.getMonth() + 1}/${end.getDate()}` : '';
    T(this, 10, 64, `매일 처음 접속하면 도장 한 칸 · 이번 주기 ${a.days}/28일${endKey ? ` (~${endKey}까지, 지나면 처음부터)` : ''} · 누적 ${a.total}일`, { size: 10, color: C.dim });
    const cw = 86,
      ch = 64;
    list.forEach((r, i) => {
      const x = 10 + (i % 7) * (cw + 3),
        y = 80 + Math.floor(i / 7) * (ch + 4);
      const done = r.day <= a.days;
      const today = r.day === a.days && a.last === todayKey();
      const big = r.day % 7 === 0;
      const g = this.add.graphics();
      g.fillStyle(done ? 0x2a2140 : C.panel, 1);
      g.fillRect(x, y, cw, ch);
      g.lineStyle(today ? 2 : 1, today ? 0xffffff : big ? hexNum(C.gold) : 0x3a3458, 1);
      g.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
      T(this, x + 4, y + 3, `${r.day}일`, { size: 10, color: big ? C.gold : C.dim });
      let ty = y + 18;
      if (r.coins) {
        T(this, x + cw / 2, ty, `${r.coins.toLocaleString()} 코인`, { size: 10, align: 'center', color: C.gold });
        ty += 14;
      }
      for (const [id, n] of Object.entries(r.items ?? {})) {
        const it = App.content.item(id);
        T(this, x + cw / 2, ty, `${it?.name ?? id}${n > 1 ? ' ×' + n : ''}`, { size: 10, align: 'center', color: it?.color ?? C.text });
        ty += 14;
      }
      if (done) {
        const s = T(this, x + cw - 6, y + 3, '✔', { size: 12, align: 'right', color: '#7dffb0' });
        if (today) this.tweens.add({ targets: s, scale: 1.3, yoyo: true, repeat: -1, duration: 500 });
      }
    });
  }

  // ------------------------------------------------ 칭호
  titlesTab(page: number) {
    const st = App.store;
    const list = App.content.rewards.titles;
    const per = 7;
    const pages = Math.max(1, Math.ceil(list.length / per));
    const eq = st.equippedTitle();
    T(this, 10, 64, `조건을 채우면 코인을 받고, 고른 칭호는 로비에 표시돼요 · 지금 칭호: ${eq ? eq.name : '없음'}`, { size: 10, color: C.dim });
    list.slice(page * per, page * per + per).forEach((t, i) => {
      const y = 80 + i * 36;
      const p = st.titleProgress(t);
      const done = p.cur >= p.need;
      const claimed = st.save.extra.titles.claimed.includes(t.id);
      panel(this, 10, y, W - 20, 32, { border: claimed ? hexNum(C.gold) : done ? 0xffffff : undefined });
      T(this, 20, y + 4, t.name, { bold: true, color: claimed ? C.gold : done ? '#ffffff' : C.text });
      T(this, 20, y + 18, t.desc, { size: 10, color: C.dim });
      // 진행 막대
      const bx = 300,
        bw = 150;
      const g = this.add.graphics();
      g.fillStyle(0x07060f, 1);
      g.fillRect(bx, y + 12, bw, 8);
      g.fillStyle(done ? hexNum(C.gold) : C.accentN, 1);
      g.fillRect(bx + 1, y + 13, (bw - 2) * Math.min(1, p.cur / p.need), 6);
      T(this, bx + bw / 2, y + 22, `${Math.min(p.cur, p.need)}/${p.need}`, { size: 10, align: 'center', color: C.dim });
      T(this, bx - 8, y + 10, `${t.coins.toLocaleString()} 코인`, { size: 10, align: 'right', color: C.gold });
      const btnX = W - 110;
      if (!claimed) {
        button(this, btnX, y + 4, 92, 24, done ? '받기' : '진행 중', async () => {
          if (this.busy) return;
          this.busy = true;
          const n = await st.claimTitle(t.id);
          audio.sfx('coin');
          toast(this, `칭호 「${t.name}」 · 코인 +${n}`, C.gold);
          this.time.delayedCall(700, () => go(this, 'Rewards', { tab: 'titles', page }));
        }, { size: 10, color: C.gold, disabled: !done });
      } else if (eq?.id === t.id) {
        button(this, btnX, y + 4, 92, 24, '장착 중', () => {}, { size: 10, color: C.accent, disabled: true });
      } else {
        button(this, btnX, y + 4, 92, 24, '장착', async () => {
          await st.equipTitle(t.id);
          audio.sfx('confirm');
          go(this, 'Rewards', { tab: 'titles', page });
        }, { size: 10 });
      }
    });
    if (pages > 1) {
      button(this, 10, H - 28, 40, 22, '◀', () => go(this, 'Rewards', { tab: 'titles', page: (page + pages - 1) % pages }), { size: 10 });
      T(this, 70, H - 24, `${page + 1}/${pages}`, { size: 10, align: 'center' });
      button(this, 90, H - 28, 40, 22, '▶', () => go(this, 'Rewards', { tab: 'titles', page: (page + 1) % pages }), { size: 10 });
    }
  }

  // ------------------------------------------------ ★5 선택권
  ticketsTab() {
    const st = App.store;
    const list = st.availableTickets();
    T(this, 10, 64, '세계관마다 한 장. 그 세계관의 ★5 하나를 골라 바로 데려와요 (이미 있으면 강화 재료가 돼요)', { size: 10, color: C.dim });
    list.forEach((tk, i) => {
      const w = App.content.world(tk.world);
      const col = w?.color ?? C.accent;
      const x = 10 + (i % 2) * 312,
        y = 80 + Math.floor(i / 2) * 136;
      const used = st.save.extra.tickets.includes(tk.id);
      panel(this, x, y, 304, 130, { border: hexNum(col) });
      T(this, x + 10, y + 6, `${w?.name ?? tk.world} ★5 선택권`, { bold: true, color: col });
      T(this, x + 294, y + 8, used ? '사용함' : '1장', { size: 10, align: 'right', color: used ? C.faint : C.gold });
      st.ticketChoices(tk.id).forEach((c, j) => {
        charSlot(this, x + 10 + j * 76, y + 28, 64, c.id, {
          label: true,
          onClick: used
            ? undefined
            : () => this.confirmTicket(tk.id, c.id),
        });
      });
      if (!used) T(this, x + 10, y + 114, '캐릭터를 눌러서 고르기', { size: 10, color: C.dim });
    });
    if (!list.length) T(this, W / 2, 160, '아직 열린 세계관 균열이 없어요', { align: 'center', color: C.dim });
  }

  confirmTicket(ticketId: string, charId: string) {
    if (this.busy) return;
    const ch = App.content.char(charId);
    const ov = this.add.container(0, 0).setDepth(500);
    ov.add(this.add.rectangle(0, 0, W, H, 0x07060f, 0.8).setOrigin(0).setInteractive());
    ov.add(panel(this, W / 2 - 150, H / 2 - 50, 300, 100, { border: hexNum(RARITY_COLORS[5]) }));
    ov.add(T(this, W / 2, H / 2 - 36, `${ch.name} 을(를) 데려올까요?`, { align: 'center', color: '#ffffff' }));
    ov.add(T(this, W / 2, H / 2 - 18, '선택권은 세계관마다 한 번만 쓸 수 있어요', { size: 10, align: 'center', color: C.dim }));
    ov.add(button(this, W / 2 - 130, H / 2 + 10, 120, 28, '취소', () => ov.destroy(), { size: 10 }));
    ov.add(
      button(this, W / 2 + 10, H / 2 + 10, 120, 28, '데려오기', async () => {
        if (this.busy) return;
        this.busy = true;
        ov.destroy();
        try {
          const r = await App.store.claimTicket(ticketId, charId);
          const note = r.isNew ? '새 동료!' : r.levelUp ? `강화! ${App.store.save.owned[charId].b}강` : r.refund ? `최대 강화 · 코인 +${r.refund}` : '강화 재료 +1';
          showFullArt(this, charId, () => go(this, 'Rewards', { tab: 'tickets' }), note);
        } catch (e: any) {
          this.busy = false;
          toast(this, e?.message ?? '실패', C.bad);
        }
      }, { size: 10, color: RARITY_COLORS[5] }),
    );
  }
}

function todayKey() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
