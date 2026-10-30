/** 연출 효과: 파티클(캔버스), 섬광, 흔들림, 빛살 */
import { h } from './dom';
import { UW, UH, ui } from './app';

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  g: number;
  shape: 'dot' | 'spark' | 'shard' | 'star';
  rot: number;
  vr: number;
  drag: number;
  glow: boolean;
}

class FX {
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  ps: P[] = [];
  running = false;
  last = 0;

  init() {
    this.canvas = h('canvas', { class: 'fx' });
    this.canvas.width = UW;
    this.canvas.height = UH;
    ui.stage.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  }

  private tick(t: number) {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    const c = this.ctx;
    c.clearRect(0, 0, UW, UH);
    c.globalCompositeOperation = 'lighter';
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.ps.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.vx *= 1 - p.drag * dt;
      p.vy *= 1 - p.drag * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const k = p.life / p.max;
      const a = Math.min(1, k * 1.5);
      const s = p.size * (p.shape === 'spark' ? k : 0.6 + 0.4 * k);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      // 글로우: 그림자 블러 대신 큰 반투명 원 (훨씬 가볍다)
      if (p.glow) {
        c.globalAlpha = a * 0.25;
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(0, 0, s * 2.6, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = a;
      c.fillStyle = p.color;
      if (p.shape === 'dot') {
        c.beginPath();
        c.arc(0, 0, s, 0, Math.PI * 2);
        c.fill();
      } else if (p.shape === 'spark') {
        c.fillRect(-s * 2, -s * 0.3, s * 4, s * 0.6);
      } else if (p.shape === 'shard') {
        c.beginPath();
        c.moveTo(0, -s);
        c.lineTo(s * 0.6, 0);
        c.lineTo(0, s);
        c.lineTo(-s * 0.6, 0);
        c.closePath();
        c.fill();
      } else {
        c.beginPath();
        for (let a2 = 0; a2 < 4; a2++) {
          const ang = (a2 / 4) * Math.PI * 2;
          c.lineTo(Math.cos(ang) * s, Math.sin(ang) * s);
          c.lineTo(Math.cos(ang + Math.PI / 4) * s * 0.35, Math.sin(ang + Math.PI / 4) * s * 0.35);
        }
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    if (this.ps.length) requestAnimationFrame((t2) => this.tick(t2));
    else {
      this.running = false;
      c.clearRect(0, 0, UW, UH);
    }
  }

  /** 한 점에서 터지기 */
  burst(x: number, y: number, o: { n?: number; color?: string | string[]; speed?: number; size?: number; life?: number; g?: number; shape?: P['shape']; spread?: number; angle?: number; drag?: number; glow?: boolean } = {}) {
    const n = o.n ?? 40;
    const cols = Array.isArray(o.color) ? o.color : [o.color ?? '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? 0) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
      const sp = (o.speed ?? 500) * (0.3 + Math.random() * 0.7);
      const life = (o.life ?? 0.9) * (0.5 + Math.random() * 0.5);
      this.ps.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: (o.size ?? 6) * (0.5 + Math.random()), color: cols[Math.floor(Math.random() * cols.length)], g: o.g ?? 600, shape: o.shape ?? 'dot', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, drag: o.drag ?? 1.2, glow: o.glow ?? true });
    }
    this.start();
  }

  /** 영역 안에서 반짝이 떠오르기 */
  sparkles(x: number, y: number, w: number, hgt: number, o: { n?: number; color?: string | string[]; up?: number; size?: number; life?: number } = {}) {
    const cols = Array.isArray(o.color) ? o.color : [o.color ?? '#ffffff'];
    for (let i = 0; i < (o.n ?? 20); i++) {
      const life = (o.life ?? 1.6) * (0.5 + Math.random() * 0.5);
      this.ps.push({ x: x + Math.random() * w, y: y + Math.random() * hgt, vx: (Math.random() - 0.5) * 40, vy: -(o.up ?? 80) * (0.5 + Math.random()), life, max: life, size: (o.size ?? 5) * (0.4 + Math.random()), color: cols[Math.floor(Math.random() * cols.length)], g: -20, shape: 'star', rot: 0, vr: (Math.random() - 0.5) * 3, drag: 0.5, glow: true });
    }
    this.start();
  }

  /** 화면 전체 섬광 */
  flash(color = '#ffffff', ms = 400, alpha = 1) {
    const el = h('div', { class: 'flash', style: { background: color, opacity: String(alpha), animationDuration: ms + 'ms' } });
    ui.topLayer.appendChild(el);
    setTimeout(() => el.remove(), ms + 50);
  }

  /** 흔들기 */
  shake(el: HTMLElement = ui.stage, power = 1, ms = 400) {
    el.style.setProperty('--shake', power + 'px');
    el.classList.remove('shaking');
    void el.offsetWidth;
    el.classList.add('shaking');
    el.style.animationDuration = ms + 'ms';
    setTimeout(() => el.classList.remove('shaking'), ms);
  }

  private rayCache = new Map<string, string>();
  /** 회전하는 빛살 요소. 캔버스에 한 번 그려 두고 비트맵만 돌린다 (가벼움) */
  rays(color: string, cls = '') {
    const key = color;
    let url = this.rayCache.get(key);
    if (!url) {
      const N = 1024;
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const g = c.getContext('2d')!;
      g.translate(N / 2, N / 2);
      const draw = (n: number, w: number, col: string, a: number, off: number) => {
        for (let i = 0; i < n; i++) {
          const ang = off + (i / n) * Math.PI * 2;
          const grad = g.createLinearGradient(0, 0, Math.cos(ang) * N * 0.5, Math.sin(ang) * N * 0.5);
          grad.addColorStop(0, col.replace(')', `,${a})`).replace('rgb(', 'rgba('));
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grad;
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(Math.cos(ang - w) * N * 0.52, Math.sin(ang - w) * N * 0.52);
          g.lineTo(Math.cos(ang + w) * N * 0.52, Math.sin(ang + w) * N * 0.52);
          g.closePath();
          g.fill();
        }
      };
      const rgb = hexToRgb(color);
      draw(16, 0.05, rgb, 0.5, 0);
      draw(24, 0.02, 'rgb(255,255,255)', 0.35, 0.2);
      url = c.toDataURL();
      this.rayCache.set(key, url);
    }
    return h('div', { class: 'rays ' + cls }, h('img', { src: url, alt: '' }), h('img', { src: url, alt: '', class: 'r2' }));
  }
}

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 'rgb(255,255,255)';
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
}

export const fx = new FX();
