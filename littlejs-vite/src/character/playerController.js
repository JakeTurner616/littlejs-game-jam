// src/character/playerController.js — Smooth Path Navigation + Direction-Stable Animation (no reset on same-direction nodes)
'use strict';
import {
  vec2, TileInfo, drawTile, keyIsDown, timeDelta, Color, setCameraPos,
  drawRect, drawEllipse, clamp, screenToWorld, mousePosScreen, mouseWasPressed,
  drawLine
} from 'littlejsengine';

export class PlayerController {
  constructor(pos = vec2(0, 0), textureCfg = { idleStartIndex: 0, walkStartIndex: 8 }, ppu = 128) {
    this.pos = vec2(pos.x, pos.y);
    this.ppu = ppu;
    this.tileRatio = 0.5;
    this.speed = 2.7 / this.ppu;

    this.direction = 0;         // 0..7
    this.state = 'idle';        // 'idle' | 'walk'
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.frames = {};
    this.durations = {};
    this.ready = false;
    this.textureCfg = textureCfg;
    this.currentAnimKey = '';

    this.mapColliders = [];
    this.feetOffset = vec2(0, 0.45);

    this.shadowScale = 1;
    this.shadowTarget = 1;
    this.shadowLerp = 5;

    this.clickTarget = null;
    this.path = [];
    this.reachThreshold = 0.1;
    this.smoothBlendDist = 0.25;

    this.debugLinks = [];
    this.debugNodes = [];
  }

  setColliders(c) { this.mapColliders = c || []; }

  /*────────────────────────── Animation Setup ──────────────────────────*/
  async loadAllAnimations() {
    const dirs = Array.from({ length: 8 }, (_, i) => i + 1);
    const idle = { cols: 9, rows: 9, frameW: 394, frameH: 504, total: 75, dur: 1 / 30 };
    const walk = { cols: 6, rows: 6, frameW: 394, frameH: 502, total: 31, dur: 1 / 30 };
    for (const d of dirs) {
      this.frames[`idle_${d}`] = this.genFrames(idle);
      this.frames[`walk_${d}`] = this.genFrames(walk);
      this.durations[`idle_${d}`] = Array(idle.total).fill(idle.dur);
      this.durations[`walk_${d}`] = Array(walk.total).fill(walk.dur);
    }
    this.ready = true;
  }
  genFrames({ cols, rows, frameW, frameH, total }) {
    const f = []; let n = 0;
    for (let y = 0; y < rows && n < total; y++)
      for (let x = 0; x < cols && n < total; x++, n++)
        f.push({ x: x * frameW, y: y * frameH, w: frameW, h: frameH });
    return f;
  }

