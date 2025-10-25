// src/environment/FogOfWarSystem.js
'use strict';
import {
  vec2, Color, overlayContext, mainCanvas, cameraPos, cameraScale
} from 'littlejsengine';
import { tmxPxToWorld } from '../map/isoMath.js';

/**
 * FogOfWarSystem
 * ---------------------------------------------------------------------
 * • Reads polygons from Tiled "FogofWar" object layer
 * • Uses identical world-space projection math as colliders & depth polygons
 * • Draws filled fog polygons aligned to the map
 * • Uses destination-over composite mode to ensure lightning renders above
 * ---------------------------------------------------------------------
 */
export class FogOfWarSystem {
  constructor() {
    this.areas = [];
    this.enabled = true;
    this.fillColor = new Color(0, 0, 0, 0.94);
  }

  loadFromMap(map) {
    if (!map?.objectLayers) return;
    const { mapData, TILE_W, TILE_H } = map;
    const { width, height } = mapData;

    const fogLayer = map.objectLayers.find(l => l.name === 'FogofWar');
    if (!fogLayer?.objects?.length) {
      console.warn('[FogOfWarSystem] No FogofWar layer found in map');
      return;
    }

    // ✅ Same world-space math as collision/depth polygons
    this.areas = fogLayer.objects.map(obj => {
      if (!obj.polygon) return null;

      const pts = obj.polygon.map(pt => {
        const w = tmxPxToWorld(
          obj.x + pt.x,
          obj.y + pt.y,
          width,
          height,
          TILE_W,
          TILE_H,
          map.PPU || 128,
          true
        );
        // Align to world like colliders
        return vec2(w.x, w.y - TILE_H / 2);
      });

      return {
        id: obj.id,
        name: obj.name || `fog_${obj.id}`,
        pts,
        hidden: true,
      };
    }).filter(Boolean);

    console.log(`[FogOfWarSystem] Loaded ${this.areas.length} fog polygons`);
  }

  revealArea(idOrName) {
    for (const a of this.areas)
      if (a.id === idOrName || a.name === idOrName)
        a.hidden = false;
  }

  revealAll() { for (const a of this.areas) a.hidden = false; }
  resetAll()  { for (const a of this.areas) a.hidden = true; }

  /*───────────────────────────────────────────────
   * Render — aligned world fog below lightning
   *───────────────────────────────────────────────*/
  render() {
    if (!this.enabled || !this.areas.length) return;

    const ctx = overlayContext;
    const scale = cameraScale;
    const cam = cameraPos;

    // world→screen conversion (identical to drawTile)
    const worldToScreen = p => vec2(
      (p.x - cam.x) * scale + mainCanvas.width  / 2,
      (p.y - cam.y) * -scale + mainCanvas.height / 2
    );

    ctx.save();
    // ✅ ensures lightning (overlay) draws *above* this fog
    ctx.globalCompositeOperation = 'destination-over';
    ctx.beginPath();

    // Combine all hidden areas into one fill pass
    for (const area of this.areas) {
      if (!area.hidden || area.pts.length < 3) continue;
      const pts = area.pts.map(worldToScreen);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++)
        ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
    }

    ctx.fillStyle = `rgba(0,0,0,${this.fillColor.a})`;
    ctx.fill();
    ctx.restore();
  }
}
