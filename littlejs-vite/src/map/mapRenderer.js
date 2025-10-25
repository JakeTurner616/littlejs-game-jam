// src/map/mapRenderer.js  ✅ adds simple Y-check realism for fence fade
'use strict';
import { drawTile, vec2, Color, clamp } from 'littlejsengine';
import { isoToWorld, tmxPxToWorld } from './isoMath.js';
import { renderMapDebug, drawDepthDebug } from './mapDebug.js';

let DEBUG_MAP_ENABLED = true;
export const setDebugMapEnabled = v => (DEBUG_MAP_ENABLED = !!v);
export const isDebugMapEnabled = () => DEBUG_MAP_ENABLED;

let WALLS_VISIBLE = true;
export const toggleWalls = () => (WALLS_VISIBLE = !WALLS_VISIBLE);
export const setWallVisibility = v => (WALLS_VISIBLE = !!v);

const fadeAlphaMap = new Map();

/*───────────────────────────────────────────────*/
export function getPolygonDepthYAtX(p, poly) {
  const x = p.x;
  let nearest = null;
  let minDist = Infinity;
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

/*───────────────────────────────────────────────*/
function parseWallPolygons(map, PPU) {
  const { objectLayers, mapData, TILE_W, TILE_H, rawImages, layers } = map;
  if (!objectLayers) return [];
  const { width, height } = mapData;
  const gidLookup = new Map();

  for (const layer of layers) {
    if (layer.type !== 'tilelayer') continue;
    const { data } = layer;
    for (let idx = 0; idx < data.length; idx++) {
      const gid = data[idx];
      if (gid) gidLookup.set(idx, gid);
    }
  }

  const polygons = [];
  for (const layer of objectLayers) {
    if (layer.name !== 'DepthPolygons') continue;
    for (const obj of layer.objects || []) {
      const props = obj.properties;
      if (!obj.polygon || !props) continue;
      const c = props.find(p => p.name === 'tile_c')?.value;
      const r = props.find(p => p.name === 'tile_r')?.value;
      if (c == null || r == null) continue;
      const gid = gidLookup.get(r * width + +c);
      const img = gid ? rawImages[gid] : null;
      const imgH_world = img ? img.height / PPU : TILE_H;
      const yOffset = (props.find(p => p.name === 'y_offset')?.value ?? 0) / PPU;
      const worldPoly = obj.polygon.map(pt => {
        const w = tmxPxToWorld(obj.x + pt.x, obj.y + pt.y, width, height, TILE_W, TILE_H, PPU, true);
        return vec2(w.x, w.y - TILE_H / 2);
      });
      polygons.push({ c, r, yOffset, worldPoly, imgH_world });
    }
  }
  return polygons;
}

/*───────────────────────────────────────────────*/
const tmpCanvas = document.createElement('canvas');
const tmpCtx = tmpCanvas.getContext('2d');
function pixelOverlapCheck(playerFeet, tileWorldPos, img, imgW_world, imgH_world, PPU) {
  tmpCanvas.width = img.width;
  tmpCanvas.height = img.height;
  tmpCtx.clearRect(0, 0, img.width, img.height);
  tmpCtx.drawImage(img, 0, 0);
  const maskData = tmpCtx.getImageData(0, 0, img.width, img.height).data;

  const localX = (playerFeet.x - tileWorldPos.x) / imgW_world * img.width + img.width / 2;
  const localY = (1 - (playerFeet.y - tileWorldPos.y) / imgH_world) * img.height / 2;
  const radius = 6;
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const px = localX + x, py = localY + y;
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
      const idx = ((py | 0) * img.width + (px | 0)) * 4 + 3;
      if (maskData[idx] > 32) return true;
    }
  }
  return false;
}

/*───────────────────────────────────────────────*/
export function renderMap(map, PPU, cameraPos, playerPos, playerFeetOffset = vec2(0, 0.45), entities = []) {
  if (!map.mapData) return;
  const { mapData, rawImages, tileInfos, layers, TILE_W, TILE_H, floorOffsets, wallOffsets } = map;
  const { width, height } = mapData;
  const playerFeet = playerPos.add(playerFeetOffset);
  const wallPolygons = parseWallPolygons(map, PPU);

  for (const layer of layers) {
    if (!layer.visible || layer.type !== 'tilelayer') continue;
    if (!WALLS_VISIBLE && layer.name.toLowerCase().includes('wall')) continue;

    const { data, name } = layer;
    const offsetY = floorOffsets?.get(name) ?? wallOffsets?.get(name) ?? 0;
    const n = width * height;
    const isFenceLayer = name.toLowerCase().includes('fence');

    for (let i = 0; i < n; i++) {
      const gid = data[i];
      if (!gid) continue;
      const c = i % width, r = (i / width) | 0;
      const info = tileInfos[gid], img = rawImages[gid];
      if (!info || !img) continue;

      const worldPos = isoToWorld(c, r, width, height, TILE_W, TILE_H).subtract(vec2(0, offsetY));
      const imgW_world = img.width / PPU;
      const imgH_world = img.height / PPU;
      const anchorOffsetY = (imgH_world - TILE_H) / 2;

      const wallPoly = wallPolygons.find(p => p.c == c && p.r == r);
      const tileKey = `${name}:${r},${c}`;
      let alpha = fadeAlphaMap.get(tileKey) ?? 1.0, target = 1.0;

      if (wallPoly) {
        const polyY = getPolygonDepthYAtX(playerFeet, wallPoly.worldPoly);
        if (polyY != null) {
          const dist = playerFeet.y - polyY;

          // ✅ fences use basic Y-range check instead of pixel overlap
          let overlapOk = false;
          if (isFenceLayer) {
            const verticalRange = 0.75; // tolerance window (world-space units)
            overlapOk = Math.abs(dist) < verticalRange;
          } else {
            overlapOk = pixelOverlapCheck(
              playerFeet, worldPos.subtract(vec2(0, anchorOffsetY)),
              img, imgW_world, imgH_world, PPU
            );
          }

          if (dist > 0 && overlapOk) {
            const fadeRange = 0.4, fadeMin = 0.35;
            target = clamp(1 - dist / fadeRange, fadeMin, 1);
          }
        }
      }

      alpha += (target - alpha) * 0.15;
      fadeAlphaMap.set(tileKey, alpha);

      drawTile(worldPos.subtract(vec2(0, anchorOffsetY)), vec2(imgW_world, imgH_world),
        info, new Color(1, 1, 1, alpha), 0, false);

      if (DEBUG_MAP_ENABLED && wallPoly)
        drawDepthDebug(wallPoly, playerFeet, getPolygonDepthYAtX);
    }
  }

  if (DEBUG_MAP_ENABLED)
    renderMapDebug(map, playerPos, playerFeetOffset, PPU, true);

  for (const e of entities) e.draw?.();
}