  /*────────────────────────── Update ──────────────────────────*/
  update() {
    if (!this.ready) return;

    // Mouse click pathfinding
    if (mouseWasPressed(0)) {
      const target = screenToWorld(mousePosScreen);
      this.clickTarget = target;
      this.path = this.buildSmartPath(target);
      console.log(`[Path] Built with ${this.path.length} nodes`);
    }

    if (this.frozen) { setCameraPos(this.pos); return; }

    // Keyboard movement
    const keyMove =
      keyIsDown('KeyW') || keyIsDown('ArrowUp') ||
      keyIsDown('KeyS') || keyIsDown('ArrowDown') ||
      keyIsDown('KeyA') || keyIsDown('ArrowLeft') ||
      keyIsDown('KeyD') || keyIsDown('ArrowRight');

    const move = vec2(0, 0);
    if (keyMove) this.path = [];

    if (keyIsDown('KeyW') || keyIsDown('ArrowUp')) move.y += 1;
    if (keyIsDown('KeyS') || keyIsDown('ArrowDown')) move.y -= 1;
    if (keyIsDown('KeyA') || keyIsDown('ArrowLeft')) move.x -= 1;
    if (keyIsDown('KeyD') || keyIsDown('ArrowRight')) move.x += 1;

    const feet = this.pos.add(this.feetOffset);

    // ✅ Smooth blended path navigation with "sticky-walk" at nodes
  // ✅ Smooth blended path navigation with curved corner interpolation
if (!keyMove && this.path.length) {
  let next = this.path[0];
  const feet = this.pos.add(this.feetOffset);

  // --- Compute "curved" path segment using lookbehind/lookahead ---
  const prev = this.path.length > 1 ? feet : feet; // use current pos as fallback
  const next1 = this.path[0];
  const next2 = this.path[1] || next1;

  // direction vectors
  const dirA = next1.subtract(prev);
  const dirB = next2.subtract(next1);

  // normalized direction vectors
  const lenA = dirA.length(), lenB = dirB.length();
  const normA = lenA ? dirA.scale(1 / lenA) : vec2(0, 0);
  const normB = lenB ? dirB.scale(1 / lenB) : vec2(0, 0);

  // if we are close to the corner, start blending to the new direction
  const distToNext = feet.distance(next1);
  const t = clamp(1 - (distToNext / this.smoothBlendDist), 0, 1);

  // create a "turn curve" blend direction
  const curveDir = normA.scale(1 - t).add(normB.scale(t)).normalize ? normA.scale(1 - t).add(normB.scale(t)) : normA;
  const blendedNext = next1.add(curveDir.scale(0.5 * this.smoothBlendDist));

  // --- movement ---
  const delta = blendedNext.subtract(feet);
  const dist = delta.length();

  if (dist > this.reachThreshold) {
    move.x = delta.x;
    move.y = delta.y / this.tileRatio;
  } else {
    // reached this node
    this.path.shift();
    if (this.path.length) {
      const peek = this.path[0];
      const delta1 = peek.subtract(feet);
      move.x = delta1.x;
      move.y = delta1.y / this.tileRatio;
    }
  }
}
    // Decide state + direction
    const isMoving = (move.x !== 0 || move.y !== 0);
    const newState = isMoving ? 'walk' : 'idle';
    const oldDirection = this.direction;
    let newDir = oldDirection;

    const stepDist = this.speed * timeDelta * 60;
    this.shadowTarget = isMoving ? 1.15 : 1.0;
    this.shadowScale += (this.shadowTarget - this.shadowScale) * clamp(timeDelta * this.shadowLerp, 0, 1);

    if (isMoving) {
      const isoMove = vec2(move.x, move.y * this.tileRatio);
      const mag = Math.hypot(isoMove.x, isoMove.y);
      if (mag > 0) {
        const step = isoMove.scale(stepDist / mag);
        const nextFeet = feet.add(step);

        if (!this.pointInsideAnyCollider(nextFeet))
          this.pos = nextFeet.subtract(this.feetOffset);
        else
          this.path = [];

        const ang = Math.atan2(-move.y, move.x);
        newDir = this.angleToDir(ang);
      }
    }

    // ✅ Only rebuild key and possibly reset when state or discrete dir actually changed
    const directionChanged = newDir !== oldDirection;
    const stateChanged = newState !== this.state;

    if (stateChanged || directionChanged) {
      // Build key with the would-be state/dir
      const newKey = `${newState}_${newDir + 1}`;

      // Commit new state/dir
      this.state = newState;
      this.direction = newDir;

      // Only reset frames when entering idle OR direction changed
      if (newState === 'idle' || directionChanged) {
        this.frameIndex = 0;
        this.frameTimer = 0;
      }

      this.currentAnimKey = newKey;
    }

    if (!window.scene?.cinematicMode) setCameraPos(this.pos);

    const frames = this.frames[this.currentAnimKey] || [];
    if (!frames.length) return;
    this.frameTimer += timeDelta;
    if (this.frameTimer >= (this.durations[this.currentAnimKey]?.[this.frameIndex] || 1 / 30)) {
      this.frameTimer = 0;
      this.frameIndex = (this.frameIndex + 1) % frames.length;
    }
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
    drawRect(feet, vec2(0.06, 0.06), new Color(1, 0, 1, 1));

    for (let i = 0; i < this.path.length - 1; i++)
      drawLine(this.path[i], this.path[i + 1], 0.03, new Color(0, 1, 0, 0.4));

    for (const link of this.debugLinks)
      drawLine(link.a, link.b, 0.02, link.color);
    for (const node of this.debugNodes)
      drawRect(node.pos, vec2(0.05, 0.05), node.color);
  }

  drawShadow() {
    const p = this.pos.add(this.feetOffset);
    const r = 0.3 * this.shadowScale;
    drawEllipse(p, vec2(r * 1.8, r * 0.9), new Color(0, 0, 0, 0.25), 0);
  }

