import Phaser from 'phaser';
import { App, C, W, hexNum } from '../core/app';
import { audio } from '../core/audio';
import { T, bg, button, fadeIn, go, panel, topBar } from '../core/ui';
import { dailySetup } from './Play';
import { teamPanel } from './Prep';

export class ChallengeScene extends Phaser.Scene {
  constructor() {
    super('Challenge');
  }

  create() {
    fadeIn(this);
    audio.bgm('map', 50, 'dorian', 92);
    bg(this, 'rift', 0.55);
    topBar(this, '도전', () => go(this, 'WorldMap'));
    const st = App.store;
    const ch = App.content.challenges;

    const cards: { key: 'micro' | 'daily' | 'marathon'; title: string; color: string; lines: string[]; best: string }[] = [
      {
        key: 'micro',
        title: '번개 모드',
        color: '#ffd84b',
        lines: [
          `${ch.micro.duration}초짜리 초간단 시련이`,
          `쉬지 않고 랜덤으로 이어진다.`,
          `${ch.micro.speedUpEvery}개마다 빨라지고, 목숨 ${ch.micro.lives}개.`,
          `성공 1개당 ${ch.micro.coinPerClear} 코인`,
        ],
        best: `최고 ${st.save.extra.microBest}개`,
      },
      {
        key: 'daily',
        title: '오늘의 도전',
        color: '#ff5fd2',
        lines: [],
        best: '',
      },
      {
        key: 'marathon',
        title: '마라톤',
        color: '#5fd3e0',
        lines: [
          `열린 미니게임이 ${ch.marathon.duration}초씩`,
          `랜덤 순서로 이어진다. 점점 어려워진다.`,
          `목숨 ${ch.marathon.lives}개를 다 잃으면 끝.`,
          `점수의 ${Math.round(ch.marathon.coinRate * 100)}%를 코인으로`,
        ],
        best: `최고 ${st.save.extra.marathonBest.toLocaleString()}점`,
      },
    ];
    if (st.modeUnlocked('daily')) {
      const d = dailySetup();
      const today = st.dailyToday();
      cards[1].lines = [
        `오늘의 규칙: ${d.mod.name}`,
        `(${d.mod.desc})`,
        ...d.games.map((g, i) => `${i + 1}. ${App.content.game(g).name}`),
        today.cleared ? '오늘 클리어 완료!' : `첫 클리어 보상 ${ch.daily.reward} 코인`,
      ];
      cards[1].best = `오늘 최고 ${today.best.toLocaleString()}점`;
    }

    const cw = 196,
      gap = 10,
      x0 = (W - (cw * 3 + gap * 2)) / 2;
    cards.forEach((c, i) => {
      const x = x0 + i * (cw + gap),
        y = 36;
      const open = st.modeUnlocked(c.key);
      panel(this, x, y, cw, 166, { border: open ? hexNum(c.color) : C.line });
      T(this, x + 10, y + 8, c.title, { size: 24, color: open ? c.color : C.faint });
      if (open) {
        c.lines.forEach((l, k) => T(this, x + 10, y + 42 + k * 15, l, { size: 10, color: k === 0 && c.key === 'daily' ? C.gold : C.text, wrap: cw - 20 }));
        T(this, x + 10, y + 142, c.best, { size: 10, color: C.dim });
      } else {
        const need = App.content.domainName(ch.unlock[c.key]);
        T(this, x + 10, y + 50, `${need} 해방 후 열린다.`, { size: 10, color: C.faint, wrap: cw - 20 });
        this.add.image(x + cw / 2, y + 110, 'ic_lock').setScale(4);
      }
      button(this, x + 10, y + 172, cw - 20, 28, open ? '시작' : '잠김', () => go(this, 'Play', { mode: c.key, domain: 'rift' }), {
        disabled: !open,
        color: c.color,
      });
    });
    teamPanel(this, x0, 246, W - x0 * 2, 108, null, { scene: 'Challenge' });
  }
}
