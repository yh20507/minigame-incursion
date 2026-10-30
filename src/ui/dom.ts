/** 아주 작은 DOM 생성 도우미. 고해상도 UI 화면은 전부 이걸로 만든다. */

type Child = Node | string | number | null | undefined | false | Child[];
export type Attrs = {
  class?: string;
  style?: string | Partial<CSSStyleDeclaration>;
  html?: string;
  text?: string;
  title?: string;
  id?: string;
  type?: string;
  value?: string;
  placeholder?: string;
  src?: string;
  alt?: string;
  min?: string;
  max?: string;
  step?: string;
  name?: string;
  for?: string;
  disabled?: boolean;
  checked?: boolean;
  required?: boolean;
  minlength?: string;
  autocomplete?: string;
  data?: Record<string, string | number>;
  vars?: Record<string, string | number>;
  onclick?: (e: MouseEvent) => void;
  onpointerdown?: (e: PointerEvent) => void;
  onpointermove?: (e: PointerEvent) => void;
  onpointerup?: (e: PointerEvent) => void;
  onpointerenter?: (e: PointerEvent) => void;
  onpointerleave?: (e: PointerEvent) => void;
  oninput?: (e: Event) => void;
  onchange?: (e: Event) => void;
  onsubmit?: (e: SubmitEvent) => void;
  onanimationend?: (e: AnimationEvent) => void;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v as string;
      else if (k === 'style') {
        if (typeof v === 'string') el.setAttribute('style', v);
        else Object.assign(el.style, v);
      } else if (k === 'html') el.innerHTML = v as string;
      else if (k === 'text') el.textContent = v as string;
      else if (k === 'data') for (const [dk, dv] of Object.entries(v as Record<string, string>)) el.dataset[dk] = String(dv);
      else if (k === 'vars') for (const [vk, vv] of Object.entries(v as Record<string, string>)) el.style.setProperty('--' + vk, String(vv));
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

/** SVG 문자열을 요소로 */
export function svg(markup: string, cls = '') {
  const span = h('span', { class: ('ico ' + cls).trim(), html: markup });
  return span;
}

export function clear(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export const fmt = (n: number) => n.toLocaleString('ko-KR');

export function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** 숫자가 굴러가는 연출 */
export function countUp(el: HTMLElement, from: number, to: number, ms = 700, suffix = '') {
  const t0 = performance.now();
  const tick = (t: number) => {
    const k = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(Math.round(from + (to - from) * e)) + suffix;
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** 요소에 애니메이션 클래스를 붙였다가 끝나면 뗀다 */
export function animate(el: HTMLElement, cls: string) {
  return new Promise<void>((r) => {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    const done = () => {
      el.removeEventListener('animationend', done);
      r();
    };
    el.addEventListener('animationend', done);
  });
}
