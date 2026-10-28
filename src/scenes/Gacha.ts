import Phaser from 'phaser';
import { App, C, H, W, hexNum } from '../core/app';
import { audio } from '../core/audio';
import { RARITY_COLORS, fitImage, portraitKey } from '../core/art';
import type { BannerDef, PullResult } from '../core/types';
import { showFullArt } from '../core/viewer';
import { T, bg, button, fadeIn, go, panel, rarityName, toast, topBar } from '../core/ui';

export class GachaScene extends Phaser.Scene {
  banner!: BannerDef;
  busy = false;

  constructor() {
    super('Gacha');
  }

  create(data: { banner?: string }) {
    fadeIn(this);
    this.busy = false;
    bg(this, 'rift', 0.35);
    topBar(this, '차원 균열', () => !this.busy && go(this, 'Lobby'));
    const banners = App.store.availableBanners();
    this.banner = banners.find((b) => b.id === data?.banner) ?? banners[0];
    // 균열마다 그 세계관 곡 (bgm/gacha_<균열id>.mp3 → bgm/gacha_<세계관id>.mp3 → 기본)
    const bf = ['gacha_' + this.banner.id, ...(this.banner.world ? ['gacha_' + this.banner.world] : []), 'gacha'];
    audio.bgm('gacha', 55, 'lydian', 100, bf);

    banners.forEach((b, i) => {
      const col = this.bannerColor(b);
      button(this, 10, 34 + i * 38, 124, 34, b.name, () => go(this, 'Gacha', { banner: b.id }), {
        color: col,
        sub: (b.type === 'standard' ? '상시' : '한정') + (App.store.isFirstMulti(b.id) ? ' · 첫 확정' : ''),
        size: 10,
      });
      if (b.id === this.banner.id) {
        const g = this.add.graphics();
        g.lineStyle(2, 0xffffff, 1);
        g.strokeRect(9, 33 + i * 38, 126, 36);
      }
    });
    button(this, 10, H - 36, 60, 26, '기록', () => this.history(), { size: 10 });
    button(this, 74, H - 36, 60, 26, '가방', () => go(this, 'Bag', { back: 'Gacha' }), { size: 10 });
    this.drawBanner();
  }

  bannerColor(b: BannerDef) {
    return b.type === 'world' && b.world ? App.content.domainColor(b.world) : C.accent;
  }

