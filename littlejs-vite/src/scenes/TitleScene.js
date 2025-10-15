// src/scenes/TitleScene.js
'use strict';
import {
  vec2, hsl, drawCanvas2D, FontImage,
  time, mainContext, keyWasPressed
} from 'littlejsengine';
import { sceneManager } from '../core/sceneManager.js';
import { GameScene } from './GameScene.js';

export class TitleScene {
  constructor() {
    this.startTime = 0;
    this.customFont = null;
  }

  async onEnter() {
    this.startTime = time;

    // Load the font bitmap image
    const fontImage = new Image();
    fontImage.src = '/assets/font/font2bitmap48.png';

    await new Promise((resolve, reject) => {
      fontImage.onload = resolve;
      fontImage.onerror = reject;
    });

    // Create FontImage — adjust character size as needed
    this.customFont = new FontImage(fontImage, vec2(48, 48), vec2(0, 1));
    console.log('Custom font image loaded successfully');
  }

  update() {
    if (keyWasPressed('Enter') || keyWasPressed('Space')) {
      sceneManager.set(new GameScene());
    }
  }

  render() {
    // Static background gradient (no flashing)
    drawCanvas2D(vec2(0, 0), vec2(20, 12), 0, false, (context) => {
      const w = context.canvas.width;
      const h = context.canvas.height;
      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, Math.hypot(w, h) * 0.7);
      gradient.addColorStop(0, hsl(0, 0, 0.1).toString());
      gradient.addColorStop(1, hsl(0, 0, 0).toString());
      context.fillStyle = gradient;
      context.fillRect(-1, -1, 2, 2);
    }, false, mainContext);

    // Draw text with custom font image
    if (this.customFont) {
      this.customFont.drawText('HELLO WORLD', vec2(0, 4), 0.05, true);
      this.customFont.drawText('Press ENTER or SPACE', vec2(0, -2), 0.06, true);
    }
  }

  onExit() {}
}