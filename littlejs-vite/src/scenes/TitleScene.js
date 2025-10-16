// src/scenes/TitleScene.js
'use strict';
import {
  vec2, hsl, drawCanvas2D, FontImage,
  time, mainContext, keyWasPressed
} from 'littlejsengine';
import { sceneManager } from '../core/sceneManager.js';
import { GameScene } from './GameScene.js';
import { preloadGameAssets } from '../util/preloadGameAssets.js';

export class TitleScene {
  constructor() {
    this.startTime = 0;
    this.customFont = null;
    this.assetsReady = false;
  }

  async onEnter() {
    this.startTime = time;

    // Load the font bitmap image
    const fontImage = new Image();
    fontImage.src = '/assets/font/font2bitmap48.png';
    await new Promise((res, rej) => {
      fontImage.onload = res;
      fontImage.onerror = rej;
    });
    this.customFont = new FontImage(fontImage, vec2(48, 48), vec2(0, 1));

    // Begin preloading game assets in background
    preloadGameAssets().then(() => {
      this.assetsReady = true;
      console.log('All game assets preloaded');
    });
  }

  update() {
    if ((keyWasPressed('Enter') || keyWasPressed('Space')) && this.assetsReady) {
      sceneManager.set(new GameScene(true)); // start immediately
    }
  }

  render() {
    drawCanvas2D(vec2(0, 0), vec2(20, 12), 0, false, (ctx) => {
      const w = ctx.canvas.width, h = ctx.canvas.height;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.hypot(w, h) * 0.7);
      g.addColorStop(0, hsl(0, 0, 0.1).toString());
      g.addColorStop(1, hsl(0, 0, 0).toString());
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
    }, false, mainContext);

    if (this.customFont) {
      this.customFont.drawText('HELLO WORLD', vec2(0, 4), 0.05, true);
      const msg = this.assetsReady ? 'Press ENTER or SPACE' : 'Loading...';
      this.customFont.drawText(msg, vec2(0, -2), 0.06, true);
    }
  }

  onExit() {}
}
