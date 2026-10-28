import Phaser from 'phaser';
import { App, C, W } from '../core/app';
import { audio } from '../core/audio';
import { T, bg, button, fadeIn, go, panel, toast, topBar } from '../core/ui';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create(data: { confirmReset?: boolean }) {
    fadeIn(this);
    bg(this, 'rift', 0.6);
    topBar(this, '설정', () => go(this, 'Lobby'));
    const st = App.store;
    const s = st.save.extra.settings;

    panel(this, 20, 40, 290, 150);
    T(this, 32, 50, '소리', { bold: true, color: C.accent });
    const row = (y: number, label: string, key: 'sfx' | 'bgm' | 'theme') => {
      if (s[key] === undefined) s[key] = 0.8;
      T(this, 32, y + 4, label, {});
      const val = T(this, 210, y + 4, Math.round(s[key] * 10) + '', { align: 'center', color: C.gold });
      const set = (v: number) => {
        s[key] = Math.max(0, Math.min(1, Math.round(v * 10) / 10));
        val.setText(Math.round(s[key] * 10) + '');
        audio.setVolumes(s.sfx, s.bgm, s.theme);
        audio.sfx('select');
        st.setSettings({});
      };
      button(this, 160, y, 30, 22, '-', () => set(s[key] - 0.1), { silent: true });
      button(this, 230, y, 30, 22, '+', () => set(s[key] + 0.1), { silent: true });
    };
    row(68, '효과음', 'sfx');
    row(94, '배경음', 'bgm');
    row(120, '테마곡', 'theme');
    T(this, 32, 154, '전체화면', {});
    button(this, 160, 150, 100, 22, '전환 (F11)', () => {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
    }, { size: 10 });

    panel(this, 330, 40, 290, 150);
    T(this, 342, 50, '저장', { bold: true, color: C.accent });
    T(this, 342, 70, App.backend.label(), { size: 10, color: C.text, wrap: 266 });
    T(this, 342, 86, `코인 ${st.coins.toLocaleString()} · 별 ${st.totalStars()} · 캐릭터 ${st.ownedChars().length}명`, { size: 10, color: C.dim });
    if (App.online) {
      button(this, 342, 150, 120, 26, '로그아웃', async () => {
        await App.backend.logout();
        location.reload();
      }, { size: 10 });
    } else if (data?.confirmReset) {
      T(this, 342, 110, '정말 모든 진행을 지울까요?\n되돌릴 수 없어요.', { size: 10, color: C.bad });
      button(this, 342, 150, 120, 26, '네, 초기화', () => {
        localStorage.removeItem('mi_save_v1');
        location.reload();
      }, { size: 10, color: C.bad });
      button(this, 470, 150, 120, 26, '취소', () => go(this, 'Settings'), { size: 10 });
    } else {
      T(this, 342, 110, '온라인 저장을 쓰려면 config.json 에\nSupabase 주소와 키를 넣으세요.', { size: 10, color: C.faint });
      button(this, 342, 150, 120, 26, '진행 초기화', () => go(this, 'Settings', { confirmReset: true }), { size: 10, color: C.bad });
    }

    panel(this, 20, 204, W - 40, 120);
    T(this, 32, 214, '조작 안내', { bold: true, color: C.accent });
    T(
      this,
      32,
      232,
      '방향키 · 스페이스(또는 Z) · 마우스로 모든 게임을 할 수 있어요.\nESC: 게임 중 일시정지 / 메뉴에서 뒤로 가기\n그림은 assets/chars · assets/bg, 음원은 assets/audio 에 넣으면 다음 실행 때 바뀌어요.',
      { size: 10, color: C.text, wrap: W - 70 },
    );
    T(this, 32, 300, '미니게임-인커젼 v0.1 · 글꼴: 갈무리 (SIL Open Font License)', { size: 10, color: C.faint });
    void toast;
  }
}