  drawBanner() {
    const b = this.banner;
    const st = App.store;
    const cfg = App.content.gacha;
    const col = this.bannerColor(b);
    const x = 144,
      y = 34,
      w = W - x - 8,
      h = 236;
    panel(this, x, y, w, h, { border: hexNum(col) });
    const bgKey = b.type === 'world' && b.world ? b.world : 'rift';
    this.add.image(x + 1, y + 1, 'bg_' + bgKey).setOrigin(0).setDisplaySize(w - 2, h - 2).setAlpha(0.45);
    T(this, x + 12, y + 8, b.name, { size: 24, color: col, stroke: true });
    if (b.type === 'world') {
      const period = b.end ? `${b.start ?? ''} ~ ${b.end} 한정` : '한정 · 종료일 미정';
      T(this, x + 12, y + 38, period, { size: 10, color: C.gold, stroke: true });
    }
    T(this, x + 12, y + 52, b.desc, { size: 10, color: C.text, stroke: true, wrap: 250 });

    const pool = st.gachaPool(b.id);
    const feat = [...pool].sort((a, c) => c.rarity - a.rarity).slice(0, 3);
    feat.forEach((c, i) => {
      const img = this.add.image(x + w - 52 - i * 82, y + h - 18, portraitKey(this, c.id)).setOrigin(0.5, 1);
      fitImage(img, 100, 130);
      if (!st.owns(c.id)) img.setTint(0x8880aa);
      T(this, img.x, y + h - 16, c.name, { size: 10, align: 'center', color: RARITY_COLORS[c.rarity], stroke: true });
    });

    let ty = y + 92;
    T(this, x + 12, ty, '확률', { size: 10, color: C.dim, stroke: true });
    ty += 14;
    for (const r of [...cfg.rarities].reverse()) {
      const n = pool.filter((c) => c.rarity === r.id).length;
      T(this, x + 12, ty, rarityName(r.id), { size: 10, color: r.color, stroke: true });
      T(this, x + 72, ty, `${r.rate}%`, { size: 10, stroke: true });
      T(this, x + 118, ty, `${n}종`, { size: 10, color: C.dim, stroke: true });
      ty += 13;
    }
    T(this, x + 12, ty, '아이템', { size: 10, color: C.cyan, stroke: true });
    T(this, x + 72, ty, `${cfg.itemRate}%`, { size: 10, stroke: true });
    ty += 19;
    const toL = Math.max(0, cfg.pity.legend - st.save.pity.legend);
    const toU = Math.max(0, cfg.pity.ultra - st.save.pity.ultra);
    T(this, x + 12, ty, `★4 확정까지 ${toL}회`, { size: 10, color: C.gold, stroke: true });
    T(this, x + 12, ty + 13, `★5 확정까지 ${toU}회`, { size: 10, color: '#ff5fd2', stroke: true });
    T(this, x + 12, ty + 26, `천장은 모든 균열 공통 · 총 ${st.save.totalPulls}회`, { size: 10, color: C.faint, stroke: true });

    const by = H - 46;
    const one = button(this, W - 336, by, 160, 36, '1회 소환', () => this.doPull(false), { sub: `${cfg.cost.single} 코인`, color: col });
    const first = st.isFirstMulti(b.id);
    const fg = Math.max(cfg.multiGuarantee, cfg.firstMultiGuarantee ?? 4);
    const multi = button(this, W - 168, by, 160, 36, `${cfg.cost.multiCount - 1}+1회 소환`, () => this.doPull(true), {
      sub: first ? `${cfg.cost.multi} 코인 · ★${fg} 이상 확정!` : `${cfg.cost.multi} 코인 · ★${cfg.multiGuarantee} 이상 1개 보장`,
      color: first ? C.gold : C.accent,
    });
    if (first) {
      const tag = T(this, W - 88, by - 16, `첫 ${cfg.cost.multiCount - 1}+1 ★${fg} 확정`, { size: 10, align: 'center', color: '#ffffff', stroke: true });
      this.tweens.add({ targets: tag, y: tag.y - 3, yoyo: true, repeat: -1, duration: 500 });
    }
    if (st.coins < cfg.cost.single || !pool.length) one.setEnabled(false);
    if (st.coins < cfg.cost.multi || !pool.length) multi.setEnabled(false);
  }

  async doPull(multi: boolean) {
    if (this.busy) return;
    this.busy = true;
    let res: PullResult[];
    try {
      res = await App.store.pull(this.banner.id, multi);
    } catch (e: any) {
      this.busy = false;
      toast(this, e?.message ?? '소환 실패', C.bad);
      return;
    }
    this.animate(res);
  }

