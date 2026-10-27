import Phaser from 'phaser';
import { App, C, H, W, hexNum } from './app';
import { audio } from './audio';
import { fitImage, portraitKey } from './art';
import { T, button } from './ui';

/** 대화창. 스토리 장면 하나를 재생하고 끝나면 onDone 호출. */
export function playDialogue(scene: Phaser.Scene, sceneId: string, onDone: () => void) {
  const data = App.content.story.scenes[sceneId];
  if (!data) {
    onDone();
    return;
  }
  const layer = scene.add.container(0, 0).setDepth(500);
  const shade = scene.add.rectangle(0, 0, W, H, 0x07060f, 0.35).setOrigin(0).setInteractive();
  layer.add(shade);

  const portrait = scene.add.image(84, H - 112, 'px').setOrigin(0.5, 1).setVisible(false);
  layer.add(portrait);

  const boxY = H - 104;
  const g = scene.add.graphics();
  g.fillStyle(0x07060f, 0.95);
  g.fillRect(10, boxY - 1, W - 20, 96);
  g.fillStyle(C.panel, 0.95);
  g.fillRect(11, boxY, W - 22, 94);
  g.lineStyle(1, C.lineHi, 1);
  g.strokeRect(11.5, boxY + 0.5, W - 23, 93);
  layer.add(g);

  const namePlate = scene.add.graphics();
  layer.add(namePlate);
  const nameT = T(scene, 30, boxY - 18, '', { bold: true, color: C.accent });
  layer.add(nameT);
  const body = T(scene, 30, boxY + 14, '', { wrap: W - 70 });
  layer.add(body);
  const more = T(scene, W - 30, boxY + 74, '▼', { size: 10, color: C.dim, align: 'right' });
  layer.add(more);
  scene.tweens.add({ targets: more, y: more.y + 3, yoyo: true, repeat: -1, duration: 400 });

  let idx = -1;
  let full = '';
  let shown = 0;
  let typing = false;
  let timer: Phaser.Time.TimerEvent | null = null;

  const finish = () => {
    timer?.remove();
    scene.input.keyboard?.off('keydown-SPACE', advance);
    scene.input.keyboard?.off('keydown-ENTER', advance);
    scene.input.keyboard?.off('keydown-Z', advance);
    layer.destroy();
    skip.destroy();
    App.store.markStory(sceneId);
    onDone();
  };

  const showLine = () => {
    const line = data.lines[idx];
    const sp = App.content.story.speakers[line.s] ?? { name: line.s };
    nameT.setText(sp.name);
    namePlate.clear();
    if (sp.name) {
      namePlate.fillStyle(0x07060f, 1);
      namePlate.fillRect(20, boxY - 22, nameT.width + 20, 20);
      namePlate.fillStyle(C.panel2, 1);
      namePlate.fillRect(21, boxY - 21, nameT.width + 18, 18);
      const col = sp.char ? App.content.domainColor(App.content.char(sp.char).domain) : C.accent;
      namePlate.lineStyle(1, hexNum(col), 1);
      namePlate.strokeRect(21.5, boxY - 20.5, nameT.width + 17, 17);
      nameT.setColor(col);
    }
    if (sp.char) {
      portrait.setTexture(portraitKey(scene, sp.char)).setVisible(true);
      fitImage(portrait, 150, 150);
      portrait.setAlpha(0);
      scene.tweens.add({ targets: portrait, alpha: 1, duration: 150 });
      body.setX(30);
    } else {
      portrait.setVisible(false);
    }
    body.setColor(line.s === 'narr' ? '#c9c3ef' : C.text);
    full = line.t;
    shown = 0;
    typing = true;
    body.setText('');
    more.setVisible(false);
    timer?.remove();
    timer = scene.time.addEvent({
      delay: 28,
      loop: true,
      callback: () => {
        shown++;
        body.setText(full.slice(0, shown));
        if (shown % 3 === 0 && full[shown - 1] !== ' ') audio.sfx('text');
        if (shown >= full.length) {
          typing = false;
          more.setVisible(true);
          timer?.remove();
        }
      },
    });
  };

  const advance = () => {
    if (typing) {
      typing = false;
      timer?.remove();
      body.setText(full);
      more.setVisible(true);
      return;
    }
    idx++;
    if (idx >= data.lines.length) finish();
    else showLine();
  };

  shade.on('pointerup', advance);
  scene.input.keyboard?.on('keydown-SPACE', advance);
  scene.input.keyboard?.on('keydown-ENTER', advance);
  scene.input.keyboard?.on('keydown-Z', advance);
  const skip = button(scene, W - 84, 6, 76, 18, '건너뛰기 ▶▶', finish, { size: 10, silent: true }).setDepth(501);
  advance();
}
