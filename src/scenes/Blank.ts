import Phaser from 'phaser';

/** DOM 화면이 떠 있는 동안 Phaser 쪽에서 도는 빈 장면 */
export class BlankScene extends Phaser.Scene {
  constructor() {
    super('Blank');
  }
  create() {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
  }
}
