// src/ui/DialogBox.js
'use strict';
import {
  overlayContext,
  mainCanvasSize,
  mousePosScreen,
  mouseWasPressed,
  mouseWheel,
  keyWasPressed
} from 'littlejsengine';
import { TextTheme } from './TextTheme.js';

/**
 * DialogBox — unified monologue + dialogue system
 * -----------------------------------------------
 * • Monologue: centered cinematic box (wrapped text)
 * • Dialogue: portrait panel w/ scroll + interactive options
 * • Spacebar: fast-forward or dismiss
 */
export class DialogBox {
  constructor(mode = 'dialogue') {
    this.mode = mode;
    this.fontFamily = TextTheme.fontFamily;
    this.text = '';
    this.visible = false;
    this.typingSpeed = 30;
    this.typeProgress = 0;
    this.pauseTimer = 0;
    this.pauseDuration = 0.7;
    this.scrollY = 0;
    this.scrollSpeed = 25;
    this.portrait = null;

    this.options = null;
    this.hoverIndex = -1;
    this.onOptionSelect = null;
  }

  isActive() {
    return this.visible && this.text;
  }

  async loadFont() {
    const fontFace = new FontFace('GameFont', 'url(/assets/font/Estonia-Regular.woff2)');
    await fontFace.load();
    document.fonts.add(fontFace);
    this.fontFamily = 'GameFont';
  }

  async loadPortrait(path) {
    if (!path) {
      this.portrait = null;
      return;
    }
    const img = new Image();
    img.src = path;
    await img.decode();
    this.portrait = img;
  }

  setMode(mode) {
    this.mode = mode;
    this.scrollY = 0;
  }

  setText(text, options = null, onOptionSelect = null) {
    if (this.visible && this.text === text) return;
    this.text = text;
    this.typeProgress = 0;
    this.pauseTimer = 0;
    this.scrollY = 0;
    this.visible = true;
    this.options = options ? options.map(o => ({ ...o, rect: null })) : null;
    this.onOptionSelect = onOptionSelect;
    this.hoverIndex = -1;
  }

  update(dt) {
    if (!this.visible || !this.text) return;

    // Spacebar to fast-forward or dismiss
    if (keyWasPressed('Space')) {
      if (this.typeProgress < this.text.length)
        this.typeProgress = this.text.length;
      else if (this.mode === 'monologue' && !this.options)
        this.visible = false;
    }

    if (this.mode === 'dialogue') {
      const wheelDelta = mouseWheel;
      if (wheelDelta) this.scrollY += wheelDelta * this.scrollSpeed;
    }

    if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
      return;
    }

    const prev = Math.floor(this.typeProgress);
    if (prev < this.text.length) {
      this.typeProgress += dt * this.typingSpeed;
      const cur = Math.floor(this.typeProgress);
      if (cur > prev && this.text[prev] === '.')
        this.pauseTimer = this.pauseDuration;
    }

