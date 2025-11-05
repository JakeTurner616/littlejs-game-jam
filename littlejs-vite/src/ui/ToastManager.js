// src/ui/ToastManager.js — 🔔 HUD popup toasts (supports color + stacking)
'use strict';
import { overlayContext, mainCanvasSize } from 'littlejsengine';
import { TextTheme } from './TextTheme.js';

export class ToastManager {
  constructor() {
    this.toasts = []; // {text, ttl, fade, color}
    this.fontFamily = TextTheme.fontFamily;
    this.fontSize = 22;
    this.spacing = 38;
  }

  /**
   * Display a toast message on screen.
   * @param {string} text - message text
   * @param {string} [color='#ffffff'] - text color
   * @param {number} [duration=3] - duration in seconds
   */
  show(text, color = '#ffffff', duration = 3) {
    this.toasts.push({ text, ttl: duration, fade: 0, color });
  }

  /**
   * Update toast fading and lifetime.
   * @param {number} dt - delta time
   */
  update(dt) {
    for (const t of this.toasts) {
      t.ttl -= dt;
      // fade in for most of the life, fade out near the end
      if (t.ttl > 0.3) t.fade += dt * 4;
      else t.fade -= dt * 6;
      t.fade = Math.max(0, Math.min(1, t.fade));
    }
    this.toasts = this.toasts.filter(t => t.ttl > -0.5 && t.fade > 0.01);
  }

  /**
   * Draw all active toasts on the overlay canvas.
   */
  draw() {
    if (!this.toasts.length) return;
    const ctx = overlayContext;
    const scale = window.devicePixelRatio || 1;
    const w = mainCanvasSize.x * scale;
    const h = mainCanvasSize.y * scale;
    const baseY = h * 0.15;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${this.fontSize * scale}px ${this.fontFamily}`;

    let y = baseY;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      const a = t.fade;
      if (a <= 0) continue;

      // measure text and calculate box dimensions
      const textW = ctx.measureText(t.text).width;
      const pad = 28 * scale;
      const boxW = textW + pad * 2;
      const boxH = this.fontSize * scale + pad;
      const boxX = (w - boxW) / 2;
      const boxY = y;

      // background box with alpha
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = TextTheme.boxColor.toString();
      ctx.fillRect(boxX, boxY, boxW, boxH);

      // border
      ctx.strokeStyle = TextTheme.borderColor.toString();
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      // text
      ctx.globalAlpha = a;
      ctx.fillStyle = t.color || TextTheme.textColor.toString();
      ctx.fillText(t.text, boxX + boxW / 2, boxY + boxH / 2);

      // advance next toast position
      y += boxH + this.spacing * scale;
    }
    ctx.restore();
  }
}
