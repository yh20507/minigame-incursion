import { ui } from '../app';
import { titleScreen } from './title';
import { lobbyScreen } from './lobby';
import { storyScreen } from './story';
import { gachaScreen } from './gacha';
import { collectionScreen } from './collection';
import { teamScreen } from './team';
import { rewardsScreen } from './rewards';
import { bagScreen, challengeScreen, settingsScreen } from './misc';
import { decorScreen } from './decor';
import { expeditionScreen } from './expedition';
import { domainScreen, prepScreen, resultScreen, worldMapScreen } from './adventure';

export function registerScreens() {
  ui.register('Title', titleScreen);
  ui.register('Lobby', lobbyScreen);
  ui.register('Story', storyScreen);
  ui.register('Gacha', gachaScreen);
  ui.register('Collection', collectionScreen);
  ui.register('Team', teamScreen);
  ui.register('Rewards', rewardsScreen);
  ui.register('Bag', bagScreen);
  ui.register('Settings', settingsScreen);
  ui.register('Challenge', challengeScreen);
  ui.register('Decor', decorScreen);
  ui.register('Expedition', expeditionScreen);
  ui.register('WorldMap', worldMapScreen);
  ui.register('Domain', domainScreen);
  ui.register('Prep', prepScreen);
  ui.register('Result', resultScreen);
}
