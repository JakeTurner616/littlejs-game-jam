// src/ui/DialogBox.js — 🎭 Dialogue+Monologue UI with click absorption & scrolling
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
import { getPortrait } from '../util/portraitCache.js';

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

    this._boxRect = null;
  }

  isActive() {
    return this.visible && this.text;
  }

  containsMouse() {
    if (!this._boxRect || !this.visible) return false;
    const uiScale = window.devicePixelRatio || 1;
    const mx = mousePosScreen.x * uiScale;
    const my = mousePosScreen.y * uiScale;
    const r = this._boxRect;
    return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
  }

  async loadFont() {
    const fontFace = new FontFace('GameFont', 'url(/assets/font/Estonia-Regular.woff2)');
    await fontFace.load();
    document.fonts.add(fontFace);
    this.fontFamily = 'GameFont';
  }

  async loadPortrait(path) {
    try {
      const img = await getPortrait(path);
      this.portrait = img;
    } catch (e) {
      console.warn('[DialogBox] Failed to load portrait:', path, e);
    }
  }

  setMode(mode) {
    if (this.mode === 'monologue' && mode === 'dialogue' && this.visible) {
      this.visible = false;
      this.text = '';
      this.typeProgress = 0;
    }
    if (this.mode !== mode) {
      this.mode = mode;
      this.scrollY = 0;
      this.typeProgress = 0;
      this.text = '';
      this.options = null;
      this.visible = false;
    } else this.mode = mode;
  }

  setText(text, options = null, onOptionSelect = null) {
    if (this.visible) {
      this.typeProgress = this.text.length;
      this.visible = false;
    }
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

    const mx = mousePosScreen.x;
    const my = mousePosScreen.y;

    if (mouseWasPressed(0) && this.containsMouse())
      window.__clickConsumed = true;

    if (keyWasPressed('Space')) {
      if (this.typeProgress < this.text.length)
        this.typeProgress = this.text.length;
      else if (this.mode === 'monologue' && !this.options)
        this.visible = false;
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

    // dialogue mode scrolling + hover
    if (this.mode === 'dialogue' && this.options) {
      const uiScale = window.devicePixelRatio || 1;
      const canvasW = mainCanvasSize.x * uiScale;
      const canvasH = mainCanvasSize.y * uiScale;
      const screenFactor = Math.min(1, Math.max(0.7, canvasH / 800));
      const padding = 40 * uiScale * screenFactor;
      const panelW = canvasW * 0.47;
      const panelH = canvasH * 0.5;
      const boxX = padding;
      const boxY = canvasH - panelH - padding;

      const separatorY = boxY + panelH - 95 * uiScale;
      const optW = panelW - padding * 1.2;
      const optH = 24 * uiScale;
      const spacing = 10 * uiScale;
      const optX = boxX + padding * 0.6;
      const optAreaY = separatorY + 10 * uiScale;
      const optAreaH = panelH - (optAreaY - boxY) - padding * 0.6;

      const insideOptArea =
        mx >= optX / uiScale - 4 &&
        mx <= (optX + optW) / uiScale + 18 &&
        my >= optAreaY / uiScale - 4 &&
        my <= (optAreaY + optAreaH) / uiScale + 8;

      const totalHeight = this.options.length * (optH + spacing);
      const maxScroll = Math.max(0, totalHeight - optAreaH);

      if (insideOptArea) {
        const wheelDelta = mouseWheel;
        if (wheelDelta) {
          this.scrollY += wheelDelta * this.scrollSpeed;
          if (this.scrollY < 0) this.scrollY = 0;
          if (this.scrollY > maxScroll) this.scrollY = maxScroll;
        }
      }

      // hover detection uses unscrolled logical rects
      this.hoverIndex = -1;
      for (let i = 0; i < this.options.length; i++) {
        const r = this.options[i].rect;
        if (!r) continue;
        const ry = r.y - this.scrollY / uiScale;
        if (mx >= r.x && mx <= r.x + r.w && my >= ry && my <= ry + r.h) {
          this.hoverIndex = i;
          break;
        }
      }

      if (mouseWasPressed(0) && this.hoverIndex >= 0 && this.onOptionSelect) {
        const opt = this.options[this.hoverIndex];
        if (!opt.disabled) this.onOptionSelect(opt.value, this.hoverIndex);
      }
    }
  }

  wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const width = ctx.measureText(test).width;
      if (width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
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
      const test = line ? `${line} ${word}` : word;
      const maxW = (y < portraitH) ? boxW - portraitIndentW - 10 : boxW;
      const w = ctx.measureText(test).width;
      if (w > maxW && line) {
        lines.push({ text: line, indent: (y < portraitH) ? portraitIndentW : 0 });
        y += TextTheme.fontSize * 1.4;
        line = word;
      } else line = test;
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

    /*────────── MONOLOGUE ──────────*/
    if (this.mode === 'monologue') {
      const boxW = canvasW * 0.8;
      const boxH = canvasH * 0.18;
      const boxX = (canvasW - boxW) / 2;
      const boxY = canvasH - boxH - 40 * uiScale;
      this._boxRect = { x: boxX, y: boxY, w: boxW, h: boxH };

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
      const lh = scale * 1.5;
      const totalH = lines.length * lh;
      let y = boxY + (boxH - totalH) / 2;
      for (const line of lines) {
        overlayContext.fillText(line, boxX + boxW / 2, y);
        y += lh;
      }
      overlayContext.restore();
      return;
    }

    /*────────── DIALOGUE ──────────*/
    const padding = 40 * uiScale * screenFactor;
    const panelW = canvasW * 0.47;
    const panelH = canvasH * 0.5;
    const boxX = padding;
    const boxY = canvasH - panelH - padding;
    this._boxRect = { x: boxX, y: boxY, w: panelW, h: panelH };

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
    const textVisibleH = panelH - padding * 2.2 - (this.options ? 90 * uiScale : 0);
    overlayContext.save();
    overlayContext.beginPath();
    overlayContext.rect(boxX + padding * 0.4, boxY + padding * 0.4, panelW - padding, textVisibleH);
    overlayContext.clip();

    let y = boxY + padding * 0.4;
    for (const l of lines) {
      overlayContext.fillText(l.text, boxX + padding * 0.4 + l.indent, y);
      y += lineHeight;
    }
    overlayContext.restore();

    const separatorY = boxY + panelH - 95 * uiScale;
    overlayContext.strokeStyle = 'rgba(255,255,255,0.08)';
    overlayContext.lineWidth = 2;
    overlayContext.beginPath();
    overlayContext.moveTo(boxX + padding * 0.5, separatorY);
    overlayContext.lineTo(boxX + panelW - padding * 0.5, separatorY);
    overlayContext.stroke();

    if (this.options) {
      const optW = panelW - padding * 1.2;
      const optH = 24 * uiScale;
      const spacing = 10 * uiScale;
      const optX = boxX + padding * 0.6;
      const optAreaY = separatorY + 10 * uiScale;
      const optAreaH = panelH - (optAreaY - boxY) - padding * 0.6;
      const totalHeight = this.options.length * (optH + spacing);
      const maxScroll = Math.max(0, totalHeight - optAreaH);
      if (this.scrollY < 0) this.scrollY = 0;
      if (this.scrollY > maxScroll) this.scrollY = maxScroll;

      overlayContext.save();
      overlayContext.beginPath();
      overlayContext.rect(optX - 4, optAreaY - 4, optW + 8, optAreaH + 8);
      overlayContext.clip();

      // ✅ fixed: logical layout, no squish
      for (let i = 0; i < this.options.length; i++) {
        const opt = this.options[i];
        const logicalY = optAreaY + i * (optH + spacing);
        const drawY = logicalY - this.scrollY;

        if (drawY + optH < optAreaY - 4) continue;
        if (drawY > optAreaY + optAreaH + 4) break;

        const hovered = i === this.hoverIndex && !opt.disabled;
        const bg = opt.disabled
          ? 'rgba(100,100,100,0.1)'
          : hovered
          ? 'rgba(100,255,100,0.12)'
          : 'rgba(255,255,255,0.05)';
        const border = opt.disabled
          ? 'rgba(100,100,100,0.3)'
          : hovered
          ? 'rgba(100,255,100,0.6)'
          : 'rgba(255,255,255,0.2)';
        const textCol = opt.disabled
          ? 'rgba(200,200,200,0.3)'
          : hovered
          ? '#8f8'
          : TextTheme.textColor.toString();

        overlayContext.fillStyle = bg;
        overlayContext.fillRect(optX, drawY, optW, optH);
        overlayContext.strokeStyle = border;
        overlayContext.strokeRect(optX, drawY, optW, optH);
        overlayContext.fillStyle = textCol;
        overlayContext.textAlign = 'center';
        overlayContext.textBaseline = 'middle';
        overlayContext.fillText(opt.label, optX + optW / 2, drawY + optH / 2);

        opt.rect = {
          x: optX / uiScale,
          y: logicalY / uiScale,
          w: optW / uiScale,
          h: optH / uiScale
        };
      }

      // 🔍 debug outlines for clickable areas
      overlayContext.strokeStyle = 'rgba(255,0,0,0.5)';
      overlayContext.lineWidth = 1 * uiScale;
      for (const opt of this.options) {
        if (!opt.rect) continue;
        overlayContext.strokeRect(
          opt.rect.x * uiScale,
          (opt.rect.y - this.scrollY / uiScale) * uiScale,
          opt.rect.w * uiScale,
          opt.rect.h * uiScale
        );
      }

      overlayContext.restore();

      if (maxScroll > 0) {
        const ratio = this.scrollY / maxScroll;
        const barH = Math.max(20 * uiScale, (optAreaH / totalHeight) * optAreaH);
        const barY = optAreaY + ratio * (optAreaH - barH);
        overlayContext.fillStyle = 'rgba(255,255,255,0.25)';
        overlayContext.fillRect(optX + optW + 6, barY, 4, barH);
      }
    }

    overlayContext.restore();
  }

  clearIfMonologue() {
    if (this.mode === 'monologue' && this.visible) {
      this.visible = false;
      this.text = '';
      this.typeProgress = 0;
      this.options = null;
    }
  }
}
