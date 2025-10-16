// src/character/meleeCharacterController.js
'use strict';
import {
  vec2, TileInfo, drawTile, keyIsDown, timeDelta, Color, setCameraPos,
  textureInfos
} from 'littlejsengine';
import { BOXER_TEXTURE_BASE } from '../main.js';

/*
  MeleeCharacterController — auto-grid aware version
  ---------------------------------------------------
  ✅ Detects sprite sheet width/height dynamically
  ✅ Uses real frame counts (Idle1=31, WalkFoward=24)
  ✅ Works with 126×132 frames, no more 256×256 scaling errors
*/

export class MeleeCharacterController {
  constructor(pos = vec2(0, 0), ppu = 128) {
    this.pos = vec2(pos.x, pos.y);
    this.vel = vec2(0, 0);
    this.ppu = ppu;
    this.tileRatio = 0.5;
    this.speed = 4.5 / this.ppu;

    this.direction = 0;
    this.state = 'Idle1';
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.frames = {};
    this.durations = {};
    this.ready = false;
    this.currentAnimKey = '';
    this.textureBase = BOXER_TEXTURE_BASE;

    // Real frame counts per anim
    this.animationMeta = {
      Idle1:      { total: 31, fps: 8 },
      WalkFoward: { total: 24, fps: 12 },
    };

    // Real frame pixel size
    this.frameW = 126;
    this.frameH = 132;
  }

  async loadAllAnimations() {
    const dirs = Array.from({ length: 8 }, (_, i) => i + 1);

    for (const [name, meta] of Object.entries(this.animationMeta)) {
      for (const d of dirs) {
        const texIndex = this.textureBase + (name === 'WalkFoward' ? 8 : 0) + (d - 1);
        const texInfo = textureInfos[texIndex];
        const sheetW = texInfo.image.width;
        const sheetH = texInfo.image.height;

        // Estimate grid dimensions automatically
        const cols = Math.floor(sheetW / this.frameW);
        const rows = Math.ceil(meta.total / cols);

        const key = `${name}_${d}`;
        this.frames[key] = this.generateFrames({
          cols, rows,
          w: this.frameW, h: this.frameH,
          total: meta.total
        });
        this.durations[key] = Array(meta.total).fill(1 / meta.fps);
      }
    }

    this.ready = true;
  }

  generateFrames({ cols, rows, w, h, total }) {
    const frames = [];
    let i = 0;
    for (let y = 0; y < rows && i < total; y++) {
      for (let x = 0; x < cols && i < total; x++, i++) {
        frames.push({ x: x * w, y: y * h, w, h });
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
    let newState = isMoving ? 'WalkFoward' : 'Idle1';
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
    } else this.vel.set(0, 0);

    setCameraPos(this.pos);
    const key = `${newState}_${newDir + 1}`;
    if (key !== this.currentAnimKey) {
      this.currentAnimKey = key;
      this.state = newState;
      this.direction = newDir;
      this.frameIndex = 0;
      this.frameTimer = 0;
    }

    const frames = this.frames[key] || [];
    const durations = this.durations[key] || [];
    if (!frames.length) return;

    this.frameTimer += timeDelta;
    const dur = durations[this.frameIndex] || (1 / 12);
    if (this.frameTimer >= dur) {
      this.frameTimer -= dur;
      this.frameIndex = (this.frameIndex + 1) % frames.length;
    }
  }

  angleToDir(a) {
    if (a < 0) a += Math.PI * 2;
    const offset = Math.PI / 8;
    const adjusted = (a + offset) % (Math.PI * 2);
    return (Math.floor(adjusted / (Math.PI / 4)) + 5) % 8;
  }

  draw() {
    if (!this.ready) return;
    const frames = this.currentFrames();
    const f = frames[this.frameIndex];
    if (!f) return;
    const texIndex = this.currentTextureIndex();
    const tile = new TileInfo(vec2(f.x, f.y), vec2(f.w, f.h), texIndex);
    const frameSize = vec2(f.w / 128, f.h / 128);
    drawTile(this.pos.add(vec2(0, 0.5)), frameSize, tile, undefined, 0, 0, Color.white);
  }

  currentFrames() {
    return this.frames[`${this.state}_${this.direction + 1}`] || [];
  }

  currentTextureIndex() {
    const base = this.state === 'WalkFoward' ? 8 : 0;
    return this.textureBase + base + this.direction;
  }
}
