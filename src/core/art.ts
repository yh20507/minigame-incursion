import type { Content } from './content';
import type { CharDef } from './types';
import { hashStr, seeded } from './rng';

/**
 * 임시 그래픽. 사용자가 그림 파일을 넣으면 그 그림이 우선이고,
 * 없는 것만 여기서 코드로 그린다.
 */

export const RARITY_COLORS = ['#000', '#9aa3ad', '#4aa3ff', '#b06cff', '#ffc845', '#ff5fd2'];

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return { c, g };
}

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  if (f < 0) {
    r *= 1 + f;
    g *= 1 + f;
    b *= 1 + f;
  } else {
    r += (255 - r) * f;
    g += (255 - g) * f;
    b += (255 - b) * f;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const SKINS = ['#f5d0b0', '#e8b48f', '#c98d66', '#8d5a3b', '#f7dcc7', '#d9a07a'];
const HAIRS = ['#2b1d16', '#6b3d22', '#d9b25f', '#e8e2d6', '#b03a2e', '#3c3f8f', '#1f1b2e', '#7a4fb5', '#3fa27a', '#ff7eb6'];

/** 16x16 픽셀 캐릭터를 그려 grid(픽셀 배열) 로 돌려준다 */
function chibiGrid(ch: CharDef, domainColor: string): (string | null)[][] {
  const r = seeded(hashStr(ch.id));
  const G: (string | null)[][] = Array.from({ length: 16 }, () => Array(16).fill(null));
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) G[y][x] = c;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
  };
  const rarity = RARITY_COLORS[ch.rarity] ?? '#fff';
  const kind =
    ch.id === 'teumsae'
      ? 'spirit'
      : ch.id === 'b07'
        ? 'robot'
        : ch.id === 'qura'
          ? 'alien'
          : ch.id === 'architect'
            ? 'cloak'
            : ch.id === 'adel'
              ? 'holo'
              : 'human';

  if (kind === 'spirit') {
    const body = '#b48cff';
    rect(4, 4, 11, 12, body);
    rect(5, 3, 10, 3, body);
    rect(5, 13, 6, 14, body);
    rect(9, 13, 10, 14, body);
    rect(3, 6, 3, 10, body);
    rect(12, 6, 12, 10, body);
    rect(6, 1, 6, 2, '#ffd6ff');
    rect(10, 2, 10, 2, '#ffd6ff');
    rect(5, 5, 10, 6, shade(body, 0.35));
    set(6, 8, '#1a0f22');
    set(9, 8, '#1a0f22');
    set(6, 7, '#fff');
    set(9, 7, '#fff');
    rect(7, 10, 8, 10, '#ff5fd2');
    return G;
  }
  if (kind === 'robot') {
    const m = '#9fb3c8';
    rect(4, 2, 11, 7, m);
    rect(5, 4, 10, 5, '#1b2a3a');
    set(6, 4, '#5fd3e0');
    set(9, 4, '#5fd3e0');
    rect(7, 0, 8, 1, '#ff5f5f');
    rect(5, 8, 10, 12, shade(m, -0.2));
    rect(3, 8, 4, 11, m);
    rect(11, 8, 12, 11, m);
    rect(7, 9, 8, 10, rarity);
    rect(5, 13, 6, 15, '#55606e');
    rect(9, 13, 10, 15, '#55606e');
    return G;
  }

  const skin = kind === 'alien' ? '#7fdc8a' : kind === 'holo' ? '#8ff0ff' : SKINS[Math.floor(r() * SKINS.length)];
  const hair = kind === 'holo' ? '#3fc8e0' : HAIRS[Math.floor(r() * HAIRS.length)];
  const outfit = kind === 'cloak' ? '#2a2140' : shade(domainColor, -0.15 - r() * 0.35);
  const style = Math.floor(r() * 4);

  // 머리
  rect(5, 3, 10, 7, skin);
  rect(4, 4, 4, 6, skin);
  rect(11, 4, 11, 6, skin);
  // 머리카락
  if (kind === 'cloak') {
    rect(3, 1, 12, 3, outfit);
    rect(3, 4, 4, 9, outfit);
    rect(11, 4, 12, 9, outfit);
    rect(5, 3, 10, 7, '#120d1f');
    set(6, 5, '#ff5fd2');
    set(9, 5, '#ff5fd2');
  } else if (kind === 'alien') {
    rect(5, 1, 10, 2, skin);
    set(5, 0, skin);
    set(10, 0, skin);
    set(5, 0, '#ffd84b');
    set(10, 0, '#ffd84b');
  } else {
    rect(4, 1, 11, 3, hair);
    rect(5, 0, 10, 0, hair);
    if (style === 0) {
      rect(3, 3, 4, 9, hair);
      rect(11, 3, 12, 9, hair);
    } else if (style === 1) {
      set(3, 2, hair);
      set(12, 2, hair);
      set(4, 0, hair);
      set(11, 0, hair);
    } else if (style === 2) {
      rect(3, 3, 3, 6, hair);
      rect(12, 3, 12, 6, hair);
      rect(11, 1, 13, 2, hair);
    } else {
      rect(4, 3, 5, 4, hair);
      rect(3, 3, 3, 11, hair);
      rect(12, 3, 12, 11, hair);
    }
  }
  if (kind !== 'cloak') {
    // 눈
    set(6, 4, '#1a1424');
    set(6, 5, '#1a1424');
    set(9, 4, '#1a1424');
    set(9, 5, '#1a1424');
    set(5, 6, shade('#ff7e9a', 0.3));
    set(10, 6, shade('#ff7e9a', 0.3));
    set(7, 7, '#b5546a');
    set(8, 7, '#b5546a');
  }
  // 몸
  rect(5, 8, 10, 12, outfit);
  rect(4, 9, 4, 11, outfit);
  rect(11, 9, 11, 11, outfit);
  set(4, 12, skin);
  set(11, 12, skin);
  rect(5, 11, 10, 11, rarity);
  set(7, 8, shade(outfit, 0.25));
  set(8, 8, shade(outfit, 0.25));
  // 다리
  const leg = shade(outfit, -0.45);
  rect(6, 13, 7, 14, leg);
  rect(8, 13, 9, 14, leg);
  rect(5, 15, 7, 15, '#1d1a26');
  rect(8, 15, 10, 15, '#1d1a26');
  if (kind === 'holo') {
    for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x++) if (G[y][x]) G[y][x] = shade('#8ff0ff', -0.1);
  }
  return G;
}

