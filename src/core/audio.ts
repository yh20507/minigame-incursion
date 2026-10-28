/**
 * 효과음과 배경음.
 * 기본은 코드로 합성한 칩튠이고, assets/audio 에 파일을 넣으면 그 파일이 우선이다.
 *   audio/bgm/<화면 또는 영역 id>.mp3   화면 배경음 (반복)
 *   audio/sfx/<효과음 이름>.mp3         효과음
 *   audio/chars/<캐릭터 id>.mp3         캐릭터 테마곡 (★4·★5 뽑기, 도감, 로비 주크박스)
 *   audio/worlds/<세계관 id>.mp3        세계관 테마곡 (캐릭터 곡이 없을 때, 한정 균열 화면)
 */

type Wave = OscillatorType;

const SCALES: Record<string, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export const BGM_KEYS = ['title', 'lobby', 'map', 'gacha', 'boss', 'final', 'result', 'challenge', 'micro', 'story', 'expedition', 'rift'];
export const SFX_KEYS = ['select', 'confirm', 'cancel', 'jump', 'hit', 'shield', 'score', 'good', 'bad', 'coin', 'tick', 'go', 'throw', 'stack', 'shoot', 'pull', 'rare', 'hero', 'legend', 'ultra', 'win', 'lose', 'star', 'text', 'tear', 'flip', 'pack'];

