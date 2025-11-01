// src/map/itemSystem.js — 🧩 Atlas-based "take" animation integration for object pickup + loot particle shimmer
'use strict';
import {
  vec2, drawLine, Color, screenToWorld, mousePosScreen,
  mouseWasPressed, drawCanvas2D, clamp, ParticleEmitter
} from 'littlejsengine';
import { tmxPxToWorld } from './isoMath.js';
import { requestPointer } from '../ui/CursorManager.js';

function pointInPolygon(p, verts) {
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

function fillPolygon(pts, color) {
  if (!pts || pts.length < 3) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pos = vec2((minX + maxX) / 2, (minY + maxY) / 2);
  const size = vec2(maxX - minX || 0.001, maxY - minY || 0.001);
  drawCanvas2D(pos, size, 0, color, ctx => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x - pos.x, pts[0].y - pos.y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - pos.x, pts[i].y - pos.y);
    ctx.closePath();
    ctx.fillStyle = color.toString();
    ctx.fill();
  });
}

export class ItemSystem {
  constructor(map, PPU, onPickup) {
    this.map = map;
    this.PPU = PPU;
    this.onPickup = onPickup;
    this.items = [];
    this.enabled = true;
    this.hovered = null;
    this.lastHovered = null;
    this.fadeTimer = 0;
    this.activeTintTimer = 0;
  }

  loadFromMap() {
    const { objectLayers, mapData, TILE_W, TILE_H } = this.map;
    const { width, height } = mapData;
    if (!objectLayers) return;

    const layer = objectLayers.find(l => l.name === 'Items');
    if (!layer?.objects?.length) return;

    for (const obj of layer.objects) {
      const props = {};
      if (Array.isArray(obj.properties))
        for (const p of obj.properties) props[p.name] = p.value;

      const itemId = props.itemId || obj.name || `item_${obj.id}`;
      const requireWalkUp = props.requireWalkUp ?? true;
      let pos, polygon = null;

      if (obj.polygon?.length) {
        polygon = obj.polygon.map(pt => {
          const w = tmxPxToWorld(
            obj.x + pt.x, obj.y + pt.y,
            width, height, TILE_W, TILE_H, this.PPU, true
          );
          return vec2(w.x, w.y - TILE_H / 2);
        });
        const avg = polygon.reduce((a, b) => a.add(b), vec2()).scale(1 / polygon.length);
        pos = avg;
      } else {
        const w = tmxPxToWorld(
          obj.x, obj.y,
          width, height, TILE_W, TILE_H, this.PPU, true
        );
        pos = vec2(w.x, w.y - TILE_H / 2);
      }

      this.items.push({ id: obj.id, itemId, pos, polygon, requireWalkUp, taken: false });
    }
    console.log(`[ItemSystem] Loaded ${this.items.length} items`);
  }

