

// src/map/mapRenderer.js — ⚡ Atlas-Based Renderer (hybrid filled-mask overlap + adaptive simplification)
'use strict';
import { drawTile, drawRect, drawLine, vec2, Color, clamp } from 'littlejsengine';
import { isoToWorld, tmxPxToWorld } from './isoMath.js';
import { renderMapDebug, drawDepthDebug } from './mapDebug.js';

/*───────────────────────────────────────────────
  DEBUG SETTINGS
───────────────────────────────────────────────*/
let DEBUG_MAP_ENABLED = true;
export const setDebugMapEnabled = v => (DEBUG_MAP_ENABLED = !!v);
export const isDebugMapEnabled = () => DEBUG_MAP_ENABLED;

const DEBUG_DRAW_CONTOURS = false; // super insanly expensive use only for debugging 
const DEBUG_DRAW_DEPTH_POLYS = true;
const DEBUG_DRAW_PLAYER_BOX = true;
const DEBUG_DRAW_MAP_GRID = false;

/*───────────────────────────────────────────────
  WALL VISIBILITY
───────────────────────────────────────────────*/
let WALLS_VISIBLE = true;
export const toggleWalls = () => (WALLS_VISIBLE = !WALLS_VISIBLE);
export const setWallVisibility = v => (WALLS_VISIBLE = !!v);

const fadeAlphaMap = new Map();
const alphaMaskCache = new Map();

/*───────────────────────────────────────────────
  ADAPTIVE ALPHA MASK (simplify + optional fill)
───────────────────────────────────────────────*/
function extractAdaptiveFilledMask(info, atlasTexture, threshold = 254) {
  const key = `${info.pos.x},${info.pos.y},${info.size.x},${info.size.y}-adaptive`;
  if (alphaMaskCache.has(key)) return alphaMaskCache.get(key);

  const img = atlasTexture.image;
  const { x: sx, y: sy } = info.pos;
  const { x: w, y: h } = info.size;

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d');
  ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // --- Extract alpha mask ---
  const mask = new Uint8Array(w * h);
  let filledCount = 0;
  for (let i = 0, j = 3; i < mask.length; i++, j += 4) {
    const val = data[j] > threshold ? 1 : 0;
    mask[i] = val;
    filledCount += val;
  }

  // --- Quick density check ---
  const density = filledCount / (w * h);
  const tooSparse = density < 0.05;
  const tooDense = density > 0.9;

  // --- Optional single-pass blur ---
  if (tooSparse || tooDense) {
    const out = new Uint8Array(mask);
    const w1 = w - 1, h1 = h - 1;
    for (let y = 1; y < h1; y++) {
      let row = y * w;
      for (let x = 1; x < w1; x++) {
        const i = row + x;
        const sum =
          mask[i - w - 1] + mask[i - w] + mask[i - w + 1] +
          mask[i - 1] + mask[i] + mask[i + 1] +
          mask[i + w - 1] + mask[i + w] + mask[i + w + 1];
        out[i] = sum >= 5 ? 1 : 0;
      }
    }
    mask.set(out);
  }

  // --- Two quick morphological dilations ---
  const fill = new Uint8Array(mask);
  const w1 = w - 1, h1 = h - 1;
  for (let pass = 0; pass < 2; pass++) {
    const src = fill.slice();
    for (let y = 1; y < h1; y++) {
      let row = y * w;
      for (let x = 1; x < w1; x++) {
        const i = row + x;
        const sum =
          src[i - w] + src[i - 1] + src[i] + src[i + 1] + src[i + w];
        if (sum >= 3) fill[i] = 1;
      }
    }
  }

  const result = { w, h, filled: fill };
  alphaMaskCache.set(key, result);
  return result;
}
/*───────────────────────────────────────────────
  PLAYER ↔ TILE MASK OVERLAP (use filled mask)
───────────────────────────────────────────────*/
function playerOverlapsTileMask(playerPos, playerSize, posDraw, sizeDraw, info, atlasTexture) {
  const pMinX = playerPos.x - playerSize.x / 2, pMaxX = playerPos.x + playerSize.x / 2;
  const pMinY = playerPos.y - playerSize.y / 2, pMaxY = playerPos.y + playerSize.y / 2;
  const minX = posDraw.x - sizeDraw.x / 2, maxX = posDraw.x + sizeDraw.x / 2;
  const minY = posDraw.y - sizeDraw.y / 2, maxY = posDraw.y + sizeDraw.y / 2;
  if (pMaxX < minX || pMinX > maxX || pMaxY < minY || pMinY > maxY) return false;

  const { w, h, filled } = extractAdaptiveFilledMask(info, atlasTexture);
  const scaleX = sizeDraw.x / w, scaleY = sizeDraw.y / h;
  const cx = posDraw.x - sizeDraw.x / 2, cy = posDraw.y - sizeDraw.y / 2;
  const step = Math.max(1, Math.floor((w * h) / 3000));

  for (let i = 0; i < w * h; i += step) {
    if (!filled[i]) continue;
    const x = i % w, y = (i / w) | 0;
    const wx = cx + x * scaleX;
    const wy = cy + (h - y) * scaleY;
    if (wx >= pMinX && wx <= pMaxX && wy >= pMinY && wy <= pMaxY)
      return true;
  }
  return false;
}

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
  WALL POLYGON PARSER (unchanged)
