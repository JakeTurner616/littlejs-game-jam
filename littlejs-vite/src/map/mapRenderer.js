// src/map/mapRenderer.js
'use strict';

import {
  drawTile,
  drawRect,
  drawLine,
  vec2,
  hsl,
  Color,
} from 'littlejsengine';
import { isoToWorld, tmxPxToWorld } from './isoMath.js';
import { renderMapDebug } from './mapDebug.js';

// ──────────────────────────────────────────────
// DEBUG TOGGLE
// ──────────────────────────────────────────────
let DEBUG_MAP_ENABLED = true;
export function setDebugMapEnabled(v) { DEBUG_MAP_ENABLED = !!v; }
export function isDebugMapEnabled() { return DEBUG_MAP_ENABLED; }

// ──────────────────────────────────────────────
// PARSE TILED POLYGON DEPTH REGIONS
// ──────────────────────────────────────────────
function parseWallPolygons(map, PPU) {
  const polygons = [];
  const { objectLayers, mapData, TILE_W, TILE_H } = map;
  const { width, height } = mapData;
  if (!objectLayers) return polygons;

  for (const layer of objectLayers) {
    if (layer.name !== 'DepthPolygons') continue;
    for (const obj of layer.objects || []) {
      if (!obj.polygon || !obj.properties) continue;

      const c = obj.properties.find(p => p.name === 'tile_c')?.value;
      const r = obj.properties.find(p => p.name === 'tile_r')?.value;
      if (c == null || r == null) continue;

      // ✅ Use same transform logic as collision polygons
      let worldPoly = obj.polygon.map(pt => {
        const w = tmxPxToWorld(
          obj.x + pt.x,
          obj.y + pt.y,
          width,
          height - 8, // same vertical anchor correction
          TILE_W,
          TILE_H,
          PPU
        );
        return vec2(w.x, w.y - TILE_H); // same base-plane alignment
      });

      polygons.push({ c, r, worldPoly });
    }
  }

  return polygons;
}

// ──────────────────────────────────────────────
// SIMPLE POINT-IN-POLYGON TEST
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
// MAIN RENDER FUNCTION
// ──────────────────────────────────────────────
export function renderMap(map, PPU, cameraPos, playerPos, playerFeetOffset = vec2(0, 0.45)) {
  if (!map.mapData) return;

  const { mapData, rawImages, tileInfos, layers, TILE_W, TILE_H } = map;
  const { width, height } = mapData;

  // Background
  drawRect(vec2(0, 0), vec2(9999, 9999), hsl(0, 0, 0.15));

  const playerFeet = playerPos.add(playerFeetOffset);
  const wallPolygons = parseWallPolygons(map, PPU);

  // ──────────────────────────────────────────────
  // TILE LAYER RENDERING
  // ──────────────────────────────────────────────
  for (const layer of layers) {
    if (!layer.visible || layer.type !== 'tilelayer') continue;
    const { data } = layer;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const gid = data[r * width + c];
        if (!gid) continue;

        const worldPos = isoToWorld(c, r, width, height, TILE_W, TILE_H);
        const info = tileInfos[gid];
        const img = rawImages[gid];
        if (!info || !img) continue;

        const imgW_world = img.width / PPU;
        const imgH_world = img.height / PPU;
        const anchorOffsetY = (imgH_world - TILE_H) / 2;

        // Find attached polygon for this tile
        const wallPoly = wallPolygons.find(p => p.c === c && p.r === r);

        // Determine alpha (transparency)
        let alpha = 1.0;
        if (wallPoly && pointInPolygon(playerFeet, wallPoly.worldPoly)) {
          alpha = 0.4;
        }

        // ✅ Corrected parameter order — color now in correct slot
        drawTile(
          worldPos.subtract(vec2(0, anchorOffsetY)),
          vec2(imgW_world, imgH_world),
          info,
          new Color(1, 1, 1, alpha), // color with alpha modulation
          0,                          // angle
          false                       // mirror
        );

        // Debug overlay for polygons
        if (DEBUG_MAP_ENABLED && wallPoly) {
          const pts = wallPoly.worldPoly;
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i];
            const b = pts[(i + 1) % pts.length];
            drawLine(a, b, 0.03, new Color(1, 0.8, 0, 0.7));
          }
        }
      }
    }
  }

  // ──────────────────────────────────────────────
  // OPTIONAL DEBUG GRID / HOVER OVERLAY
  // ──────────────────────────────────────────────
  if (DEBUG_MAP_ENABLED)
    renderMapDebug(map, playerPos, playerFeetOffset, PPU, true);
}