function drawGrid(g: CanvasRenderingContext2D, G: (string | null)[][], ox: number, oy: number, px: number) {
  // 외곽선
  g.fillStyle = '#0d0a16';
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (!G[y][x]) continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx > 15 || ny > 15 || !G[ny][nx]) g.fillRect(ox + nx * px, oy + ny * px, px, px);
      }
    }
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const c = G[y][x];
      if (!c) continue;
      g.fillStyle = c;
      g.fillRect(ox + x * px, oy + y * px, px, px);
    }
}

export function makeCharTextures(scene: Phaser.Scene, content: Content) {
  for (const ch of content.chars) {
    const color = content.domainColor(ch.domain);
    const grid = chibiGrid(ch, color);
    const sk = 'spr_' + ch.id;
    if (!scene.textures.exists(sk)) {
      const { c, g } = canvas(54, 54);
      drawGrid(g, grid, 3, 3, 3);
      scene.textures.addCanvas(sk, c);
    }
    // ★4 이상은 고화질 일러스트 자리. 파일이 없으면 임시 카드를 만든다
    const fk = 'full_' + ch.id;
    if (ch.rarity >= 4 && !scene.textures.exists(fk)) {
      const { c, g } = canvas(256, 320);
      const dom = content.domain(ch.domain);
      const sky = dom?.sky ?? [shade(color, -0.65), '#120d22'];
      const grad = g.createLinearGradient(0, 0, 0, 320);
      grad.addColorStop(0, sky[0]);
      grad.addColorStop(1, sky[1]);
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 320);
      const r = seeded(hashStr(ch.id + 'bg'));
      g.fillStyle = shade(color, -0.2);
      g.globalAlpha = 0.25;
      for (let i = 0; i < 50; i++) g.fillRect(Math.floor(r() * 64) * 4, Math.floor(r() * 80) * 4, 4, 4);
      g.globalAlpha = 1;
      drawGrid(g, grid, 32, 48, 12);
      g.fillStyle = 'rgba(7,6,15,0.7)';
      g.fillRect(0, 288, 256, 32);
      g.fillStyle = '#c9c3ef';
      g.font = '10px Galmuri9';
      g.textAlign = 'center';
      g.fillText('임시 그림 · ' + ch.id + '_full.png', 128, 308);
      scene.textures.addCanvas(fk, c);
      placeholderFull.add(ch.id);
    }
  }
}

