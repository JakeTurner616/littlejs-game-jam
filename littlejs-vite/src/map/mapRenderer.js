// src/map/mapRenderer.js — ⚡ Atlas-Based Renderer (no rawImages, skip fade for floor layers)
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

/*───────────────────────────────────────────────
  DEPTH Y AT X HELPER
───────────────────────────────────────────────*/
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

/*───────────────────────────────────────────────
  WALL POLYGON PARSER (uses tileInfos instead)
───────────────────────────────────────────────*/
function parseWallPolygons(map, PPU) {
  const { objectLayers, mapData, TILE_W, TILE_H, tileInfos, layers } = map;
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

      polygons.push({ c, r, yOffset, worldPoly, imgH_world });
    }
  }
  return polygons;
}

/*───────────────────────────────────────────────
  RENDER FUNCTION
───────────────────────────────────────────────*/
export function renderMap(map, PPU, cameraPos, playerPos, playerFeetOffset = vec2(0, 0.45), entities = []) {
  if (!map.mapData) return;
  const { mapData, tileInfos, layers, TILE_W, TILE_H, floorOffsets, wallOffsets } = map;
  const { width, height } = mapData;
  const playerFeet = playerPos.add(playerFeetOffset);
  const wallPolygons = parseWallPolygons(map, PPU);

  for (const layer of layers) {
    if (!layer.visible || layer.type !== 'tilelayer') continue;
    if (!WALLS_VISIBLE && layer.name.toLowerCase().includes('wall')) continue;

    const { data, name } = layer;
    const lowerName = name.toLowerCase();

    const offsetY = floorOffsets?.get(name) ?? wallOffsets?.get(name) ?? 0;
    const n = width * height;

    const isFloorLayer = lowerName.includes('floor'); // 🚫 floor layers should not fade

    for (let i = 0; i < n; i++) {
      const gid = data[i];
      if (!gid) continue;
      const c = i % width, r = (i / width) | 0;
      const info = tileInfos[gid];
      if (!info) continue;

      const texW_world = info.size.x / PPU;
      const texH_world = info.size.y / PPU;

      const worldPos = isoToWorld(c, r, width, height, TILE_W, TILE_H).subtract(vec2(0, offsetY));
      const anchorOffsetY = (texH_world - TILE_H) / 2;

      const tileKey = `${name}:${r},${c}`;
      let alpha = fadeAlphaMap.get(tileKey) ?? 1.0;
      let target = 1.0;

      // 🚫 Skip fade entirely for floor layers
      if (isFloorLayer) {
        alpha = 1.0;
        fadeAlphaMap.set(tileKey, 1.0);
        drawTile(worldPos.subtract(vec2(0, anchorOffsetY)), vec2(texW_world, texH_world),
          info, new Color(1, 1, 1, 1.0), 0, false);
        continue;
      }

      // 🔶 Wall fade logic
      const wallPoly = wallPolygons.find(p => p.c == c && p.r == r);
      if (wallPoly) {
        const polyY = getPolygonDepthYAtX(playerFeet, wallPoly.worldPoly);
        if (polyY != null) {
          const dist = playerFeet.y - polyY;
          const MIN_THRESHOLD = 0.1;
          const FADE_RANGE = 0.7;
          const FADE_MIN = 0.35;

          if (dist > MIN_THRESHOLD && dist < FADE_RANGE) {
            const ratio = (dist - MIN_THRESHOLD) / (FADE_RANGE - MIN_THRESHOLD);
            target = clamp(1 - ratio, FADE_MIN, 1);
          }
        }
      }

      alpha += (target - alpha) * 0.15;
      fadeAlphaMap.set(tileKey, alpha);

      drawTile(worldPos.subtract(vec2(0, anchorOffsetY)), vec2(texW_world, texH_world),
        info, new Color(1, 1, 1, alpha), 0, false);

      if (DEBUG_MAP_ENABLED && wallPoly)
        drawDepthDebug(wallPoly, playerFeet, getPolygonDepthYAtX);
    }
  }

  if (DEBUG_MAP_ENABLED)
    renderMapDebug(map, playerPos, playerFeetOffset, PPU, true);

  for (const e of entities)
    e.draw?.();
}
