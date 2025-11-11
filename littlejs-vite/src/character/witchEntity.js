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
  drawRect
} from 'littlejsengine';
import { worldToIso, isoToWorld } from '../map/isoMath.js';

export class WitchEntity {
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
    this.alpha = 1;
    this.fadeSpeed = 0.015;
    this.fading = false;
    this.dead = false;

    // debug mode
    this.debugEnabled = false;
    this.debugSpeed = 0.025;
    this.tileRatio = 0.5;
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
    const base = `./assets/witch/ghost_woman_idle/ghost-woman-idle_export_ArmaturemixamocomLayer0001_dir${dirIndex}`;
    const jsonPath = `${base}.json`;
    const pngPath = `${base}.png`;
    const res = await fetch(jsonPath);
    if (!res.ok) throw new Error(`Failed to load witch JSON: ${jsonPath}`);
    const data = await res.json();
    this.frames = (data.frames || []).map(f => f.frame);
    this.durations = (data.frames || []).map(f => (f.duration ?? 33) / 1000);
    this.texIndex = await this.#loadTextureAsIndex(pngPath);
    this.ready = true;
  }

  fadeOut(speed = 0.015) {
    this.fading = true;
    this.fadeSpeed = Math.max(0.001, speed);
  }

  update(dt = 1 / 60) {
    if (!this.ready || !this.frames.length) return;

    // animate frames
    this.frameTimer += dt;
    const dur = this.durations[this.frameIndex] || 1 / 30;
    if (this.frameTimer >= dur) {
      this.frameTimer -= dur;
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }

    // fade logic
    if (this.fading) {
      this.alpha -= this.fadeSpeed * (dt * 60);
      if (this.alpha <= 0.01) {
        this.alpha = 0;
        this.dead = true;
      }
    }

    // 🔹 Debug move system
    if (this.debugEnabled) {
      const move = vec2(0, 0);
      if (keyIsDown('ArrowUp') || keyIsDown('KeyW')) move.y += 1;
      if (keyIsDown('ArrowDown') || keyIsDown('KeyS')) move.y -= 1;
      if (keyIsDown('ArrowLeft') || keyIsDown('KeyA')) move.x -= 1;
      if (keyIsDown('ArrowRight') || keyIsDown('KeyD')) move.x += 1;

      const isMoving = move.x || move.y;
      if (isMoving) {
        const isoMove = vec2(move.x, move.y * this.tileRatio);
        const mag = Math.hypot(isoMove.x, isoMove.y);
        if (mag > 0) {
          const step = isoMove.scale(this.debugSpeed / mag);
          this.pos = this.pos.add(step);
        }
      }

      // 🔹 Press P → print both world + tile coordinates
      if (keyWasPressed('KeyP')) {
        const scene = window.scene;
        if (!scene?.map) {
          console.warn('[WitchEntity] Scene or map missing for coordinate conversion');
          return;
        }

        const { mapData, TILE_W, TILE_H } = scene.map;
        const { width, height } = mapData;
        const iso = worldToIso(this.pos.x, this.pos.y, width, height, TILE_W, TILE_H);

        console.log(
          `%c[WitchEntity] WORLD (${this.pos.x.toFixed(2)}, ${this.pos.y.toFixed(2)}) → TILE (c=${iso.x.toFixed(2)}, r=${iso.y.toFixed(2)})`,
          'color:#f6f;font-weight:bold;'
        );

        // helper line for easy spawn copying
        console.log(
          `%cspawn_c=${Math.round(iso.x)}, spawn_r=${Math.round(iso.y)}`,
          'color:#6ff;font-weight:bold;'
        );
      }
    }
  }

  draw() {
    if (!this.ready || this.texIndex < 0 || !this.frames.length || this.alpha <= 0) return;

    const f = this.frames[this.frameIndex];
    const scaleY = 256 / (f.h || 498);
    const frameSize = vec2((f.w / this.ppu) * scaleY, (f.h / this.ppu) * scaleY);
    const tile = new TileInfo(vec2(f.x, f.y), vec2(f.w, f.h), this.texIndex);
    const tint = new Color(1, 1, 1, this.alpha);
    drawTile(this.pos.add(vec2(0, 0.5)), frameSize, tile, tint, 0, 0);

    if (this.debugEnabled)
      drawRect(this.pos, vec2(0.06, 0.06), new Color(1, 0.5, 0, 0.9));
  }
}

/*───────────────────────────────────────────────
  GLOBAL DEBUG TOGGLE
───────────────────────────────────────────────*/
if (typeof window !== 'undefined') {
  window.DEBUG_WITCH = false;
  window.toggleWitchDebug = () => {
    window.DEBUG_WITCH = !window.DEBUG_WITCH;
    if (window.scene) {
      const all = [
        ...(scene.witchManager?.entitiesAbove || []),
        ...(scene.witchManager?.entitiesBelow || [])
      ];
      for (const w of all)
        if (w instanceof WitchEntity) w.debugEnabled = window.DEBUG_WITCH;
    }
    console.log(
      `%c[WitchEntity] Debug → ${window.DEBUG_WITCH ? 'ON (move with arrows/WASD, press P to log coords)' : 'OFF'}`,
      'color:#f6f;font-weight:bold;'
    );
  };
}
