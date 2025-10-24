// src/ui/DialogBox.js
'use strict';
import { overlayContext, mainCanvasSize, mouseWheel } from 'littlejsengine';
import { TextTheme } from './TextTheme.js';

/**
 * DialogBox — supports monologue and dialogue modes
 * -------------------------------------------------
 * • Text now wraps naturally around portrait
 * • Scrollable and typewriter effect retained
 */
export class DialogBox {
  constructor(mode = 'monologue') {
    this.mode = mode;
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

    // reverse scroll for natural direction
    const wheelDelta = mouseWheel;
    if (wheelDelta) this.scrollY += wheelDelta * this.scrollSpeed;

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

  /**
   * Wrap text with dynamic left indent for portrait flow
   */
  wrapTextWithPortrait(ctx, text, boxX, boxY, boxW, boxH, portraitH, portraitIndentW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    let y = 0;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      // available width depends on current vertical position
      const currentMaxW = (y < portraitH)
        ? boxW - portraitIndentW - 10 // indent next to portrait
        : boxW;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > currentMaxW && line) {
        lines.push({ text: line, indent: (y < portraitH) ? portraitIndentW : 0 });
        y += TextTheme.fontSize * 1.4;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line)
      lines.push({ text: line, indent: (y < portraitH) ? portraitIndentW : 0 });
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
    // MONOLOGUE MODE (centered block)
    // ──────────────────────────────────────────────
    if (isMonologue) {
      const paddingX = 50 * uiScale * screenFactor;
      const paddingY = 40 * uiScale * screenFactor;
      const boxW = canvasW * 0.8;
      const boxH = canvasH * 0.2;
      const boxX = (canvasW - boxW) / 2;
      const boxY = canvasH - boxH - paddingY;

      overlayContext.save();
      overlayContext.fillStyle = TextTheme.boxColor.toString();
      overlayContext.fillRect(boxX, boxY, boxW, boxH);
      overlayContext.strokeStyle = TextTheme.borderColor.toString();
      overlayContext.lineWidth = 3 * uiScale * screenFactor;
      overlayContext.strokeRect(boxX - 2, boxY - 2, boxW + 4, boxH + 4);
      overlayContext.restore();

      overlayContext.save();
      overlayContext.font = `${scale}px ${this.fontFamily}`;
      overlayContext.textBaseline = 'top';
      overlayContext.textAlign = 'center';
      overlayContext.fillStyle = TextTheme.textColor.toString();

      const lines = this.wrapTextWithPortrait(
        overlayContext, shownText, boxX, boxY, boxW, boxH, 0, 0
      );
      const lineHeight = scale * 1.4;
      let y = boxY + (boxH - lines.length * lineHeight) / 2;
      for (const l of lines) {
        overlayContext.fillText(l.text, boxX + boxW / 2, y);
        y += lineHeight;
      }
      overlayContext.restore();
      return;
    }

    // ──────────────────────────────────────────────
    // DIALOGUE MODE (portrait + text flow)
    // ──────────────────────────────────────────────
    const padding = 40 * uiScale * screenFactor;
    const panelW = canvasW * 0.47;
    const panelH = canvasH * 0.5;
    const boxX = padding;
    const boxY = canvasH - panelH - padding;

    // background box
    overlayContext.save();
    overlayContext.fillStyle = TextTheme.boxColor.toString();
    overlayContext.fillRect(boxX, boxY, panelW, panelH);
    overlayContext.strokeStyle = TextTheme.borderColor.toString();
    overlayContext.lineWidth = 3 * uiScale * screenFactor;
    overlayContext.strokeRect(boxX - 2, boxY - 2, panelW + 4, panelH + 4);
    overlayContext.restore();

    const portraitSize = panelH * 0.4;
    const px = boxX + padding * 0.5;
    const py = boxY + padding * 0.5;
    if (this.portrait)
      overlayContext.drawImage(this.portrait, px, py, portraitSize, portraitSize);
    else {
      overlayContext.fillStyle = 'rgba(255,255,255,0.05)';
      overlayContext.fillRect(px, py, portraitSize, portraitSize);
      overlayContext.strokeStyle = 'rgba(255,255,255,0.2)';
      overlayContext.strokeRect(px, py, portraitSize, portraitSize);
    }

    // text region wraps around portrait
    overlayContext.save();
    overlayContext.font = `${scale * 1.05}px ${this.fontFamily}`;
    overlayContext.textAlign = 'left';
    overlayContext.textBaseline = 'top';
    overlayContext.fillStyle = TextTheme.textColor.toString();

    const portraitIndentW = portraitSize + padding * 0.5;
    const lines = this.wrapTextWithPortrait(
      overlayContext, shownText, boxX, boxY, panelW - padding, panelH,
      portraitSize + padding * 0.3, portraitIndentW
    );

    const lineHeight = scale * 1.4;
    const totalHeight = lines.length * lineHeight;
    const visibleHeight = panelH - padding * 1.2;
    const maxScroll = Math.max(0, totalHeight - visibleHeight);
    this.scrollY = Math.max(0, Math.min(this.scrollY, maxScroll));

    overlayContext.save();
    overlayContext.beginPath();
    overlayContext.rect(boxX + padding * 0.4, boxY + padding * 0.4, panelW - padding, visibleHeight);
    overlayContext.clip();

    let y = boxY + padding * 0.4 - this.scrollY;
    for (const l of lines) {
      overlayContext.fillText(l.text, boxX + padding * 0.4 + l.indent, y);
      y += lineHeight;
    }
    overlayContext.restore();

    // scrollbar
    if (maxScroll > 0) {
      const barW = 6 * uiScale;
      const barX = boxX + panelW - barW - padding * 0.1;
      const trackY = boxY + padding * 0.4;
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