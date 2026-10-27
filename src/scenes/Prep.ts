import Phaser from 'phaser';
import { App, C, H, W, hexNum } from '../core/app';
import type { Bonus } from '../core/types';
import { T, bg, button, charSlot, fadeIn, go, panel, starsRow, topBar } from '../core/ui';

export function bonusLines(b: Bonus, withTime = true) {
  const out: string[] = [];
  if (b.score) out.push(`점수 +${b.score}%`);
  if (b.coin) out.push(`코인 +${b.coin}%`);
  if (b.time && withTime) out.push(`제한시간 +${b.time}초`);
  if (b.shield) out.push(`보호막 ${b.shield}회`);
  if (!out.length) out.push('보너스 없음');
  return out;
}

export function teamPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, domainId: string | null, back: { scene: string; data?: object }) {
  const st = App.store;
  panel(scene, x, y, w, h);
  T(scene, x + 10, y + 8, '출전 팀', { bold: true, color: C.accent });
  const lead = st.save.team.leader;
  charSlot(scene, x + 10, y + 28, 56, lead);
  T(scene, x + 10, y + 88, '리더', { size: 10, color: C.dim });
  T(scene, x + 72, y + 30, App.content.char(lead).name, { bold: true });
  T(scene, x + 72, y + 46, App.content.char(lead).title, { size: 10, color: C.dim });
  st.save.team.supports.forEach((s, i) => {
    charSlot(scene, x + 72 + i * 44, y + 62, 38, s);
  });
  T(scene, x + 164, y + 74, '서포트\n(패시브 50%)', { size: 10, color: C.faint });
  const b = st.bonus(domainId);
  T(scene, x + 10, y + 112, '적용 보너스', { size: 10, color: C.dim });
  T(scene, x + 10, y + 126, bonusLines(b).join('\n'), { color: C.good });
  if (b.notes.length) T(scene, x + 10, y + 126 + bonusLines(b).length * 16 + 4, b.notes.join('\n'), { size: 10, color: C.gold, wrap: w - 20 });
  button(scene, x + w - 90, y + 8, 80, 20, '편성 변경', () => go(scene, 'Team', { back }), { size: 10 });
}

export class PrepScene extends Phaser.Scene {
  constructor() {
    super('Prep');
  }

  create(data: { game: string; domain: string }) {
    fadeIn(this);
    const g = App.content.game(data.game);
    const d = App.content.domain(data.domain)!;
    const rec = App.store.save.scores[g.id];
    bg(this, d.id, 0.6);
    topBar(this, g.name, () => go(this, 'Domain', { id: d.id }), d.color);

    panel(this, 16, 40, 340, 264, { border: hexNum(d.color) });
    T(this, 28, 50, `${d.name} · ${g.genre}`, { size: 10, color: d.color });
    T(this, 28, 66, g.name, { size: 24, color: C.text });
    T(this, 28, 102, g.rule, { wrap: 316, color: C.text });
    T(this, 28, 150, '조작', { size: 10, color: C.dim });
    T(this, 28, 164, g.controls, { wrap: 316, color: C.cyan });
    T(this, 28, 204, '별 기준', { size: 10, color: C.dim });
    g.stars.forEach((s, i) => {
      starsRow(this, 28 + i * 100, 222, i + 1, i + 1);
      T(this, 28 + i * 100 + (i + 1) * 11 + 4, 220, s.toLocaleString(), { size: 10 });
    });
    T(this, 28, 246, '내 기록', { size: 10, color: C.dim });
    T(this, 28, 262, rec ? `최고 ${rec.best.toLocaleString()}점 · ${rec.plays}회 플레이` : '아직 도전하지 않았어요', { color: rec ? C.text : C.faint });
    starsRow(this, 250, 262, rec?.stars ?? 0, 3, 2);
    T(this, 28, 284, `목숨 ${g.lives}개 · 제한시간 45초`, { size: 10, color: C.faint });

    teamPanel(this, 366, 40, 258, 264, d.id, { scene: 'Prep', data });

    const start = () => go(this, 'Play', { mode: 'normal', game: g.id, domain: d.id });
    button(this, W - 196, H - 46, 180, 34, '시작!  (스페이스)', start, { color: d.color });
    this.input.keyboard?.on('keydown-SPACE', start);
    this.input.keyboard?.on('keydown-ENTER', start);
  }
}
