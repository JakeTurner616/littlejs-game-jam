// src/map/mapRenderer.js
'use strict';

import {
  drawTile, drawRect, vec2, hsl, Color, clamp
} from 'littlejsengine';
import { isoToWorld, tmxPxToWorld } from './isoMath.js';
import { renderMapDebug, drawDepthDebug } from './mapDebug.js';

/*───────────────────────────────────────────────────────────────
  DEBUG CONTROL
───────────────────────────────────────────────────────────────*/
let DEBUG_MAP_ENABLED = true;
export function setDebugMapEnabled(v) { DEBUG_MAP_ENABLED = !!v; }
export function isDebugMapEnabled() { return DEBUG_MAP_ENABLED; }

/*───────────────────────────────────────────────────────────────
  DEPTH POLYGON UTILITIES
───────────────────────────────────────────────────────────────*/
export function getPolygonDepthYAtX(p, poly) {
  const intersections = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (Math.abs(a.x - b.x) < 1e-6) continue;
    const t = (p.x - a.x) / (b.x - a.x);
    if (t >= 0 && t <= 1)
      intersections.push(a.y + (b.y - a.y) * t);
  }
  if (!intersections.length) return null;
  const playerY = p.y;
  intersections.sort((a, b) => Math.abs(playerY - a) - Math.abs(playerY - b));
  for (const y of intersections)
    if (y <= playerY) return y;
  return intersections[0];
}

/*───────────────────────────────────────────────────────────────
  DEPTH POLYGON PARSER
───────────────────────────────────────────────────────────────*/
function parseWallPolygons(map, PPU) {
  const polygons = [];
  const { objectLayers, mapData, TILE_W, TILE_H, rawImages, layers } = map;
  const { width, height } = mapData;
  if (!objectLayers) return polygons;

  const gidLookup = new Map();
  for (const layer of layers) {
    if (layer.type !== 'tilelayer') continue;
    const { data } = layer;
    for (let r = 0; r < height; r++)
      for (let c = 0; c < width; c++) {
        const gid = data[r * width + c];
        if (gid) gidLookup.set(`${c},${r}`, gid);
      }
  }

  for (const layer of objectLayers) {
    if (layer.name !== 'DepthPolygons') continue;
    for (const obj of layer.objects || []) {
      if (!obj.polygon || !obj.properties) continue;
      const c = obj.properties.find(p => p.name === 'tile_c')?.value;
      const r = obj.properties.find(p => p.name === 'tile_r')?.value;
      const yOffsetProp = obj.properties.find(p => p.name === 'y_offset')?.value ?? 0;
      if (c == null || r == null) continue;

      const gid = gidLookup.get(`${c},${r}`);
      const img = gid ? rawImages[gid] : null;
      const imgH_world = img ? img.height / PPU : TILE_H;

      const worldPoly = obj.polygon.map(pt => {
        const w = tmxPxToWorld(
          obj.x + pt.x,
          obj.y + pt.y,
          width,
          height,
          TILE_W,
          TILE_H,
          PPU,
          true
        );
        return vec2(w.x, w.y - TILE_H / 2);
      });

      polygons.push({
        c, r,
        yOffset: yOffsetProp / PPU,
        worldPoly,
      });
    }
  }
  return polygons;
}

/*───────────────────────────────────────────────────────────────
  PER-PIXEL MASK CHECK
───────────────────────────────────────────────────────────────*/
function pixelOverlapCheck(playerFeet, tileWorldPos, img, imgW_world, imgH_world, PPU, TILE_H) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  const maskData = ctx.getImageData(0, 0, img.width, img.height).data;

  const relativeX = playerFeet.x - tileWorldPos.x;
  const relativeY = playerFeet.y - tileWorldPos.y;
  const localX = (relativeX / imgW_world + 0.5) * img.width;
  const localY = (1 - (relativeY / imgH_world + 0.5)) * img.height;

  const radius = 6;
  for (let y = -radius; y <= radius; y++)
    for (let x = -radius; x <= radius; x++) {
      const px = Math.floor(localX + x);
      const py = Math.floor(localY + y);
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
      const idx = (py * img.width + px) * 4 + 3;
      if (maskData[idx] > 32) return true;
    }
  return false;
}

