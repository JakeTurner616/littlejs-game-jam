// src/character/playerController.js
'use strict';

import {
  vec2,
  TileInfo,
  drawTile,
  keyIsDown,
  time,
  Color
} from 'littlejsengine';

// ──────────────────────────────────────────────────────────────
// PLAYER CONTROLLER WITH MULTI-DIRECTION ANIMATION
// ──────────────────────────────────────────────────────────────
export class PlayerController {
  constructor(pos = vec2(0, 0), textureConfig = { idleStartIndex: 0, walkStartIndex: 8 }) {
    this.pos = pos;
    this.speed = 0.025;
    this.direction = 0; // 0–7 (dir1–dir8)
    this.isMoving = false;

    this.textureConfig = textureConfig;
    this.animFPS = 12;
    this.frames = {};   // {idle_dir1: [...], walk_dir1: [...], ...}
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.ready = false;
  }

  // ──────────────────────────────────────────────────────────────
  // LOAD ALL 16 ANIMATIONS (Idle + Walk for directions 1–8)
  // ──────────────────────────────────────────────────────────────
  async loadAllAnimations() {
    const dirs = Array.from({ length: 8 }, (_, i) => i + 1);

    for (const d of dirs) {
      const baseIdle = `/assets/character/Idle/Businessman_Idle_dir${d}.json`;
      const baseWalk = `/assets/character/Walk/Businessman_Walk_dir${d}.json`;

      try {
        const [idleJSON, walkJSON] = await Promise.all([
          fetch(baseIdle).then(r => r.json()),
          fetch(baseWalk).then(r => r.json())
        ]);

        this.frames[`idle_${d}`] = idleJSON.frames.map(f => f.frame);
        this.frames[`walk_${d}`] = walkJSON.frames.map(f => f.frame);
      }
      catch (err) {
        console.warn(`Missing animation for direction ${d}`, err);
      }
    }

    this.ready = true;
  }

  // ──────────────────────────────────────────────────────────────
  // UPDATE PLAYER MOVEMENT + ANIMATION
  // ──────────────────────────────────────────────────────────────
  update() {
    if (!this.ready) return;

    const move = vec2(0, 0);
    if (keyIsDown('ArrowUp')) move.y -= 1;
    if (keyIsDown('ArrowDown')) move.y += 1;
    if (keyIsDown('ArrowLeft')) move.x -= 1;
    if (keyIsDown('ArrowRight')) move.x += 1;

    this.isMoving = !!(move.x || move.y);

    if (this.isMoving) {
      move.normalize();
      this.pos.add(move.scale(this.speed));

      // Determine facing direction (8-way)
      const angle = Math.atan2(move.y, move.x);
      this.direction = this.angleToDir(angle);
    }

    // Update animation timing
    const frameTime = 1 / this.animFPS;
    this.frameTimer += time.delta;
    if (this.frameTimer >= frameTime) {
      this.frameTimer = 0;
      this.frameIndex = (this.frameIndex + 1) % this.currentFrames().length;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // RENDER PLAYER SPRITE
  // ──────────────────────────────────────────────────────────────
  draw() {
    if (!this.ready) return;

    const frames = this.currentFrames();
    if (!frames?.length) return;

    const f = frames[this.frameIndex];
    const texIndex = this.currentTextureIndex();

    const tile = new TileInfo(
      vec2(f.x, f.y),
      vec2(f.w, f.h),
      texIndex
    );

    const frameSize = vec2(f.w / 128, f.h / 128);

    drawTile(
      this.pos.add(vec2(0, 0.5)),
      frameSize,
      tile,
      undefined,
      0,
      0,
      Color.white
    );
  }

  // ──────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────
  currentFrames() {
    const d = this.direction + 1;
    return this.frames[`${this.isMoving ? 'walk' : 'idle'}_${d}`] || [];
  }

  currentTextureIndex() {
    const d = this.direction; // 0–7
    const base = this.isMoving ? this.textureConfig.walkStartIndex : this.textureConfig.idleStartIndex;
    return base + d;
  }

  angleToDir(angle) {
    // 8-way direction mapping
    const step = (Math.PI * 2) / 8;
    let dir = Math.round((angle + Math.PI * 2) / step) % 8;
    return dir; // 0–7
  }
}
