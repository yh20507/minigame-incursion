import Phaser from 'phaser';
import { App, C, H, W } from '../core/app';
import { audio } from '../core/audio';
import { LocalBackend, SupabaseBackend } from '../core/backend';
import { Store } from '../core/store';
import { T, fadeIn, go } from '../core/ui';

export class TitleScene extends Phaser.Scene {
  private ready = false;
  private started = false;

  constructor() {
    super('Title');
  }

  create() {
    fadeIn(this);
    this.ready = false;
    this.started = false;
    this.add.image(0, 0, 'bg_rift').setOrigin(0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, 0x07060f, 0.35).setOrigin(0);

    // 떨어지는 세계 조각들
    const shards = this.add.container(0, 0);
    const colors = App.content.domains.map((d) => Phaser.Display.Color.HexStringToColor(d.color).color);
    for (let i = 0; i < 26; i++) {
      const s = this.add
        .rectangle(Math.random() * W, Math.random() * H, 4 + Math.random() * 14, 4 + Math.random() * 10, Phaser.Utils.Array.GetRandom(colors), 0.5)
        .setAngle(Math.random() * 360);
      shards.add(s);
      this.tweens.add({
        targets: s,
        y: s.y + H + 40,
        angle: s.angle + 180,
        duration: 6000 + Math.random() * 8000,
        repeat: -1,
        onRepeat: () => {
          s.y = -20;
          s.x = Math.random() * W;
        },
      });
    }

    // 인트로: 균열이 퍼지고 → 섬광 → 로고
    const crack = this.add.graphics();
    const pts: [number, number][] = [];
    let x = W / 2,
      y = 0;
    while (y < H) {
      pts.push([x, y]);
      x += (Math.random() - 0.5) * 50;
      y += 12 + Math.random() * 18;
    }
    let drawn = 0;
    const crackTimer = this.time.addEvent({
      delay: 20,
      repeat: pts.length - 2,
      callback: () => {
        drawn++;
        crack.clear();
        crack.lineStyle(3, 0xff5fd2, 1);
        crack.beginPath();
        crack.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i <= drawn && i < pts.length; i++) crack.lineTo(pts[i][0], pts[i][1]);
        crack.strokePath();
        crack.lineStyle(1, 0xffffff, 1);
        crack.strokePath();
      },
    });

    const logo = this.add.container(W / 2, 118).setAlpha(0);
    if (this.textures.exists('logo')) {
      const img = this.add.image(0, 0, 'logo');
      img.setScale(Math.min(420 / img.width, 140 / img.height));
      logo.add(img);
    } else {
      const sub = T(this, 0, -46, '미 니 게 임', { size: 24, align: 'center', color: C.cyan, stroke: true });
      const mainA = T(this, -2, -12, '인커젼', { size: 36, align: 'center', color: '#ff5fd2' }).setAlpha(0.7);
      const mainB = T(this, 2, -12, '인커젼', { size: 36, align: 'center', color: '#5fd3e0' }).setAlpha(0.7);
      const main = T(this, 0, -12, '인커젼', { size: 36, align: 'center', color: '#ffffff', stroke: true });
      const en = T(this, 0, 34, 'M I N I G A M E   I N C U R S I O N', { size: 10, align: 'center', color: C.dim });
      const bar = this.add.rectangle(0, 30, 200, 2, 0xff5fd2);
      logo.add([sub, mainA, mainB, main, bar, en]);
      this.time.addEvent({
        delay: 90,
        loop: true,
        callback: () => {
          const j = Math.random() < 0.12;
          mainA.setX(j ? -4 - Math.random() * 4 : -2);
          mainB.setX(j ? 4 + Math.random() * 4 : 2);
        },
      });
    }

    const prompt = T(this, W / 2, 236, '스페이스 또는 클릭으로 시작', { align: 'center', color: C.text, stroke: true }).setAlpha(0);
    this.tweens.add({ targets: prompt, alpha: { from: 1, to: 0.25 }, yoyo: true, repeat: -1, duration: 700, delay: 1600 });
    const modeLabel = App.online ? '온라인 저장 모드 (Supabase)' : '오프라인 저장 모드 (이 PC에 저장)';
    T(this, 8, H - 16, 'v0.1 · ' + modeLabel, { size: 10, color: C.faint });
    T(this, W - 8, H - 16, '글꼴: 갈무리 (OFL)', { size: 10, color: C.faint, align: 'right' });

