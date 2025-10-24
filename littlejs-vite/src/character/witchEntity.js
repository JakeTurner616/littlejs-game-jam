// src/character/witchEntity.js
'use strict';
import {
  vec2,
  TileInfo,
  drawTile,
  Color,
  TextureInfo,
  textureInfos,
  keyIsDown,
  keyWasPressed,
  drawRect,
  worldToScreen
} from 'littlejsengine';
import { worldToIso } from '../map/isoMath.js';

/**
 * WitchEntity — idle ghost that plays a directional loop
 * ------------------------------------------------------
 * ✅ Uses LittleJS texture system correctly (TextureInfo → texture index)
 * ✅ Supports z-layer rendering (above/below map)
 * ✅ Includes interactive debug control for precise spawn positioning
 */
export class WitchEntity {
  /**
   * @param {vec2} pos - world-space spawn position
   * @param {number} direction - 0..7
   * @param {number} ppu - pixels-per-unit
   * @param {string} renderLayer - 'above' or 'below' map
   */
  constructor(pos = vec2(0, 0), direction = 0, ppu = 128, renderLayer = 'above') {
    this.pos = vec2(pos.x, pos.y);
    this.ppu = ppu;
    this.direction = Math.max(0, Math.min(7, direction));
    this.renderLayer = renderLayer;
    this.ready = false;

    this.frames = [];
    this.durations = [];
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.texIndex = -1;

    // 🧭 DEBUG CONTROL
    this.debugEnabled = false;
    this.debugSpeed = 0.02;
  }

  async #loadTextureAsIndex(pngPath) {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('Image failed: ' + pngPath));
      im.src = pngPath;
    });
    const texInfo = new TextureInfo(img);
    textureInfos.push(texInfo);
    return textureInfos.length - 1;
  }

  async load() {
    const dirIndex = this.direction + 1;
    const base = `/assets/witch/ghost_woman_idle/ghost-woman-idle_export_ArmaturemixamocomLayer0001_dir${dirIndex}`;
    const jsonPath = `${base}.json`;
    const pngPath = `${base}.png`;

    const res = await fetch(jsonPath);
    if (!res.ok) throw new Error(`Failed to load witch JSON: ${jsonPath}`);
    const data = await res.json();

    this.frames = (data.frames || []).map(f => f.frame);
    this.durations = (data.frames || []).map(f => (f.duration ?? 33) / 1000);
    this.texIndex = await this.#loadTextureAsIndex(pngPath);

    this.ready = true;

    console.log('%c[WitchEntity] Loaded and ready. Toggle debug with window.toggleWitchDebug().', 'color:#aef');
  }

  update(dt = 1 / 60) {
    if (!this.ready || !this.frames.length) return;

    // animation
    this.frameTimer += dt;
    const dur = this.durations[this.frameIndex] || (1 / 30);
    if (this.frameTimer >= dur) {
      this.frameTimer -= dur;
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }

    // 🧭 DEBUG MOVEMENT
    if (this.debugEnabled) {
      const move = vec2(0, 0);
      if (keyIsDown('ArrowUp')) move.y += 1;
      if (keyIsDown('ArrowDown')) move.y -= 1;
      if (keyIsDown('ArrowLeft')) move.x -= 1;
      if (keyIsDown('ArrowRight')) move.x += 1;

      if (move.x || move.y) {
        this.pos.x += move.x * this.debugSpeed;
        this.pos.y += move.y * this.debugSpeed;
      }

      // Print coordinates with "P"
      if (keyWasPressed('KeyP')) {
        const iso = worldToIso(this.pos.x, this.pos.y, 16, 16, 1, 1);
        console.log(
          `%c[WitchEntity] Position: X:${this.pos.x.toFixed(2)}, Y:${this.pos.y.toFixed(2)}  |  Tile C:${Math.floor(iso.x)}, R:${Math.floor(iso.y)}`,
          'color:#6ff;font-weight:bold;'
        );
      }
    }
  }

  draw() {
    if (!this.ready || this.texIndex < 0 || !this.frames.length) return;
    const f = this.frames[this.frameIndex];
    const scaleY = 256 / (f.h || 498);
    const frameSize = vec2((f.w / this.ppu) * scaleY, (f.h / this.ppu) * scaleY);
    const tile = new TileInfo(vec2(f.x, f.y), vec2(f.w, f.h), this.texIndex);

    drawTile(this.pos.add(vec2(0, 0.5)), frameSize, tile, undefined, 0, 0, Color.white);

    // Debug crosshair
    if (this.debugEnabled) {
      drawRect(this.pos, vec2(0.05, 0.05), new Color(1, 0.5, 0, 0.8));
    }
  }
}

/*───────────────────────────────────────────────
  🧭 GLOBAL DEBUG CONTROL
───────────────────────────────────────────────*/
if (typeof window !== 'undefined') {
  window.DEBUG_WITCH = false;

  window.toggleWitchDebug = () => {
    window.DEBUG_WITCH = !window.DEBUG_WITCH;
    if (window.scene) {
      for (const w of [...(scene.entitiesAbove || []), ...(scene.entitiesBelow || [])]) {
        if (w instanceof WitchEntity) w.debugEnabled = window.DEBUG_WITCH;
      }
    }
    console.log(
      `%c[WitchEntity] Debug mode → ${window.DEBUG_WITCH ? 'ON (Use Arrows + P)' : 'OFF'}`,
      'color:#6ff;font-weight:bold;'
    );
  };
}
