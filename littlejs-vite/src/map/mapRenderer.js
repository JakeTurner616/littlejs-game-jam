// src/map/mapRenderer.js
'use strict';

import {
  drawTile, drawRect, vec2, hsl, Color, clamp, drawLine
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

/**
 * Parse all Tiled object layer polygons named "DepthPolygons"
 * and convert them into world-space coordinates.
 */
function parseWallPolygons(map, PPU) {
  const polygons = [];
  const { objectLayers, mapData, TILE_W, TILE_H, rawImages, layers } = map;
  const { width, height } = mapData;
  if (!objectLayers) return polygons;

  // Build GID lookup (to find image height for anchor offset)
  const gidLookup = new Map();
  for (const layer of layers) {
    if (layer.type !== 'tilelayer') continue;
    const { data } = layer;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const gid = data[r * width + c];
        if (gid) gidLookup.set(`${c},${r}`, gid);
      }
    }
  }

  // Build polygons from the "DepthPolygons" object layer
  for (const layer of objectLayers) {
    if (layer.name !== 'DepthPolygons') continue;
    for (const obj of layer.objects || []) {
      if (!obj.polygon || !obj.properties) continue;

      const c = obj.properties.find(p => p.name === 'tile_c')?.value;
      const r = obj.properties.find(p => p.name === 'tile_r')?.value;
      if (c == null || r == null) continue;

      // Retrieve the image for this tile (not needed for offset now but kept for consistency)
      const gid = gidLookup.get(`${c},${r}`);
      const img = gid ? rawImages[gid] : null;
      const imgH_world = img ? img.height / PPU : TILE_H;
      const anchorOffsetY = (imgH_world - TILE_H) / 2;

      // Convert polygon to world-space coordinates
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

        // ✅ Match collision polygons exactly:
        // Use a fixed TILE_H / 2 downward shift (ignore anchorOffsetY)
        return vec2(w.x, w.y - TILE_H / 2);
      });

      polygons.push({
        c,
        r,
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
  MAP RENDERER (DEPTH + TRANSPARENCY)
───────────────────────────────────────────────────────────────*/
const fadeAlphaMap = new Map();

export function renderMap(
  map,
  PPU,
  cameraPos,
  playerPos,
  playerFeetOffset = vec2(0, 0.45),
  entities = []
) {
  if (!map.mapData) return;
  const { mapData, rawImages, tileInfos, layers, TILE_W, TILE_H } = map;
  const { width, height } = mapData;

  // clear background
  drawRect(vec2(0, 0), vec2(9999, 9999), hsl(0, 0, 0.15));

  const playerFeet = playerPos.add(playerFeetOffset);
  const wallPolygons = parseWallPolygons(map, PPU);
//if (DEBUG_MAP_ENABLED)
  //console.log('[DepthPolygons]', wallPolygons.length, wallPolygons);

  const opaqueTiles = [];
  const transparentTiles = [];

  for (const layer of layers) {
    if (!layer.visible || layer.type !== 'tilelayer') continue;
    const { data, name: layerName } = layer;
    const floorOffsetWorld = map.floorOffsets?.get(layerName) || 0;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const gid = data[r * width + c];
        if (!gid) continue;

        const worldPos = isoToWorld(c, r, width, height, TILE_W, TILE_H)
          .subtract(vec2(0, floorOffsetWorld));

        const info = tileInfos[gid];
        const img = rawImages[gid];
        if (!info || !img) continue;

        const imgW_world = img.width / PPU;
        const imgH_world = img.height / PPU;
        const anchorOffsetY = (imgH_world - TILE_H) / 2;
        const wallPoly = wallPolygons.find(p => p.c === c && p.r === r);
        const tileKey = `${layerName}:${r},${c}`;

        // Track fade state
        let currentAlpha = fadeAlphaMap.get(tileKey) ?? 1.0;
        let targetAlpha = 1.0;

        // Apply DepthPolygon fade
        if (wallPoly) {
          const polyY = getPolygonDepthYAtX(playerFeet, wallPoly.worldPoly);
          if (polyY !== null) {
            const dist = playerFeet.y - polyY;
            const tileWorldPos = worldPos.subtract(vec2(0, anchorOffsetY));
            const pixelOverlap = pixelOverlapCheck(
              playerFeet, tileWorldPos, img, imgW_world, imgH_world, PPU, TILE_H
            );

            // Fade if player is behind wall polygon
            if (pixelOverlap && dist > 0) {
              const fadeRange = 0.4;
              const fadeMin = 0.35;
              targetAlpha = clamp(1.0 - dist / fadeRange, fadeMin, 1.0);
            }
          }
        }

        // Smooth fade interpolation
        const fadeSpeed = 0.15;
        currentAlpha += (targetAlpha - currentAlpha) * fadeSpeed;
        fadeAlphaMap.set(tileKey, currentAlpha);

        const tileDrawable = {
          y: worldPos.y - anchorOffsetY,
          alpha: currentAlpha,
          wallPoly,
          draw: () => {
            drawTile(
              worldPos.subtract(vec2(0, anchorOffsetY)),
              vec2(imgW_world, imgH_world),
              info,
              new Color(1, 1, 1, currentAlpha),
              0,
              false
            );

            // Debug overlay
            if (DEBUG_MAP_ENABLED && wallPoly)
              drawDepthDebug(wallPoly, playerFeet, getPolygonDepthYAtX);
          },
        };

        if (targetAlpha < 1.0)
          transparentTiles.push(tileDrawable);
        else
          opaqueTiles.push(tileDrawable);
      }
    }
  }

  // Draw in proper order
  for (const t of opaqueTiles) t.draw();
  const depthSorted = [...transparentTiles, ...entities];
  depthSorted.sort((a, b) => a.y - b.y);
  for (const d of depthSorted) d.draw();

  // Debug layer
  if (DEBUG_MAP_ENABLED)
    renderMapDebug(map, playerPos, playerFeetOffset, PPU, true);
  if (DEBUG_MAP_ENABLED && wallPolygons?.length) {
  for (const wallPoly of wallPolygons) {
    const pts = wallPoly.worldPoly;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      drawLine(a, b, 0.03, new Color(1, 0.8, 0.1, 0.9));
    }
  }
}
}
