import Phaser from 'phaser';
import { MiniGame } from './base';

// 대사 템플릿: 빈칸에 맞는 단어 하나 + 오답 둘
const LINES: { t: string; a: string; w: string[] }[] = [
  { t: '막이 오르면 배우는 ___ 를 잊는다', a: '대본', w: ['모자', '사과'] },
  { t: '이 대사는 대본에 없어, 내 ___ 야', a: '것', w: ['밥', '달'] },
  { t: '조명이 꺼진 자리는 ___ 에서도 사라진다', a: '대본', w: ['냄비', '구두'] },
  { t: '접은 건 다시 ___ 수 있어', a: '펼', w: ['먹을', '잘'] },
  { t: '관객이 없어도 ___ 는 계속된다', a: '연극', w: ['식사', '청소'] },
  { t: '마지막 장은 아직 ___ 있다', a: '비어', w: ['끓고', '졸고'] },
  { t: '배역이 있으면 ___ 있는 거야', a: '살아', w: ['자고', '걷고'] },
  { t: '막은 내리지 않아, 내가 내리지 않는 ___', a: '한', w: ['밤', '컵'] },
  { t: '커튼 뒤에서 소품이 ___ 를 기다린다', a: '차례', w: ['국물', '바람'] },
  { t: '그림자는 막이 내려도 ___', a: '남아', w: ['익어', '녹아'] },
  { t: '읽는 사람이 있는 한 이야기는 ___ 않는다', a: '끝나지', w: ['익지', '울지'] },
  { t: '무대 위의 ___ 는 거짓말을 못 한다', a: '조명', w: ['국자', '이불'] },
  { t: '대사를 ___ 배우는 접히지 않는다', a: '가진', w: ['삶은', '구운'] },
  { t: '종이 도시의 아침은 ___ 소리로 시작된다', a: '커튼', w: ['주전자', '우산'] },
  { t: '필경사는 한 줄씩 ___ 고 있다', a: '고치', w: ['튀기', '말리'] },
  { t: '오늘의 공연은 ___ 번째 반복이다', a: '삼천', w: ['고등어', '복숭아'] },
];

/** 대사 받아치기: 흘러가는 대사의 빈칸에 맞는 단어를 1/2/3 또는 클릭으로 고르기. 대사가 왼쪽 끝에 닿기 전에! */
export class LinesGame extends MiniGame {
  cur = -1;
  text1!: Phaser.GameObjects.Text;
  opts: Phaser.GameObjects.Text[] = [];
  boxes: Phaser.GameObjects.Rectangle[] = [];
  answer = 0;
  x = 640;
  speed = 60;
  solved = 0;
  busy = 0;
  order: number[] = [];

  create() {
    const bg = this.gfx();
    bg.fillGradientStyle(0x6b3a3a, 0x6b3a3a, 0x241212, 0x241212, 1);
    bg.fillRect(0, 0, 640, 340);
    // 무대
    bg.fillStyle(0x3a2222, 1);
    bg.fillRect(0, 250, 640, 90);
    bg.fillStyle(0xffb3a7, 0.25);
    bg.fillRect(0, 250, 640, 3);
    // 커튼
    bg.fillStyle(0x8a2a2a, 1);
    bg.fillRect(0, 0, 40, 340);
    bg.fillRect(600, 0, 40, 340);
    this.player(320, 300, 40);
    this.text1 = this.text(320, 110, '', 12, '#fff5e8');
    for (let i = 0; i < 3; i++) {
      const bx = 160 + i * 160;
      const box = this.add(this.s.add.rectangle(bx, 190, 140, 40, 0x241212, 0.9).setStrokeStyle(1, 0xffb3a7, 0.6));
      this.boxes.push(box);
      this.opts.push(this.text(bx, 190, '', 12, '#ffb3a7'));
      this.text(bx - 58, 178, String(i + 1), 10, '#ffe08a');
    }
    this.text(320, 12, '빈칸에 맞는 단어 · 1/2/3 또는 클릭', 10, '#ffb3a7');
    this.order = [...Array(LINES.length).keys()].sort(() => this.h.rng() - 0.5);
    this.next();
  }

  next() {
    this.cur = (this.cur + 1) % this.order.length;
    const L = LINES[this.order[this.cur]];
    this.text1.setText(L.t.replace('___', '[    ]'));
    const options = [L.a, ...L.w].sort(() => this.h.rng() - 0.5);
    this.answer = options.indexOf(L.a);
    options.forEach((o, i) => this.opts[i].setText(o));
    this.x = 640;
    this.speed = (this.h.micro ? 90 : 55) * this.ramp(0.02, 2.4);
    this.text1.setX(this.x).setAlpha(1);
  }

  update(dt: number) {
    if (this.busy > 0) {
      this.busy -= dt;
      return;
    }
    this.x -= this.speed * dt;
    this.text1.setX(Math.round(Math.max(this.x, 320)));
    // 왼쪽 끝 = 시간 초과: 대사가 중앙에 도달한 뒤 추가 유예
    const timeout = this.x < 320 - 220;
    const inp = this.h.inp;
    let pick = -1;
    if (inp.codes.has('Digit1') || inp.codes.has('Numpad1')) pick = 0;
    if (inp.codes.has('Digit2') || inp.codes.has('Numpad2')) pick = 1;
    if (inp.codes.has('Digit3') || inp.codes.has('Numpad3')) pick = 2;
    if (inp.pointer.pressed) {
      const i = this.boxes.findIndex((b) => Math.abs(b.x - inp.pointer.x) < 70 && Math.abs(b.y - inp.pointer.y) < 20);
      if (i >= 0) pick = i;
    }
    if (pick >= 0 || timeout) {
      const box = this.boxes[Math.max(0, pick)];
      if (pick === this.answer) {
        this.solved++;
        this.h.sfx('good');
        const bonus = Math.round(Math.max(0, (this.x - 100) / 540) * 60);
        this.h.addScore(100 + bonus, box.x, box.y - 30);
        const L = LINES[this.order[this.cur]];
        this.text1.setText(L.t.replace('___', L.a));
      } else {
        this.h.sfx('bad');
        this.h.float(timeout ? '놓쳤다!' : '야유!', 320, 150, '#ff4b6e');
        this.h.hit(320, 150);
      }
      this.busy = 0.5;
      this.s.time.delayedCall(450, () => !this.finished && this.next());
    }
  }

  microDone() {
    return this.solved >= 1;
  }
  microSuccess() {
    return this.solved >= 1;
  }
}
