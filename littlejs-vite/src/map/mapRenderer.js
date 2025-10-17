// src/map/mapRenderer.js
'use strict';

import {
  drawTile,
  drawRect,
  vec2,
  hsl,
} from 'littlejsengine';
import { isoToWorld } from './isoMath.js';
import { renderMapDebug } from './mapDebug.js';

// Internal flag (not exported directly)
let DEBUG_MAP_ENABLED = true;

// Functions to control it safely
export function setDebugMapEnabled(v) { DEBUG_MAP_ENABLED = !!v; }
export function isDebugMapEnabled() { return DEBUG_MAP_ENABLED; }

export function renderMap(map, PPU, cameraPos, playerPos, playerFeetOffset = vec2(0, 0.45)) {
  if (!map.mapData) return;

  const { mapData, rawImages, tileInfos, layers, TILE_W, TILE_H } = map;
  const { width, height } = mapData;

  // Background
  drawRect(vec2(0, 0), vec2(9999, 9999), hsl(0, 0, 0.15));

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

        drawTile(worldPos.subtract(vec2(0, anchorOffsetY)),
          vec2(imgW_world, imgH_world), info);
      }
    }
  }

  // ──────────────────────────────────────────────
  // Optional debug overlay
  // ──────────────────────────────────────────────
  if (DEBUG_MAP_ENABLED)
    renderMapDebug(map, playerPos, playerFeetOffset, PPU, true);
}
