/** 효과음과 배경음을 코드로 합성한다 (칩튠 느낌). 파일이 필요 없다. */

type Wave = OscillatorType;

const SCALES: Record<string, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class Synth {
  ctx: AudioContext | null = null;
  sfxGain!: GainNode;
  bgmGain!: GainNode;
  sfxVol = 0.7;
  bgmVol = 0.5;
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

  setVolumes(sfx: number, bgm: number) {
    this.sfxVol = sfx;
    this.bgmVol = bgm;
    if (!this.ctx) return;
    this.sfxGain.gain.value = sfx * 0.35;
    this.bgmGain.gain.value = bgm * 0.12;
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
    const t = ctx.currentTime;
    switch (name) {
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
  bgm(key: string, root = 57, scale = 'minor', tempo = 100) {
    const ctx = this.ensure();
    if (!ctx) return;
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

  stopBgm() {
    if (this.bgmTimer) clearInterval(this.bgmTimer);
    this.bgmTimer = null;
    this.bgmKey = '';
  }
}

export const audio = new Synth();
