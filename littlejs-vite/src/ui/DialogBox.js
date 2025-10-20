// src/ui/DialogBox.js
'use strict';
import { vec2, FontImage, overlayContext, mainCanvasSize } from 'littlejsengine';
import { TextTheme } from './TextTheme.js';

export class DialogBox {
  constructor() {
    this.font = null;
    this.text = '';
    this.visible = true;
    this.typingSpeed = 20;
    this.typeProgress = 0;
  }

  async loadFont() {
    const img = new Image();
    img.src = TextTheme.fontPath;
    await img.decode();

    overlayContext.imageSmoothingEnabled = false;

    // Base font tile size
    this.font = new FontImage(img, vec2(48, 48), vec2(-30, 0), overlayContext);
  }

  setText(text) {
    this.text = text;
    this.typeProgress = 0;
  }

  update(dt) {
    if (!this.visible || !this.text) return;
    if (this.typeProgress < this.text.length)
      this.typeProgress += dt * this.typingSpeed;
  }

  draw() {
    if (!this.visible || !this.font) return;

    const shownText = this.text.substring(0, Math.floor(this.typeProgress));

    const padding = 40;
    const boxW = mainCanvasSize.x - padding * 2;
    const boxH = 120;
    const boxX = padding + boxW / 2;
    const boxY = mainCanvasSize.y - boxH - 50 + boxH / 2;

    // Draw dialog box
    overlayContext.save();
    overlayContext.fillStyle = TextTheme.boxColor.toString();
    overlayContext.fillRect(padding, mainCanvasSize.y - boxH - 50, boxW, boxH);
    overlayContext.strokeStyle = TextTheme.borderColor.toString();
    overlayContext.lineWidth = 3;
    overlayContext.strokeRect(padding - 2, mainCanvasSize.y - boxH - 52, boxW + 4, boxH + 4);
    overlayContext.restore();

    // ──────────────────────────────────────────────
    // Draw text with squished horizontal spacing
    // ──────────────────────────────────────────────
    const tileW = 48;
    const tileH = 48;
    const cols = this.font.image.width / tileW;
    const scaleY = 1.0;
    const scaleX = 1;   // horizontal squish factor
    const spacing = 16;    // horizontal spacing between letters
    const overallScale = 1.6;

    const totalW = shownText.length * spacing * scaleX * overallScale;
    const startX = boxX - totalW / 2;
    const startY = boxY;

    for (let i = 0; i < shownText.length; i++) {
      const code = shownText.charCodeAt(i);
      if (code < 32 || code > 126) continue;

      const index = code - 32;
      const sx = (index % cols) * tileW;
      const sy = Math.floor(index / cols) * tileH;
      const dx = startX + i * spacing * overallScale;
      const dy = startY;

      overlayContext.save();
      overlayContext.translate(dx, dy);
      overlayContext.scale(scaleX * overallScale, scaleY * overallScale);
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