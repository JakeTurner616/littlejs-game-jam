// src/environment/lightingSystem.js
'use strict';
import { drawRect, vec2, hsl, Color } from 'littlejsengine';

/**
 * LightingSystem — unified rain + lightning manager
 * -------------------------------------------------
 * • Smooth, cinematic rain with persistent particles
 * • Balanced drop size: thinner, more numerous, faster motion
 * • Works in both overlay and background modes
 */
export class LightingSystem {
  constructor() {
    // Core toggles
    this.rainEnabled = false;
    this.lightningEnabled = false;

    // Render modes
    this.rainRenderMode = 'overlay';
    this.lightningRenderMode = 'overlay';

    // Lightning state
    this.lightningTimer = 0;
    this.lightningFlash = 0;

    // Rain system
    this.rainDrops = [];
    this.rainDensity = 600;  // more drops overall
    this.rainSpeed = 15;     // faster descent
    this.windDrift = 1.4;    // subtle sideways drift
    this.cinematicMode = true;
  }

  /*───────────────────────────────────────────────
    CONFIGURATION
  ────────────────────────────────────────────────*/
  setRainMode(mode = 'overlay') { this.rainRenderMode = mode; }
  setLightningMode(mode = 'overlay') { this.lightningRenderMode = mode; }
  toggleRain() { this.rainEnabled = !this.rainEnabled; }
  toggleCinematic() { this.cinematicMode = !this.cinematicMode; }

  triggerLightning() {
    this.lightningEnabled = true;
    this.lightningTimer = 0.1 + Math.random() * 0.1;
    this.lightningFlash = 1;
  }

  /*───────────────────────────────────────────────
    UPDATE
  ────────────────────────────────────────────────*/
  update(dt) {
    // Lightning timer
    if (this.lightningEnabled) {
      this.lightningTimer -= dt;
      this.lightningFlash = Math.max(0, this.lightningTimer * 10);
      if (this.lightningTimer <= 0) {
        this.lightningEnabled = false;
        this.lightningFlash = 0;
      }
    }

    // Maintain rain system
    if (this.rainEnabled) {
      // Maintain density
      while (this.rainDrops.length < this.rainDensity)
        this.rainDrops.push(this._spawnDrop());

      const speedScale = this.cinematicMode ? 0.55 : 1.0;

      for (const d of this.rainDrops) {
        d.pos.y -= d.vel.y * dt * speedScale;
        d.pos.x += d.vel.x * dt * speedScale;

        // Recycle when below screen
        if (d.pos.y < -25) {
          d.pos.y = 30 + Math.random() * 10;
          d.pos.x = Math.random() * 60 - 30;
        }
      }
    } else {
      this.rainDrops.length = 0;
    }
  }

  /*───────────────────────────────────────────────
    RENDER LAYERS
  ────────────────────────────────────────────────*/
  renderBase() {
    drawRect(vec2(0, 0), vec2(9999, 9999), hsl(0, 0, 0.15));
  }

  renderMidLayer() {
    // Lightning flash behind map
    if (this.lightningRenderMode === 'background' && this.lightningEnabled && this.lightningFlash > 0) {
      drawRect(vec2(0, 0), vec2(9999, 9999),
        new Color(1, 1, 1, this.lightningFlash * 0.35));
    }

    // Background rain
    if (this.rainRenderMode === 'background' && this.rainEnabled)
      this._renderRain(true);
  }

  renderOverlay() {
    // Foreground rain
    if (this.rainRenderMode === 'overlay' && this.rainEnabled)
      this._renderRain(false);

    // Foreground lightning
    if (this.lightningRenderMode === 'overlay' && this.lightningEnabled && this.lightningFlash > 0)
      this._renderLightning();
  }

  /*───────────────────────────────────────────────
    INTERNAL RENDER HELPERS
  ────────────────────────────────────────────────*/
  _spawnDrop() {
    // Small, sleek streaks for dense rainfall
    const baseWidth  = 0.012;  // thin drops (~1.5 px)
    const baseLength = 0.18;   // shorter streak (~22 px)
    const speed      = this.rainSpeed * (0.9 + Math.random() * 0.3);
    const drift      = (Math.random() - 0.5) * this.windDrift;

    return {
      pos: vec2(Math.random() * 60 - 30, Math.random() * 40),
      size: vec2(baseWidth, baseLength * (0.8 + Math.random() * 0.4)),
      vel: vec2(drift, speed),
      alpha: 0.45 + Math.random() * 0.25,
    };
  }

  _renderRain(isBackground = false) {
    const color = new Color(0.65, 0.82, 1, 1);
    const brightness = isBackground ? 0.3 : 0.55;

    for (const d of this.rainDrops) {
      color.a = brightness * d.alpha;
      drawRect(d.pos, d.size, color);
    }
  }

  _renderLightning() {
    drawRect(vec2(0, 0), vec2(9999, 9999),
      new Color(1, 1, 1, this.lightningFlash * 0.45));
  }
}