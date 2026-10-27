import type { Backend } from './backend';
import type { Content } from './content';
import type { Store } from './store';

/** 화면들이 같이 쓰는 전역 객체 */
export const App = {
  content: null as unknown as Content,
  store: null as unknown as Store,
  backend: null as unknown as Backend,
  online: false,
};

export const W = 640;
export const H = 360;

export const C = {
  bg: 0x0b0918,
  panel: 0x15122a,
  panel2: 0x1e1a3a,
  line: 0x3a3270,
  lineHi: 0x6b5bd6,
  text: '#eae6ff',
  dim: '#a69fd0',
  faint: '#6d669a',
  accent: '#ff5fd2',
  accentN: 0xff5fd2,
  gold: '#ffc845',
  good: '#4be37a',
  bad: '#ff4b6e',
  cyan: '#5fd3e0',
};

export function hexNum(hex: string) {
  return parseInt(hex.replace('#', ''), 16);
}