/** 임시 카드로 대신한 ★4·★5 일러스트 */
export const placeholderFull = new Set<string>();

/** 초상화로 쓸 텍스처: 사용자 일러스트(art) → 고화질 일러스트(★4·★5) → 게임용 캐릭터 */
export function portraitKey(scene: Phaser.Scene, id: string) {
  if (scene.textures.exists('art_' + id)) return 'art_' + id;
  if (scene.textures.exists('full_' + id)) return 'full_' + id;
  return 'spr_' + id;
}

function drawSkyline(g: CanvasRenderingContext2D, theme: string, color: string, sky: [string, string], r: () => number) {
  const W = 640,
    H = 360;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, sky[0]);
  grad.addColorStop(1, sky[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const P = 2;
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(Math.round(x / P) * P, Math.round(y / P) * P, Math.ceil(w / P) * P, Math.ceil(h / P) * P);
  };

  if (theme === 'ashen') {
    // 재 입자
    for (let i = 0; i < 90; i++) px(r() * W, r() * H * 0.8, 2, 2, 'rgba(230,220,220,0.25)');
    // 먼 산
    for (let x = 0; x < W; x += 4) {
      const h = 60 + Math.sin(x * 0.01) * 20 + Math.sin(x * 0.033) * 12;
      px(x, H - 120 - h, 4, h + 120, '#3d3542');
    }
    // 성벽과 탑
    const wall = '#2a2230';
    px(0, H - 110, W, 110, wall);
    for (let x = 0; x < W; x += 24) px(x, H - 122, 14, 12, wall);
    for (const tx of [80, 300, 520]) {
      px(tx, H - 190, 46, 80, wall);
      for (let k = 0; k < 4; k++) px(tx + k * 12, H - 200, 8, 10, wall);
      px(tx + 18, H - 170, 8, 14, shade(color, -0.3));
    }
    // 부서진 틈
    for (let i = 0; i < 6; i++) px(r() * W, H - 100 + r() * 60, 10 + r() * 20, 2, '#1a141e');
    px(0, H - 40, W, 40, '#1d1820');
  } else if (theme === 'neon') {
    for (let i = 0; i < 30; i++) px(r() * W, r() * H * 0.5, 2, 2, 'rgba(255,255,255,0.3)');
    for (let layer = 0; layer < 2; layer++) {
      let x = -10;
      while (x < W) {
        const w = 30 + r() * 50;
        const h = (layer ? 90 : 150) + r() * (layer ? 80 : 120);
        const c = layer ? '#120c24' : '#1f1538';
        px(x, H - h, w, h, c);
        for (let wy = H - h + 8; wy < H - 20; wy += 10)
          for (let wx = x + 6; wx < x + w - 6; wx += 8)
            if (r() < 0.35) px(wx, wy, 4, 4, r() < 0.5 ? '#ff4fa8' : '#5fd3e0');
        x += w + 4;
      }
    }
    // 간판
    for (let i = 0; i < 5; i++) {
      const sx = r() * (W - 60),
        sy = 120 + r() * 120;
      px(sx, sy, 40, 14, '#0d0a16');
      px(sx + 2, sy + 2, 36, 10, i % 2 ? '#ff4fa8' : '#5fd3e0');
    }
    // 비
    for (let i = 0; i < 120; i++) px(r() * W, r() * H, 2, 8, 'rgba(160,200,255,0.18)');
    px(0, H - 30, W, 30, '#0b0818');
    for (let x = 0; x < W; x += 16) px(x, H - 30, 8, 2, 'rgba(255,79,168,0.4)');
  } else if (theme === 'nebula') {
    for (let i = 0; i < 6; i++) {
      const cx = r() * W,
        cy = r() * H,
        rad = 60 + r() * 100;
      const ng = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      ng.addColorStop(0, i % 2 ? 'rgba(95,211,224,0.25)' : 'rgba(180,140,255,0.25)');
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = ng;
      g.fillRect(0, 0, W, H);
    }
    for (let i = 0; i < 160; i++) {
      const s = r() < 0.1 ? 4 : 2;
      px(r() * W, r() * H, s, s, `rgba(255,255,255,${0.3 + r() * 0.7})`);
    }
    // 정거장 링
    g.strokeStyle = '#2b3a66';
    g.lineWidth = 8;
    g.beginPath();
    g.ellipse(470, 110, 120, 30, -0.15, 0, Math.PI * 2);
    g.stroke();
    px(450, 70, 40, 80, '#2b3a66');
    px(458, 90, 8, 8, '#5fd3e0');
    px(474, 110, 8, 8, '#5fd3e0');
    px(0, H - 34, W, 34, '#141c38');
    for (let x = 0; x < W; x += 32) px(x, H - 34, 16, 4, '#2b3a66');
  } else {
    // rift
    for (let i = 0; i < 140; i++) px(r() * W, r() * H, 2, 2, `rgba(220,200,255,${0.2 + r() * 0.5})`);
    for (let k = 0; k < 7; k++) {
      let x = r() * W,
        y = r() * H;
      g.fillStyle = k % 2 ? 'rgba(255,95,210,0.5)' : 'rgba(180,140,255,0.5)';
      for (let s = 0; s < 40; s++) {
        x += (r() - 0.5) * 24;
        y += (r() - 0.3) * 12;
        g.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, 4, 2);
      }
    }
  }
}

