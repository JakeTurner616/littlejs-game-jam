// src/scenes/TitleScene.js
'use strict';
import { drawText, vec2, keyWasPressed, hsl } from 'littlejsengine';
import { sceneManager } from '../core/sceneManager.js';
import { GameScene } from './GameScene.js';

export class TitleScene {
  onEnter() {
    console.log('Entered Title Scene');
  }

  update() {
    // Press Enter to start game
    if (keyWasPressed('Enter')) {
      sceneManager.set(new GameScene());
    }
  }

  render() {
    // Draw centered title
    drawText('MY GAME TITLE', vec2(0, 1), 1, hsl(0.1, 0.8, 0.7));
    drawText('Press ENTER to start', vec2(0, -0.5), 0.4, hsl(0.5, 0.8, 0.8));
  }
}
