// src/map/wallUtils.js — 🧱 Wall parsing + depth calculations
'use strict';
import { vec2 } from 'littlejsengine';
import { tmxPxToWorld } from './isoMath.js';

/*───────────────────────────────────────────────
  DEPTH Y AT X HELPER
───────────────────────────────────────────────*/
export function getPolygonDepthYAtX(p, poly) {
  const x = p.x;
  let nearest = null, minDist = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    const dx = b.x - a.x;
    if (Math.abs(dx) < 1e-6) continue;
    const t = (x - a.x) / dx;
    if (t < 0 || t > 1) continue;
    const y = a.y + (b.y - a.y) * t;
    const dy = Math.abs(p.y - y);
    if (y <= p.y && dy < minDist) { minDist = dy; nearest = y; }
  }
  return nearest;
}

/*───────────────────────────────────────────────
  WALL POLYGON PARSER
───────────────────────────────────────────────*/
export function parseWallPolygons(map, PPU) {
  const { objectLayers, mapData, TILE_W, TILE_H, tileInfos, layers } = map;
  if (!objectLayers) return [];
  const { width, height } = mapData;
  const gidLookup = new Map();
  for (const layer of layers) {
    if (layer.type !== 'tilelayer') continue;
    for (let idx = 0; idx < layer.data.length; idx++) {
      const gid = layer.data[idx];
      if (gid) gidLookup.set(idx, gid);
    }
  }

  const polys = [];
  for (const layer of objectLayers) {
    if (layer.name !== 'DepthPolygons') continue;
    for (const obj of layer.objects || []) {
      if (!obj.polygon) continue;
      const props = obj.properties || [];
      const c = props.find(p => p.name === 'tile_c')?.value;
      const r = props.find(p => p.name === 'tile_r')?.value;
      if (c == null || r == null) continue;
      const gid = gidLookup.get(r * width + +c);
      const info = tileInfos[gid];
      const texH = info ? info.size.y : TILE_H * PPU;
      const imgH_world = texH / PPU;
      const yOffset = (props.find(p => p.name === 'y_offset')?.value ?? 0) / PPU;
      const worldPoly = obj.polygon.map(pt => {
        const w = tmxPxToWorld(obj.x + pt.x, obj.y + pt.y, width, height, TILE_W, TILE_H, PPU, true);
        return vec2(w.x, w.y - TILE_H / 2);
      });
      polys.push({ c, r, yOffset, worldPoly, imgH_world });
    }
  }
  return polys;
}