export function makeBgTextures(scene: Phaser.Scene, content: Content) {
  const themes: { id: string; color: string; sky: [string, string] }[] = [
    ...content.domains.map((d) => ({ id: d.id, color: d.color, sky: d.sky })),
    { id: 'rift', color: '#b48cff', sky: ['#24123d', '#07060f'] },
    ...content.worlds.map((w) => ({ id: w.id, color: w.color, sky: [shade(w.color, -0.7), '#07060f'] as [string, string] })),
  ];
  for (const t of themes) {
    const key = 'bg_' + t.id;
    if (scene.textures.exists(key)) continue;
    const { c, g } = canvas(640, 360);
    drawSkyline(g, t.id, t.color, t.sky, seeded(hashStr(t.id)));
    scene.textures.addCanvas(key, c);
  }
}

const ICONS: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  heart: {
    rows: ['.11.11.', '1221111', '1211111', '1111111', '.11111.', '..111..', '...1...'],
    pal: { '1': '#ff4b6e', '2': '#ffd0dc' },
  },
  heart_empty: {
    rows: ['.11.11.', '1..1..1', '1.....1', '1.....1', '.1...1.', '..1.1..', '...1...'],
    pal: { '1': '#5a4a6a' },
  },
  shield: {
    rows: ['1111111', '1222221', '1222221', '1222221', '.12221.', '..121..', '...1...'],
    pal: { '1': '#5fd3e0', '2': '#bff6ff' },
  },
  star: {
    rows: ['....1....', '...121...', '1111211111', '.1222221.', '..12221..', '.1221221.', '11.....11'],
    pal: { '1': '#ffc845', '2': '#fff2b3' },
  },
  star_empty: {
    rows: ['....1....', '...1.1...', '1111.1111', '.1.....1.', '..1...1..', '.1.1.1.1.', '11.....11'],
    pal: { '1': '#5a4a6a' },
  },
  coin: {
    rows: ['.1111.', '122221', '121121', '121121', '122221', '.1111.'],
    pal: { '1': '#c98a1a', '2': '#ffd84b' },
  },
  lock: {
    rows: ['.111.', '1...1', '1...1', '11111', '12221', '12121', '11111'],
    pal: { '1': '#a69fd0', '2': '#5a4a8a' },
  },
  arrow: {
    rows: ['...1...', '..121..', '.12221.', '1222221', '..121..', '..121..', '..111..'],
    pal: { '1': '#0d0a16', '2': '#ffffff' },
  },
};

