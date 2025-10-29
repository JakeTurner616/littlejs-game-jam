// src/map/mapRenderer.js — ⚡ Modular Atlas-Based Renderer
'use strict';
import { drawTile, vec2, Color, clamp } from 'littlejsengine';
import { isoToWorld } from './isoMath.js';
import { getPolygonDepthYAtX, parseWallPolygons } from './wallUtils.js';
import { extractAdaptiveFilledMask, playerOverlapsTileMask } from './maskUtils.js';
import { drawDebugPlayerBox, drawDebugGrid } from './renderDebug.js';
import { drawDepthDebug } from './mapDebug.js';

/*───────────────────────────────────────────────
  DEBUG SETTINGS
───────────────────────────────────────────────*/
let DEBUG_MAP_ENABLED = true;
export const setDebugMapEnabled = v => (DEBUG_MAP_ENABLED = !!v);
export const isDebugMapEnabled = () => DEBUG_MAP_ENABLED;

const DEBUG_DRAW_CONTOURS = false;
const DEBUG_DRAW_DEPTH_POLYS = true;
const DEBUG_DRAW_PLAYER_BOX = true;
const DEBUG_DRAW_MAP_GRID = false;

let WALLS_VISIBLE = true;
export const toggleWalls = () => (WALLS_VISIBLE = !WALLS_VISIBLE);
export const setWallVisibility = v => (WALLS_VISIBLE = !!v);

const fadeAlphaMap = new Map();

/*───────────────────────────────────────────────
  MAIN RENDER FUNCTION
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

      if (DEBUG_MAP_ENABLED && DEBUG_DRAW_DEPTH_POLYS && wallPoly)
        drawDepthDebug(wallPoly, playerFeet, getPolygonDepthYAtX);
    }
  }

  if (DEBUG_MAP_ENABLED && DEBUG_DRAW_PLAYER_BOX)
    drawDebugPlayerBox(playerBoxPos, playerBoxSize);

  if (DEBUG_MAP_ENABLED && DEBUG_DRAW_MAP_GRID)
    drawDebugGrid(map, playerPos, playerFeetOffset, PPU);

  for (const e of entities)
    e.draw?.();
}
