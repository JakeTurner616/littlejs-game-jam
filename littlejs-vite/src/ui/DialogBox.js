// src/ui/DialogBox.js
'use strict';
import { vec2, FontImage, overlayContext, mainCanvasSize } from 'littlejsengine';
import { TextTheme } from './TextTheme.js';

export class DialogBox {
  constructor() {
    this.font = null;
    this.text = '';
    this.visible = true;
    this.typingSpeed = 14;
    this.typeProgress = 0;
    this.pauseTimer = 0;       // ⏸️ pause countdown
    this.pauseDuration = 0.7;  // pause length after "."
  }

  async loadFont() {
    const img = new Image();
    img.src = TextTheme.fontPath;
    await img.decode();
    overlayContext.imageSmoothingEnabled = false;
    this.font = new FontImage(img, vec2(48, 48), vec2(-30, 0), overlayContext);
  }

  setText(text) {
    this.text = text;
    this.typeProgress = 0;
    this.pauseTimer = 0;
  }

  update(dt) {
    if (!this.visible || !this.text) return;

    // Handle active pause
    if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
      return;
    }

    const prevIndex = Math.floor(this.typeProgress);
    if (prevIndex < this.text.length) {
      // Advance typing
      this.typeProgress += dt * this.typingSpeed;

      const currentIndex = Math.floor(this.typeProgress);
      // If we just finished typing a ".", pause next frame
      if (currentIndex > prevIndex) {
        const lastChar = this.text[prevIndex];
        if (lastChar === '.') {
          this.pauseTimer = this.pauseDuration;
        }
      }
    }
  }

  wrapText(ctx, text, maxCharsPerLine) {
    const words = text.split(' ');
    const lines = [];
    let line = '';

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (testLine.length > maxCharsPerLine) {
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
    if (!this.visible || !this.font) return;
    const shownText = this.text.substring(0, Math.floor(this.typeProgress));

    const uiScale = window.devicePixelRatio || 1;
    const canvasW = mainCanvasSize.x * uiScale;
    const canvasH = mainCanvasSize.y * uiScale;
    const screenFactor = Math.min(1, Math.max(0.7, canvasH / 800));

    // ──────────────────────────────────────────────
    // TEXT METRICS
    // ──────────────────────────────────────────────
    const charSpacing = 18 * uiScale * screenFactor;
    const lineSpacing = 52 * uiScale * screenFactor;
    const scale = 1.3 * uiScale * screenFactor;
    const paddingX = 50 * uiScale * screenFactor;
    const paddingY = 40 * uiScale * screenFactor;

    const maxCharsPerLine = Math.floor((canvasW - paddingX * 2) / (charSpacing * scale));
    const lines = this.wrapText(overlayContext, shownText, maxCharsPerLine);

    // Dynamic box height based on # of lines
    const boxH = paddingY * 2 + lines.length * lineSpacing;
    const boxW = canvasW - paddingX * 0.8;
    const boxX = (canvasW - boxW) / 2;
    const boxY = canvasH - boxH - paddingY;

    // ──────────────────────────────────────────────
    // DRAW BOX
    // ──────────────────────────────────────────────
    overlayContext.save();
    overlayContext.fillStyle = TextTheme.boxColor.toString();
    overlayContext.fillRect(boxX, boxY, boxW, boxH);
    overlayContext.strokeStyle = TextTheme.borderColor.toString();
    overlayContext.lineWidth = 3 * uiScale * screenFactor;
    overlayContext.strokeRect(boxX - 2, boxY - 2, boxW + 4, boxH + 4);
    overlayContext.restore();

    // ──────────────────────────────────────────────
    // DRAW TEXT
    // ──────────────────────────────────────────────
    const tileW = 48;
    const tileH = 48;
    const cols = this.font.image.width / tileW;

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const totalW = line.length * charSpacing * scale;
      const startX = boxX + (boxW - totalW) / 2;
      const baseY = boxY + paddingY + l * lineSpacing + tileH * 0.25 * scale;

      for (let i = 0; i < line.length; i++) {
        const code = line.charCodeAt(i);
        if (code < 32 || code > 126) continue;
        const index = code - 32;
        const sx = (index % cols) * tileW;
        const sy = Math.floor(index / cols) * tileH;
        const dx = startX + i * charSpacing * scale;
        const dy = baseY;

        overlayContext.save();
        overlayContext.translate(dx, dy);
        overlayContext.scale(scale, scale);
        overlayContext.drawImage(
          this.font.image,
          sx, sy, tileW, tileH,
          -tileW / 2, -tileH / 2,
          tileW, tileH
        );
        overlayContext.restore();
      }
    }
  }
}