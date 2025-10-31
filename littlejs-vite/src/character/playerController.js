// src/character/playerController.js — 🧍 sprite bounds + proper take animation support (with debug)
'use strict';
import {
  vec2, keyIsDown, timeDelta, Color, setCameraPos,
  drawRect, drawEllipse, drawLine, drawTile, TileInfo
} from 'littlejsengine';
import { handlePlayerMovement } from './playerMovement.js';
import { handlePlayerAnimation, loadAllAnimations } from './playerAnimation.js';
import { buildSmartPath } from './playerPathfinding.js';
import { pointInsideAnyCollider } from './playerCollision.js';
import { isDebugMapEnabled } from '../map/mapRenderer.js';

export class PlayerController {
  constructor(pos = vec2(0, 0), textureCfg = {}, ppu = 128) {
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
      textureCfg: {
        idleStartIndex: 0,
        walkStartIndex: 8,
        takeStartIndex: 16, // ✅ Ensure take animation index exists
        ...textureCfg
      },
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
      noclip: false,
      frozen: false,
      animating: false,
      onceAnimationComplete: null
    });
  }

  async loadAllAnimations() { await import('./playerAnimation.js').then(mod => mod.loadAllAnimations(this)); }
  async initAnimations() { await loadAllAnimations(this); }
  setColliders(c) { this.mapColliders = c || []; }

  update() {
    if (!this.ready) return;

    // ⛔ Skip movement if frozen for item pickup animation
    if (!this.frozen)
      handlePlayerMovement(this);

    handlePlayerAnimation(this);

    if (!window.scene?.cinematicMode)
      setCameraPos(this.pos);
  }

  pointInsideAnyCollider(p) {
    if (this.noclip) return false;
    return pointInsideAnyCollider(this.mapColliders, p);
  }

  /** Get world-space bounding box of current sprite */
  getSpriteBounds() {
    const f = this.currentFrames()[this.frameIndex];
    if (!f) return null;
    const s = vec2((f.w / this.ppu) * 256 / 504, (f.h / this.ppu) * 256 / 504);
    const spritePos = this.pos.add(vec2(0, 0.5));
    return {
      pos: spritePos,
      size: s,
      minX: spritePos.x - s.x / 2,
      maxX: spritePos.x + s.x / 2,
      minY: spritePos.y - s.y / 2,
      maxY: spritePos.y + s.y / 2
    };
  }

   draw() {
    if (!this.ready) return;

    // 🧩 One-frame visual buffer: render last take frame before switching to idle
    if (this.deferIdleSwitch && this.lastTakeFrame) {
      const f = this.lastTakeFrame;
      const texIndex = this.currentTextureIndex();
      const tex = new TileInfo(vec2(f.x, f.y), vec2(f.w, f.h), texIndex);
      const s = vec2((f.w / this.ppu) * 256 / 504, (f.h / this.ppu) * 256 / 504);

      console.log(`[DrawBuffer] rendering deferred take frame (${f.w}x${f.h}) tex=${texIndex}`);
      this.drawShadow();
      drawTile(this.pos.add(vec2(0, 0.5)), s, tex, undefined, 0, 0, Color.white);

      this.deferIdleSwitch = false;   // ✅ clear after one buffered render
      this.lastTakeFrame = null;
      return;
    }

    const f = this.currentFrames()[this.frameIndex];
    if (!f) return;

    const texIndex = this.currentTextureIndex();
    const tex = new TileInfo(vec2(f.x, f.y), vec2(f.w, f.h), texIndex);
    const s = vec2((f.w / this.ppu) * 256 / 504, (f.h / this.ppu) * 256 / 504);

    //console.log(`[Draw] state=${this.state} frame=(${f.w}x${f.h}) tex=${texIndex} size=(${s.x.toFixed(3)}, ${s.y.toFixed(3)}) pos=(${this.pos.x.toFixed(2)}, ${this.pos.y.toFixed(2)})`);

    this.drawShadow();
    drawTile(this.pos.add(vec2(0, 0.5)), s, tex, undefined, 0, 0, Color.white);

    // feet dot
    drawRect(this.pos.add(this.feetOffset), vec2(0.06, 0.06),
      this.noclip ? new Color(1, 1, 0, 1) : new Color(1, 0, 1, 1));

    // path debug
    for (let i = 0; i < this.path.length - 1; i++)
      drawLine(this.path[i], this.path[i + 1], 0.03, new Color(0, 1, 0, 0.4));

    // 🟩 debug sprite bounds
    if (isDebugMapEnabled()) {
      const b = this.getSpriteBounds();
      if (b)
        drawRect(b.pos, b.size, new Color(0, 1, 0, 0.3), 0, false);
    }
  }

  drawShadow() {
    const p = this.pos.add(this.feetOffset);
    const r = 0.3 * this.shadowScale;
    drawEllipse(p, vec2(r * 1.8, r * 0.9), new Color(0, 0, 0, 0.25), 0);
  }

  buildSmartPath(target) { return buildSmartPath(this, target); }
  currentFrames() { return this.frames[`${this.state}_${this.direction + 1}`] || []; }

  /** Return correct texture index for each animation type */
  currentTextureIndex() {
    const { idleStartIndex, walkStartIndex, takeStartIndex } = this.textureCfg;
    const dir = this.direction || 0;
    let index;

    switch (this.state) {
      case 'walk': index = walkStartIndex + dir; break;
      case 'take': index = takeStartIndex + dir; break;
      default: index = idleStartIndex + dir; break;
    }

    if (isNaN(index) || index < 0) {
      console.warn(`[PlayerController] ⚠️ Invalid texture index (${index}) for state "${this.state}"`);
      index = idleStartIndex; // fallback
    }

    //console.log(`[TextureDebug] state=${this.state} dir=${dir} → texIndex=${index}`);
    return index;
  }
}