    if (this.mode === 'dialogue' && this.options) {
      const mx = mousePosScreen.x;
      const my = mousePosScreen.y;
      this.hoverIndex = -1;
      for (let i = 0; i < this.options.length; i++) {
        const r = this.options[i].rect;
        if (!r) continue;
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h)
          this.hoverIndex = i;
      }
      if (mouseWasPressed(0) && this.hoverIndex >= 0 && this.onOptionSelect) {
        const opt = this.options[this.hoverIndex];
        this.onOptionSelect(opt.value, this.hoverIndex);
      }
    }
  }

  wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = ctx.measureText(testLine).width;
      if (width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = testLine;
    }
    if (line) lines.push(line);
    return lines;
  }

  wrapTextWithPortrait(ctx, text, boxX, boxY, boxW, boxH, portraitH, portraitIndentW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    let y = 0;
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const maxW = (y < portraitH) ? boxW - portraitIndentW - 10 : boxW;
      const w = ctx.measureText(testLine).width;
      if (w > maxW && line) {
        lines.push({ text: line, indent: (y < portraitH) ? portraitIndentW : 0 });
        y += TextTheme.fontSize * 1.4;
        line = word;
      } else line = testLine;
    }
    if (line) lines.push({ text: line, indent: (y < portraitH) ? portraitIndentW : 0 });
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

    /*───────────────────────────────────────────────
      MONOLOGUE MODE — centered cinematic text w/ wrapping
    ────────────────────────────────────────────────*/
    if (this.mode === 'monologue') {
      const boxW = canvasW * 0.8;
      const boxH = canvasH * 0.18;
      const boxX = (canvasW - boxW) / 2;
      const boxY = canvasH - boxH - 40 * uiScale;

      overlayContext.save();
      overlayContext.fillStyle = TextTheme.boxColor.toString();
      overlayContext.fillRect(boxX, boxY, boxW, boxH);
      overlayContext.strokeStyle = TextTheme.borderColor.toString();
      overlayContext.lineWidth = 3;
      overlayContext.strokeRect(boxX - 2, boxY - 2, boxW + 4, boxH + 4);

      overlayContext.font = `${scale * 1.2}px ${this.fontFamily}`;
      overlayContext.textAlign = 'center';
      overlayContext.textBaseline = 'top';
      overlayContext.fillStyle = TextTheme.textColor.toString();

      const lines = this.wrapText(overlayContext, shownText, boxW * 0.9);
      const lineHeight = scale * 1.5;
      const totalHeight = lines.length * lineHeight;
      let y = boxY + (boxH - totalHeight) / 2;

      for (const line of lines) {
        overlayContext.fillText(line, boxX + boxW / 2, y);
        y += lineHeight;
      }

      overlayContext.restore();
      return;
    }

    /*───────────────────────────────────────────────
      DIALOGUE MODE — portrait, scroll, options
    ────────────────────────────────────────────────*/
    const padding = 40 * uiScale * screenFactor;
    const panelW = canvasW * 0.47;
    const panelH = canvasH * 0.5;
    const boxX = padding;
    const boxY = canvasH - panelH - padding;

    overlayContext.save();
    overlayContext.fillStyle = TextTheme.boxColor.toString();
    overlayContext.fillRect(boxX, boxY, panelW, panelH);
    overlayContext.strokeStyle = TextTheme.borderColor.toString();
    overlayContext.lineWidth = 3 * uiScale * screenFactor;
    overlayContext.strokeRect(boxX - 2, boxY - 2, panelW + 4, panelH + 4);

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

    overlayContext.font = `${scale * 1.05}px ${this.fontFamily}`;
    overlayContext.textAlign = 'left';
    overlayContext.textBaseline = 'top';
    overlayContext.fillStyle = TextTheme.textColor.toString();

    const portraitIndentW = portraitSize + padding * 0.5;
    const lines = this.wrapTextWithPortrait(
      overlayContext, shownText,
      boxX, boxY, panelW - padding, panelH,
      portraitSize + padding * 0.3, portraitIndentW
    );

    const lineHeight = scale * 1.4;
    const totalHeight = lines.length * lineHeight;
    const visibleHeight = panelH - padding * 2.2 - (this.options ? 90 * uiScale : 0);
    const maxScroll = Math.max(0, totalHeight - visibleHeight);
    this.scrollY = Math.max(0, Math.min(this.scrollY, maxScroll));

    // Text region
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

    // ──────────────────────────────────────────────
    // Separator Line
    // ──────────────────────────────────────────────
    const separatorY = boxY + panelH - 95 * uiScale;
    overlayContext.strokeStyle = 'rgba(255,255,255,0.08)';
    overlayContext.lineWidth = 2;
    overlayContext.beginPath();
    overlayContext.moveTo(boxX + padding * 0.5, separatorY);
    overlayContext.lineTo(boxX + panelW - padding * 0.5, separatorY);
    overlayContext.stroke();

    // ──────────────────────────────────────────────
    // Options (moved up slightly, better hitbox)
    // ──────────────────────────────────────────────
    if (this.options) {
      const optBaseY = separatorY + 10 * uiScale; // slightly higher placement
      const optW = panelW - padding * 1.2;
      const optH = 28 * uiScale;
      const optX = boxX + padding * 0.6;

      for (let i = 0; i < this.options.length; i++) {
        const yOpt = optBaseY + i * (optH + 10 * uiScale);
        const hovered = i === this.hoverIndex;

        overlayContext.fillStyle = hovered
          ? 'rgba(100,255,100,0.12)'
          : 'rgba(255,255,255,0.05)';
        overlayContext.fillRect(optX, yOpt, optW, optH);
        overlayContext.strokeStyle = hovered
          ? 'rgba(100,255,100,0.6)'
          : 'rgba(255,255,255,0.2)';
        overlayContext.strokeRect(optX, yOpt, optW, optH);

        overlayContext.fillStyle = hovered ? '#8f8' : TextTheme.textColor.toString();
        overlayContext.textAlign = 'center';
        overlayContext.textBaseline = 'middle';
        overlayContext.fillText(
          this.options[i].label,
          optX + optW / 2,
          yOpt + optH / 2 + 2 * uiScale // offset text slightly down visually
        );

        // Hitbox slightly below text for natural feel
        this.options[i].rect = {
          x: optX,
          y: yOpt + 2 * uiScale,
          w: optW,
          h: optH + 2 * uiScale
        };
      }
    }

    overlayContext.restore();
  }
}
