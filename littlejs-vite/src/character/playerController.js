// src/character/playerController.js — fixed to respect cinematicMode flag
'use strict';
import {
  vec2, TileInfo, drawTile, keyIsDown, timeDelta, Color, setCameraPos,
  drawRect, ParticleEmitter, drawEllipse, clamp
} from 'littlejsengine';

/*
  PlayerController — LittleMan (PixelOver export)
  -----------------------------------------------
  ✅ Reads 394×504 / 394×502 sprites
  ✅ Auto-scales to match ~256×256 world height
  ✅ Adds footstep particles and dynamic shadow
  ✅ Frame-rate independent movement speed fix
  ✅ Respects cinematic camera override
*/

export class PlayerController {
  constructor(pos = vec2(0, 0), textureConfig = { idleStartIndex: 0, walkStartIndex: 8 }, ppu = 128) {
    this.pos = vec2(pos.x, pos.y);
    this.vel = vec2(0, 0);
    this.ppu = ppu;

    this.tileRatio = 0.5;
    this.speed = 4 / this.ppu; // base world-units per second
    this.direction = 0;
    this.state = 'idle';
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.frames = {};
    this.durations = {};
    this.ready = false;
    this.textureConfig = textureConfig;
    this.currentAnimKey = '';

    this.mapColliders = [];
    this.feetOffset = vec2(0, 0.45);

    this.footstepTimer = 0;
    this.footstepInterval = 0.18;

    this.shadowScale = 1.0;
    this.shadowTargetScale = 1.0;
    this.shadowLerpSpeed = 5.0;
  }

  setColliders(colliders) { this.mapColliders = colliders || []; }

  async loadAllAnimations() {
    const dirs = Array.from({ length: 8 }, (_, i) => i + 1);
    const idleMeta = { cols: 9, rows: 9, frameW: 394, frameH: 504, total: 75, duration: 1 / 30 };
    const walkMeta = { cols: 6, rows: 6, frameW: 394, frameH: 502, total: 31, duration: 1 / 30 };

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

    // ✅ Frame-rate independent movement
    const baseSpeed = this.speed;
    const stepDist = baseSpeed * timeDelta * 60;

    // Shadow growth/shrink
    this.shadowTargetScale = isMoving ? 1.15 : 1.0;
    const t = clamp(timeDelta * this.shadowLerpSpeed, 0, 1);
    this.shadowScale += (this.shadowTargetScale - this.shadowScale) * t;

    if (isMoving) {
      const isoMove = vec2(move.x, move.y * this.tileRatio);
      const mag = Math.hypot(isoMove.x, isoMove.y);
      if (mag > 0) {
        const step = isoMove.scale(stepDist / mag);
        const nextPos = this.pos.add(step);
        const feet = nextPos.add(this.feetOffset);
        if (!this.pointInsideAnyCollider(feet)) {
          this.pos = nextPos;
          this.footstepTimer += timeDelta;
          if (this.footstepTimer >= this.footstepInterval) {
            this.footstepTimer = 0;
            this.emitFootstepParticle(move);
          }
        } else this.vel.set(0, 0);
        const angle = Math.atan2(-move.y, move.x);
        newDir = this.angleToDir(angle);
      }
    } else {
      this.vel.set(0, 0);
      this.footstepTimer = 0;
    }

    // ✅ Prevent camera override during cinematic mode
    if (!window.scene?.cinematicMode) {
      setCameraPos(this.pos);
    }

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
    const currentDur = durations[this.frameIndex] || (1 / 30);
    if (this.frameTimer >= currentDur) {
      this.frameTimer -= currentDur;
      this.frameIndex = (this.frameIndex + 1) % frames.length;
    }
  }

  emitFootstepParticle(moveDir = vec2(0, 0)) {
    const feetPos = this.pos.add(this.feetOffset);
    const speed = 0.01 + Math.random() * 0.03;
    const angle = Math.atan2(-moveDir.y, moveDir.x) + (Math.random() - 0.5) * 0.3;
    const sidewaysOffset = vec2(Math.sin(angle) * 0.02, -Math.cos(angle) * 0.02);
    const pos = feetPos.add(sidewaysOffset);

    new ParticleEmitter(
      pos, angle,
      0.05, 0, 0, 0.4,
      undefined,
      new Color(0.3, 0.25, 0.2, 0.35),
      new Color(0.4, 0.35, 0.3, 0.25),
      new Color(0.3, 0.25, 0.2, 0),
      new Color(0.4, 0.35, 0.3, 0),
      0.25 + Math.random() * 0.1,
      0.02, 0.05,
      speed, 0,
      0.9, 0.9, 0, 0.4, 0.15,
      0.2, false, false, true, -1
    ).emitParticle();
  }

  drawShadow() {
    const shadowPos = this.pos.add(this.feetOffset);
    const baseRadius = 0.3 * this.shadowScale;
    const width = baseRadius * 1.8;
    const height = baseRadius * 0.9;

    const pos = vec2(shadowPos.x, shadowPos.y);
    const outer = vec2(width * 1.2, height * 1.2);
    const inner = vec2(width, height);

    drawEllipse(pos, outer, new Color(0, 0, 0, 0.08), 0);
    drawEllipse(pos, inner, new Color(0, 0, 0, 0.25), 0);
  }

  pointInsideAnyCollider(p) {
    for (const c of this.mapColliders)
      if (this.pointInPolygon(p, c.pts)) return true;
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

    const scaleFactor = 256 / 504;
    const frameSize = vec2(
      (f.w / this.ppu) * scaleFactor,
      (f.h / this.ppu) * scaleFactor
    );

    // Draw shadow first
    this.drawShadow();

    // Draw sprite slightly above feet
    drawTile(this.pos.add(vec2(0, 0.5)), frameSize, tile, undefined, 0, 0, Color.white);

    // DEBUG: visualize world feet position
    const feet = this.pos.add(this.feetOffset);
    drawRect(feet, vec2(0.06, 0.06), new Color(1, 0, 1, 1));
  }

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
