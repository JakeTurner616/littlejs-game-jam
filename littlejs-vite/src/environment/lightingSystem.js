// src/environment/lightingSystem.js — ⚡ Final Final Version
'use strict';
import { drawRect, vec2, Color, overlayContext, mainCanvas } from 'littlejsengine';

export class LightingSystem {
  constructor() {
    this.rainEnabled = true;
    this.lightningEnabled = false;
    this.rainRenderMode = 'overlay';
    this.lightningRenderMode = 'overlay';
    this.lightningTimer = 0;
    this.lightningFlash = 0;

    // Rain setup
    this.poolSize = 400;
    this.spawnW = 64;
    this.spawnH = 40;
    this.angle = Math.PI / 12;
    this.baseSpeed = 24;

    this._sinA = Math.sin(this.angle);
    this._cosA = Math.cos(this.angle);
    this._rainColor = new Color(0.75, 0.85, 1, 1);

    this.rainDrops = new Array(this.poolSize);
    this._initPool();
  }

  setRainMode(m = 'overlay') { this.rainRenderMode = m; }
  setLightningMode(m = 'overlay') { this.lightningRenderMode = m; }
  toggleRain() { this.rainEnabled = !this.rainEnabled; }

  triggerLightning() {
    this.lightningEnabled = true;
    this.lightningTimer = 0.4 + Math.random() * 0.1;
    this.lightningFlash = 1;
  }

  _initPool() {
    const { poolSize, spawnW, spawnH, baseSpeed, _sinA, _cosA } = this;
    for (let i = 0; i < poolSize; i++) {
      const spd = baseSpeed * (0.9 + Math.random() * 0.3);
      this.rainDrops[i] = {
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

  update(dt) {
    if (this.lightningEnabled) {
      const t = (this.lightningTimer -= dt);
      if (t > 0) this.lightningFlash = t * 10;
      else { this.lightningEnabled = false; this.lightningFlash = 0; }
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
  // Ambient base darkness in canvas space (not world)
  //───────────────────────────────────────────────
  renderBase() {
    const ctx = overlayContext;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
    ctx.restore();
  }

  renderMidLayer(cam = vec2(0, 0)) {
    if (this.lightningRenderMode === 'background' && this.lightningFlash > 0)
      this._renderLightningOverlay(0.35);
    if (this.rainRenderMode === 'background' && this.rainEnabled)
      this._renderRain(cam, true);
  }

  renderOverlay(cam = vec2(0, 0)) {
    if (this.rainRenderMode === 'overlay' && this.rainEnabled)
      this._renderRain(cam, false);
    if (this.lightningRenderMode === 'overlay' && this.lightningFlash > 0)
      this._renderLightningOverlay(0.45);
  }

  _renderRain(cam, bg) {
    const { rainDrops, poolSize, spawnW, _rainColor } = this;
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

  //───────────────────────────────────────────────
  // Lightning drawn directly to overlayContext (full canvas)
  //───────────────────────────────────────────────
  _renderLightningOverlay(strength = 0.45) {
    const a = this.lightningFlash * strength;
    if (a <= 0) return;

    const ctx = overlayContext;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(255,255,255,${Math.min(a, 1)})`;
    ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
    ctx.restore();
  }
}
