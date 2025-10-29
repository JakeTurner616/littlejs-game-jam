// src/map/mapRenderer.js — ⚡ Modular Atlas-Based Renderer + PaintSystem (black→color fade)
'use strict';
import { drawTile, vec2, Color, clamp } from 'littlejsengine';
import { isoToWorld } from './isoMath.js';
import { getPolygonDepthYAtX, parseWallPolygons } from './wallUtils.js';
import { playerOverlapsTileMask } from './maskUtils.js';
import { drawDebugPlayerBox, drawDebugGrid, drawDebugRevealRadius  } from './renderDebug.js';
import { drawDepthDebug } from './mapDebug.js';
import { getTileBrightness } from './paintSystem.js';

let DEBUG_MAP_ENABLED = true;
export const setDebugMapEnabled = v => (DEBUG_MAP_ENABLED = !!v);
export const isDebugMapEnabled = () => DEBUG_MAP_ENABLED;

let WALLS_VISIBLE = true;
export const toggleWalls = () => (WALLS_VISIBLE = !WALLS_VISIBLE);
export const setWallVisibility = v => (WALLS_VISIBLE = !!v);

const fadeAlphaMap = new Map();

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

      // 🎨 start black → fade to color
      const brightness = getTileBrightness(name, r, c); // 0 (black) → 1 (bright)
      const baseCol = new Color(brightness, brightness, brightness, 1); // color mix base

      const key = `${name}:${r},${c}`;
      let alpha = fadeAlphaMap.get(key) ?? 1; // 👈 start fully visible
      let target = 1.0; // fully visible when revealed

      // Floors fully visible
      if (isFloor) {
        fadeAlphaMap.set(key, 1.0);
        drawTile(posDraw, sizeDraw, info, baseCol, 0, false);
        continue;
      }

      // Depth fade
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

      // Smooth fade update
      alpha += (target - alpha) * 0.15;
      fadeAlphaMap.set(key, alpha);

      // 🪄 Combine brightness (color reveal) and alpha (opacity)
      const revealMix = brightness; // 0=black, 1=color
      const color = new Color(
        clamp(baseCol.r * revealMix, 0, 1),
        clamp(baseCol.g * revealMix, 0, 1),
        clamp(baseCol.b * revealMix, 0, 1),
        alpha
      );

      drawTile(posDraw, sizeDraw, info, color, 0, false);

      if (DEBUG_MAP_ENABLED && wallPoly)
        drawDepthDebug(wallPoly, playerFeet, getPolygonDepthYAtX);
    }
  }

if (DEBUG_MAP_ENABLED) {  
  drawDebugPlayerBox(playerBoxPos, playerBoxSize);  
  drawDebugGrid(map, playerPos, playerFeetOffset, PPU);  
  drawDebugRevealRadius(playerPos, playerFeetOffset, 1.5, TILE_W, TILE_H); // Pass playerFeetOffset  
}

  for (const e of entities)
    e.draw?.();
}
