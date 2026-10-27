import Phaser from 'phaser';
import { App, C, H, W, hexNum } from '../core/app';
import { audio } from '../core/audio';
import { RARITY_COLORS, fitImage } from '../core/art';
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
    audio.bgm('gacha', 55, 'lydian', 100);
    bg(this, 'rift', 0.35);
    topBar(this, '차원 균열', () => !this.busy && go(this, 'WorldMap'));
    const banners = App.store.availableBanners();
    this.banner = banners.find((b) => b.id === data?.banner) ?? banners[0];

    banners.forEach((b, i) => {
      const col = this.bannerColor(b);
      button(this, 10, 34 + i * 38, 124, 34, b.name, () => go(this, 'Gacha', { banner: b.id }), {
        color: col,
        sub: b.type === 'standard' ? '상시' : '한정',
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
      const img = this.add.image(x + w - 52 - i * 82, y + h - 18, 'art_' + c.id).setOrigin(0.5, 1);
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
    const multi = button(this, W - 168, by, 160, 36, `${cfg.cost.multiCount - 1}+1회 소환`, () => this.doPull(true), {
      sub: `${cfg.cost.multi} 코인 · ★${cfg.multiGuarantee} 이상 1개 보장`,
      color: C.accent,
    });
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

  animate(res: PullResult[]) {
    const top = Math.max(0, ...res.map((r) => r.rarity));
    const ov = this.add.container(0, 0).setDepth(400);
    const dark = this.add.rectangle(0, 0, W, H, 0x07060f, 1).setOrigin(0).setInteractive();
    ov.add(dark);
    const colors: Record<number, number> = { 0: 0x5fd3e0, 1: 0x9aa3ad, 2: 0x4aa3ff, 3: 0xb06cff, 4: 0xffc845, 5: 0xff5fd2 };
    const col = colors[Math.min(top, 4)];
    audio.stopBgm();
    audio.sfx('pull');

    const crack = this.add.graphics();
    ov.add(crack);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 14; i++) pts.push([W / 2 + (Math.random() - 0.5) * (i % 2 ? 30 : 10), 40 + i * 20]);
    const drawCrack = (c: number, width: number) => {
      crack.clear();
      crack.fillStyle(c, 0.9);
      crack.beginPath();
      crack.moveTo(pts[0][0], pts[0][1]);
      pts.forEach(([px, py], i) => crack.lineTo(px - width * Math.sin((i / 14) * Math.PI), py));
      [...pts].reverse().forEach(([px, py], i) => crack.lineTo(px + width * Math.sin(((14 - i) / 14) * Math.PI), py));
      crack.closePath();
      crack.fillPath();
      crack.lineStyle(1, 0xffffff, 1);
      crack.strokePoints(pts.map(([a, b]) => new Phaser.Math.Vector2(a, b)));
    };
    const parts = this.add.particles(W / 2, H / 2, 'spark', {
      speed: { min: 60, max: 260 },
      lifespan: 900,
      scale: { start: 2, end: 0 },
      tint: col,
      quantity: 2,
      frequency: 40,
      emitting: false,
    });
    ov.add(parts);

    let skip = false;
    const reveal = () => {
      if (skip) return;
      skip = true;
      crack.destroy();
      parts.destroy();
      // 초레어는 전용 일러스트부터
      const ultras = res.filter((r) => r.kind === 'char' && r.rarity === 5);
      const next = (i: number) => {
        if (i >= ultras.length) return this.showResults(ov, res);
        showFullArt(this, ultras[i].id, () => next(i + 1));
      };
      next(0);
    };
    dark.on('pointerup', () => top < 5 && reveal());
    this.input.keyboard?.once('keydown-SPACE', () => top < 5 && reveal());

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 900,
      ease: 'Quad.In',
      onUpdate: (t) => {
        const open = t.getValue() ?? 0;
        drawCrack(open < 0.6 ? 0xffffff : col, 2 + open * 30);
      },
      onComplete: () => {
        if (skip) return;
        parts.start();
        if (top >= 4) this.cameras.main.shake(500, 0.01);
        audio.sfx(top >= 4 ? 'legend' : top === 3 ? 'hero' : 'rare');
        if (top < 5) {
          this.time.delayedCall(top === 4 ? 1100 : 600, reveal);
          return;
        }
        // ★5: 정지 → 무지개 → 붕괴
        this.time.delayedCall(500, () => {
          parts.stop();
          const freeze = this.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0);
          ov.add(freeze);
          const warn = T(this, W / 2, H / 2 - 12, '균 열 이 변', { size: 24, align: 'center', color: '#ff5fd2', stroke: true }).setAlpha(0);
          ov.add(warn);
          this.tweens.add({ targets: warn, alpha: 1, duration: 400, delay: 400 });
          this.time.delayedCall(1300, () => {
            audio.sfx('ultra');
            freeze.destroy();
            warn.destroy();
            const rainbow = this.add.graphics();
            ov.add(rainbow);
            this.tweens.addCounter({
              from: 0,
              to: 1,
              duration: 1400,
              onUpdate: (t) => {
                const v = t.getValue() ?? 0;
                rainbow.clear();
                for (let k = 0; k < 7; k++) {
                  const c = Phaser.Display.Color.HSVToRGB((v * 2 + k / 7) % 1, 0.7, 1).color as number;
                  rainbow.fillStyle(c, 0.25);
                  rainbow.fillRect(0, (H / 7) * k, W * v, H / 7);
                }
                drawCrack(Phaser.Display.Color.HSVToRGB(v % 1, 0.6, 1).color as number, 32 + v * 260);
              },
              onComplete: () => {
                this.cameras.main.flash(500, 255, 255, 255);
                this.cameras.main.shake(600, 0.02);
                for (let k = 0; k < 30; k++) {
                  const shard = this.add.rectangle(W / 2, H / 2, 6 + Math.random() * 18, 4 + Math.random() * 10, Phaser.Display.Color.HSVToRGB(Math.random(), 0.6, 1).color as number);
                  ov.add(shard);
                  this.tweens.add({
                    targets: shard,
                    x: W / 2 + (Math.random() - 0.5) * 900,
                    y: H / 2 + (Math.random() - 0.5) * 700,
                    angle: Math.random() * 720,
                    duration: 900,
                  });
                }
                this.time.delayedCall(900, reveal);
              },
            });
          });
        });
      },
    });
  }

  showResults(ov: Phaser.GameObjects.Container, res: PullResult[]) {
    this.input.keyboard?.removeAllListeners('keydown-SPACE');
    const fx = this.add.container(0, 0);
    ov.add(fx);
    fx.add(this.add.image(0, 0, 'bg_rift').setOrigin(0).setDisplaySize(W, H).setAlpha(0.6));
    const close = () => {
      ov.destroy();
      this.busy = false;
      go(this, 'Gacha', { banner: this.banner.id });
    };

    if (res.length === 1) {
      const r = res[0];
      if (r.kind === 'item') {
        const it = App.content.item(r.id)!;
        const icon = this.add.image(200, 170, 'it_' + it.id);
        fitImage(icon, 140, 140);
        fx.add(icon);
        fx.add(T(this, 360, 110, '아이템', { color: C.cyan, bold: true, stroke: true }));
        fx.add(T(this, 360, 128, it.name, { size: 24, stroke: true }));
        fx.add(T(this, 360, 164, it.desc, { color: C.text, wrap: 240, stroke: true }));
        fx.add(T(this, 360, 210, it.effect === 'instant' ? `코인 +${it.value}` : `보유 ${App.store.itemCount(it.id)}개`, { bold: true, color: C.gold, stroke: true }));
      } else {
        const c = App.content.char(r.id);
        const col = RARITY_COLORS[r.rarity];
        const img = this.add.image(210, 330, 'art_' + c.id).setOrigin(0.5, 1);
        fitImage(img, 280, 300);
        img.setAlpha(0).setY(350);
        fx.add(img);
        this.tweens.add({ targets: img, alpha: 1, y: 330, duration: 400, ease: 'Back.Out' });
        fx.add(T(this, 380, 84, rarityName(r.rarity), { size: 12, color: col, bold: true, stroke: true }));
        fx.add(T(this, 380, 102, c.name, { size: c.name.length > 5 ? 24 : 36, color: '#ffffff', stroke: true }));
        fx.add(T(this, 380, 148, `${c.title} · ${App.content.domainName(c.domain)}`, { color: C.dim, stroke: true, wrap: 240 }));
        fx.add(T(this, 380, 174, `"${c.line}"`, { color: C.text, wrap: 240, stroke: true }));
        fx.add(T(this, 380, 226, this.dupText(r), { bold: true, color: r.isNew ? C.accent : C.gold, stroke: true }));
        if (r.pity) fx.add(T(this, 380, 246, '천장 도달!', { size: 10, color: C.gold, stroke: true }));
      }
    } else {
      const cw = 86,
        chh = 112,
        gap = 8;
      res.forEach((r, i) => {
        const row = i < 6 ? 0 : 1;
        const inRow = row === 0 ? Math.min(6, res.length) : res.length - 6;
        const k = row === 0 ? i : i - 6;
        const x0 = (W - (cw * inRow + gap * (inRow - 1))) / 2;
        const x = x0 + k * (cw + gap),
          y = 38 + row * (chh + gap);
        const card = this.add.container(x + cw / 2, y + chh / 2).setScale(0, 1);
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
          const icon = this.add.image(0, -12, 'it_' + it.id);
          fitImage(icon, 40, 40);
          card.add(icon);
          card.add(T(this, 0, 18, it.name, { size: 10, align: 'center', color: C.cyan, stroke: true }));
          card.add(T(this, 0, 34, it.effect === 'instant' ? `+${it.value}코인` : '아이템', { size: 10, align: 'center', color: C.dim, stroke: true }));
        } else {
          const c = App.content.char(r.id);
          const img = this.add.image(0, -10, 'spr_' + c.id);
          fitImage(img, 60, 60);
          card.add(img);
          card.add(T(this, 0, 22, c.name, { size: 10, align: 'center', color: RARITY_COLORS[r.rarity], stroke: true }));
          card.add(T(this, 0, 36, this.dupText(r, true), { size: 10, align: 'center', color: r.isNew ? C.accent : C.gold, stroke: true }));
          card.add(T(this, -cw / 2 + 4, -chh / 2 + 3, rarityName(r.rarity), { size: 10, color: RARITY_COLORS[r.rarity] }));
        }
        fx.add(card);
        this.tweens.add({
          targets: card,
          scaleX: 1,
          duration: 140,
          delay: 110 * i,
          onStart: () => audio.sfx(r.rarity >= 4 ? 'legend' : r.rarity === 3 ? 'hero' : 'select'),
        });
        if (r.rarity >= 4) this.tweens.add({ targets: card, y: card.y - 4, yoyo: true, repeat: -1, duration: 500, delay: 110 * i + 200 });
      });
    }
    fx.add(button(this, W / 2 - 70, H - 40, 140, 30, '확인 (스페이스)', close, { color: C.accent }));
    this.time.delayedCall(300, () => this.input.keyboard?.once('keydown-SPACE', close));
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
