// src/environment/FogSystem.js
'use strict';
import {
  vec2,
  ParticleEmitter,
  Color,
  drawRect,
  cameraPos,
  mainCanvas,
  overlayContext,
  rand,
  timeDelta,
  clamp
} from 'littlejsengine';

export class FogSystem {
  constructor() {
    this.enabled = true;
    this.density = 0.85;
    this.baseColor = new Color(0.7, 0.75, 0.78, 1);
    this.fogColor = new Color(0.65, 0.68, 0.72, 1);

    this.emitters = [];
    this.maxEmitters = 8;
    this.emitterSpawnRadius = 12;

    this.layers = [
      { distance: 4, alpha: 0.12, size: 3, speed: 0.02 },
      { distance: 8, alpha: 0.15, size: 4, speed: 0.015 },
      { distance: 12, alpha: 0.18, size: 4.5, speed: 0.01 }
    ];

    this.overlayAlpha = 0.4;
    this.vignetteStrength = 0.6;
    this.time = 0;
    this.waveSpeed = 0.3;
    this.waveAmplitude = 0.05;
    this.particles = [];
    this.maxParticles = 180;
    this.updateInterval = 0.05;
    this.updateTimer = 0;

    // ⬇ New fade control state
    this.fadingOut = false;
    this.fadeTimer = 0;
    this.fadeDuration = 0.5; // seconds for fade
  }

  update(dt, playerPos) {
    if (!this.enabled && !this.fadingOut) return;

    this.time += dt;
    this.updateTimer += dt;

    // ⬇ Handle fading logic
    if (this.fadingOut) {
      this.fadeTimer += dt;
      const t = clamp(this.fadeTimer / this.fadeDuration, 0, 1);
      this.density = (1 - t) * 0.85; // fade down
      if (t >= 1) {
        this.fadingOut = false;
        this.enabled = false;
        this.clear();
      }
    }

    if (!this.enabled) return;
    if (this.updateTimer < this.updateInterval) return;
    this.updateTimer = 0;

    this._spawnFogParticles(playerPos);
    this._updateParticles(dt, playerPos);
  }

  fadeOut() {
    if (!this.fadingOut && this.enabled) {
      this.fadingOut = true;
      this.fadeTimer = 0;
    }
  }

  _spawnFogParticles(playerPos) {
    if (this.fadingOut) return; // stop spawning during fade
    const particlesNeeded = this.maxParticles - this.particles.length;
    if (particlesNeeded <= 0) return;
    const spawnCount = Math.min(6, particlesNeeded);

    for (let i = 0; i < spawnCount; i++) {
      const layer = this.layers[Math.floor(rand() * this.layers.length)];
      const angle = rand() * Math.PI * 2;
      const distance = this.emitterSpawnRadius * Math.pow(rand(), 0.5);
      const offset = vec2(Math.cos(angle) * distance, Math.sin(angle) * distance);
      const pos = playerPos.add(offset.add(vec2(rand() * 2 - 1, rand() * 2 - 1)));

      const emitter = new ParticleEmitter(
        pos,
        angle,
        layer.size,
        0,
        0,
        Math.PI * 2,
        undefined,
        new Color(this.fogColor.r, this.fogColor.g, this.fogColor.b, layer.alpha * 0.7),
        new Color(this.fogColor.r, this.fogColor.g, this.fogColor.b, layer.alpha),
        new Color(this.fogColor.r, this.fogColor.g, this.fogColor.b, layer.alpha * 0.6),
        new Color(this.fogColor.r, this.fogColor.g, this.fogColor.b, 0),
        8 + rand() * 6,
        layer.size * 0.4,
        layer.size * 1.4,
        layer.speed,
        0,
        0.98,
        1,
        0,
        0.5,
        0.1,
        0.5,
        false,
        false,
        true,
        -1
      );

      emitter.emitParticle();

      this.particles.push({
        emitter,
        layer,
        spawnTime: this.time,
        lifetime: 8 + rand() * 6
      });
    }
  }

  _updateParticles(dt, playerPos) {
    this.particles = this.particles.filter(p => {
      const age = this.time - p.spawnTime;
      if (age > p.lifetime) return false;
      const dist = p.emitter.pos.distance(playerPos);
      return dist < this.emitterSpawnRadius * 3;
    });
  }

  render(playerPos, mode = 'overlay') {
    if (!this.enabled && !this.fadingOut) return;
    if (mode === 'overlay') this._renderScreenOverlay();
    else if (mode === 'midlayer') this._renderDistanceFog(playerPos);
  }

  _renderScreenOverlay() {
    const ctx = overlayContext;
    const w = mainCanvas.width;
    const h = mainCanvas.height;
    ctx.save();

    const baseAlpha = this.overlayAlpha * this.density;
    ctx.fillStyle = `rgba(${this.baseColor.r * 255}, ${this.baseColor.g * 255}, ${this.baseColor.b * 255}, ${baseAlpha})`;
    ctx.fillRect(0, 0, w, h);

    const waveOffset = Math.sin(this.time * this.waveSpeed) * this.waveAmplitude;
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
    gradient.addColorStop(0, `rgba(${this.fogColor.r * 255}, ${this.fogColor.g * 255}, ${this.fogColor.b * 255}, 0)`);
    gradient.addColorStop(0.5 + waveOffset, `rgba(${this.fogColor.r * 255}, ${this.fogColor.g * 255}, ${this.fogColor.b * 255}, ${baseAlpha * 0.3})`);
    gradient.addColorStop(1, `rgba(${this.fogColor.r * 255}, ${this.fogColor.g * 255}, ${this.fogColor.b * 255}, ${baseAlpha * 0.6})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    if (this.vignetteStrength > 0) {
      const vignette = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 1.5);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(0.7, `rgba(0,0,0,${this.vignetteStrength * 0.3})`);
      vignette.addColorStop(1, `rgba(0,0,0,${this.vignetteStrength * 0.7})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  _renderDistanceFog(playerPos) {}
  setDensity(density) { this.density = clamp(density, 0, 1); }
  setColor(r, g, b) {
    this.baseColor = new Color(r, g, b, 1);
    this.fogColor = new Color(r * 0.95, g * 0.95, b * 0.95, 1);
  }
  toggle() { this.enabled = !this.enabled; return this.enabled; }
  clear() { this.particles = []; }
}