  // ---------------------------------------------------------------- 카드팩 연출
  private wait(ms: number) {
    return new Promise<void>((r) => this.time.delayedCall(ms, r));
  }
  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((r) => this.tweens.add({ ...cfg, onComplete: () => r() }));
  }

  /** 1) 팩이 떨어지고 2) 찢고 3) 카드가 펼쳐지고 4) 뒤집으며 ★4·★5는 일러스트 */
  async animate(res: PullResult[]) {
    const top = Math.max(0, ...res.map((r) => r.rarity));
    const rarCol = (r: number) => (r <= 0 ? 0x5fd3e0 : hexNum(RARITY_COLORS[r]));
    const topCol = top >= 5 ? 0xffffff : rarCol(top);
    const banCol = hexNum(this.bannerColor(this.banner));
    const multi = res.length > 1;
    audio.stopBgm();
    audio.bgm('gacha_open', 55, 'lydian', 110, ['gacha']);

    const ov = this.add.container(0, 0).setDepth(400);
    const dark = this.add.rectangle(0, 0, W, H, 0x07060f, 0.94).setOrigin(0).setInteractive();
    ov.add(dark);
    ov.add(this.add.image(0, 0, 'bg_' + (this.banner.world ?? 'rift')).setOrigin(0).setDisplaySize(W, H).setAlpha(0.25));

    // ----- 팩
    const pw = multi ? 150 : 116,
      ph = multi ? 210 : 164;
    const pack = this.add.container(W / 2, -ph);
    ov.add(pack);
    const body = this.add.graphics();
    const dk = Phaser.Display.Color.ValueToColor(banCol).darken(55).color;
    body.fillStyle(0x07060f, 1);
    body.fillRect(-pw / 2 - 2, -ph / 2 + 22, pw + 4, ph - 20);
    body.fillStyle(dk, 1);
    body.fillRect(-pw / 2, -ph / 2 + 24, pw, ph - 24);
    body.fillStyle(banCol, 0.35);
    for (let i = 0; i < 6; i++) body.fillRect(-pw / 2, -ph / 2 + 40 + i * 26, pw, 2);
    body.lineStyle(2, banCol, 1);
    body.strokeRect(-pw / 2 + 4, -ph / 2 + 28, pw - 8, ph - 32);
    body.fillStyle(0xffffff, 0.08);
    body.fillRect(-pw / 2 + 8, -ph / 2 + 30, 10, ph - 40);
    pack.add(body);
    const emblem = this.add.rectangle(0, 10, 34, 34, banCol).setAngle(45).setStrokeStyle(2, 0xffffff);
    pack.add(emblem);
    pack.add(T(this, 0, ph / 2 - 46, this.banner.name, { size: 10, align: 'center', color: '#ffffff', stroke: true }));
    pack.add(T(this, 0, ph / 2 - 30, multi ? `${res.length}장` : '1장', { size: 10, align: 'center', color: C.gold, stroke: true }));
    // 윗부분(찢겨 나갈 띠)
    const strip = this.add.container(0, -ph / 2 + 12);
    const sg = this.add.graphics();
    sg.fillStyle(0x07060f, 1);
    sg.fillRect(-pw / 2 - 2, -12, pw + 4, 26);
    sg.fillStyle(Phaser.Display.Color.ValueToColor(banCol).darken(30).color, 1);
    sg.fillRect(-pw / 2, -10, pw, 22);
    sg.fillStyle(0x07060f, 1);
    for (let x = -pw / 2; x < pw / 2; x += 8) sg.fillTriangle(x, -10, x + 8, -10, x + 4, -5);
    strip.add(sg);
    pack.add(strip);
    // 찢는 선
    const tearY = -ph / 2 + 24;
    const dash = this.add.graphics();
    dash.lineStyle(1, 0xffffff, 0.7);
    for (let x = -pw / 2 + 4; x < pw / 2 - 4; x += 8) dash.lineBetween(x, tearY, x + 4, tearY);
    pack.add(dash);
    const tearLine = this.add.graphics();
    pack.add(tearLine);
    const leak = this.add.particles(0, 0, 'spark', {
      speed: { min: 20, max: 120 },
      angle: { min: 200, max: 340 },
      lifespan: 600,
      scale: { start: 1.5, end: 0 },
      tint: topCol,
      frequency: 30,
      emitting: false,
    });
    pack.add(leak);

    audio.sfx('pack');
    await this.tween({ targets: pack, y: H / 2 + 6, duration: 520, ease: 'Bounce.Out' });
    this.tweens.add({ targets: pack, angle: { from: -1.5, to: 1.5 }, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });

    const hint = T(this, W / 2, H / 2 + ph / 2 + 18, '팩 윗부분을 옆으로 끌어서 찢기  (스페이스 길게)', { size: 10, align: 'center', color: C.text, stroke: true });
    ov.add(hint);
    this.tweens.add({ targets: hint, alpha: 0.35, yoyo: true, repeat: -1, duration: 600 });
    const skipBtn = button(this, W - 92, H - 30, 84, 22, '건너뛰기 ▶▶', () => (progress = 1), { size: 10, silent: true });
    ov.add(skipBtn);

    // ----- 찢기
    let progress = 0;
    let dragging = false;
    let startX = 0;
    const onDown = (p: Phaser.Input.Pointer) => {
      const lx = p.x - pack.x,
        ly = p.y - pack.y;
      if (Math.abs(lx) < pw / 2 + 20 && ly > -ph / 2 - 20 && ly < -ph / 2 + 50) {
        dragging = true;
        startX = Math.min(p.x, pack.x - pw / 2 + progress * pw);
      }
    };
    const onMove = (p: Phaser.Input.Pointer) => {
      if (!dragging || !p.isDown) return;
      progress = Math.max(progress, Math.min(1, (p.x - (pack.x - pw / 2)) / pw));
      if (p.x < startX) progress = Math.max(progress, Math.min(1, (pack.x + pw / 2 - p.x) / pw));
    };
    const onUp = () => (dragging = false);
    this.input.on('pointerdown', onDown);
    this.input.on('pointermove', onMove);
    this.input.on('pointerup', onUp);
    const space = this.input.keyboard!.addKey('SPACE');
    let lastTick = 0;
    await new Promise<void>((resolve) => {
      const ev = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          if (space.isDown) progress = Math.min(1, progress + 0.022);
          const x = -pw / 2 + progress * pw;
          tearLine.clear();
          tearLine.lineStyle(2, topCol, 1);
          tearLine.lineBetween(-pw / 2, tearY, x, tearY);
          if (progress > 0 && progress < 1) {
            leak.setPosition(x, tearY);
            leak.emitting = true;
            if (Math.floor(progress * 12) !== lastTick) {
              lastTick = Math.floor(progress * 12);
              audio.sfx('tick');
            }
          }
          if (progress >= 1) {
            ev.remove();
            resolve();
          }
        },
      });
    });
    this.input.off('pointerdown', onDown);
    this.input.off('pointermove', onMove);
    this.input.off('pointerup', onUp);
    leak.emitting = false;
    hint.destroy();
    skipBtn.destroy();
    this.tweens.killTweensOf(pack);
    pack.setAngle(0);

    // ----- 띠가 날아가고 빛이 솟는다
    audio.sfx('tear');
    dash.destroy();
    this.tweens.add({ targets: strip, x: pw * 0.9, y: strip.y - 90, angle: 50, alpha: 0, duration: 500, ease: 'Quad.Out' });
    const beam = this.add.graphics();
    pack.add(beam);
    const beamCol = top >= 5 ? 0xff5fd2 : topCol;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 700,
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        beam.clear();
        beam.fillStyle(beamCol, 0.25 + 0.25 * v);
        beam.fillTriangle(-pw / 2 + 6, tearY, pw / 2 - 6, tearY, 0, tearY - 40 - 220 * v);
        beam.fillStyle(0xffffff, 0.3 * v);
        beam.fillTriangle(-pw / 4, tearY, pw / 4, tearY, 0, tearY - 30 - 160 * v);
      },
    });
    this.cameras.main.shake(top >= 4 ? 500 : 200, top >= 4 ? 0.012 : 0.005);
    audio.sfx(top >= 4 ? 'legend' : top === 3 ? 'hero' : 'rare');
    await this.wait(top >= 4 ? 900 : 600);

    if (top >= 5) {
      // ★5: 정지 → 균열 이변 → 무지개
      const freeze = this.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0);
      ov.add(freeze);
      const warn = T(this, W / 2, H / 2 - 12, '균 열 이 변', { size: 24, align: 'center', color: '#ff5fd2', stroke: true }).setAlpha(0);
      ov.add(warn);
      await this.tween({ targets: warn, alpha: 1, duration: 500, delay: 300 });
      await this.wait(500);
      audio.sfx('ultra');
      freeze.destroy();
      warn.destroy();
      const rainbow = this.add.graphics();
      ov.add(rainbow);
      await new Promise<void>((r) =>
        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 1100,
          onUpdate: (t) => {
            const v = t.getValue() ?? 0;
            rainbow.clear();
            for (let k = 0; k < 7; k++) {
              const c = Phaser.Display.Color.HSVToRGB((v * 2 + k / 7) % 1, 0.7, 1).color as number;
              rainbow.fillStyle(c, 0.28);
              rainbow.fillRect(0, (H / 7) * k, W * v, H / 7);
            }
          },
          onComplete: () => r(),
        }),
      );
      this.cameras.main.flash(400, 255, 255, 255);
      this.tweens.add({ targets: rainbow, alpha: 0, duration: 600, onComplete: () => rainbow.destroy() });
    }
    await this.tween({ targets: pack, y: H + ph, alpha: 0, duration: 400, ease: 'Quad.In' });
    pack.destroy();
    this.dealCards(ov, res);
  }

  /** 카드 펼치기와 뒤집기 */
  dealCards(ov: Phaser.GameObjects.Container, res: PullResult[]) {
    const single = res.length === 1;
    const cw = single ? 120 : 82,
      ch = single ? 168 : 114,
      gap = 10;
    type Card = { c: Phaser.GameObjects.Container; back: Phaser.GameObjects.Container; face: Phaser.GameObjects.Container; r: PullResult; open: boolean };
    const cards: Card[] = [];
    const pos = (i: number) => {
      if (single) return { x: W / 2, y: H / 2 - 6 };
      const row = i < 6 ? 0 : 1;
      const n = row === 0 ? Math.min(6, res.length) : res.length - 6;
      const k = row === 0 ? i : i - 6;
      const x0 = (W - (cw * n + gap * (n - 1))) / 2 + cw / 2;
      return { x: x0 + k * (cw + gap), y: 34 + ch / 2 + row * (ch + gap) };
    };
    res.forEach((r, i) => {
      const p = pos(i);
      const c = this.add.container(W / 2, H + 80).setScale(0.6);
      const back = this.cardBack(cw, ch, r.rarity);
      const face = this.cardFace(cw, ch, r, single);
      face.setVisible(false);
      c.add([face, back]);
      ov.add(c);
      const card: Card = { c, back, face, r, open: false };
      cards.push(card);
      this.tweens.add({ targets: c, x: p.x, y: p.y, scale: 1, angle: { from: Phaser.Math.Between(-30, 30), to: 0 }, duration: 380, delay: 70 * i, ease: 'Back.Out', onStart: () => audio.sfx('select') });
      const z = this.add.zone(-cw / 2, -ch / 2, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true });
      c.add(z);
      z.on('pointerup', () => this.time.delayedCall(0, () => flip(card)));
    });

    let busy = false;
    const flip = async (card: Card) => {
      if (card.open || busy) return;
      busy = true;
      card.open = true;
      audio.sfx('flip');
      await this.tween({ targets: card.c, scaleX: 0, duration: 90 });
      card.back.setVisible(false);
      card.face.setVisible(true);
      await this.tween({ targets: card.c, scaleX: 1, duration: 110 });
      if (card.r.kind === 'char' && card.r.rarity >= 4) {
        this.tweens.add({ targets: card.c, y: card.c.y - 4, yoyo: true, repeat: -1, duration: 500 });
        await new Promise<void>((r) => showFullArt(this, card.r.id, r));
      } else if (card.r.rarity === 3) audio.sfx('hero');
      busy = false;
      if (cards.every((c) => c.open)) finish();
    };
    const flipAll = async () => {
      for (const c of cards) {
        if (c.open) continue;
        while (busy) await this.wait(50);
        await flip(c);
      }
    };

    const allBtn = button(this, W / 2 - 70, H - 34, 140, 26, '전부 뒤집기 (스페이스)', () => flipAll(), { size: 10, color: C.accent });
    ov.add(allBtn);
    const onSpace = () => {
      if (cards.every((c) => c.open)) return;
      flipAll();
    };
    this.input.keyboard?.on('keydown-SPACE', onSpace);

    const finish = () => {
      this.input.keyboard?.off('keydown-SPACE', onSpace);
      allBtn.destroy();
      const nNew = res.filter((r) => r.isNew).length;
      const nUp = res.filter((r) => r.levelUp).length;
      const nItem = res.filter((r) => r.kind === 'item').length;
      const cfg = App.content.gacha;
      const toU = Math.max(0, cfg.pity.ultra - App.store.save.pity.ultra);
      const toL = Math.max(0, cfg.pity.legend - App.store.save.pity.legend);
      const sum = `NEW ${nNew} · 강화 ${nUp} · 아이템 ${nItem}   |   ★4까지 ${toL}회 · ★5까지 ${toU}회`;
      ov.add(T(this, W / 2, single ? H - 64 : H - 56, sum, { size: 10, align: 'center', color: C.text, stroke: true }));
      const close = () => {
        ov.destroy();
        this.busy = false;
        go(this, 'Gacha', { banner: this.banner.id });
      };
      ov.add(button(this, W / 2 - 70, H - 36, 140, 28, '확인 (스페이스)', close, { color: C.accent }));
      this.time.delayedCall(250, () => this.input.keyboard?.once('keydown-SPACE', close));
    };
  }

  cardBack(w: number, h: number, rarity: number) {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x07060f, 1);
    g.fillRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
    g.fillStyle(0x1e1a3a, 1);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.lineStyle(1, 0x6b5bd6, 1);
    g.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
    g.fillStyle(0x6b5bd6, 0.5);
    for (let y = -h / 2 + 10; y < h / 2 - 8; y += 8) for (let x = -w / 2 + 10; x < w / 2 - 8; x += 8) if (((x + y) / 8) % 2 === 0) g.fillRect(x, y, 2, 2);
    c.add(g);
    c.add(this.add.rectangle(0, 0, 20, 20, 0x6b5bd6).setAngle(45).setStrokeStyle(2, 0xffffff));
    if (rarity >= 4) {
      const glow = this.add.graphics();
      c.add(glow);
      if (rarity === 4) {
        glow.lineStyle(3, 0xffc845, 1);
        glow.strokeRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
        this.tweens.add({ targets: glow, alpha: 0.35, yoyo: true, repeat: -1, duration: 420 });
      } else {
        const tw = this.tweens.addCounter({
          from: 0,
          to: 360,
          duration: 1400,
          repeat: -1,
          onUpdate: (t) => {
            const hue = (t.getValue() ?? 0) / 360;
            glow.clear();
            glow.lineStyle(3, Phaser.Display.Color.HSVToRGB(hue, 0.7, 1).color as number, 1);
            glow.strokeRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
          },
        });
        c.once('destroy', () => tw.remove());
      }
    }
    return c;
  }

  cardFace(cw: number, chh: number, r: PullResult, big: boolean) {
    const card = this.add.container(0, 0);
    const g = this.add.graphics();
    const col = r.kind === 'item' ? 0x5fd3e0 : hexNum(RARITY_COLORS[r.rarity]);
    g.fillStyle(0x07060f, 1);
    g.fillRect(-cw / 2 - 1, -chh / 2 - 1, cw + 2, chh + 2);
    g.fillStyle(Phaser.Display.Color.ValueToColor(col).darken(68).color, 1);
    g.fillRect(-cw / 2, -chh / 2, cw, chh);
    g.lineStyle(r.rarity >= 4 ? 2 : 1, col, 1);
    g.strokeRect(-cw / 2 + 1, -chh / 2 + 1, cw - 2, chh - 2);
    card.add(g);
    if (r.kind === 'item') {
      const it = App.content.item(r.id)!;
      const icon = this.add.image(0, -14, 'it_' + it.id);
      fitImage(icon, big ? 64 : 40, big ? 64 : 40);
      card.add(icon);
      card.add(T(this, 0, chh / 2 - 38, it.name, { size: 10, align: 'center', color: C.cyan, stroke: true }));
      card.add(T(this, 0, chh / 2 - 22, it.effect === 'instant' ? `+${it.value}코인` : '아이템', { size: 10, align: 'center', color: C.dim, stroke: true }));
    } else {
      const c = App.content.char(r.id);
      const img = this.add.image(0, -12, big ? portraitKey(this, c.id) : 'spr_' + c.id);
      fitImage(img, cw - 16, big ? chh - 60 : 60);
      card.add(img);
      card.add(T(this, 0, chh / 2 - 38, c.name, { size: 10, align: 'center', color: RARITY_COLORS[r.rarity], stroke: true }));
      card.add(T(this, 0, chh / 2 - 22, this.dupText(r, true), { size: 10, align: 'center', color: r.isNew ? C.accent : C.gold, stroke: true }));
      card.add(T(this, -cw / 2 + 4, -chh / 2 + 3, rarityName(r.rarity), { size: 10, color: RARITY_COLORS[r.rarity], stroke: true }));
    }
    return card;
  }

  dupText(r: PullResult, short = false) {
    const enh = App.content.gacha.enhance;
    if (r.isNew) return 'NEW!';
    if (r.levelUp) return `강화! ${r.b}강`;
    if (r.refund) return short ? `+${r.refund}코인` : `최대 강화 · ${r.refund} 코인으로 환급`;
    const need = enh.need[r.b] ?? 1;
    return short ? `중복 ${r.d}/${need}` : `중복 · 다음 강화까지 ${r.d}/${need}`;
  }

  history() {
    const ov = this.add.container(0, 0).setDepth(400);
    ov.add(this.add.rectangle(0, 0, W, H, 0x07060f, 0.9).setOrigin(0).setInteractive());
    ov.add(panel(this, 60, 30, W - 120, H - 70));
    ov.add(T(this, 76, 40, '최근 뽑기 기록', { bold: true, color: C.accent }));
    const log = App.store.save.extra.log.slice(0, 40);
    if (!log.length) ov.add(T(this, W / 2, 140, '아직 기록이 없어요', { align: 'center', color: C.faint }));
    log.forEach((e, i) => {
      const col = i < 20 ? 0 : 1;
      const row = i % 20;
      const isChar = e.r > 0 && App.content.hasChar(e.id);
      const name = isChar ? App.content.char(e.id).name : App.content.item(e.id)?.name ?? e.id;
      const x = 76 + col * 250,
        y = 60 + row * 12;
      const d = new Date(e.at);
      ov.add(T(this, x, y, `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, { size: 10, color: C.faint }));
      ov.add(T(this, x + 70, y, `${isChar ? rarityName(e.r) : '아이템'} ${name}`, { size: 10, color: isChar ? RARITY_COLORS[e.r] : C.cyan }));
    });
    ov.add(button(this, W / 2 - 50, H - 34, 100, 24, '닫기', () => ov.destroy(), { size: 10 }));
  }
}