  /*────────────────────────── Pathfinding ──────────────────────────*/
  buildSmartPath(target) {
    const feetStart = this.pos.add(this.feetOffset);
    const feetGoal = target;
    const baseNodes = window.scene?.map?.maneuverNodes || [];
    this.debugLinks = [];
    this.debugNodes = [];

    if (this.rayClear(feetStart, feetGoal)) {
      this.debugLinks.push({ a: feetStart, b: feetGoal, color: new Color(0, 1, 0, 0.6) });
      return [feetGoal];
    }

    if (!baseNodes.length) return [];

    const nodes = new Map(baseNodes.map(n => [n.id, { ...n }]));
    const startNode = { id: 'start', pos: feetStart, connections: [] };
    const goalNode = { id: 'goal', pos: feetGoal, connections: [] };
    nodes.set('start', startNode);
    nodes.set('goal', goalNode);

    for (const n of baseNodes) {
      if (this.rayClear(feetStart, n.pos)) startNode.connections.push(n.id);
      if (this.rayClear(n.pos, feetGoal)) n.connections.push('goal');
    }

    const links = new Map();
    for (const [id, n] of nodes.entries()) {
      const adj = [];
      for (const cid of n.connections || []) {
        const t = nodes.get(cid);
        if (!t) continue;
        const clear = this.rayClear(n.pos, t.pos);
        this.debugLinks.push({
          a: n.pos, b: t.pos,
          color: clear ? new Color(1, 0.6, 0, 0.5) : new Color(1, 0, 0, 0.3),
        });
        if (clear) adj.push(t);
      }
      links.set(id, adj);
    }

    const open = [startNode];
    const came = new Map();
    const g = new Map([[startNode.id, 0]]);
    const h = (a, b) => (a?.pos && b?.pos) ? a.pos.distance(b.pos) : Infinity;

    while (open.length) {
      // ✅ Correct: pass node objects to h()
      open.sort((a, b) => (g.get(a.id) + h(a, goalNode)) - (g.get(b.id) + h(b, goalNode)));
      const current = open.shift();
      if (!current?.pos) continue;
      if (current.id === 'goal') break;

      for (const next of links.get(current.id) || []) {
        if (!next?.pos) continue;
        const cost = g.get(current.id) + current.pos.distance(next.pos);
        if (!g.has(next.id) || cost < g.get(next.id)) {
          g.set(next.id, cost);
          came.set(next.id, current);
          if (!open.includes(next)) open.push(next);
        }
      }
    }

    const path = [];
    let cur = goalNode;
    while (came.has(cur.id)) {
      const prev = came.get(cur.id);
      path.unshift(cur.pos);
      cur = prev;
    }

    if (!path.length) return [];

    for (let i = 0; i < path.length - 1; i++)
      this.debugLinks.push({ a: path[i], b: path[i + 1], color: new Color(0, 1, 0, 0.7) });

    return path;
  }

  /*────────────────────────── Collisions ──────────────────────────*/
  rayClear(a, b, step = 0.1) {
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
    if (!isFinite(dist) || dist <= 0) return false;
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let i = 0; i <= steps; i++) {
      const p = vec2(a.x + dx * (i / steps), a.y + dy * (i / steps));
      if (this.pointInsideAnyCollider(p)) return false;
    }
    return true;
  }

  pointInsideAnyCollider(p) {
    for (const c of this.mapColliders)
      if (this.pointInPoly(p, c.pts)) return true;
    return false;
  }

  pointInPoly(p, v) {
    let inside = false;
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
      const xi = v[i].x, yi = v[i].y, xj = v[j].x, yj = v[j].y;
      const inter = ((yi > p.y) !== (yj > p.y)) &&
        (p.x < (xj - xi) * (p.y - yi) / ((yj - yi) || 1e-9) + xi);
      if (inter) inside = !inside;
    }
    return inside;
  }

  angleToDir(a) {
    if (a < 0) a += Math.PI * 2;
    const off = Math.PI / 8;
    return (Math.floor(((a + off) % (2 * Math.PI)) / (Math.PI / 4)) + 5) % 8;
  }

  currentFrames() { return this.frames[`${this.state}_${this.direction + 1}`] || []; }

  currentTextureIndex() {
    const base = this.state === 'walk'
      ? this.textureCfg.walkStartIndex
      : this.textureCfg.idleStartIndex;
    return base + this.direction;
  }
}
