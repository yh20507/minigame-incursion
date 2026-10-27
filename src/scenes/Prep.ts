import Phaser from 'phaser';
import { App, C, H, W, hexNum } from '../core/app';
import type { Bonus } from '../core/types';
import { T, bg, button, charSlot, fadeIn, go, panel, starsRow, toast, topBar } from '../core/ui';
import { fitImage } from '../core/art';

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

const USABLE = ['shield', 'time', 'score', 'coin', 'revive'];

export function modeInfo(mode: string, domain: string, game?: string) {
  const ch = App.content.challenges;
  switch (mode) {
    case 'boss': {
      const d = App.content.domain(domain)!;
      const gk = App.content.char(d.gatekeeper);
      return { title: `보스 · ${gk.name}`, sub: `${d.name} · 시련의 문지기`, color: d.color, bg: d.id, lines: [`이 영역의 시련 ${ch.boss.segments}개를 ${ch.boss.duration}초씩 연달아 버틴다.`, `목숨 ${ch.boss.lives}개를 공유하고, 시련마다 통과 점수를 넘겨야 한다.`, `첫 클리어: ${gk.name} 합류 + ${ch.boss.reward.toLocaleString()} 코인`] };
    }
    case 'final':
      return { title: '최종장 · 설계자', sub: '조각세계의 중심', color: C.accent, bg: 'rift', lines: [`모든 영역의 시련 ${ch.final.segments}개가 뒤섞여 나온다.`, `목숨 ${ch.final.lives}개 공유, 시련마다 통과 점수가 있다.`, `첫 클리어: 설계자 합류 + ${ch.final.reward.toLocaleString()} 코인`] };
    case 'micro':
      return { title: '번개 모드', sub: '도전', color: '#ffd84b', bg: 'rift', lines: [`${ch.micro.duration}초짜리 초간단 시련이 랜덤으로 이어진다.`, `${ch.micro.speedUpEvery}개마다 빨라진다. 목숨 ${ch.micro.lives}개.`, `성공 1개당 ${ch.micro.coinPerClear} 코인`] };
    case 'daily':
      return { title: '오늘의 도전', sub: '도전', color: '#ff5fd2', bg: 'rift', lines: ['오늘 정해진 미니게임 3개를 특별 규칙으로 연달아 한다.', '중간에 쓰러지면 실패. 하루 첫 클리어 때 보상.', `첫 클리어 보상 ${ch.daily.reward} 코인`] };
    case 'marathon':
      return { title: '마라톤', sub: '도전', color: '#5fd3e0', bg: 'rift', lines: [`열린 미니게임이 ${ch.marathon.duration}초씩 랜덤 순서로 이어진다.`, `목숨 ${ch.marathon.lives}개를 다 잃으면 끝.`, `점수의 ${Math.round(ch.marathon.coinRate * 100)}%를 코인으로`] };
  }
  const g = App.content.game(game!);
  return { title: g.name, sub: '', color: App.content.domain(g.domain)!.color, bg: g.domain, lines: [] as string[] };
}

export class PrepScene extends Phaser.Scene {
  constructor() {
    super('Prep');
  }

  create(data: { mode?: string; game?: string; domain: string; sel?: string[] }) {
    fadeIn(this);
    const mode = data.mode ?? 'normal';
    const info = modeInfo(mode, data.domain, data.game);
    const sel = new Set(data.sel ?? []);
    bg(this, info.bg, 0.6);
    const backTo = (): [string, object] =>
      mode === 'normal' || mode === 'boss' ? ['Domain', { id: mode === 'boss' ? data.domain : App.content.game(data.game!).domain }] : mode === 'final' ? ['WorldMap', {}] : ['Challenge', {}];
    topBar(this, info.title, () => go(this, ...backTo()), info.color);

    panel(this, 16, 34, 340, 220, { border: hexNum(info.color) });
    if (mode === 'normal') {
      const g = App.content.game(data.game!);
      const d = App.content.domain(g.domain)!;
      const rec = App.store.save.scores[g.id];
      T(this, 28, 42, `${d.name} · ${g.genre}`, { size: 10, color: d.color });
      T(this, 28, 56, g.name, { size: 24, color: C.text });
      T(this, 28, 88, g.rule, { wrap: 316, color: C.text });
      T(this, 28, 126, g.controls, { size: 10, wrap: 316, color: C.cyan });
      T(this, 28, 158, '별 기준', { size: 10, color: C.dim });
      g.stars.forEach((s, i) => {
        starsRow(this, 28 + i * 100, 174, i + 1, i + 1);
        T(this, 28 + i * 100 + (i + 1) * 11 + 4, 172, s.toLocaleString(), { size: 10 });
      });
      T(this, 28, 196, rec ? `최고 ${rec.best.toLocaleString()}점 · ${rec.plays}회 플레이` : '아직 도전하지 않았어요', { color: rec ? C.text : C.faint });
      starsRow(this, 250, 196, rec?.stars ?? 0, 3, 2);
      T(this, 28, 226, `목숨 ${g.lives}개 · 제한시간 45초`, { size: 10, color: C.faint });
    } else {
      T(this, 28, 42, info.sub, { size: 10, color: info.color });
      T(this, 28, 56, info.title, { size: 24, color: C.text });
      info.lines.forEach((l, i) => T(this, 28, 96 + i * 22, l, { wrap: 316, color: i === info.lines.length - 1 ? C.gold : C.text }));
    }

    // 아이템
    panel(this, 16, 262, 340, 92);
    T(this, 26, 268, '아이템 사용 (눌러서 고르기, 시작할 때 하나씩 소모)', { size: 10, color: C.dim });
    USABLE.forEach((id, i) => {
      const it = App.content.item(id);
      if (!it) return;
      const n = App.store.itemCount(id);
      const x = 26 + i * 66,
        y = 284;
      const on = sel.has(id);
      const g = this.add.graphics();
      g.fillStyle(on ? 0x2c2560 : 0x110f20, 1);
      g.fillRect(x, y, 60, 62);
      g.lineStyle(on ? 2 : 1, on ? 0xffffff : n ? 0x3a3270 : 0x221e3a, 1);
      g.strokeRect(x + 0.5, y + 0.5, 59, 61);
      const icon = this.add.image(x + 30, y + 20, 'it_' + id);
      fitImage(icon, 26, 26);
      if (!n) icon.setAlpha(0.3);
      T(this, x + 30, y + 36, it.name, { size: 10, align: 'center', color: n ? C.text : C.faint });
      T(this, x + 30, y + 48, `${n}개`, { size: 10, align: 'center', color: n ? C.gold : C.faint });
      const z = this.add.zone(x, y, 60, 62).setOrigin(0).setInteractive({ useHandCursor: n > 0 });
      z.on('pointerover', () => n && toast(this, it.desc));
      z.on('pointerup', () => {
        if (!n) return;
        if (on) sel.delete(id);
        else sel.add(id);
        go(this, 'Prep', { ...data, sel: [...sel] });
      });
    });

    teamPanel(this, 366, 34, 258, 264, mode === 'normal' ? App.content.game(data.game!).domain : mode === 'boss' ? data.domain : null, {
      scene: 'Prep',
      data,
    });

    const start = async () => {
      if ((this as any).__leaving) return;
      const used = await App.store.useItems([...sel]);
      go(this, 'Play', { mode, game: data.game, domain: data.domain, items: used.map((u) => u.id) });
    };
    button(this, W - 196, H - 52, 180, 40, '시작!  (스페이스)', start, { color: info.color });
    this.input.keyboard?.on('keydown-SPACE', start);
    this.input.keyboard?.on('keydown-ENTER', start);
  }
}
