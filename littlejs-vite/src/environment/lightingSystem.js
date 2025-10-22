// src/environment/lightingSystem.js
'use strict';
import {
  drawRect,
  hsl,
  Color,
  vec2,
  overlayContext,
} from 'littlejsengine';

export class LightingSystem {
  constructor() {
    this.mode = 'default';
    this.flashTimer = 0;
    this.flashDuration = 0.4;

    this.rainEnabled = false;
    this.rainDrops = [];
    this.rainCount = 220;

    this.initRain();
  }

  /** Create normalized screen-space rain drops */
  initRain() {
    this.rainDrops = [];
    for (let i = 0; i < this.rainCount; i++) {
      this.rainDrops.push({
        x: Math.random(),
        y: Math.random(),
        speed: 0.15 + Math.random() * 0.2,
        length: 0.03 + Math.random() * 0.05,
        slant: 0.015 + Math.random() * 0.02,
      });
    }
  }

  toggleRain() { this.rainEnabled = !this.rainEnabled; }

  triggerLightning() {
    this.mode = 'lightning';
    this.flashTimer = this.flashDuration;
  }

  update(dt) {
    // ⚡ Lightning fade
    if (this.mode === 'lightning') {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.mode = 'default';
        this.flashTimer = 0;
      }
    }

    // 🌧️ Rain motion (fall *downward* — LittleJS Y+ = up)
    if (this.rainEnabled) {
      const scrollSpeed = 0.25;
      for (const d of this.rainDrops) {
        d.y += d.speed * dt * 3;          // ✅ flip direction (down)
        d.x += d.slant * dt * 3 * 0.5;    // ✅ slant right/down

        // wrap when off bottom or sides
        if (d.y > 1.1 || d.x < -0.1 || d.x > 1.1) {
          d.y = -0.1;
          d.x = Math.random();
        }
      }
    }
  }

  renderBase() {
    drawRect(vec2(0, 0), vec2(9999, 9999), hsl(0, 0, 0.15));
  }

  renderOverlay() {
    // ⚡ Lightning flash overlay
    if (this.mode === 'lightning') {
      const t = this.flashTimer / this.flashDuration;
      const alpha = Math.pow(t, 0.5);
      drawRect(vec2(0, 0), vec2(9999, 9999), new Color(1, 1, 1, alpha));
    }

    // 🌧️ Screen-space rain
    if (this.rainEnabled) {
      const ctx = overlayContext;
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;

      // Slightly oversize canvas for seamless edges
      const pad = 100; // px
      const drawW = w + pad * 2;
      const drawH = h + pad * 2;

      ctx.save();
      ctx.translate(-pad, -pad); // extend draw region
      ctx.strokeStyle = new Color(0.7, 0.8, 1, 0.25).toString();
      ctx.lineWidth = 1.4;
      ctx.beginPath();

      for (const d of this.rainDrops) {
        const x = d.x * drawW;
        const y = d.y * drawH;
        ctx.moveTo(x, y);
        ctx.lineTo(x - d.slant * 200, y + d.length * 400); // ✅ fall downward
      }

      ctx.stroke();
      ctx.restore();
    }
  }
}