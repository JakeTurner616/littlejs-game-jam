// src/map/objectTriggers.js
'use strict';
import { vec2 } from 'littlejsengine';
import { tmxPxToWorld } from './isoMath.js';

/**
 * ObjectTriggerEventSystem — proximity-based world triggers
 * ---------------------------------------------------------
 * • Reads Tiled object layer named "ObjectTriggers"
 * • Supports pixel, tile, or hybrid coordinate placement
 * • Each object defines { eventId, radius, repeatable, tile_c, tile_r, direction, etc. }
 */
export class ObjectTriggerEventSystem {
  constructor(map, PPU, onEvent) {
    this.map = map;
    this.PPU = PPU;
    this.onEvent = onEvent;
    this.enabled = true;
    this.triggers = [];
    this.visited = new Set();
  }

  /*───────────────────────────────────────────────
    LOAD FROM MAP DATA
  ────────────────────────────────────────────────*/
  loadFromMap() {
    const { objectLayers, mapData, TILE_W, TILE_H } = this.map;
    const { width, height } = mapData;
    const PPU = this.PPU;
    if (!objectLayers) return;

    const layer = objectLayers.find(l => l.name === 'ObjectTriggers');
    if (!layer?.objects?.length) return;

    for (const obj of layer.objects) {
      // 🧠 Normalize properties
      let props = {};
      if (Array.isArray(obj.properties)) {
        for (const p of obj.properties) props[p.name] = p.value;
      } else if (typeof obj.properties === 'object') {
        props = obj.properties;
      }

      const eventId = props.eventId || props.EventID || props.EVENTID;
      const repeatable = props.repeatable ?? false;
      const radius = props.radius ?? 0.4;
      const once = !repeatable;
      const allProps = props;

      // ✅ Tile-based coordinate support
      let pos;
      if (props.tile_c !== undefined && props.tile_r !== undefined) {
        const c = Number(props.tile_c);
        const r = Number(props.tile_r);
        const pxX = c * TILE_W;
        const pxY = r * TILE_H;
        const w = tmxPxToWorld(pxX, pxY, width, height, TILE_W, TILE_H, PPU, true);
        pos = vec2(w.x, w.y - TILE_H / 2);
      } else {
        // fallback: use object pixel coordinates
        const w = tmxPxToWorld(obj.x, obj.y, width, height, TILE_W, TILE_H, PPU, true);
        pos = vec2(w.x, w.y - TILE_H / 2);
      }

      this.triggers.push({
        id: obj.id,
        name: obj.name || `trigger_${obj.id}`,
        eventId,
        pos,
        radius,
        once,
        active: false,
        properties: allProps,
      });
    }

    console.log(`[ObjectTriggerEventSystem] Loaded ${this.triggers.length} triggers`);
  }

  /*───────────────────────────────────────────────
    UPDATE EACH FRAME
  ────────────────────────────────────────────────*/
  update(playerPos, playerFeetOffset) {
    if (!this.enabled || !this.triggers.length) return;
    const feet = playerPos.add(playerFeetOffset);

    for (const t of this.triggers) {
      const dist = feet.subtract(t.pos).length();
      const within = dist <= t.radius;

      if (within && !t.active) {
        const key = `${t.id}:${t.eventId}`;
        if (t.once && this.visited.has(key)) continue;
        this.visited.add(key);

        console.log(`[ObjectTrigger] Fired '${t.eventId}' near ${t.name}`);
        this.onEvent?.(t);
        t.active = true;
      }

      if (!within && t.active) {
        t.active = false;
      }
    }
  }

  drawDebug(drawCircle) {
    if (!this.triggers.length || !drawCircle) return;
    for (const t of this.triggers) {
      const c = t.active ? 0.4 : 0;
      const color = { r: 1, g: 0.7 + c, b: 0.2 + c, a: 0.5 };
      drawCircle(t.pos, t.radius, color);
    }
  }

  reset() {
    this.visited.clear();
    for (const t of this.triggers) t.active = false;
  }
}