/*───────────────────────────────────────────────────────────────
  MAP RENDERER — FADE WHILE KEEPING TILED ORDER
───────────────────────────────────────────────────────────────*/
const fadeAlphaMap = new Map();

export function renderMap(map, PPU, cameraPos, playerPos, playerFeetOffset = vec2(0, 0.45), entities = []) {
  if (!map.mapData) return;
  const { mapData, rawImages, tileInfos, layers, TILE_W, TILE_H, floorOffsets, wallOffsets } = map;
  const { width, height } = mapData;

  drawRect(vec2(0, 0), vec2(9999, 9999), hsl(0, 0, 0.15));

  const playerFeet = playerPos.add(playerFeetOffset);
  const wallPolygons = parseWallPolygons(map, PPU);

  // Iterate in same order as Tiled renders: each layer, top→bottom, left→right
  for (const layer of layers) {
    if (!layer.visible || layer.type !== 'tilelayer') continue;
    const { data, name: layerName } = layer;
    const floorOffsetWorld =
      floorOffsets?.get(layerName) ??
      wallOffsets?.get(layerName) ?? 0;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const gid = data[r * width + c];
        if (!gid) continue;

        const info = tileInfos[gid];
        const img = rawImages[gid];
        if (!info || !img) continue;

        const worldPos = isoToWorld(c, r, width, height, TILE_W, TILE_H)
          .subtract(vec2(0, floorOffsetWorld));
        const imgW_world = img.width / PPU;
        const imgH_world = img.height / PPU;
        const anchorOffsetY = (imgH_world - TILE_H) / 2;

        const wallPoly = wallPolygons
          .filter(p => p.c === c && p.r === r)
          .sort((a, b) =>
            Math.abs(a.yOffset - floorOffsetWorld) - Math.abs(b.yOffset - floorOffsetWorld)
          )[0];

        const tileKey = `${layerName}:${r},${c}`;
        let currentAlpha = fadeAlphaMap.get(tileKey) ?? 1.0;
        let targetAlpha = 1.0;

        if (wallPoly) {
          const polyY = getPolygonDepthYAtX(playerFeet, wallPoly.worldPoly);
          if (polyY !== null) {
            const dist = playerFeet.y - polyY;
            const tileWorldPos = worldPos.subtract(vec2(0, anchorOffsetY));
            const overlap = pixelOverlapCheck(playerFeet, tileWorldPos, img, imgW_world, imgH_world, PPU, TILE_H);
            if (overlap && dist > 0) {
              const fadeRange = 0.4;
              const fadeMin = 0.35;
              targetAlpha = clamp(1.0 - dist / fadeRange, fadeMin, 1.0);
            }
          }
        }

        const fadeSpeed = 0.15;
        currentAlpha += (targetAlpha - currentAlpha) * fadeSpeed;
        fadeAlphaMap.set(tileKey, currentAlpha);

        // Draw immediately, preserving the same iteration order as Tiled
        drawTile(
          worldPos.subtract(vec2(0, anchorOffsetY)),
          vec2(imgW_world, imgH_world),
          info,
          new Color(1, 1, 1, currentAlpha),
          0,
          false
        );

        if (DEBUG_MAP_ENABLED && wallPoly)
          drawDepthDebug(wallPoly, playerFeet, getPolygonDepthYAtX);
      }
    }
  }

  // Entities drawn after map as usual
  for (const e of entities) e.draw?.();

  if (DEBUG_MAP_ENABLED)
    renderMapDebug(map, playerPos, playerFeetOffset, PPU, true);
}
