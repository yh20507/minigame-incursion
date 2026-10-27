import Phaser from 'phaser';
import { App } from '../core/app';
import { audio } from '../core/audio';
import { playDialogue } from '../core/dialogue';
import { bg, fadeIn, go } from '../core/ui';

/** 스토리 장면: 배경 + 대화창. 끝나면 next 화면으로. */
export class StoryScene extends Phaser.Scene {
  constructor() {
    super('Story');
  }

  create(data: { id: string; next: string; nextData?: object }) {
    fadeIn(this);
    const sc = App.content.story.scenes[data.id];
    const bgKey = sc?.bg ?? 'rift';
    bg(this, bgKey, 0.25);
    const d = App.content.domain(bgKey);
    if (d) audio.bgm(d.id, d.music.root, d.music.scale, d.music.tempo);
    else audio.bgm('rift', 50, 'minor', 80);
    playDialogue(this, data.id, () => go(this, data.next, data.nextData));
  }
}
