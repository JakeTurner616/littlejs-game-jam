// src/map/mapRenderer.js
import { drawTile, drawLine, drawText, hsl, rgb, drawRect, vec2 } from 'littlejsengine';
import { isoToWorld, tmxPxToWorld } from './isoMath.js';

export function renderMap(map, PPU, cameraPos) {
  if (!map.mapData) return;
  const { mapData, rawImages, tileInfos, layers, objectLayers, colliders, TILE_W, TILE_H } = map;
  const { width, height } = mapData;

  // Background
  drawRect(vec2(0, 0), vec2(9999, 9999), hsl(0, 0, 0.15));

  // ──────────────────────────────────────────────
  // TILE LAYERS
  // ──────────────────────────────────────────────
  for (const layer of layers) {
    const data = layer.data;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const gid = data[r * width + c];
        if (!gid) continue;
        const img = rawImages[gid];
        const tinfo = tileInfos[gid];
        const p = isoToWorld(c, r, width, height, TILE_W, TILE_H);
        const drawSize = vec2(img.width / PPU, img.height / PPU);
        const offsetY = (img.height - mapData.tileheight) / PPU;
        const drawPos = vec2(p.x, p.y - offsetY);
        drawTile(drawPos, drawSize, tinfo);
      }
    }
  }

  // ──────────────────────────────────────────────
  // OBJECT LAYER DEBUG DRAW
  // ──────────────────────────────────────────────
  for (const layer of objectLayers) {
    for (const obj of layer.objects) {
      if (!obj.polygon) continue;
      const pts = obj.polygon.map(pt => {
        const w = tmxPxToWorld(obj.x + pt.x, obj.y + pt.y, width, height - 8, TILE_W, TILE_H, PPU);
        return vec2(w.x, w.y);
      });
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        drawLine(a, b, 0.015, rgb(1, 0.5, 0));
      }
    }
  }

  // ──────────────────────────────────────────────
  // COLLISION LAYER DEBUG DRAW
  // ──────────────────────────────────────────────
  if (colliders?.length) {
    for (const col of colliders) {
      const pts = col.pts;
      if (!pts || pts.length < 2) continue;

      // Draw polygon edges
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        drawLine(a, b, 0.03, rgb(1, 0, 0));
      }

      // Optional label at polygon centroid
      const centroid = pts.reduce((acc, p) => acc.add(p), vec2(0, 0)).scale(1 / pts.length);
      drawText(`#${col.id}`, centroid.add(vec2(0, 0.1)), 0.3, rgb(1, 0, 0), 0.02, rgb(0, 0, 0), 'center');
    }
  }
}