───────────────────────────────────────────────*/
function parseWallPolygons(map, PPU) {
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

/*───────────────────────────────────────────────
  RENDER FUNCTION
───────────────────────────────────────────────*/
export function renderMap(map, PPU, cameraPos, playerPos, playerFeetOffset = vec2(0, 0.45), entities = []) {
  if (!map.mapData) return;
  const { mapData, tileInfos, layers, TILE_W, TILE_H, floorOffsets, wallOffsets, atlasTexture } = map;
  const { width, height } = mapData;
  const playerFeet = playerPos.add(playerFeetOffset);
  const wallPolys = parseWallPolygons(map, PPU);

  const playerBoxPos = playerPos.add(vec2(0, 0.8));
  const playerBoxSize = vec2(0.5, 0.8);

  for (const layer of layers) {
    if (!layer.visible || layer.type !== 'tilelayer') continue;
    if (!WALLS_VISIBLE && layer.name.toLowerCase().includes('wall')) continue;

    const { data, name } = layer;
    const lower = name.toLowerCase();
    const offsetY = floorOffsets?.get(name) ?? wallOffsets?.get(name) ?? 0;
    const n = width * height;
    const isFloor = lower.includes('floor');

    for (let i = 0; i < n; i++) {
      const gid = data[i];
      if (!gid) continue;
      const c = i % width, r = (i / width) | 0;
      const info = tileInfos[gid];
      if (!info) continue;

      const texW = info.size.x / PPU, texH = info.size.y / PPU;
      const worldPos = isoToWorld(c, r, width, height, TILE_W, TILE_H).subtract(vec2(0, offsetY));
      const anchorY = (texH - TILE_H) / 2;
      const posDraw = worldPos.subtract(vec2(0, anchorY));
      const sizeDraw = vec2(texW, texH);
      const key = `${name}:${r},${c}`;
      let alpha = fadeAlphaMap.get(key) ?? 1.0, target = 1.0;

      if (isFloor) {
        fadeAlphaMap.set(key, 1.0);
        drawTile(posDraw, sizeDraw, info, new Color(1, 1, 1, 1), 0, false);
        continue;
      }

      const wallPoly = wallPolys.find(p => p.c == c && p.r == r);
      if (wallPoly) {
        const py = getPolygonDepthYAtX(playerFeet, wallPoly.worldPoly);
        if (py != null) {
          const dist = playerFeet.y - py;
          const MIN = -1.5, RANGE = 2, MINA = 0.45;
          if (dist > MIN && dist < RANGE) {
            const overlaps = playerOverlapsTileMask(playerBoxPos, playerBoxSize, posDraw, sizeDraw, info, atlasTexture);
            if (overlaps) {
              const ratio = (dist - MIN) / (RANGE - MIN);
              target = clamp(1 - ratio, MINA, 1);
            }
          }
        }
      }

      alpha += (target - alpha) * 0.15;
      fadeAlphaMap.set(key, alpha);
      drawTile(posDraw, sizeDraw, info, new Color(1, 1, 1, alpha), 0, false);

      if (DEBUG_MAP_ENABLED && DEBUG_DRAW_CONTOURS && !isFloor) {
        const { w, h, filled } = extractAdaptiveFilledMask(info, atlasTexture);
        const sx = texW / w, sy = texH / h;
        const cx = posDraw.x - texW / 2, cy = posDraw.y - texH / 2;
        for (let y = 0; y < h; y += 2)
          for (let x = 0; x < w; x += 2)
            if (filled[y * w + x])
              drawRect(vec2(cx + x * sx, cy + (h - y) * sy), vec2(sx * 2, sy * 2), new Color(1, 0, 0, 0.2));
      }

      if (DEBUG_MAP_ENABLED && DEBUG_DRAW_DEPTH_POLYS && wallPoly)
        drawDepthDebug(wallPoly, playerFeet, getPolygonDepthYAtX);
    }
  }

  if (DEBUG_MAP_ENABLED && DEBUG_DRAW_PLAYER_BOX)
    drawRect(playerBoxPos, playerBoxSize, new Color(0, 1, 0, 1), 0.04, true);

  if (DEBUG_MAP_ENABLED && DEBUG_DRAW_MAP_GRID)
    renderMapDebug(map, playerPos, playerFeetOffset, PPU, true);

  for (const e of entities)
    e.draw?.();
}