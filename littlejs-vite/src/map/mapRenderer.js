// src/map/mapRenderer.js
import { drawTile, drawLine, hsl, rgb, drawRect, vec2 } from 'littlejsengine';
import { isoToWorld, tmxPxToWorld } from './isoMath.js';

export function renderMap(map, PPU, cameraPos) {
  if (!map.mapData) return;
  const { mapData, rawImages, tileInfos, layers, objectLayers, TILE_W, TILE_H } = map;
  const { width, height } = mapData;

  // Background
  drawRect(vec2(0, 0), vec2(9999, 9999), hsl(0, 0, 0.15));

  // Draw all tile layers
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

  // Optional: object layer debug draw (disabled by default)
  /*
  for (const layer of objectLayers) {
    for (const obj of layer.objects) {
      if (!obj.polygon) continue;
      const pts = obj.polygon.map(pt => {
        const w = tmxPxToWorld(obj.x + pt.x, obj.y + pt.y, width, height, TILE_W, TILE_H, PPU);
        return vec2(w.x, w.y);
      });
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        drawLine(a, b, 0.02, rgb(1, 0, 0));
      }
    }
  }
  */
}
