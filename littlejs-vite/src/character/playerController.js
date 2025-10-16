// src/character/playerController.js
'use strict';
import {
  vec2, TileInfo, drawTile, keyIsDown, timeDelta, Color, setCameraPos,
} from 'littlejsengine';

/*
  PlayerController — self-contained animation generator
  ------------------------------------------------------
  ✅ No .json dependencies
  ✅ Procedurally generates frame rects/durations based on known sheet layout
  ✅ Works with 8 directions for Idle & Walk
*/

export class PlayerController {
  constructor(pos = vec2(0, 0), textureConfig = { idleStartIndex: 0, walkStartIndex: 8 }, ppu = 128) {
    this.pos = vec2(pos.x, pos.y);
    this.vel = vec2(0, 0);
    this.ppu = ppu;

    // ────────────────────────────────────────────────────────
    // Base speed and isometric correction ratio
    // tile width:height = 2:1 → rise/run fix ratio = 0.5
    // (adjust if your tiles differ from 256×128)
    // ────────────────────────────────────────────────────────
    this.tileRatio = 0.5;
    this.speed = 4 / this.ppu;
    this.direction = 0;
    this.state = 'idle';
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.frames = {};
    this.durations = {};
    this.ready = false;
    this.textureConfig = textureConfig;
    this.currentAnimKey = '';
  }

  async loadAllAnimations() {
    const dirs = Array.from({ length: 8 }, (_, i) => i + 1);

    // Idle: 22 frames, 256×256 each, grid 5×5 (sheet size 1280×1280)
    const idleMeta = { cols: 5, rows: 5, frameW: 256, frameH: 256, total: 22, duration: 1 / 12 };
    // Walk: 12 frames, 256×256 each, grid 4×3 (sheet size 1024×768)
    const walkMeta = { cols: 4, rows: 3, frameW: 256, frameH: 256, total: 12, duration: 1 / 12 };

    for (const d of dirs) {
      this.frames[`idle_${d}`] = this.generateFrames(idleMeta);
      this.frames[`walk_${d}`] = this.generateFrames(walkMeta);
      this.durations[`idle_${d}`] = Array(idleMeta.total).fill(idleMeta.duration);
      this.durations[`walk_${d}`] = Array(walkMeta.total).fill(walkMeta.duration);
    }

    this.ready = true;
  }

  generateFrames({ cols, rows, frameW, frameH, total }) {
    const frames = [];
    let count = 0;
    for (let y = 0; y < rows && count < total; y++) {
      for (let x = 0; x < cols && count < total; x++) {
        frames.push({ x: x * frameW, y: y * frameH, w: frameW, h: frameH });
        count++;
      }
    }
    return frames;
  }

  update() {
    if (!this.ready) return;

    const move = vec2(0, 0);
    if (keyIsDown('KeyW') || keyIsDown('ArrowUp')) move.y += 1;
    if (keyIsDown('KeyS') || keyIsDown('ArrowDown')) move.y -= 1;
    if (keyIsDown('KeyA') || keyIsDown('ArrowLeft')) move.x -= 1;
    if (keyIsDown('KeyD') || keyIsDown('ArrowRight')) move.x += 1;

    const isMoving = move.x || move.y;
    let newState = isMoving ? 'walk' : 'idle';
    let newDir = this.direction;

    if (isMoving) {
      const isoMove = vec2(move.x, move.y * this.tileRatio);
      const mag = Math.hypot(isoMove.x, isoMove.y);
      if (mag > 0) {
        this.vel = isoMove.scale(this.speed / mag);
        this.pos = this.pos.add(this.vel);
        const angle = Math.atan2(-move.y, move.x);
        newDir = this.angleToDir(angle);
      }
    } else {
      this.vel.set(0, 0);
    }

    setCameraPos(this.pos);

    const key = `${newState}_${newDir + 1}`;
    if (key !== this.currentAnimKey) {
      this.currentAnimKey = key;
      this.state = newState;
      this.direction = newDir;
      this.frameIndex = 0;
      this.frameTimer = 0;
    }

    const frames = this.frames[this.currentAnimKey] || [];
    const durations = this.durations[this.currentAnimKey] || [];
    if (!frames.length) return;

    this.frameTimer += timeDelta;
    const currentDur = durations[this.frameIndex] || (1 / 12);
    if (this.frameTimer >= currentDur) {
      this.frameTimer -= currentDur;
      this.frameIndex = (this.frameIndex + 1) % frames.length;
    }
  }

  angleToDir(a) {
    if (a < 0) a += Math.PI * 2;
    const offset = Math.PI / 8;
    const adjusted = (a + offset) % (Math.PI * 2);
    let rawDir = Math.floor(adjusted / (Math.PI / 4));
    rawDir = (rawDir + 5) % 8;
    return rawDir;
  }

  draw() {
    if (!this.ready) return;
    const frames = this.currentFrames();
    if (!frames.length) return;

    const f = frames[this.frameIndex];
    const texIndex = this.currentTextureIndex();
    const tile = new TileInfo(vec2(f.x, f.y), vec2(f.w, f.h), texIndex);
    const frameSize = vec2(f.w / 128, f.h / 128);
    drawTile(this.pos.add(vec2(0, 0.5)), frameSize, tile, undefined, 0, 0, Color.white);
  }

  setState(s) { this.state = s; }

  currentFrames() {
    const d = this.direction + 1;
    return this.frames[`${this.state}_${d}`] || [];
  }

  currentTextureIndex() {
    const base = this.state === 'walk'
      ? this.textureConfig.walkStartIndex
      : this.textureConfig.idleStartIndex;
    return base + this.direction;
  }
}
