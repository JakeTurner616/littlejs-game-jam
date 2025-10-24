// src/environment/lightingSystem.js
'use strict';
import { drawRect, vec2, hsl, Color } from 'littlejsengine';

/**
 * LightingSystem — ultra-optimized rain + lightning
 * -------------------------------------------------
 * • No splashes, no allocations during update
 * • Precomputed pooled rain streaks
 * • Screen culling + lightning overlay
 */
export class LightingSystem {
  constructor() {
    // Core toggles
    this.rainEnabled = true;            // ✅ rain ON by default
    this.lightningEnabled = false;

    // Render modes
    this.rainRenderMode = 'overlay';    // ✅ overlay by default
    this.lightningRenderMode = 'overlay';

    // Lightning state
    this.lightningTimer = 0;
    this.lightningFlash = 0;

    // Rain system
    this.poolSize = 400;
    this.rainDrops = new Array(this.poolSize);
    this.spawnW = 64;
    this.spawnH = 40;
    this.angle = Math.PI / 12;           // slight diagonal
    this.baseSpeed = 24;
    this.frameCounter = 0;

    this._initPool();
  }

  /*───────────────────────────────────────────────
    CONFIG
  ────────────────────────────────────────────────*/
  setRainMode(mode = 'overlay') { this.rainRenderMode = mode; }
  setLightningMode(mode = 'overlay') { this.lightningRenderMode = mode; }
  toggleRain() { this.rainEnabled = !this.rainEnabled; }
  triggerLightning() {
    this.lightningEnabled = true;
    this.lightningTimer = 0.42 + Math.random() * 0.08;
    this.lightningFlash = 1;
  }

  /*───────────────────────────────────────────────
    INTERNAL INITIALIZATION
  ────────────────────────────────────────────────*/
  _initPool() {
    const sinA = Math.sin(this.angle);
    const cosA = Math.cos(this.angle);
    for (let i = 0; i < this.poolSize; i++) {
      const len = 0.4 + Math.random() * 0.4;
      const spd = this.baseSpeed * (0.9 + Math.random() * 0.3);
      const vx = sinA * spd;
      const vy = -cosA * spd;
      this.rainDrops[i] = {
        x: Math.random() * this.spawnW - this.spawnW / 2,
        y: Math.random() * this.spawnH,
        vx, vy, len,
        alpha: 0.35 + Math.random() * 0.25,
        width: 0.015 + Math.random() * 0.01,
      };
    }
  }

  /*───────────────────────────────────────────────
    UPDATE
  ────────────────────────────────────────────────*/
  update(dt) {
    // Lightning fade
    if (this.lightningEnabled) {
      this.lightningTimer -= dt;
      this.lightningFlash = Math.max(0, this.lightningTimer * 10);
      if (this.lightningTimer <= 0) {
        this.lightningEnabled = false;
        this.lightningFlash = 0;
      }
    }
    if (!this.rainEnabled) return;

    const drops = this.rainDrops;
    const n = this.poolSize;
    const spawnW = this.spawnW;
    const spawnH = this.spawnH;

    for (let i = 0; i < n; i++) {
      const d = drops[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      if (d.y < -25 || d.x > spawnW / 2 || d.x < -spawnW / 2 - 10) {
        d.x = Math.random() * spawnW - spawnW / 2;
        d.y = 25 + Math.random() * 10;
      }
    }
  }

  /*───────────────────────────────────────────────
    RENDER
  ────────────────────────────────────────────────*/

  /**
   * Draws base dark layer anchored to camera position
   * so it always matches world and fade depth alignment.
   */
  renderBase(cameraPos = vec2(0, 0)) {
    // ✅ Centered background rectangle following camera
    const size = vec2(128, 128); // large enough to fill viewport
    drawRect(cameraPos, size, hsl(0, 0, 0.15));
  }

  renderMidLayer(cameraPos = vec2(0, 0)) {
    if (this.lightningRenderMode === 'background' && this.lightningFlash > 0)
      drawRect(
        cameraPos,
        vec2(128, 128),
        new Color(1, 1, 1, this.lightningFlash * 0.35)
      );

    if (this.rainRenderMode === 'background' && this.rainEnabled)
      this._renderRain(cameraPos, true);
  }

  renderOverlay(cameraPos = vec2(0, 0)) {
    if (this.rainRenderMode === 'overlay' && this.rainEnabled)
      this._renderRain(cameraPos, false);
    if (this.lightningRenderMode === 'overlay' && this.lightningFlash > 0)
      this._renderLightning();
  }

  _renderRain(cameraPos, isBackground) {
    const color = new Color(0.75, 0.85, 1, 1);
    const brightness = isBackground ? 0.25 : 0.55;
    const viewHalfW = 32, viewHalfH = 24;
    const drops = this.rainDrops;
    const n = this.poolSize;

    for (let i = 0; i < n; i++) {
      const d = drops[i];
      const dx = d.x - cameraPos.x;
      const dy = d.y - cameraPos.y;
      if (dx < -viewHalfW || dx > viewHalfW || dy < -viewHalfH || dy > viewHalfH)
        continue;

      color.a = brightness * d.alpha;
      drawRect(vec2(d.x, d.y), vec2(d.width, d.len), color);
    }
  }

  _renderLightning() {
    drawRect(vec2(0, 0), vec2(9999, 9999),
      new Color(1, 1, 1, this.lightningFlash * 0.45));
  }
}
