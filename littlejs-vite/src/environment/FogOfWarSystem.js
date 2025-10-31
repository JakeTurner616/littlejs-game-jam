// src/environment/FogOfWarSystem.js — persistent reveal memory
'use strict';
import {
  vec2, Color, overlayContext, mainCanvas, cameraPos, cameraScale
} from 'littlejsengine';
import { tmxPxToWorld } from '../map/isoMath.js';

export class FogOfWarSystem {
  constructor() {
    this.areas = [];
    this.enabled = true;
    this.fillColor = new Color(0, 0, 0, 0.94);
    this.revealedSet = new Set(); // 🔒 persistent memory
    this.currentMapKey = null;
  }

  loadFromMap(map) {
    if (!map?.objectLayers) return;
    const fogLayer = map.objectLayers.find(l => l.name === 'FogofWar');
    if (!fogLayer?.objects?.length) {
      console.warn('[FogOfWarSystem] No FogofWar layer found');
      return;
    }

    // use map name or file path as a key
    this.currentMapKey = map.mapData?.name || map.mapData?.tiledversion || 'unknown_map';

    const { mapData, TILE_W, TILE_H } = map;
    const { width, height } = mapData;

    this.areas = fogLayer.objects.map(obj => {
      if (!obj.polygon) return null;
      const props = Object.fromEntries((obj.properties || []).map(p => [p.name, p.value]));
      const revealOnEventId = props.revealOnEventId || null;
      const pts = obj.polygon.map(pt => {
        const w = tmxPxToWorld(
          obj.x + pt.x,
          obj.y + pt.y,
          width, height, TILE_W, TILE_H,
          map.PPU || 128, true
        );
        return vec2(w.x, w.y - TILE_H / 2);
      });

      const name = obj.name || `fog_${obj.id}`;
      const key = `${this.currentMapKey}:${name}`;
      const alreadyRevealed = this.revealedSet.has(key);

      return {
        id: obj.id,
        name,
        pts,
        hidden: !alreadyRevealed,
        revealOnEventId
      };
    }).filter(Boolean);

    console.log(`[FogOfWarSystem] Loaded ${this.areas.length} fog areas for map '${this.currentMapKey}'`);
  }

  revealByEvent(eventId) {
    if (!eventId) return;
    let count = 0;
    for (const a of this.areas) {
      if (a.revealOnEventId === eventId && a.hidden) {
        a.hidden = false;
        this.revealedSet.add(`${this.currentMapKey}:${a.name}`);
        count++;
      }
    }
    if (count)
      console.log(`[FogOfWarSystem] Revealed ${count} fog areas linked to '${eventId}'`);
  }

  revealAll() {
    for (const a of this.areas) {
      a.hidden = false;
      this.revealedSet.add(`${this.currentMapKey}:${a.name}`);
    }
  }

  resetAll() {
    for (const a of this.areas) a.hidden = true;
  }

  render() {
    if (!this.enabled || !this.areas.length) return;
    const ctx = overlayContext, scale = cameraScale, cam = cameraPos;
    const worldToScreen = p => vec2(
      (p.x - cam.x) * scale + mainCanvas.width / 2,
      (p.y - cam.y) * -scale + mainCanvas.height / 2
    );

    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.beginPath();

    for (const area of this.areas) {
      if (!area.hidden || area.pts.length < 3) continue;
      const pts = area.pts.map(worldToScreen);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
    }

    ctx.fillStyle = `rgba(0,0,0,${this.fillColor.a})`;
    ctx.fill();
    ctx.restore();
  }
}
