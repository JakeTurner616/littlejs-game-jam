// src/map/mapRenderer.js
'use strict';

import {
  drawTile,
  drawRect,
  drawLine,
  vec2,
  hsl,
  Color,
  clamp,
} from 'littlejsengine';
import { isoToWorld, tmxPxToWorld } from './isoMath.js';
import { renderMapDebug } from './mapDebug.js';

/*───────────────────────────────────────────────────────────────
  MAP DEBUG CONTROL
───────────────────────────────────────────────────────────────*/
let DEBUG_MAP_ENABLED = true;
export function setDebugMapEnabled(v) { DEBUG_MAP_ENABLED = !!v; }
export function isDebugMapEnabled() { return DEBUG_MAP_ENABLED; }

/*───────────────────────────────────────────────────────────────
  HELPERS
───────────────────────────────────────────────────────────────*/
function getPolygonDepthYAtX(p, poly) {
  const intersections = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (Math.abs(a.x - b.x) < 1e-6) continue;
    const t = (p.x - a.x) / (b.x - a.x);
    if (t >= 0 && t <= 1) intersections.push(a.y + (b.y - a.y) * t);
  }
  if (!intersections.length) return null;
  return Math.max(...intersections);
}

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

      const worldPoly = obj.polygon.map(pt => {
        const w = tmxPxToWorld(
          obj.x + pt.x,
          obj.y + pt.y,
          width,
          height - 8,
          TILE_W,
          TILE_H,
          PPU
        );
        return vec2(w.x, w.y - TILE_H);
      });
      polygons.push({ c, r, worldPoly });
    }
  }
  return polygons;
}

/*───────────────────────────────────────────────────────────────
  PIXEL-PERFECT OVERLAP
───────────────────────────────────────────────────────────────*/
function pixelOverlapCheck(playerFeet, tileWorldPos, img, imgW_world, imgH_world, PPU, TILE_H) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  const maskData = ctx.getImageData(0, 0, img.width, img.height).data;

  const anchorOffsetY = (imgH_world - TILE_H) / 2;
  const relativeX = playerFeet.x - tileWorldPos.x;
  const relativeY = playerFeet.y - tileWorldPos.y;

  const localX = (relativeX / imgW_world + 0.5) * img.width;
  const localY = (1 - (relativeY / imgH_world + 0.5)) * img.height;

  const radius = 6;
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const px = Math.floor(localX + x);
      const py = Math.floor(localY + y);
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
      const idx = (py * img.width + px) * 4 + 3;
      if (maskData[idx] > 32) return true;
    }
  }
  return false;
}

/*───────────────────────────────────────────────────────────────
  RENDER MAP WITH DEPTH FADE + DEBUG OVERLAYS
───────────────────────────────────────────────────────────────*/
const fadeAlphaMap = new Map(); // keyed by layer:r,c

export function renderMap(map, PPU, cameraPos, playerPos, playerFeetOffset = vec2(0, 0.45)) {
  if (!map.mapData) return;
  const { mapData, rawImages, tileInfos, layers, TILE_W, TILE_H } = map;
  const { width, height } = mapData;

  drawRect(vec2(0, 0), vec2(9999, 9999), hsl(0, 0, 0.15));

  const playerFeet = playerPos.add(playerFeetOffset);
  const wallPolygons = parseWallPolygons(map, PPU);

  for (const layer of layers) {
    if (!layer.visible || layer.type !== 'tilelayer') continue;
    const { data, name: layerName } = layer;

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
        const wallPoly = wallPolygons.find(p => p.c === c && p.r === r);

        const tileKey = `${layerName}:${r},${c}`;
        let currentAlpha = fadeAlphaMap.get(tileKey) ?? 1.0;
        let targetAlpha = 1.0;

        if (wallPoly) {
          const polyY = getPolygonDepthYAtX(playerFeet, wallPoly.worldPoly);
          if (polyY !== null) {
            const dist = playerFeet.y - polyY;
            const tileWorldPos = worldPos.subtract(vec2(0, anchorOffsetY));
            const pixelOverlap = pixelOverlapCheck(
              playerFeet, tileWorldPos,
              img, imgW_world, imgH_world, PPU, TILE_H
            );
            if (pixelOverlap)
              targetAlpha = clamp(1.0 - Math.min(Math.max((dist - 0.05) / 0.2, 0), 1), 0.35, 1.0);
          }
        }

        // 🔄 Smooth fade (debounce)
        const fadeSpeed = 0.15;
        currentAlpha += (targetAlpha - currentAlpha) * fadeSpeed;
        fadeAlphaMap.set(tileKey, currentAlpha);

        drawTile(
          worldPos.subtract(vec2(0, anchorOffsetY)),
          vec2(imgW_world, imgH_world),
          info,
          new Color(1, 1, 1, currentAlpha),
          0,
          false
        );

        /*───────────────────────────────────────────────
          DEBUG OVERLAYS
        ───────────────────────────────────────────────*/
        if (DEBUG_MAP_ENABLED && wallPoly) {
          const pts = wallPoly.worldPoly;
          // Yellow polygon outlines the depth volume
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            drawLine(a, b, 0.03, new Color(1, 0.8, 0.1, 0.9));
          }

          // Blue casted depth plane moving across polygon
          const polyY = getPolygonDepthYAtX(playerFeet, wallPoly.worldPoly);
          if (polyY !== null)
            drawLine(
              vec2(playerFeet.x - 0.15, polyY),
              vec2(playerFeet.x + 0.15, polyY),
              0.05,
              new Color(0.1, 0.6, 1, 0.9)
            );
        }
      }
    }
  }

  if (DEBUG_MAP_ENABLED)
    renderMapDebug(map, playerPos, playerFeetOffset, PPU, true);
}
