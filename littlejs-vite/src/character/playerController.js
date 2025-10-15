// src/character/playerController.js
'use strict';
import {
  vec2, TileInfo, drawTile, keyIsDown, timeDelta, Color, setCameraPos,
} from 'littlejsengine';

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
    this.tileRatio = 0.5;   // TILE_H / TILE_W for iso projection
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
    for (const d of dirs) {
      try {
        const [idleData, walkData] = await Promise.all([
          fetch(`/assets/character/Idle/Businessman_Idle_dir${d}.json`).then(r => r.json()),
          fetch(`/assets/character/Walk/Businessman_Walk_dir${d}.json`).then(r => r.json()),
        ]);
        this.frames[`idle_${d}`] = idleData.frames.map(f => f.frame);
        this.frames[`walk_${d}`] = walkData.frames.map(f => f.frame);
        this.durations[`idle_${d}`] = idleData.frames.map(f => f.duration / 1000);
        this.durations[`walk_${d}`] = walkData.frames.map(f => f.duration / 1000);
      } catch (e) {
        console.warn(`Missing animation dir ${d}`, e);
      }
    }
    this.ready = true;
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
      // apply isometric ratio correction before normalization
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
