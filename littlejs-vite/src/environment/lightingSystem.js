// src/environment/lightingSystem.js
'use strict';
import { drawRect, vec2, hsl, Color } from 'littlejsengine';

/**
 * LightingSystem — optimized rain + lightning
 * -------------------------------------------------
 * • Precomputed pooled rain streaks
 * • No allocations during update/render
 * • Cached color objects
 */
export class LightingSystem {
  constructor() {
    // Core toggles
    this.rainEnabled = true;
    this.lightningEnabled = false;

    // Render modes
    this.rainRenderMode = 'overlay';
    this.lightningRenderMode = 'overlay';

    // Lightning state
    this.lightningTimer = 0;
    this.lightningFlash = 0;

    // Rain system
    this.poolSize = 400;
    this.spawnW = 64;
    this.spawnH = 40;
    this.angle = Math.PI / 12; // slight diagonal
    this.baseSpeed = 24;

    // Cached values for performance
    this._sinA = Math.sin(this.angle);
    this._cosA = Math.cos(this.angle);
    this._rainColor = new Color(0.75, 0.85, 1, 1);
    this._lightColor = new Color(1, 1, 1, 0);

    this.rainDrops = new Array(this.poolSize);
    this._initPool();
  }

  //───────────────────────────────────────────────
  setRainMode(m = 'overlay') { this.rainRenderMode = m; }
  setLightningMode(m = 'overlay') { this.lightningRenderMode = m; }
  toggleRain() { this.rainEnabled = !this.rainEnabled; }

  triggerLightning() {
    this.lightningEnabled = true;
    this.lightningTimer = 0.4 + Math.random() * 0.1;
    this.lightningFlash = 1;
  }

  //───────────────────────────────────────────────
  _initPool() {
    const { poolSize, spawnW, spawnH, baseSpeed, _sinA, _cosA } = this;
    const drops = this.rainDrops;
    for (let i = 0; i < poolSize; i++) {
      const spd = baseSpeed * (0.9 + Math.random() * 0.3);
      drops[i] = {
        x: Math.random() * spawnW - spawnW * 0.5,
        y: Math.random() * spawnH,
        vx: _sinA * spd,
        vy: -_cosA * spd,
        len: 0.4 + Math.random() * 0.4,
        alpha: 0.35 + Math.random() * 0.25,
        width: 0.015 + Math.random() * 0.01,
      };
    }
  }

  //───────────────────────────────────────────────
  update(dt) {
    // Lightning fade
    if (this.lightningEnabled) {
      const t = (this.lightningTimer -= dt);
      if (t > 0) this.lightningFlash = t * 10;
      else {
        this.lightningEnabled = false;
        this.lightningFlash = 0;
      }
    }
    if (!this.rainEnabled) return;

    const { rainDrops, poolSize, spawnW } = this;
    for (let i = 0; i < poolSize; i++) {
      const d = rainDrops[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y < -25 || d.x > spawnW * 0.5 || d.x < -spawnW * 0.5 - 10) {
        d.x = Math.random() * spawnW - spawnW * 0.5;
        d.y = 25 + Math.random() * 10;
      }
    }
  }

  //───────────────────────────────────────────────
  renderBase(cam = vec2(0, 0)) {
    drawRect(cam, vec2(128, 128), hsl(0, 0, 0.15));
  }

  renderMidLayer(cam = vec2(0, 0)) {
    if (this.lightningRenderMode === 'background' && this.lightningFlash > 0) {
      const c = this._lightColor;
      c.a = this.lightningFlash * 0.35;
      drawRect(cam, vec2(128, 128), c);
    }
    if (this.rainRenderMode === 'background' && this.rainEnabled)
      this._renderRain(cam, true);
  }

  renderOverlay(cam = vec2(0, 0)) {
    if (this.rainRenderMode === 'overlay' && this.rainEnabled)
      this._renderRain(cam, false);
    if (this.lightningRenderMode === 'overlay' && this.lightningFlash > 0)
      this._renderLightning();
  }

  _renderRain(cam, bg) {
    const { rainDrops, poolSize, spawnW, spawnH, _rainColor } = this;
    const bright = bg ? 0.25 : 0.55;
    const halfW = 32, halfH = 24;
    for (let i = 0; i < poolSize; i++) {
      const d = rainDrops[i];
      const dx = d.x - cam.x;
      const dy = d.y - cam.y;
      if (dx < -halfW || dx > halfW || dy < -halfH || dy > halfH) continue;
      _rainColor.a = bright * d.alpha;
      drawRect(vec2(d.x, d.y), vec2(d.width, d.len), _rainColor);
    }
  }

  _renderLightning() {
    const c = this._lightColor;
    c.a = this.lightningFlash * 0.45;
    drawRect(vec2(0, 0), vec2(9999, 9999), c);
  }
}
