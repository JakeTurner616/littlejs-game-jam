// src/ui/DialogBox.js
'use strict';
import { overlayContext, mainCanvasSize, mouseWheel } from 'littlejsengine';
import { TextTheme } from './TextTheme.js';

export class DialogBox {
  constructor(mode = 'monologue') {
    this.mode = mode; // "monologue" | "dialogue"
    this.fontFamily = TextTheme.fontFamily;
    this.text = '';
    this.visible = true;
    this.typingSpeed = 30;
    this.typeProgress = 0;
    this.pauseTimer = 0;
    this.pauseDuration = 0.7;
    this.portrait = null;
    this.scrollY = 0;
    this.scrollSpeed = 25;
  }

  async loadFont() {
    const fontFace = new FontFace('GameFont', 'url(/assets/font/Estonia-Regular.woff2)');
    await fontFace.load();
    document.fonts.add(fontFace);
    this.fontFamily = 'GameFont';
  }

  async loadPortrait(path) {
    if (!path) { this.portrait = null; return; }
    const img = new Image();
    img.src = path;
    await img.decode();
    this.portrait = img;
  }

  setMode(mode) {
    if (mode !== 'monologue' && mode !== 'dialogue')
      throw new Error(`Unknown DialogBox mode: ${mode}`);
    this.mode = mode;
    this.scrollY = 0;
  }

  setText(text) {
    this.text = text;
    this.typeProgress = 0;
    this.pauseTimer = 0;
    this.scrollY = 0;
  }

update(dt) {
  if (!this.visible || !this.text) return;

  // ✅ Reverse scroll direction for natural behavior
  const wheelDelta = mouseWheel;
  if (wheelDelta) this.scrollY += wheelDelta * this.scrollSpeed;

  // typing effect
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
    const isMonologue = this.mode === 'monologue';

    // ──────────────────────────────────────────────
    // MONOLOGUE MODE
    // ──────────────────────────────────────────────
    if (isMonologue) {
      const paddingX = 50 * uiScale * screenFactor;
      const paddingY = 40 * uiScale * screenFactor;
      const boxW = canvasW * 0.8;
      const boxH = canvasH * 0.2;
      const boxX = (canvasW - boxW) / 2;
      const boxY = canvasH - boxH - paddingY;

      overlayContext.save();
      overlayContext.font = `${scale}px ${this.fontFamily}`;
      overlayContext.textBaseline = 'top';
      const lines = this.wrapText(overlayContext, shownText, boxW - paddingX * 2);
      overlayContext.restore();

      const lineHeight = scale * 1.4;
      const textHeight = lines.length * lineHeight;

      // background box
      overlayContext.save();
      overlayContext.fillStyle = TextTheme.boxColor.toString();
      overlayContext.fillRect(boxX, boxY, boxW, boxH);
      overlayContext.strokeStyle = TextTheme.borderColor.toString();
      overlayContext.lineWidth = 3 * uiScale * screenFactor;
      overlayContext.strokeRect(boxX - 2, boxY - 2, boxW + 4, boxH + 4);
      overlayContext.restore();

      // text
      overlayContext.save();
      overlayContext.fillStyle = TextTheme.textColor.toString();
      overlayContext.font = `${scale}px ${this.fontFamily}`;
      overlayContext.textAlign = 'center';
      overlayContext.textBaseline = 'top';
      const yOffset = boxY + (boxH - textHeight) / 2;
      for (let i = 0; i < lines.length; i++) {
        const x = boxX + boxW / 2;
        const y = yOffset + i * lineHeight;
        overlayContext.fillText(lines[i], x, y);
      }
      overlayContext.restore();
      return;
    }

    // ──────────────────────────────────────────────
    // DIALOGUE MODE — left-aligned w/ scroll + portrait
    // ──────────────────────────────────────────────
    const padding = 40 * uiScale * screenFactor;
    const panelW = canvasW * 0.47; // slightly wider to fit scrollbar
    const panelH = canvasH * 0.5;
    const boxX = padding;
    const boxY = canvasH - panelH - padding;

    const portraitSize = panelH * 0.4;
    const textAreaX = boxX + portraitSize + padding * 0.9;
    const textAreaW = panelW - portraitSize - padding * 1.6; // extra space for scrollbar gap

    // background box
    overlayContext.save();
    overlayContext.fillStyle = TextTheme.boxColor.toString();
    overlayContext.fillRect(boxX, boxY, panelW, panelH);
    overlayContext.strokeStyle = TextTheme.borderColor.toString();
    overlayContext.lineWidth = 3 * uiScale * screenFactor;
    overlayContext.strokeRect(boxX - 2, boxY - 2, panelW + 4, panelH + 4);
    overlayContext.restore();

    // portrait (or placeholder)
    const px = boxX + padding * 0.5;
    const py = boxY + padding * 0.5;
    if (this.portrait) {
      overlayContext.drawImage(this.portrait, px, py, portraitSize, portraitSize);
    } else {
      overlayContext.fillStyle = 'rgba(255,255,255,0.05)';
      overlayContext.fillRect(px, py, portraitSize, portraitSize);
      overlayContext.strokeStyle = 'rgba(255,255,255,0.2)';
      overlayContext.strokeRect(px, py, portraitSize, portraitSize);
    }

    // text + scrollable region
    overlayContext.save();
    overlayContext.font = `${scale * 1.05}px ${this.fontFamily}`;
    overlayContext.textAlign = 'left';
    overlayContext.textBaseline = 'top';
    overlayContext.fillStyle = TextTheme.textColor.toString();

    const lines = this.wrapText(overlayContext, shownText, textAreaW);
    const lineHeight = scale * 1.4;
    const totalHeight = lines.length * lineHeight;
    const visibleHeight = panelH - padding * 1.2;
    const maxScroll = Math.max(0, totalHeight - visibleHeight);
    this.scrollY = Math.max(0, Math.min(this.scrollY, maxScroll));

    overlayContext.save();
    overlayContext.beginPath();
    overlayContext.rect(textAreaX, boxY + padding * 0.5, textAreaW, visibleHeight);
    overlayContext.clip();

    let y = boxY + padding * 0.5 - this.scrollY;
    for (const line of lines) {
      overlayContext.fillText(line, textAreaX + 6, y);
      y += lineHeight;
    }
    overlayContext.restore();

    // scrollbar (moved slightly outward)
    if (maxScroll > 0) {
      const barW = 6 * uiScale;
      const barX = boxX + panelW - barW - padding * 0.1; // shifted outward
      const trackY = boxY + padding * 0.5;
      const trackH = visibleHeight;
      const thumbH = Math.max(20, (visibleHeight / totalHeight) * trackH);
      const thumbY = trackY + (this.scrollY / maxScroll) * (trackH - thumbH);

      overlayContext.fillStyle = 'rgba(255,255,255,0.2)';
      overlayContext.fillRect(barX, trackY, barW, trackH);
      overlayContext.fillStyle = 'rgba(255,255,255,0.6)';
      overlayContext.fillRect(barX, thumbY, barW, thumbH);
    }
    overlayContext.restore();
  }
}
