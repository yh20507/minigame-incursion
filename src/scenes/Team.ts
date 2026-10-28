import Phaser from 'phaser';
import { App, C, H, W } from '../core/app';
import { passiveLabel } from '../core/store';
import { T, bg, button, charSlot, fadeIn, go, panel, toast, topBar } from '../core/ui';
import { bonusLines } from './Prep';

type Slot = 'leader' | 0 | 1;

export class TeamScene extends Phaser.Scene {
  constructor() {
    super('Team');
  }

  create(data: { back?: { scene: string; data?: object }; slot?: Slot; page?: number }) {
    fadeIn(this);
    bg(this, 'rift', 0.6);
    const st = App.store;
    const back = data?.back ?? { scene: 'Lobby' };
    const slot: Slot = data?.slot ?? 'leader';
    const page = data?.page ?? 0;
    const reopen = (o: Partial<typeof data> = {}) => go(this, 'Team', { back, slot, page, ...o });
    topBar(this, '편성', () => go(this, back.scene, back.data));

    // 슬롯
    panel(this, 10, 34, 300, 132);
    T(this, 20, 42, '리더 (조작 캐릭터 · 패시브 100%)', { size: 10, color: C.dim });
    const lead = st.save.team.leader;
    charSlot(this, 20, 58, 64, lead, { selected: slot === 'leader', onClick: () => reopen({ slot: 'leader' }) });
    T(this, 92, 62, App.content.char(lead).name, { bold: true });
    T(this, 92, 78, App.content.char(lead).title, { size: 10, color: C.dim });
    App.content.char(lead).passives.forEach((p, i) =>
      T(this, 92, 92 + i * 12, passiveLabel(p, App.content.domainName(p.domain ?? '')), { size: 10, color: C.good }),
    );
    T(this, 20, 128, '서포트 (패시브 50%, 보호막 제외)', { size: 10, color: C.dim });
    [0, 1].forEach((i) => {
      const id = st.save.team.supports[i];
      charSlot(this, 200 + i * 52, 120, 44, id, { selected: slot === i, onClick: () => reopen({ slot: i as Slot }) });
      if (!id) T(this, 222 + i * 52, 136, '+', { align: 'center', color: C.faint });
    });

    // 보너스 요약
    panel(this, 320, 34, 310, 132);
    T(this, 330, 42, '팀 보너스 (모든 영역 공통분)', { size: 10, color: C.dim });
    const b = st.bonus(null);
    T(this, 330, 58, bonusLines(b).join('   '), { color: C.good, wrap: 290 });
    T(this, 330, 80, '크로스오버', { size: 10, color: C.dim });
    const active = st.activeCrossovers();
    let cy = 94;
    for (const cx of App.content.synergies.crossovers) {
      const on = active.includes(cx);
      const names = cx.members.map((m) => (st.owns(m) ? App.content.char(m).name : '???')).join(' + ');
      if (!on && !cx.members.some((m) => st.owns(m))) continue;
      T(this, 330, cy, `${on ? '●' : '○'} ${cx.name}: ${names}`, { size: 10, color: on ? C.gold : C.faint });
      cy += 12;
      if (cy > 156) break;
    }
    if (cy === 94) T(this, 330, cy, '특정 캐릭터 조합을 함께 편성하면 발동한다.', { size: 10, color: C.faint });

    // 보유 캐릭터 목록
    const owned = st.ownedChars().sort((a, c) => c.rarity - a.rarity || a.domain.localeCompare(c.domain));
    const per = 26,
      cols = 13,
      size = 40,
      gap = 8;
    const pages = Math.max(1, Math.ceil(owned.length / per));
    const slotName = slot === 'leader' ? '리더' : `서포트 ${slot + 1}`;
    T(this, 12, 174, `보유 캐릭터 · ${slotName} 자리에 넣을 캐릭터를 고르세요`, { size: 10, color: C.accent });
    owned.slice(page * per, page * per + per).forEach((c, i) => {
      const x = 12 + (i % cols) * (size + gap),
        y = 190 + Math.floor(i / cols) * (size + 22);
      const inTeam = st.teamIds().includes(c.id);
      const s = charSlot(this, x, y, size, c.id, {
        label: true,
        onClick: () => this.assign(slot, c.id, () => reopen()),
      });
      if (inTeam) s.add(T(this, 2, 1, '출전', { size: 10, color: C.accent, stroke: true }));
    });
    if (pages > 1) {
      button(this, W - 130, H - 26, 56, 20, '◀', () => reopen({ page: (page + pages - 1) % pages }), { size: 10 });
      T(this, W - 66, H - 22, `${page + 1}/${pages}`, { size: 10, align: 'center' });
      button(this, W - 56, H - 26, 50, 20, '▶', () => reopen({ page: (page + 1) % pages }), { size: 10 });
    }
    if (slot !== 'leader' && st.save.team.supports[slot]) {
      button(this, 12, H - 26, 110, 20, '이 자리 비우기', () => {
        const sup = [...st.save.team.supports];
        sup[slot] = null;
        st.setTeam(st.save.team.leader, sup).then(() => reopen());
      }, { size: 10 });
    }
    void Phaser;
  }

  assign(slot: Slot, id: string, done: () => void) {
    const st = App.store;
    let leader = st.save.team.leader;
    const sup = [...st.save.team.supports];
    if (slot === 'leader') {
      if (id === leader) return done();
      const i = sup.indexOf(id);
      if (i >= 0) sup[i] = leader; // 자리 맞바꾸기
      leader = id;
    } else {
      if (id === leader) {
        toast(this, '리더는 서포트로 넣을 수 없어요');
        return;
      }
      const other = slot === 0 ? 1 : 0;
      if (sup[other] === id) sup[other] = sup[slot];
      sup[slot] = id;
    }
    st.setTeam(leader, sup).then(done);
  }
}
