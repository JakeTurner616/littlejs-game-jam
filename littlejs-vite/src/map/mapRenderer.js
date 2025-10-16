// src/map/mapRenderer.js
'use strict';

import {
  drawTile,
  drawLine,
  drawText,
  drawRect,
  vec2,
  hsl,
  rgb,
  mousePosScreen,
  screenToWorld,
} from 'littlejsengine';
import { isoToWorld, worldToIso } from './isoMath.js';

/**
 * Render isometric Tiled map with proper sprite anchoring,
 * hover highlighting, debug grid, and collider polygons.
 */
export function renderMap(map, PPU, cameraPos) {
  if (!map.mapData) return;

  const {
    mapData,
    rawImages,
    tileInfos,
    layers,
    objectLayers,
    colliders,
    TILE_W,
    TILE_H,
  } = map;
  const { width, height } = mapData;

  // Background
  drawRect(vec2(0, 0), vec2(9999, 9999), hsl(0, 0, 0.15));

  // ──────────────────────────────────────────────
  // RENDER TILE LAYERS
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
        const gridHeight = TILE_H;
        const anchorOffsetY = (imgH_world - gridHeight) / 2;

        drawTile(
          worldPos.subtract(vec2(0, anchorOffsetY)),
          vec2(imgW_world, imgH_world),
          info
        );
      }
    }
  }

  // ──────────────────────────────────────────────
  // DEBUG GRID
  // ──────────────────────────────────────────────
  const showDebugTiles = true;
  const lineColor = rgb(0, 1, 0);
  const textColor = rgb(1, 1, 0);

  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const imgH_world = 4.0; // 512px / 128 PPU
  const anchorOffsetY = (imgH_world - TILE_H) / 2 * 2;

  if (showDebugTiles) {
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const p = isoToWorld(c, r, width, height, TILE_W, TILE_H).subtract(
          vec2(0, anchorOffsetY)
        );

        const top = vec2(p.x, p.y + halfH);
        const right = vec2(p.x + halfW, p.y);
        const bottom = vec2(p.x, p.y - halfH);
        const left = vec2(p.x - halfW, p.y);

        drawLine(top, right, 0.02, lineColor);
        drawLine(right, bottom, 0.02, lineColor);
        drawLine(bottom, left, 0.02, lineColor);
        drawLine(left, top, 0.02, lineColor);

        drawText(
          `${c},${r}`,
          p.add(vec2(0, -TILE_H * 0.4)),
          TILE_H * 0.3,
          textColor,
          0,
          undefined,
          'center'
        );
      }
    }
  }

  // ──────────────────────────────────────────────
  // HOVER TILE MARKER 
  // ──────────────────────────────────────────────
  const worldMouse = screenToWorld(mousePosScreen);
  const iso = worldToIso(
    worldMouse.x,
    worldMouse.y,
    width,
    height,
    TILE_W,
    TILE_H,
    anchorOffsetY - 0.5 // matches debug grid 
  );
  const c = Math.floor(iso.x);
  const r = Math.floor(iso.y);

  if (c >= 0 && c < width && r >= 0 && r < height) {
    const p = isoToWorld(c, r, width, height, TILE_W, TILE_H).subtract(
      vec2(0, anchorOffsetY)
    );
    const top = vec2(p.x, p.y + halfH);
    const right = vec2(p.x + halfW, p.y);
    const bottom = vec2(p.x, p.y - halfH);
    const left = vec2(p.x - halfW, p.y);

    const hoverColor = rgb(1, 1, 0);
    drawLine(top, right, 0.05, hoverColor);
    drawLine(right, bottom, 0.05, hoverColor);
    drawLine(bottom, left, 0.05, hoverColor);
    drawLine(left, top, 0.05, hoverColor);
  }

  // ──────────────────────────────────────────────
  // COLLIDER DEBUG LINES (WORLD SPACE)
  // ──────────────────────────────────────────────
  if (colliders && colliders.length) {
    const colColor = rgb(1, 0, 0); // red outlines
    const thickness = 0.06;

    for (const collider of colliders) {
      const pts = collider.pts;
      if (!pts || pts.length < 2) continue;

      // Draw closed polygon
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        drawLine(a, b, thickness, colColor);
      }

      // Optionally draw collider ID
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      drawText(`#${collider.id}`, vec2(cx, cy), 0.4, colColor, 0);
    }
  }
}
