import Phaser from 'phaser';
import { App, C, H, W } from '../core/app';
import { audio } from '../core/audio';
import { fitImage, portraitKey } from '../core/art';
import { T, bg, button, fadeIn, go, panel, starsRow } from '../core/ui';
import { addShards, exploreProgress, landed, shardsFor } from '../core/explore';
import type { RunResult } from './Play';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(r: RunResult) {
    fadeIn(this);
    audio.stopBgm();
    const bgKey = r.mode === 'normal' || r.mode === 'boss' ? App.content.game(r.game ?? r.segments[0]?.game ?? 'jump').domain : 'rift';
    bg(this, r.mode === 'boss' ? r.domain : bgKey, 0.65);
    this.process(r);
  }

  async process(r: RunResult) {
    const st = App.store;
    const ch = App.content.challenges;
    let title = '';
    let titleColor = C.text;
    let scoreLabel = '점수';
    const lines: { t: string; c?: string }[] = [];
    let coins = 0;
    let stars = -1;
    let newBest = false;
    let joined: string | null = null;
    let next: { key: string; data?: object } = { key: 'WorldMap' };
    const boost = (n: number) => Math.floor(n * (1 + (r.coinPct ?? 0) / 100));
    let retry: { key: string; data?: object } | null = null;

    switch (r.mode) {
      case 'normal': {
        const g = App.content.game(r.game!);
        const res = await st.recordResult(g.id, r.score, g.domain, r.coinPct);
        title = r.success ? '타임 업!' : '게임 오버';
        titleColor = r.success ? C.good : C.bad;
        coins = res.coins;
        stars = res.stars;
        newBest = res.newBest;
        if (res.newStars) lines.push({ t: `새 별 ${res.newStars}개! (+${res.newStars * 100} 코인 포함)`, c: C.gold });
        lines.push({ t: `최고 기록 ${res.best.toLocaleString()}`, c: C.dim });
        if (res.coinBonus) lines.push({ t: `편성 코인 보너스 +${res.coinBonus}%`, c: C.good });
        const d = App.content.domain(g.domain)!;
        if (st.bossUnlocked(d.id) && !st.save.cleared[d.id]) lines.push({ t: `${d.name}의 보스 스테이지에 도전할 수 있어요!`, c: C.accent });
        next = { key: 'Domain', data: { id: g.domain } };
        retry = { key: 'Prep', data: { mode: 'normal', game: g.id, domain: g.domain } };
        break;
      }
      case 'boss':
      case 'final': {
        const isFinal = r.mode === 'final';
        const key = isFinal ? 'final' : r.domain;
        const cfg = isFinal ? ch.final : ch.boss;
        if (r.success) {
          const first = await st.markCleared(key);
          title = isFinal ? '설계자와의 놀이, 승리!' : '문지기 해방!';
          titleColor = C.gold;
          coins = boost(first ? cfg.reward : Math.round(cfg.reward * 0.2));
          await st.addCoins(coins);
          if (first) {
            const gk = isFinal ? 'architect' : App.content.domain(r.domain)!.gatekeeper;
            await st.grant(gk);
            joined = gk;
            const sid = isFinal ? 'final_clear' : r.domain + '_clear';
            next = { key: 'Story', data: { id: sid, next: 'WorldMap' } };
            if (!isFinal) {
              const nd = App.content.domains.find((d) => d.unlockAfter === r.domain);
              if (nd) lines.push({ t: `새 영역 '${nd.name}'이(가) 열렸다!`, c: C.accent });
            }
          } else next = { key: isFinal ? 'WorldMap' : 'Domain', data: isFinal ? {} : { id: r.domain } };
        } else {
          title = '도전 실패...';
          titleColor = C.bad;
          coins = boost(Math.floor(r.score * 0.03));
          await st.addCoins(coins);
          lines.push({ t: '편성을 바꾸거나, 미니게임에서 실력을 쌓고 다시 도전하자.', c: C.dim });
          next = { key: isFinal ? 'WorldMap' : 'Domain', data: isFinal ? {} : { id: r.domain } };
        }
        retry = { key: 'Prep', data: { mode: r.mode, domain: r.domain } };
        r.segments.forEach((s, i) => {
          const g = App.content.game(s.game);
          lines.push({ t: `${i + 1}. ${g.name}  ${s.score.toLocaleString()}점  ${s.passed ? '통과' : '실패'}`, c: s.passed ? C.text : C.bad });
        });
        break;
      }
      case 'landing': {
        const f = App.content.frontier;
        const cfg = ch.landing;
        if (r.success) {
          const first = !landed();
          if (first) {
            st.save.extra.explore.landed.push(f.id);
            await st.saveMeta();
          }
          title = '상륙 성공!';
          titleColor = C.gold;
          coins = boost(first ? cfg.reward : Math.round(cfg.reward * 0.1));
          await st.addCoins(coins);
          if (first) lines.push({ t: f.landed, c: C.accent });
        } else {
          title = '상륙 실패...';
          titleColor = C.bad;
          coins = boost(Math.floor(r.score * 0.03));
          await st.addCoins(coins);
        }
        r.segments.forEach((sg, i) => {
          const g = App.content.game(sg.game);
          lines.push({ t: `${i + 1}. ${g.name}  ${sg.score.toLocaleString()}점  ${sg.passed ? '통과' : '실패'}`, c: sg.passed ? C.text : C.bad });
        });
        next = { key: 'Expedition' };
        retry = { key: 'Prep', data: { mode: 'landing', domain: 'rift' } };
        break;
      }
      case 'micro': {
        title = '번개 모드 종료';
        scoreLabel = '성공한 게임';
        coins = boost(r.microCleared * ch.micro.coinPerClear);
        await st.addCoins(coins);
        newBest = await st.setBest('microBest', r.microCleared);
        lines.push({ t: `최고 기록 ${st.save.extra.microBest}개`, c: C.dim });
        next = { key: 'Challenge' };
        retry = { key: 'Prep', data: { mode: 'micro', domain: 'rift' } };
        break;
      }
      case 'marathon': {
        title = '마라톤 종료';
        coins = boost(Math.floor(r.score * ch.marathon.coinRate));
        await st.addCoins(coins);
        newBest = await st.setBest('marathonBest', r.score);
        lines.push({ t: `버틴 시련 ${r.segments.filter((s) => s.passed).length}개 · 최고 ${st.save.extra.marathonBest.toLocaleString()}점`, c: C.dim });
        next = { key: 'Challenge' };
        retry = { key: 'Prep', data: { mode: 'marathon', domain: 'rift' } };
        break;
      }
      case 'daily': {
        const firstClear = await st.updateDaily(r.score, r.success);
        title = r.success ? '오늘의 도전 클리어!' : '오늘의 도전 실패';
        titleColor = r.success ? C.good : C.bad;
        coins = boost(Math.floor(r.score * 0.05)) + (firstClear ? ch.daily.reward : 0);
        await st.addCoins(coins);
        if (firstClear) lines.push({ t: `첫 클리어 보상 +${ch.daily.reward} 코인`, c: C.gold });
        lines.push({ t: `규칙: ${r.modifier} · 오늘 최고 ${st.dailyToday().best.toLocaleString()}점`, c: C.dim });
        next = { key: 'Challenge' };
        retry = { key: 'Prep', data: { mode: 'daily', domain: 'rift' } };
        break;
      }
    }

    const shards = shardsFor(r, Math.max(0, stars));
    if (shards > 0) {
      await addShards(shards);
      lines.push({ t: `좌표 조각 +${shards}  (탐사 ${Math.round(exploreProgress() * 100)}%)`, c: App.content.frontier.color });
    }
    if (r.items?.length) lines.push({ t: '사용한 아이템: ' + r.items.map((i) => App.content.item(i)?.name ?? i).join(', '), c: C.cyan });
    // ---- 화면 ----
    panel(this, 120, 40, 400, 250);
    const tt = T(this, W / 2, 54, title, { size: 24, align: 'center', color: titleColor, stroke: true });
    tt.setScale(0.5);
    this.tweens.add({ targets: tt, scale: 1, duration: 250, ease: 'Back.Out' });
    T(this, W / 2, 92, scoreLabel, { size: 10, align: 'center', color: C.dim });
    const sc = T(this, W / 2, 104, '0', { size: 36, align: 'center', color: C.gold, stroke: true });
    this.tweens.addCounter({
      from: 0,
      to: r.score,
      duration: Math.min(1000, 200 + r.score / 5),
      onUpdate: (tw) => sc.setText(Math.round(tw.getValue() ?? 0).toLocaleString()),
    });
    if (newBest) {
      const nb = T(this, W / 2 + 110, 112, 'NEW!', { bold: true, color: C.accent, stroke: true }).setAngle(-12);
      this.tweens.add({ targets: nb, scale: 1.2, yoyo: true, repeat: -1, duration: 300 });
    }
    let y = 150;
    if (stars >= 0) {
      const row = starsRow(this, W / 2 - 33, y, 0, 3, 2);
      for (let i = 0; i < stars; i++) {
        this.time.delayedCall(500 + i * 250, () => {
          (row.list[i] as Phaser.GameObjects.Image).setTexture('ic_star').setScale(3);
          this.tweens.add({ targets: row.list[i], scale: 2, duration: 150 });
          audio.sfx('star');
        });
      }
      y += 26;
    }
    const coinT = T(this, W / 2, y, `+${coins.toLocaleString()} 코인`, { align: 'center', color: C.gold, bold: true });
    this.time.delayedCall(400, () => coins && audio.sfx('coin'));
    void coinT;
    y += 20;
    for (const l of lines.slice(0, 6)) {
      T(this, W / 2, y, l.t, { size: 10, align: 'center', color: l.c ?? C.text });
      y += 15;
    }
    if (joined) {
      const c = App.content.char(joined);
      const img = this.add.image(560, 160, portraitKey(this, joined));
      fitImage(img, 120, 120);
      img.setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, y: 150, duration: 500, delay: 700 });
      T(this, 560, 220, `${c.name} 합류!`, { align: 'center', bold: true, color: C.gold, stroke: true });
      this.time.delayedCall(700, () => audio.sfx('legend'));
    }

    const by = H - 52;
    if (retry) button(this, W / 2 - 170, by, 160, 30, '다시 하기', () => go(this, retry!.key, retry!.data));
    button(this, W / 2 + 10, by, 160, 30, next.key === 'Story' ? '계속 ▶' : '나가기', () => go(this, next.key, next.data), { color: C.accent });
    this.input.keyboard?.on('keydown-SPACE', () => go(this, next.key, next.data));
    this.input.keyboard?.on('keydown-ESC', () => go(this, next.key, next.data));
  }
}
