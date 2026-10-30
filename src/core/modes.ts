import { App, C } from './app';
import { currentFrontier } from './explore';
import type { Bonus } from './types';

export function bonusLines(b: Bonus, withTime = true) {
  const out: string[] = [];
  if (b.score) out.push(`점수 +${b.score}%`);
  if (b.coin) out.push(`코인 +${b.coin}%`);
  if (b.time && withTime) out.push(`제한시간 +${b.time}초`);
  if (b.shield) out.push(`보호막 ${b.shield}회`);
  if (!out.length) out.push('보너스 없음');
  return out;
}

export const USABLE = ['shield', 'time', 'score', 'coin', 'revive'];

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
    case 'landing': {
      const f = currentFrontier();
      return { title: `상륙전 · ${f.name}`, sub: '균열 너머 해역', color: f.color, bg: 'rift', lines: [`경계의 수호자가 모든 영역의 시련 ${ch.landing.segments}개를 섞어 낸다.`, `목숨 ${ch.landing.lives}개 공유, 시련마다 통과 점수가 있다.`, `첫 상륙: ${ch.landing.reward.toLocaleString()} 코인 + 대륙 발견`] };
    }
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