    const flash = this.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0);
    const showLogo = () => {
      if (this.ready) return;
      this.ready = true;
      crackTimer.remove();
      flash.setAlpha(1);
      this.tweens.add({ targets: flash, alpha: 0, duration: 500 });
      this.tweens.add({ targets: crack, alpha: 0, duration: 800 });
      logo.setAlpha(1).setScale(1.4);
      this.tweens.add({ targets: logo, scale: 1, duration: 350, ease: 'Back.Out' });
      this.cameras.main.shake(250, 0.01);
      prompt.setAlpha(1);
      audio.sfx('legend');
    };
    this.time.delayedCall(pts.length * 20 + 200, showLogo);

    const proceed = () => {
      audio.ensure();
      if (!this.ready) {
        showLogo();
        return;
      }
      if (this.started) return;
      this.started = true;
      this.begin();
    };
    this.input.on('pointerup', proceed);
    this.input.keyboard?.on('keydown-SPACE', proceed);
    this.input.keyboard?.on('keydown-ENTER', proceed);
  }

  private async begin() {
    audio.bgm('title', 52, 'minor', 90);
    if (App.online) {
      const be = App.backend as SupabaseBackend;
      const ok = await be.restoreSession();
      if (!ok) {
        this.showLogin(be);
        return;
      }
      try {
        await App.store.init();
      } catch (e) {
        this.showLogin(be, '서버에 연결하지 못했어요. 다시 로그인하거나 오프라인으로 하세요.');
        return;
      }
    }
    this.enterGame();
  }

  private enterGame() {
    const s = App.store.save.extra.settings;
    audio.setVolumes(s.sfx, s.bgm);
    if (!App.store.save.story['prologue']) {
      go(this, 'Story', { id: 'prologue', next: 'WorldMap' });
    } else {
      go(this, 'WorldMap');
    }
  }

  private showLogin(be: SupabaseBackend, msg = '') {
    const ov = document.getElementById('overlay')!;
    ov.innerHTML = `
      <form class="login" autocomplete="on">
        <h2>미니게임-인커젼</h2>
        <p>진행 상황을 온라인에 저장하려면 로그인하세요.<br/>처음이면 이메일과 비밀번호를 정하고 '회원가입'을 누르세요.</p>
        <label>이메일</label><input name="email" type="email" required />
        <label>비밀번호 (6자 이상)</label><input name="pw" type="password" minlength="6" required />
        <div class="row"><button type="button" data-a="signup">회원가입</button><button class="primary" type="submit">로그인</button></div>
        <div class="msg">${msg}</div>
        <button type="button" class="offline" data-a="offline">오프라인으로 하기 (이 PC에만 저장)</button>
      </form>`;
    ov.classList.add('show');
    const form = ov.querySelector('form')!;
    const msgEl = ov.querySelector('.msg') as HTMLElement;
    const email = form.querySelector('[name=email]') as HTMLInputElement;
    const pw = form.querySelector('[name=pw]') as HTMLInputElement;
    this.input.keyboard!.enabled = false;
    const close = () => {
      ov.classList.remove('show');
      ov.innerHTML = '';
      this.input.keyboard!.enabled = true;
    };
    const after = async () => {
      msgEl.textContent = '불러오는 중...';
      try {
        await App.store.init();
        close();
        this.enterGame();
      } catch (e: any) {
        msgEl.textContent = '불러오기 실패: ' + (e?.message ?? e);
      }
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msgEl.textContent = '로그인 중...';
      try {
        await be.signIn(email.value.trim(), pw.value);
        await after();
      } catch (err: any) {
        msgEl.textContent = '로그인 실패: ' + (err?.message ?? err);
      }
    });
    form.querySelector('[data-a=signup]')!.addEventListener('click', async () => {
      if (!form.reportValidity()) return;
      msgEl.textContent = '가입 중...';
      try {
        const hasSession = await be.signUp(email.value.trim(), pw.value);
        if (hasSession) await after();
        else msgEl.textContent = '가입 완료! 메일함의 확인 링크를 누른 뒤 로그인하세요.';
      } catch (err: any) {
        msgEl.textContent = '가입 실패: ' + (err?.message ?? err);
      }
    });
    form.querySelector('[data-a=offline]')!.addEventListener('click', async () => {
      App.backend = new LocalBackend();
      App.online = false;
      App.store = new Store(App.content, App.backend);
      await App.store.init();
      close();
      this.enterGame();
    });
    email.focus();
  }
}
