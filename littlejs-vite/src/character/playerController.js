// src/character/playerController.js
'use strict';
import {
  vec2, keyIsDown, timeDelta, Color, setCameraPos,
  drawRect, drawEllipse, drawLine, drawTile, TileInfo
} from 'littlejsengine';
import { handlePlayerMovement } from './playerMovement.js';
import { handlePlayerAnimation, loadAllAnimations } from './playerAnimation.js';
import { buildSmartPath } from './playerPathfinding.js';
import { pointInsideAnyCollider } from './playerCollision.js';

export class PlayerController {
  constructor(pos = vec2(0, 0), textureCfg = { idleStartIndex: 0, walkStartIndex: 8 }, ppu = 128) {
    Object.assign(this, {
      pos: vec2(pos.x, pos.y),
      ppu,
      tileRatio: 0.5,
      speed: 2.7 / ppu,
      direction: 0,
      state: 'idle',
      frameIndex: 0,
      frameTimer: 0,
      frames: {},
      durations: {},
      ready: false,
      textureCfg,
      currentAnimKey: '',
      mapColliders: [],
      feetOffset: vec2(0, 0.45),
      shadowScale: 1,
      shadowTarget: 1,
      shadowLerp: 5,
      clickTarget: null,
      path: [],
      reachThreshold: 0.1,
      smoothBlendDist: 0.25,
      debugLinks: [],
      debugNodes: [],
      destinationMarker: null,
      markerAlpha: 0,
      markerScale: 1,
      markerTimer: 0,
      noclip: false // toggled manually in console
    });
  }

  async loadAllAnimations() { await import('./playerAnimation.js').then(mod => mod.loadAllAnimations(this)); }
  async initAnimations() { await loadAllAnimations(this); }
  setColliders(c) { this.mapColliders = c || []; }

  /*────────────────────────── Update ──────────────────────────*/
  update() {
    if (!this.ready) return;

    // Normal movement + animation always happen
    handlePlayerMovement(this);
    handlePlayerAnimation(this);

    if (!window.scene?.cinematicMode)
      setCameraPos(this.pos);
  }

  /*────────────────────────── Collision Override ──────────────────────────*/
  // ✅ Overwrite collider check to ignore when noclip is true
  pointInsideAnyCollider(p) {
    if (this.noclip) return false; // 🚫 skip all collision detection
    return pointInsideAnyCollider(this.mapColliders, p);
  }

  /*────────────────────────── Draw ──────────────────────────*/
  draw() {
    if (!this.ready) return;
    const f = this.currentFrames()[this.frameIndex];
    if (!f) return;

    const tex = new TileInfo(vec2(f.x, f.y), vec2(f.w, f.h), this.currentTextureIndex());
    const s = vec2((f.w / this.ppu) * 256 / 504, (f.h / this.ppu) * 256 / 504);
    this.drawShadow();
    drawTile(this.pos.add(vec2(0, 0.5)), s, tex, undefined, 0, 0, Color.white);

    const feet = this.pos.add(this.feetOffset);
    drawRect(
      feet,
      vec2(0.06, 0.06),
      this.noclip ? new Color(1, 1, 0, 1) : new Color(1, 0, 1, 1)
    );

    for (let i = 0; i < this.path.length - 1; i++)
      drawLine(this.path[i], this.path[i + 1], 0.03, new Color(0, 1, 0, 0.4));
  }

  drawShadow() {
    const p = this.pos.add(this.feetOffset);
    const r = 0.3 * this.shadowScale;
    drawEllipse(p, vec2(r * 1.8, r * 0.9), new Color(0, 0, 0, 0.25), 0);
  }

  buildSmartPath(target) { return buildSmartPath(this, target); }
  currentFrames() { return this.frames[`${this.state}_${this.direction + 1}`] || []; }

  currentTextureIndex() {
    const base = this.state === 'walk'
      ? this.textureCfg.walkStartIndex
      : this.textureCfg.idleStartIndex;
    return base + this.direction;
  }
}
