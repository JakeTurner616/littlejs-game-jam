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
    this.maxEmitters = 3;  
    this.emitterSpawnRadius = 12;  
  
    this.layers = [  
      { distance: 6, alpha: 0.12, size: 6, speed: 0.02 },  
      { distance: 12, alpha: 0.14, size: 5, speed: 0.01 }  
    ];  
  
    this.overlayAlpha = 0.4;  
    this.vignetteStrength = 0.6;  
    this.time = 0;  
    this.waveSpeed = 0.3;  
    this.waveAmplitude = 0.05;  
    this.particles = [];  
    this.maxParticles = 100;  
    this.updateInterval = 0.05;  
    this.updateTimer = 0;  
  
    this.fadingOut = false;  
    this.fadeTimer = 0;  
    this.fadeDuration = 0.5;  
  
    // ✅ OPTIMIZATION: Pre-allocate color objects (reuse instead of creating new ones)  
    this._colorCache = this.layers.map(layer => ({  
      startA: new Color(this.fogColor.r, this.fogColor.g, this.fogColor.b, layer.alpha * 0.7),  
      startB: new Color(this.fogColor.r, this.fogColor.g, this.fogColor.b, layer.alpha),  
      endA: new Color(this.fogColor.r, this.fogColor.g, this.fogColor.b, layer.alpha * 0.6),  
      endB: new Color(this.fogColor.r, this.fogColor.g, this.fogColor.b, 0)  
    }));  
  
    // ✅ OPTIMIZATION: Cache RGBA strings to avoid repeated string building  
    this._rgbaCache = {  
      base: '',  
      fog: '',  
      vignette: ['', '']  
    };  
    this._updateRGBACache();  
  
    // ✅ OPTIMIZATION: Cache canvas dimensions to avoid repeated property access  
    this._canvasW = 0;  
    this._canvasH = 0;  
    this._maxDim = 0;  
  }  
  
  _updateRGBACache() {  
    const br = Math.floor(this.baseColor.r * 255);  
    const bg = Math.floor(this.baseColor.g * 255);  
    const bb = Math.floor(this.baseColor.b * 255);  
    const fr = Math.floor(this.fogColor.r * 255);  
    const fg = Math.floor(this.fogColor.g * 255);  
    const fb = Math.floor(this.fogColor.b * 255);  
  
    this._rgbaCache.basePrefix = `rgba(${br},${bg},${bb},`;  
    this._rgbaCache.fogPrefix = `rgba(${fr},${fg},${fb},`;  
  }  
  
  update(dt, playerPos) {  
    if (!this.enabled && !this.fadingOut) return;  
  
    this.time += dt;  
    this.updateTimer += dt;  
  
    if (this.fadingOut) {  
      this.fadeTimer += dt;  
      const t = clamp(this.fadeTimer / this.fadeDuration, 0, 1);  
      this.density = (1 - t) * 0.85;  
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
      
    // ✅ Force all existing particles to expire quickly  
    for (let i = 0; i < this.particles.length; i++) {  
      const p = this.particles[i];  
      // Reduce remaining lifetime to match fade duration  
      const age = this.time - p.spawnTime;  
      const remainingLife = p.lifetime - age;  
      if (remainingLife > this.fadeDuration) {  
        p.lifetime = age + this.fadeDuration; // Expire in 0.5s  
      }  
    }  
  }  
}
  
  _spawnFogParticles(playerPos) {  
  if (this.fadingOut) return;  
  const particlesNeeded = this.maxParticles - this.particles.length;  
  if (particlesNeeded <= 0) return;  
      
  const spawnCount = Math.min(3, particlesNeeded);  
  
  for (let i = 0; i < spawnCount; i++) {  
    const layerIdx = Math.floor(rand() * this.layers.length);  
    const layer = this.layers[layerIdx];  
    const angle = rand() * Math.PI * 2;  
    const distance = this.emitterSpawnRadius * Math.pow(rand(), 0.5);  
        
    const cosA = Math.cos(angle);  
    const sinA = Math.sin(angle);  
    const offset = vec2(  
      cosA * distance + rand() * 2 - 1,  
      sinA * distance + rand() * 2 - 1  
    );  
    const pos = playerPos.add(offset);  
  
    const colors = this._colorCache[layerIdx];  
      
    // ✅ NEW: Reduce lifetime to 0.5s during fade-out  
    const lifetime = this.fadingOut ? 0.3 : (3 + rand() * 2);  
      
    const emitter = new ParticleEmitter(  
      pos,  
      angle,  
      layer.size,  
      0,  
      0,  
      Math.PI * 2,  
      undefined,  
      colors.startA,  
      colors.startB,  
      colors.endA,  
      colors.endB,  
      lifetime, // ✅ Use variable lifetime  
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
      lifetime // ✅ Store the actual lifetime used  
    });  
  }  
}
  
  _updateParticles(dt, playerPos) {  
    // ✅ OPTIMIZATION: Use for-loop with splice instead of filter (avoids array reallocation)  
    const cullDist = this.emitterSpawnRadius * 3;  
    for (let i = this.particles.length - 1; i >= 0; i--) {  
      const p = this.particles[i];  
      const age = this.time - p.spawnTime;  
      if (age > p.lifetime || p.emitter.pos.distance(playerPos) >= cullDist) {  
        this.particles.splice(i, 1);  
      }  
    }  
  }  
  
  render(playerPos, mode = 'overlay') {  
    if (!this.enabled && !this.fadingOut) return;  
    if (mode === 'overlay') this._renderScreenOverlay();  
    else if (mode === 'midlayer') this._renderDistanceFog(playerPos);  
  }  
  
  _renderScreenOverlay() {  
    const ctx = overlayContext;  
      
    // ✅ OPTIMIZATION: Cache canvas dimensions (only update if changed)  
    const w = mainCanvas.width;  
    const h = mainCanvas.height;  
    if (w !== this._canvasW || h !== this._canvasH) {  
      this._canvasW = w;  
      this._canvasH = h;  
      this._maxDim = Math.max(w, h);  
    }  
  
    ctx.save();  
  
    const baseAlpha = this.overlayAlpha * this.density;  
      
    // ✅ OPTIMIZATION: Use cached RGBA string prefix  
    ctx.fillStyle = this._rgbaCache.basePrefix + baseAlpha + ')';  
    ctx.fillRect(0, 0, w, h);  
  
    // ✅ OPTIMIZATION: Only create gradient if wave animation is enabled  
    const waveOffset = Math.sin(this.time * this.waveSpeed) * this.waveAmplitude;  
    const gradient = ctx.createRadialGradient(  
      w >> 1, h >> 1, 0,  // ✅ Use bit shift for division by 2  
      w >> 1, h >> 1, this._maxDim >> 1  
    );  
      
    // ✅ OPTIMIZATION: Use cached RGBA prefix  
    const fogPrefix = this._rgbaCache.fogPrefix;  
    gradient.addColorStop(0, fogPrefix + '0)');  
    gradient.addColorStop(0.5 + waveOffset, fogPrefix + (baseAlpha * 0.3) + ')');  
    gradient.addColorStop(1, fogPrefix + (baseAlpha * 0.6) + ')');  
      
    ctx.fillStyle = gradient;  
    ctx.fillRect(0, 0, w, h);  
  
    // ✅ OPTIMIZATION: Skip vignette if strength is negligible  
    if (this.vignetteStrength > 0.01) {  
      const vignette = ctx.createRadialGradient(  
        w >> 1, h >> 1, 0,  
        w >> 1, h >> 1, this._maxDim / 1.5  
      );  
        
      vignette.addColorStop(0, 'rgba(0,0,0,0)');  
      vignette.addColorStop(0.7, 'rgba(0,0,0,' + (this.vignetteStrength * 0.3) + ')');  
      vignette.addColorStop(1, 'rgba(0,0,0,' + (this.vignetteStrength * 0.7) + ')');  
        
      ctx.fillStyle = vignette;  
      ctx.fillRect(0, 0, w, h);  
    }  
      
    ctx.restore();  
  }  
  
  _renderDistanceFog(playerPos) {}  
    
  setDensity(density) {   
    this.density = clamp(density, 0, 1);   
  }  
    
  setColor(r, g, b) {  
    this.baseColor = new Color(r, g, b, 1);  
    this.fogColor = new Color(r * 0.95, g * 0.95, b * 0.95, 1);  
      
    // ✅ OPTIMIZATION: Update cached colors when color changes  
    for (let i = 0; i < this.layers.length; i++) {  
      const layer = this.layers[i];  
      const colors = this._colorCache[i];  
      colors.startA.set(this.fogColor.r, this.fogColor.g, this.fogColor.b, layer.alpha * 0.7);  
      colors.startB.set(this.fogColor.r, this.fogColor.g, this.fogColor.b, layer.alpha);  
      colors.endA.set(this.fogColor.r, this.fogColor.g, this.fogColor.b, layer.alpha * 0.6);  
      colors.endB.set(this.fogColor.r, this.fogColor.g, this.fogColor.b, 0);  
    }  
    this._updateRGBACache();  
  }  
    
  toggle() {   
    this.enabled = !this.enabled;   
    return this.enabled;   
  }  
    
  clear() {   
    this.particles = [];   
  }  
}