class Synth {
  ctx: AudioContext | null = null;
  sfxGain!: GainNode;
  bgmGain!: GainNode;
  sfxVol = 0.7;
  bgmVol = 0.5;
  themeVol = 0.8;
  /** 실제로 있는 음원 파일 */
  files = { bgm: new Set<string>(), sfx: new Map<string, ArrayBuffer>(), chars: new Set<string>(), worlds: new Set<string>() };
  private sfxBuf = new Map<string, AudioBuffer>();
  private bgmEl: HTMLAudioElement | null = null;
  private bgmElKey = '';
  private themeEl: HTMLAudioElement | null = null;
  private resumeBgm: (() => void) | null = null;
  private bgmTimer: number | null = null;
  private bgmKey = '';
  private nextTime = 0;
  private step = 0;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return null;
    }
    this.sfxGain = this.ctx.createGain();
    this.bgmGain = this.ctx.createGain();
    this.sfxGain.connect(this.ctx.destination);
    this.bgmGain.connect(this.ctx.destination);
    this.setVolumes(this.sfxVol, this.bgmVol);
    return this.ctx;
  }

  setVolumes(sfx: number, bgm: number, theme = this.themeVol) {
    this.sfxVol = sfx;
    this.bgmVol = bgm;
    this.themeVol = theme;
    if (this.bgmEl) this.bgmEl.volume = Math.min(1, bgm * 0.7);
    if (this.themeEl) this.themeEl.volume = Math.min(1, theme);
    if (!this.ctx) return;
    this.sfxGain.gain.value = sfx * 0.35;
    this.bgmGain.gain.value = bgm * 0.12;
  }

  /** 어떤 음원 파일이 있는지 확인한다 (부팅 때 한 번) */
  async scan(bgmKeys: string[], charIds: string[], worldIds: string[]) {
    const exists = async (url: string) => {
      try {
        const r = await fetch(url, { method: 'HEAD' });
        return r.ok && !(r.headers.get('content-type') ?? '').includes('text/html');
      } catch {
        return false;
      }
    };
    const jobs: Promise<void>[] = [];
    for (const k of [...BGM_KEYS, ...bgmKeys]) jobs.push(exists(`assets/audio/bgm/${k}.mp3`).then((ok) => void (ok && this.files.bgm.add(k))));
    for (const id of charIds) jobs.push(exists(`assets/audio/chars/${id}.mp3`).then((ok) => void (ok && this.files.chars.add(id))));
    for (const id of worldIds) jobs.push(exists(`assets/audio/worlds/${id}.mp3`).then((ok) => void (ok && this.files.worlds.add(id))));
    for (const k of SFX_KEYS)
      jobs.push(
        (async () => {
          if (!(await exists(`assets/audio/sfx/${k}.mp3`))) return;
          try {
            const r = await fetch(`assets/audio/sfx/${k}.mp3`);
            this.files.sfx.set(k, await r.arrayBuffer());
          } catch {
            /* 무시 */
          }
        })(),
      );
    await Promise.all(jobs);
  }

  private playFileSfx(name: string) {
    const ctx = this.ctx!;
    const buf = this.sfxBuf.get(name);
    if (buf) {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.connect(this.sfxGain);
      s.start();
      return true;
    }
    const raw = this.files.sfx.get(name);
    if (!raw) return false;
    this.files.sfx.delete(name);
    ctx.decodeAudioData(raw.slice(0)).then((b) => {
      this.sfxBuf.set(name, b);
      this.playFileSfx(name);
    }).catch(() => {});
    return true;
  }

  /** 캐릭터 테마곡 주소 (캐릭터 곡 → 세계관 곡 → 없음) */
  themeUrl(charId: string, worldId?: string) {
    if (this.files.chars.has(charId)) return `assets/audio/chars/${charId}.mp3`;
    if (worldId && this.files.worlds.has(worldId)) return `assets/audio/worlds/${worldId}.mp3`;
    return null;
  }

  /** 테마곡 재생. 배경음은 잠시 멈췄다가 stopTheme 때 다시 튼다. 곡이 없으면 false */
  playTheme(url: string | null, start = 0, loop = false) {
    if (!url) return false;
    this.stopTheme(true);
    this.ensure();
    const prevKey = this.bgmKey || this.bgmElKey;
    const prev = this.bgmLast;
    // 음원 배경음은 테마곡이 끝나면 멈춘 자리부터 이어서
    this.pausedBgm = this.bgmEl && this.bgmElKey ? { url: this.bgmElKey, time: this.bgmEl.currentTime } : null;
    this.stopBgm();
    this.resumeBgm = prevKey && prev ? () => this.bgm(prev.key, prev.root, prev.scale, prev.tempo, prev.files) : null;
    const el = new Audio(url);
    el.loop = loop;
    el.volume = 0;
    el.currentTime = start;
    const target = Math.min(1, this.themeVol);
    el.play().catch(() => {});
    let v = 0;
    const fade = window.setInterval(() => {
      v = Math.min(target, v + target / 20);
      el.volume = v;
      if (v >= target) clearInterval(fade);
    }, 50);
    this.themeEl = el;
    return true;
  }

  stopTheme(immediate = false) {
    const el = this.themeEl;
    if (!el) return;
    this.themeEl = null;
    const resume = this.resumeBgm;
    this.resumeBgm = null;
    const end = () => {
      el.pause();
      el.src = '';
      if (!immediate) resume?.();
    };
    if (immediate) return end();
    const fade = window.setInterval(() => {
      el.volume = Math.max(0, el.volume - 0.08);
      if (el.volume <= 0.01) {
        clearInterval(fade);
        end();
      }
    }, 40);
  }

  private tone(freq: number, dur: number, wave: Wave, vol = 1, at = 0, slide = 0, dest?: AudioNode) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = (at || ctx.currentTime) + 0.001;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol = 1, at = 0, dest?: AudioNode) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = at || ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = vol;
    s.buffer = buf;
    s.connect(g);
    g.connect(dest ?? this.sfxGain);
    s.start(t);
  }

  sfx(name: string) {
    const ctx = this.ensure();
    if (!ctx || this.sfxVol <= 0) return;
    if ((this.files.sfx.has(name) || this.sfxBuf.has(name)) && this.playFileSfx(name)) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'tear':
        this.noise(0.35, 0.7);
        this.tone(1800, 0.25, 'sawtooth', 0.15, 0, 0.3);
        break;
      case 'flip':
        this.noise(0.06, 0.4);
        this.tone(700, 0.06, 'triangle', 0.3, 0, 1.6);
        break;
      case 'pack':
        this.tone(180, 0.18, 'square', 0.5, 0, 0.5);
        this.noise(0.1, 0.5);
        break;
      case 'select':
        this.tone(880, 0.05, 'square', 0.4);
        break;
      case 'confirm':
        this.tone(660, 0.06, 'square', 0.5);
        this.tone(990, 0.08, 'square', 0.5, t + 0.06);
        break;
      case 'cancel':
        this.tone(440, 0.08, 'square', 0.4, 0, 0.6);
        break;
      case 'jump':
        this.tone(330, 0.12, 'square', 0.5, 0, 2.2);
        break;
      case 'hit':
        this.noise(0.18, 0.8);
        this.tone(160, 0.2, 'sawtooth', 0.5, 0, 0.4);
        break;
      case 'shield':
        this.tone(1200, 0.15, 'triangle', 0.6, 0, 0.5);
        break;
      case 'score':
        this.tone(1320, 0.05, 'square', 0.35);
        break;
      case 'good':
        this.tone(784, 0.06, 'square', 0.4);
        this.tone(1175, 0.08, 'square', 0.4, t + 0.05);
        break;
      case 'bad':
        this.tone(220, 0.15, 'square', 0.5, 0, 0.7);
        break;
      case 'coin':
        this.tone(988, 0.05, 'square', 0.4);
        this.tone(1319, 0.12, 'square', 0.4, t + 0.05);
        break;
      case 'tick':
        this.tone(1760, 0.03, 'square', 0.25);
        break;
      case 'go':
        this.tone(523, 0.08, 'square', 0.5);
        this.tone(784, 0.08, 'square', 0.5, t + 0.08);
        this.tone(1047, 0.16, 'square', 0.5, t + 0.16);
        break;
      case 'throw':
        this.noise(0.12, 0.4);
        this.tone(500, 0.18, 'triangle', 0.4, 0, 0.5);
        break;
      case 'stack':
        this.tone(200, 0.08, 'square', 0.6);
        this.noise(0.05, 0.4);
        break;
      case 'shoot':
        this.noise(0.06, 0.5);
        this.tone(900, 0.06, 'square', 0.3, 0, 0.3);
        break;
      case 'pull':
        for (let i = 0; i < 8; i++) this.tone(300 + i * 60, 0.06, 'square', 0.3, t + i * 0.05);
        break;
      case 'rare':
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'square', 0.4, t + i * 0.07));
        break;
      case 'hero':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'square', 0.45, t + i * 0.07));
        break;
      case 'legend':
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.2, 'square', 0.45, t + i * 0.08));
        this.tone(2093, 0.6, 'triangle', 0.5, t + 0.5);
        break;
      case 'ultra':
        this.noise(0.6, 0.6);
        [262, 330, 392, 523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) =>
          this.tone(f, 0.25, i % 2 ? 'square' : 'sawtooth', 0.4, t + 0.3 + i * 0.06),
        );
        this.tone(1047, 1.2, 'triangle', 0.6, t + 1.0);
        this.tone(1568, 1.2, 'triangle', 0.4, t + 1.0);
        break;
      case 'win':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'square', 0.45, t + i * 0.1));
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.2, 'square', 0.45, t + i * 0.14));
        break;
      case 'star':
        this.tone(1568, 0.1, 'square', 0.4);
        this.tone(2093, 0.2, 'triangle', 0.4, t + 0.08);
        break;
      case 'text':
        this.tone(600 + Math.random() * 200, 0.02, 'square', 0.12);
        break;
    }
  }

  /** 영역 분위기의 짧은 반복 배경음. key 가 같으면 이어서 재생. */
  private pausedBgm: { url: string; time: number } | null = null;
  private bgmLast: { key: string; root: number; scale: string; tempo: number; files?: string[] } | null = null;

  /** 배경음. files 순서대로 음원 파일을 찾고, 없으면 key 로 칩튠을 합성한다 */
  bgm(key: string, root = 57, scale = 'minor', tempo = 100, files?: string[]) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (this.themeEl) {
      // 테마곡이 끝나면 이 곡으로
      this.resumeBgm = () => this.bgm(key, root, scale, tempo, files);
      return;
    }
    this.bgmLast = { key, root, scale, tempo, files };
    // files 항목: bgm 키 또는 'assets/...' 로 시작하는 주소 (있는지 이미 확인된 것)
    const pickFile = (files ?? [key]).find((k) => k.startsWith('assets/') || this.files.bgm.has(k));
    const fileUrl = pickFile ? (pickFile.startsWith('assets/') ? pickFile : `assets/audio/bgm/${pickFile}.mp3`) : null;
    const url = key === 'lobby' && this.lobbyOverride ? this.lobbyOverride : fileUrl;
    if (url) {
      if (this.bgmElKey === url && this.bgmEl) return;
      this.stopBgm();
      const el = new Audio(url);
      el.loop = true;
      el.volume = Math.min(1, this.bgmVol * 0.7);
      if (this.pausedBgm?.url === url) el.currentTime = this.pausedBgm.time;
      this.pausedBgm = null;
      el.play().catch(() => {});
      this.bgmEl = el;
      this.bgmElKey = url;
      return;
    }
    if (this.bgmKey === key && this.bgmTimer) return;
    this.stopBgm();
    this.bgmKey = key;
    const sc = SCALES[scale] ?? SCALES.minor;
    const beat = 60 / tempo / 2; // 8분음표
    const prog = [0, 5, 3, 4]; // 화음 진행 (스케일 도수)
    const deg = (d: number) => root + Math.floor(d / 7) * 12 + sc[((d % 7) + 7) % 7];
    let seed = 0;
    for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const melody: number[] = Array.from({ length: 32 }, () => (rnd() < 0.7 ? Math.floor(rnd() * 8) : -1));
    this.nextTime = ctx.currentTime + 0.1;
    this.step = 0;
    const schedule = () => {
      if (!this.ctx) return;
      while (this.nextTime < this.ctx.currentTime + 0.25) {
        const s = this.step % 64;
        const chord = prog[Math.floor(s / 16)];
        const t = this.nextTime;
        if (s % 4 === 0) this.tone(midi(deg(chord) - 24), beat * 3.5, 'triangle', 0.9, t, 0, this.bgmGain);
        const arp = [0, 2, 4, 2][s % 4];
        this.tone(midi(deg(chord + arp) - 12), beat * 0.9, 'square', 0.25, t, 0, this.bgmGain);
        const m = melody[s % 32];
        if (m >= 0 && s % 2 === 0) this.tone(midi(deg(chord + m)), beat * 1.6, 'square', 0.3, t, 0, this.bgmGain);
        if (s % 8 === 4) this.noise(0.05, 0.25, t, this.bgmGain);
        this.nextTime += beat;
        this.step++;
      }
    };
    schedule();
    this.bgmTimer = window.setInterval(schedule, 60);
  }

  /** 로비에서 고른 곡 (설정되면 로비 배경음을 대신) */
  lobbyOverride: string | null = null;

  stopBgm() {
    if (this.bgmTimer) clearInterval(this.bgmTimer);
    this.bgmTimer = null;
    this.bgmKey = '';
    if (this.bgmEl) {
      this.bgmEl.pause();
      this.bgmEl.src = '';
    }
    this.bgmEl = null;
    this.bgmElKey = '';
  }
}

export const audio = new Synth();
