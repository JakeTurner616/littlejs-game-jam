// src/ui/DialogBox.js
'use strict';
import { overlayContext, mainCanvasSize } from 'littlejsengine';
import { TextTheme } from './TextTheme.js';

export class DialogBox {
  constructor() {
    this.fontFamily = TextTheme.fontFamily;
    this.text = '';
    this.visible = true;
    this.typingSpeed = 14;
    this.typeProgress = 0;
    this.pauseTimer = 0;       // pause countdown
    this.pauseDuration = 0.7;  // pause length after "."
  }

  async loadFont() {
    // Load web font dynamically
    const fontFace = new FontFace('GameFont', 'url(/assets/font/Estonia-Regular.woff2)'); // \public\assets\font\Estonia-Regular.woff2
    await fontFace.load();
    document.fonts.add(fontFace);
    this.fontFamily = 'GameFont';
  }

  setText(text) {
    this.text = text;
    this.typeProgress = 0;
    this.pauseTimer = 0;
  }

  update(dt) {
    if (!this.visible || !this.text) return;

    if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
      return;
    }

    const prevIndex = Math.floor(this.typeProgress);
    if (prevIndex < this.text.length) {
      this.typeProgress += dt * this.typingSpeed;
      const currentIndex = Math.floor(this.typeProgress);
      if (currentIndex > prevIndex && this.text[prevIndex] === '.')
        this.pauseTimer = this.pauseDuration;
    }
  }

  wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  draw() {
    if (!this.visible) return;
    const shownText = this.text.substring(0, Math.floor(this.typeProgress));

    const uiScale = window.devicePixelRatio || 1;
    const canvasW = mainCanvasSize.x * uiScale;
    const canvasH = mainCanvasSize.y * uiScale;
    const screenFactor = Math.min(1, Math.max(0.7, canvasH / 800));
    const scale = screenFactor * TextTheme.fontSize;

    const paddingX = 50 * uiScale * screenFactor;
    const paddingY = 40 * uiScale * screenFactor;
    const boxW = canvasW - paddingX * 0.8;
    const maxTextWidth = boxW - paddingX * 2;

    // Setup font
    overlayContext.save();
    overlayContext.font = `${scale}px ${this.fontFamily}`;
    overlayContext.textBaseline = 'top';
    const lines = this.wrapText(overlayContext, shownText, maxTextWidth);
    overlayContext.restore();

    const lineHeight = scale * 1.4;
    const boxH = paddingY * 2 + lines.length * lineHeight;
    const boxX = (canvasW - boxW) / 2;
    const boxY = canvasH - boxH - paddingY;

    // Draw background box
    overlayContext.save();
    overlayContext.fillStyle = TextTheme.boxColor.toString();
    overlayContext.fillRect(boxX, boxY, boxW, boxH);
    overlayContext.strokeStyle = TextTheme.borderColor.toString();
    overlayContext.lineWidth = 3 * uiScale * screenFactor;
    overlayContext.strokeRect(boxX - 2, boxY - 2, boxW + 4, boxH + 4);
    overlayContext.restore();

    // Draw text
    overlayContext.save();
    overlayContext.fillStyle = TextTheme.textColor.toString();
    overlayContext.font = `${scale}px ${this.fontFamily}`;
    overlayContext.textAlign = 'center';
    overlayContext.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
      const x = boxX + boxW / 2;
      const y = boxY + paddingY + i * lineHeight;
      overlayContext.fillText(lines[i], x, y);
    }

    overlayContext.restore();
  }
}