export function makeIconTextures(scene: Phaser.Scene) {
  for (const [name, ic] of Object.entries(ICONS)) {
    const key = 'ic_' + name;
    if (scene.textures.exists(key)) continue;
    const w = Math.max(...ic.rows.map((r) => r.length));
    const { c, g } = canvas(w, ic.rows.length);
    ic.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const col = ic.pal[ch];
        if (!col) return;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }),
    );
    scene.textures.addCanvas(key, c);
  }
  if (!scene.textures.exists('px')) {
    const { c, g } = canvas(2, 2);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 2, 2);
    scene.textures.addCanvas('px', c);
  }
  if (!scene.textures.exists('spark')) {
    const { c, g } = canvas(4, 4);
    g.fillStyle = '#fff';
    g.fillRect(1, 0, 2, 4);
    g.fillRect(0, 1, 4, 2);
    scene.textures.addCanvas('spark', c);
  }
}

/** 텍스처를 상자 크기에 맞춰 비율 유지로 맞춘다 */
export function fitImage(img: Phaser.GameObjects.Image, maxW: number, maxH: number) {
  const f = img.frame;
  const s = Math.min(maxW / f.width, maxH / f.height);
  img.setScale(s);
  return img;
}

const ITEM_ICONS: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  pouch: {
    rows: ['....1111....', '...122221...', '....1331....', '...122221...', '..12222221..', '.1222442221.', '.1224444221.', '.1222442221.', '.1222222221.', '..11111111..'],
    pal: { '1': '#5a3a1b', '2': '#c98a4a', '3': '#ffd84b', '4': '#ffd84b' },
  },
  shield: {
    rows: ['....11....', '....22....', '...1221...', '..133331..', '.13444431.', '.13444431.', '.13444431.', '..133331..', '...1111...'],
    pal: { '1': '#0d0a16', '2': '#9aa3ad', '3': '#5fd3e0', '4': '#bff6ff' },
  },
  time: {
    rows: ['1111111111', '.12222221.', '..133331..', '...1331...', '....11....', '...1221...', '..122221..', '.12333321.', '1111111111'],
    pal: { '1': '#5a3a1b', '2': '#d9c9a6', '3': '#d9a066' },
  },
  score: {
    rows: ['....1....', '...121...', '1111211111', '.1222221.', '..12221..', '.1221221.', '11.....11'],
    pal: { '1': '#a03a8a', '2': '#ff5fd2' },
  },
  coin: {
    rows: ['..1111..', '.122221.', '12233221', '12322321', '12322321', '12233221', '.122221.', '..1111..'],
    pal: { '1': '#8a5a1a', '2': '#ffc845', '3': '#fff2b3' },
  },
  revive: {
    rows: ['.......11', '......121', '.....1221', '....12221', '...12221.', '..12221..', '.12221...', '.1221....', '1.11.....'],
    pal: { '1': '#6d669a', '2': '#ffffff' },
  },
  shard: {
    rows: ['....1....', '...121...', '..12321..', '.1233321.', '123333321', '.1233321.', '..12321..', '...121...', '....1....'],
    pal: { '1': '#3a2a6a', '2': '#b48cff', '3': '#e8dcff' },
  },
};

export function makeItemTextures(scene: Phaser.Scene, content: Content) {
  for (const it of content.items) {
    const key = 'it_' + it.id;
    if (scene.textures.exists(key)) continue;
    const ic = ITEM_ICONS[it.id] ?? ITEM_ICONS.shard;
    const w = Math.max(...ic.rows.map((r) => r.length));
    const { c, g } = canvas(w, ic.rows.length);
    ic.rows.forEach((row, y) =>
      [...row].forEach((chr, x) => {
        const col = ic.pal[chr];
        if (!col) return;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }),
    );
    scene.textures.addCanvas(key, c);
  }
}
