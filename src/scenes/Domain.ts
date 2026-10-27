import Phaser from 'phaser';
import { App, C, W, hexNum } from '../core/app';
import { audio } from '../core/audio';
import { fitImage } from '../core/art';
import { T, bg, fadeIn, go, panel, starsRow, toast, topBar } from '../core/ui';

export class DomainScene extends Phaser.Scene {
  constructor() {
    super('Domain');
  }

  create(data: { id: string }) {
    fadeIn(this);
    const d = App.content.domain(data.id)!;
    const st = App.store;
    audio.bgm(d.id, d.music.root, d.music.scale, d.music.tempo);
    bg(this, d.id, 0.4);
    topBar(this, d.name, () => go(this, 'WorldMap'), d.color);
    T(this, 16, 36, d.subtitle, { color: d.color, bold: true });
    T(this, 16, 54, d.desc, { size: 10, color: C.dim, wrap: 600 });

    const cw = 146,
      ch = 132,
      gap = 8,
      x0 = (W - (cw * 4 + gap * 3)) / 2;
    d.games.forEach((gid, i) => {
      const g = App.content.game(gid);
      const rec = st.save.scores[gid];
      const x = x0 + i * (cw + gap),
        y = 78;
      const c = this.add.container(x, y);
      const p = panel(this, 0, 0, cw, ch, { border: hexNum(d.color) });
      c.add(p);
      c.add(this.add.rectangle(0, 0, cw, 18, hexNum(d.color), 0.25).setOrigin(0));
      c.add(T(this, 8, 3, g.genre, { size: 10, color: d.color }));
      c.add(T(this, 8, 24, g.name, { bold: true, wrap: cw - 16 }));
      c.add(T(this, 8, 44, g.rule, { size: 10, color: C.dim, wrap: cw - 16 }));
      c.add(starsRow(this, 8, ch - 34, rec?.stars ?? 0));
      c.add(T(this, 8, ch - 18, rec ? `최고 ${rec.best.toLocaleString()}` : '도전 전', { size: 10, color: rec ? C.text : C.faint }));
      const z = this.add.zone(0, 0, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true });
      c.add(z);
      const hl = this.add.rectangle(0, 0, cw, ch).setOrigin(0).setStrokeStyle(2, 0xffffff).setVisible(false);
      c.add(hl);
      z.on('pointerover', () => {
        hl.setVisible(true);
        audio.sfx('select');
      });
      z.on('pointerout', () => hl.setVisible(false));
      z.on('pointerup', () => {
        audio.sfx('confirm');
        go(this, 'Prep', { mode: 'normal', game: gid, domain: d.id });
      });
    });

    // 보스
    const bx = x0,
      by = 220,
      bw = W - x0 * 2,
      bh = 104;
    const unlocked = st.bossUnlocked(d.id);
    const cleared = !!st.save.cleared[d.id];
    const gk = App.content.char(d.gatekeeper);
    const bc = this.add.container(bx, by);
    bc.add(panel(this, 0, 0, bw, bh, { border: unlocked ? C.accentN : C.line, fill: 0x120f22 }));
    const portrait = this.add.image(54, bh / 2, 'art_' + gk.id);
    fitImage(portrait, 84, 84);
    if (!unlocked) portrait.setTint(0x333344);
    bc.add(portrait);
    bc.add(T(this, 110, 12, '보스 스테이지', { size: 10, color: C.accent }));
    bc.add(T(this, 110, 26, `시련의 문지기 · ${gk.name}`, { bold: true, color: unlocked ? C.text : C.faint }));
    const cfg = App.content.challenges.boss;
    bc.add(
      T(
        this,
        110,
        46,
        `이 영역의 시련 ${cfg.segments}개를 ${cfg.duration}초씩 연달아 버텨라. 목숨 ${cfg.lives}개 공유.\n` +
          (cleared ? '해방 완료! 다시 도전하면 코인 보상을 받을 수 있다.' : `첫 클리어 보상: ${gk.name} 합류 + ${cfg.reward.toLocaleString()} 코인`),
        { size: 10, color: C.dim, wrap: bw - 230 },
      ),
    );
    const stars = st.domainStars(d.id);
    const status = cleared ? '해방됨' : unlocked ? '도전 가능!' : `★ ${stars}/${d.bossStars} 필요`;
    bc.add(T(this, bw - 14, 14, status, { align: 'right', bold: true, color: cleared ? C.good : unlocked ? C.accent : C.faint }));
    if (unlocked) {
      const btn = this.add.rectangle(bw - 70, bh - 24, 112, 26, C.accentN).setInteractive({ useHandCursor: true });
      const bt = T(this, bw - 70, bh - 31, cleared ? '다시 도전' : '도전하기', { align: 'center', bold: true, color: '#1a0f22' });
      bc.add([btn, bt]);
      this.tweens.add({ targets: btn, alpha: 0.75, yoyo: true, repeat: -1, duration: 500 });
      btn.on('pointerup', () => {
        audio.sfx('confirm');
        const sid = d.id + '_boss';
        const playData = { mode: 'boss', domain: d.id };
        if (!st.save.story[sid]) go(this, 'Story', { id: sid, next: 'Prep', nextData: playData });
        else go(this, 'Prep', playData);
      });
    } else {
      const z = this.add.zone(0, 0, bw, bh).setOrigin(0).setInteractive();
      bc.add(z);
      z.on('pointerup', () => toast(this, `이 영역에서 별을 ${d.bossStars}개 모으면 도전할 수 있어요`));
    }
  }
}
