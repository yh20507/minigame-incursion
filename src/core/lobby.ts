import { App, C, hexNum } from './app';
import { audio } from './audio';

export const ACCENTS = ['#ff5fd2', '#5fd3e0', '#ffc845', '#4be37a', '#b06cff', '#ff8a3d', '#ff4b6e', '#9fb3c8'];

/** 메뉴 강조색 바꾸기 */
export function applyAccent(color: string) {
  C.accent = color;
  C.accentN = hexNum(color);
}

/** 로비 배경음 고르기 결과를 오디오에 반영 */
export function lobbyMusicUrl(sel: string): string | null {
  if (!sel) return null;
  const [kind, id] = sel.split(':');
  if (kind === 'bgm' && audio.files.bgm.has(id)) return `assets/audio/bgm/${id}.mp3`;
  if (kind === 'char' && audio.files.chars.has(id)) return `assets/audio/chars/${id}.mp3`;
  if (kind === 'world' && audio.files.worlds.has(id)) return `assets/audio/worlds/${id}.mp3`;
  return null;
}

export function lobbyMusicName(sel: string) {
  if (!sel) return '기본 로비 곡';
  const [kind, id] = sel.split(':');
  if (kind === 'char' && App.content.hasChar(id)) return `${App.content.char(id).name} 테마`;
  if (kind === 'world') return `${App.content.domainName(id)} 테마`;
  const names: Record<string, string> = { title: '타이틀', lobby: '로비', map: '조각세계 지도', gacha: '차원 균열', boss: '보스', final: '최종장', result: '결과', challenge: '도전', micro: '번개 모드', story: '스토리', expedition: '원정대', rift: '균열' };
  return names[id] ?? App.content.domainName(id);
}

export function playLobbyMusic() {
  const sel = App.store.save.extra.lobby.bgm;
  audio.lobbyOverride = lobbyMusicUrl(sel);
  audio.stopBgm();
  audio.bgm('lobby', 52, 'major', 96, ['lobby', 'title']);
}