  update(player) {
    if (!this.enabled) return;
    const feet = player.pos.add(player.feetOffset);
    const worldMouse = screenToWorld(mousePosScreen);
    let newHover = null;

    for (const item of this.items) {
      if (item.taken) continue;
      if (item.polygon && pointInPolygon(worldMouse, item.polygon)) {
        newHover = item;
        requestPointer();
        break;
      }
    }

    if (newHover !== this.hovered) {
      this.lastHovered = this.hovered;
      this.hovered = newHover;
    }

    this.fadeTimer = clamp(this.fadeTimer + (this.hovered ? 1 : -1) / 20, 0, 1);

    // 🟡 Click-to-walk logic (rerouted through ManeuverNodes)
    if (mouseWasPressed(0) && this.hovered && !this.hovered.taken) {
      window.__clickConsumed = true;
      const item = this.hovered;
      const nodes = window.scene?.map?.maneuverNodes || [];

      if (item.requireWalkUp) {
        let targetPos = item.pos;
        let path = player.buildSmartPath(targetPos);

        if (!path?.length && nodes.length) {
          const sorted = [...nodes].sort((a, b) =>
            a.pos.distance(item.pos) - b.pos.distance(item.pos)
          );
          let reachableNode = null;
          for (const n of sorted) {
            const testPath = player.buildSmartPath(n.pos);
            if (testPath?.length) {
              reachableNode = n;
              path = testPath;
              targetPos = n.pos;
              break;
            }
          }
          if (reachableNode)
            console.log(`[ItemSystem] Path to ${item.itemId} rerouted via node ${reachableNode.id}`);
          else
            console.warn(`[ItemSystem] No reachable node for ${item.itemId}`);
        }

        if (path?.length) {
          // assign movement but delay pickup until arrival
          player.path = path;
          player.pendingPickup = item;
          player.destinationMarker = item.pos;
          player.markerAlpha = 1.0;
          player.markerScale = 1.0;

          // 💫 restore particle emitter
          if (player.markerEmitter) {
            player.markerEmitter.emitRate = 0;
            player.markerEmitter.emitTime = 0;
            player.markerEmitter = null;
          }
          player.markerEmitter = new ParticleEmitter(
            item.pos, 0, 0.6, 0, 6, 0.2, undefined,
            new Color(0.9, 0.75, 0.3, 0.45),
            new Color(0.8, 0.6, 0.25, 0.4),
            new Color(0.4, 0.1, 0.0, 0.0),
            new Color(0.2, 0.0, 0.0, 0.0),
            1.5, 0.06, 0.02, 0.02, 0,
            0.98, 1, 0, 0.2, 0.15,
            0.1, false, true, true, 1e9
          );
        } else console.warn(`[ItemSystem] Cannot reach ${item.itemId}`);
      } else this.pickup(player, item);
    }

    // 🚶 Auto-pickup only when player has fully arrived
    if (player.pendingPickup) {
      const target = player.pendingPickup;
      const dist = feet.distance(target.pos);
      const arrived = dist < 0.8 && player.path.length === 0;
      if (!target.taken && arrived) {
        console.log(`[ItemSystem] ✅ Player arrived at ${target.itemId} — triggering pickup`);
        player.pendingPickup = null;
        this.pickup(player, target);
      }
    }

    // Manual interact key
    for (const item of this.items)
      if (!item.taken && item.requireWalkUp && feet.distance(item.pos) < 0.8 && player.interactPressed)
        this.pickup(player, item);

    // ✨ Loot indicator for unsearched items
    for (const item of this.items) {
      if (item.taken) {
        if (item.lootEmitter) {
          item.lootEmitter.emitRate = 0;
          item.lootEmitter.emitTime = 0.3;
          item.lootEmitter = null;
        }
        continue;
      }
      if (!item.lootEmitter) {
        item.lootEmitter = new ParticleEmitter(
          item.pos, 0, 0.6, 0, 4, 0.2, undefined,
  new Color(1.0, 0.9, 0.2, 0.5),    // vibrant gold  
  new Color(1.0, 0.8, 0.0, 0.4),  
  new Color(1.0, 0.5, 0.0, 0.0),    // fade to orange  
  new Color(0.8, 0.3, 0.0, 0.0),  
          1.4, 0.08, 0.02, 0.02, 0,
          0.98, 1, 0, 0.15, 0.12,
          0.1, false, true, true, 1e9
        );
      }
    }

    if (this.activeTintTimer > 0) this.activeTintTimer -= 1 / 60;
  }

  pickup(player, item) {
    if (item.taken) return;
    item.taken = true;
    this.activeTintTimer = 0.25;

    if (item.lootEmitter) {
      item.lootEmitter.emitRate = 0;
      item.lootEmitter.emitTime = 0.3;
      item.lootEmitter = null;
    }

    // 🧊 freeze movement but allow animation
    player.frozen = true;
    player.animating = true;

    const takeKey = `take_${player.direction + 1}`;

    if (player.frames[takeKey]) {
      console.log(`[ItemSystem] 🔹 Starting take animation for ${item.itemId} (dir ${player.direction + 1})`);

      player.state = 'take';
      player.frameIndex = 0;
      player.frameTimer = 0;
      player.currentAnimKey = takeKey;

      player.onceAnimationComplete = () => {
        console.log(`[ItemSystem] ✅ Take animation finished for ${item.itemId}`);
        player.frozen = false;
        player.animating = false;
        player.state = 'idle';
        player.frameIndex = 0;
        player.frameTimer = 0;
        player.currentAnimKey = `idle_${player.direction + 1}`;
        this.onPickup?.(item);
      };
    } else {
      console.warn(`[ItemSystem] Missing take animation for dir ${player.direction + 1}`);
      setTimeout(() => {
        player.frozen = false;
        player.animating = false;
        this.onPickup?.(item);
      }, 1200);
    }
  }

  drawDebug() {
    const poly = this.hovered || this.lastHovered;
    if (poly) this.renderHoverOverlay(poly);
  }

  renderHoverOverlay(item) {
    if (!item?.polygon?.length) return;
    const alpha = this.fadeTimer;
    const activeAlpha = Math.max(this.activeTintTimer * 2, alpha);
    const fillColor = this.activeTintTimer > 0
      ? new Color(1, 0.5, 0.1, 0.35 * activeAlpha)
      : new Color(1, 0.9, 0.2, 0.25 * alpha);
    const lineColor = this.activeTintTimer > 0
      ? new Color(1, 0.6, 0.1, 0.9 * activeAlpha)
      : new Color(1, 1, 0.3, 0.8 * alpha);

    fillPolygon(item.polygon, fillColor);
    for (let i = 0; i < item.polygon.length; i++) {
      const a = item.polygon[i];
      const b = item.polygon[(i + 1) % item.polygon.length];
      drawLine(a, b, 0.05, lineColor);
    }
  }
}
