import Phaser from 'phaser';
import { App, C, H, W, hexNum } from './app';
import { fitImage, portraitKey } from './art';
import { todayKey } from './rng';
import type { Season } from './types';
import { T, button, go } from './ui';

/** 지금 진행 중인 시즌 (가장 최근에 시작한 것) */
export function currentSeason(): Season | null {
  const today = todayKey();
  const live = App.content.updates.filter((s) => s.start <= today && (!s.end || s.end >= today));
  return live.sort((a, b) => b.start.localeCompare(a.start))[0] ?? null;
}

export function unseenNews() {
  const s = currentSeason();
  return !!s && !App.store.save.extra.seenNews.includes(s.id);
}

/** 새 소식 창 */
export function showNews(scene: Phaser.Scene, manual: boolean) {
  const s = currentSeason();
  if (!s) return;
  const ov = scene.add.container(0, 0).setDepth(600);
  ov.add(scene.add.rectangle(0, 0, W, H, 0x07060f, 0.85).setOrigin(0).setInteractive());
  const x = 70,
    y = 30,
    w = W - 140,
    h = H - 60;
  const g = scene.add.graphics();
  g.fillStyle(0x07060f, 1);
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(C.panel, 1);
  g.fillRect(x, y, w, h);
  g.lineStyle(2, C.accentN, 1);
  g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ov.add(g);
  if (s.highlight && App.content.hasChar(s.highlight)) {
    const img = scene.add.image(x + w - 70, y + 40, portraitKey(scene, s.highlight)).setOrigin(0.5, 0);
    fitImage(img, 110, 136);
    ov.add(img);
  }
  ov.add(T(scene, x + 14, y + 10, '새 소식', { size: 10, color: C.accent }));
  ov.add(T(scene, x + 14, y + 24, s.name, { size: 24, color: '#ffffff' }));
  ov.add(T(scene, x + 14, y + 56, `${s.start} ~ ${s.end ?? '종료일 미정'}`, { size: 10, color: C.gold }));
  ov.add(T(scene, x + 14, y + 72, s.desc, { size: 10, color: C.text, wrap: w - 170 }));
  let ty = y + 106;
  for (const n of s.notes) {
    ov.add(T(scene, x + 14, ty, '◆ ' + n, { size: 10, color: C.text, wrap: w - 170 }));
    ty += 18;
  }
  ty += 6;
  s.banners.slice(0, 4).forEach((bid, i) => {
    const b = App.content.banners.find((x2) => x2.id === bid);
    if (!b) return;
    const col = b.world ? App.content.domainColor(b.world) : C.accent;
    ov.add(
      button(scene, x + 14 + i * 98, ty, 92, 22, b.name.replace(' 균열', ''), () => {
        close();
        go(scene, 'Gacha', { banner: b.id });
      }, { size: 10, color: col }),
    );
  });
  const close = () => {
    ov.destroy();
    if (!App.store.save.extra.seenNews.includes(s.id)) {
      App.store.save.extra.seenNews.push(s.id);
      App.store.saveMeta();
    }
  };
  ov.add(button(scene, x + w - 90, y + h - 32, 80, 24, '닫기', close, { size: 10 }));
  void manual;
  void hexNum;
}
