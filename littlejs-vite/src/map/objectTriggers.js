// src/map/objectTriggers.js
'use strict';
import { vec2, drawLine, Color } from 'littlejsengine';
import { tmxPxToWorld } from './isoMath.js';

/**
 * ObjectTriggerEventSystem — polygon-based world triggers
 * --------------------------------------------------------
 * • Reads Tiled object layer named "ObjectTriggers"
 * • Uses polygon containment instead of radius
 * • Only draws debug polygons when debug mode is active
 */
export class ObjectTriggerEventSystem {
  constructor(map, PPU, onEvent) {
    this.map = map;
    this.PPU = PPU;
    this.onEvent = onEvent;
    this.enabled = true;
    this.triggers = [];
    this.visited = new Set();
    this.debugEnabled = false; // ✅ debug toggle

    if (typeof window !== 'undefined') {
      window.resetAllTriggers = () => this.resetAll();
      window.toggleTriggerDebug = () => {
        this.debugEnabled = !this.debugEnabled;
        console.log(
          `%c[ObjectTriggerEventSystem] Debug mode → ${this.debugEnabled ? 'ON' : 'OFF'}`,
          'color:#0ff;font-weight:bold;'
        );
      };
    }
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
      let props = {};
      if (Array.isArray(obj.properties)) for (const p of obj.properties) props[p.name] = p.value;
      else if (typeof obj.properties === 'object') props = obj.properties;

      const eventId = props.eventId || props.EventID || props.EVENTID;
      const repeatable = props.repeatable ?? false;
      const once = !repeatable;

      // Compute polygon
      let polyPts = [];
      if (obj.polygon?.length) {
        polyPts = obj.polygon.map(pt => {
          const w = tmxPxToWorld(obj.x + pt.x, obj.y + pt.y, width, height, TILE_W, TILE_H, PPU, true);
          return vec2(w.x, w.y - TILE_H / 2);
        });
      } else {
        // fallback single-point marker
        const w = tmxPxToWorld(obj.x, obj.y, width, height, TILE_W, TILE_H, PPU, true);
        polyPts = [vec2(w.x, w.y - TILE_H / 2)];
      }

      this.triggers.push({
        id: obj.id,
        name: obj.name || `trigger_${obj.id}`,
        eventId,
        once,
        active: false,
        properties: props,
        polyPts,
      });
    }

    console.log(`[ObjectTriggerEventSystem] Loaded ${this.triggers.length} polygon triggers`);
  }

  /*───────────────────────────────────────────────
    UPDATE — Polygon-based hit test
  ────────────────────────────────────────────────*/
  update(playerPos, playerFeetOffset) {
    if (!this.enabled || !this.triggers.length) return;
    const feet = playerPos.add(playerFeetOffset);

    for (const t of this.triggers) {
      const inside = this.pointInsidePolygon(feet, t.polyPts);

      if (inside && !t.active) {
        const key = `${t.id}:${t.eventId}`;
        if (t.once && this.visited.has(key)) continue;
        this.visited.add(key);

        console.log(`[ObjectTrigger] Fired '${t.eventId}' inside ${t.name}`);
        this.onEvent?.(t);
        t.active = true;
      }

      if (!inside && t.active) t.active = false;
    }
  }

  /*───────────────────────────────────────────────
    POINT-IN-POLYGON TEST
  ────────────────────────────────────────────────*/
  pointInsidePolygon(point, poly) {
    if (!poly?.length) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /*───────────────────────────────────────────────
    DEBUG DRAW — exact polygon outlines (only in debug)
  ────────────────────────────────────────────────*/
  drawDebug() {
    if (!this.debugEnabled || !this.triggers.length) return; // ✅ only draw in debug
    const teal = new Color(0, 0.9, 0.9, 0.8);
    for (const t of this.triggers) {
      if (t.polyPts?.length >= 3) {
        const pts = t.polyPts;
        for (let i = 0; i < pts.length; i++)
          drawLine(pts[i], pts[(i + 1) % pts.length], 0.05, teal);
      } else if (t.polyPts?.length === 1) {
        const p = t.polyPts[0];
        drawLine(vec2(p.x - 0.05, p.y), vec2(p.x + 0.05, p.y), 0.04, teal);
        drawLine(vec2(p.x, p.y - 0.05), vec2(p.x, p.y + 0.05), 0.04, teal);
      }
    }
  }

  /*───────────────────────────────────────────────
    RESET HELPERS
  ────────────────────────────────────────────────*/
  reset() {
    this.visited.clear();
    for (const t of this.triggers) t.active = false;
  }

  resetAll() {
    console.log('[ObjectTriggerEventSystem] All triggers reset manually');
    this.reset();
  }
}