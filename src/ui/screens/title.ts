/** 타이틀: 균열 인트로 → 로고 → 시작 / 로그인 */
import { App } from '../../core/app';
import { audio } from '../../core/audio';
import { LocalBackend, SupabaseBackend } from '../../core/backend';
import { Store } from '../../core/store';
import { ui, type Screen } from '../app';
import { btn } from '../components';
import { h, svg, wait } from '../dom';
import { fx } from '../fx';
import { I } from '../icons';

export function titleScreen(): Screen {
  let ready = false;
  let started = false;

  const crack = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  crack.setAttribute('class', 'crack');
  crack.setAttribute('viewBox', '0 0 1920 1080');
  const pts: string[] = [];
  let x = 960,
    y = -20;
  while (y < 1120) {
    pts.push(`${x},${y}`);
    x += (Math.random() - 0.5) * 140;
    y += 40 + Math.random() * 60;
  }
  crack.innerHTML = `<polyline points="${pts.join(' ')}" class="c1"/><polyline points="${pts.join(' ')}" class="c2"/>`;

  const hasLogo = ui.game.textures.exists('logo') && (ui.game.textures.get('logo').getSourceImage() as HTMLImageElement) instanceof HTMLImageElement;
  const logo = hasLogo
    ? h('div', { class: 'logo' }, h('img', { class: 'logo-img', src: (ui.game.textures.get('logo').getSourceImage() as HTMLImageElement).src, alt: '미니게임-인커젼' }), h('div', { class: 'logo-sub' }, '꿰매어진 세계의 끝에서, 조각을 모아라'))
    : h(
        'div',
        { class: 'logo' },
        h('div', { class: 'logo-top' }, h('span', null, 'MINIGAME'), h('i'), h('span', null, 'INCURSION')),
        h('div', { class: 'logo-main', data: { t: '인커젼' } }, h('em', null, '미니게임'), h('b', null, '인커젼')),
        h('div', { class: 'logo-sub' }, '꿰매어진 세계의 끝에서, 조각을 모아라'),
      );
  const prompt = h('div', { class: 'title-prompt' }, h('span', { class: 'key' }, 'SPACE'), ' 또는 클릭으로 시작');
  const mode = App.online ? '온라인 저장 · Supabase' : '오프라인 저장 · 이 PC';
  const foot = h(
    'div',
    { class: 'title-foot' },
    h('span', null, `v0.4 · ${mode}`),
    h('span', null, '글꼴 Pretendard · Rajdhani · 갈무리 (OFL)'),
  );
  const el = h(
    'div',
    { class: 'title-screen' },
    h('div', { class: 'title-glow' }),
    crack as unknown as Node,
    h('div', { class: 'title-center' }, logo, prompt),
    foot,
  );

  const reveal = async () => {
    if (ready) return;
    ready = true;
    crack.classList.add('done');
    fx.flash('#ffffff', 600, 0.9);
    fx.shake(ui.stage, 2, 450);
    fx.burst(960, 540, { n: 90, color: ['#ff5fd2', '#5fd3e0', '#ffffff', '#ffc845'], speed: 900, size: 8, life: 1.4, shape: 'shard', g: 200 });
    audio.sfx('legend');
    logo.classList.add('show');
    await wait(900);
    prompt.classList.add('show');
    crack.style.opacity = '0';
  };
  const t1 = setTimeout(reveal, 1700);

  const proceed = () => {
    audio.ensure();
    if (!ready) return void reveal();
    if (started) return;
    started = true;
    begin();
  };
  el.addEventListener('pointerup', proceed);

  async function begin() {
    audio.bgm('title', 52, 'minor', 90);
    if (App.online) {
      const be = App.backend as SupabaseBackend;
      const ok = await be.restoreSession();
      if (!ok) return login(be);
      try {
        await App.store.init();
      } catch {
        return login(be, '서버에 연결하지 못했어요. 다시 로그인하거나 오프라인으로 하세요.');
      }
    }
    enter();
  }

  function enter() {
    const s = App.store.save.extra.settings;
    audio.setVolumes(s.sfx, s.bgm, s.theme ?? 0.8);
    if (!App.store.save.story['prologue']) ui.show('Story', { id: 'prologue', next: 'Lobby' });
    else ui.show('Lobby');
  }

  function login(be: SupabaseBackend, msg = '') {
    const email = h('input', { name: 'email', type: 'email', required: true, autocomplete: 'username' });
    const pw = h('input', { name: 'pw', type: 'password', minlength: '6', required: true, autocomplete: 'current-password' });
    const msgEl = h('p', { class: 'login-msg' }, msg);
    const form = h(
      'form',
      {
        class: 'login-form',
        onsubmit: async (e) => {
          e.preventDefault();
          msgEl.textContent = '로그인 중...';
          try {
            await be.signIn(email.value.trim(), pw.value);
            await after();
          } catch (err: any) {
            msgEl.textContent = '로그인 실패: ' + (err?.message ?? err);
          }
        },
      },
      h('div', { class: 'field' }, h('label', null, '이메일'), email),
      h('div', { class: 'field' }, h('label', null, '비밀번호 (6자 이상)'), pw),
      msgEl,
      h(
        'div',
        { class: 'login-btns' },
        btn('회원가입', async () => {
          if (!form.reportValidity()) return;
          msgEl.textContent = '가입 중...';
          try {
            const has = await be.signUp(email.value.trim(), pw.value);
            if (has) await after();
            else msgEl.textContent = '가입 완료! 메일함의 확인 링크를 누른 뒤 로그인하세요.';
          } catch (err: any) {
            msgEl.textContent = '가입 실패: ' + (err?.message ?? err);
          }
        }, { cls: 'ghost' }),
        h('button', { class: 'btn primary', type: 'submit' }, h('span', null, '로그인')),
      ),
      h(
        'button',
        {
          class: 'login-offline',
          type: 'button',
          onclick: async () => {
            App.backend = new LocalBackend();
            App.online = false;
            App.store = new Store(App.content, App.backend);
            await App.store.init();
            close();
            enter();
          },
        },
        '오프라인으로 하기 (이 PC에만 저장)',
      ),
    );
    const after = async () => {
      msgEl.textContent = '불러오는 중...';
      try {
        await App.store.init();
        close();
        enter();
      } catch (e: any) {
        msgEl.textContent = '불러오기 실패: ' + (e?.message ?? e);
      }
    };
    const close = ui.modal({
      title: '로그인',
      body: [h('p', { class: 'dim', style: { marginBottom: '20px' } }, '진행 상황을 온라인에 저장하려면 로그인하세요. 처음이면 이메일과 비밀번호를 정하고 회원가입을 누르세요.'), form],
      buttons: [],
      noClose: true,
    });
    setTimeout(() => email.focus(), 50);
  }

  return {
    el,
    bg: 'none',
    primary: proceed,
    onLeave: () => clearTimeout(t1),
  };
}

export const titleIcon = svg(I.rift);
