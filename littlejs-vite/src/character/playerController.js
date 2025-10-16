// src/character/playerController.js
'use strict';
import {
  vec2, TileInfo, drawTile, keyIsDown, timeDelta, Color, setCameraPos, drawRect,
} from 'littlejsengine';

/*
  PlayerController — self-contained animation generator + map collider support
  ---------------------------------------------------------------------------
  ✅ Procedurally generates frame rects/durations
  ✅ Supports 8 directions
  ✅ Uses map.colliders as solid boundaries (point-in-polygon feet test)
  ✅ Draws a blue debug rect showing the current feet position
*/

export class PlayerController {
  constructor(pos = vec2(0, 0), textureConfig = { idleStartIndex: 0, walkStartIndex: 8 }, ppu = 128) {
    this.pos = vec2(pos.x, pos.y);
    this.vel = vec2(0, 0);
    this.ppu = ppu;

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

    this.mapColliders = []; // populated externally
    this.feetOffset = vec2(0, 0.45); // where the feet are relative to pos
  }

  setColliders(colliders) { this.mapColliders = colliders || []; }

  async loadAllAnimations() {
    const dirs = Array.from({ length: 8 }, (_, i) => i + 1);
    const idleMeta = { cols: 5, rows: 5, frameW: 256, frameH: 256, total: 22, duration: 1 / 12 };
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
        const step = isoMove.scale(this.speed / mag);
        const nextPos = this.pos.add(step);
        const feet = nextPos.add(this.feetOffset);

        // ─────────────── Collision Boundary Check ───────────────
        if (!this.pointInsideAnyCollider(feet)) {
          this.pos = nextPos;
          this.vel = step;
        } else {
          // rollback / block movement
          this.vel.set(0, 0);
        }

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

  /** Point-in-polygon test (odd–even rule) */
  pointInsideAnyCollider(point) {
    for (const collider of this.mapColliders) {
      if (this.pointInPolygon(point, collider.pts)) return true;
    }
    return false;
  }

  pointInPolygon(p, verts) {
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
      const xi = verts[i].x, yi = verts[i].y;
      const xj = verts[j].x, yj = verts[j].y;
      const intersect = ((yi > p.y) !== (yj > p.y)) &&
        (p.x < (xj - xi) * (p.y - yi) / ((yj - yi) || 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
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

    // ─────────────── Feet Debug Rect ───────────────
    const feet = this.pos.add(this.feetOffset);
    drawRect(feet, vec2(0.08, 0.04), new Color(0, 0.6, 1, 0.8));
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