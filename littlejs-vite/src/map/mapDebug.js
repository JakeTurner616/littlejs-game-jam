// src/map/mapDebug.js
'use strict';
import {
  drawLine, vec2, rgb, screenToWorld, mousePosScreen, mouseWasPressed, Color
} from 'littlejsengine';
import { isoToWorld, worldToIso } from './isoMath.js';

/** Draws full debug grid, hover highlight, player marker, and colliders. */
export function renderMapDebug(map, playerPos, playerFeetOffset, PPU, DEBUG_ENABLED = true) {
  if (!DEBUG_ENABLED || !map.mapData) return;
  const { mapData, layers, colliders, TILE_W, TILE_H } = map;
  const { width, height } = mapData;
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const anchorOffsetY = ((4.0) - TILE_H) / 2 * 2;

  // Grid
  const gridColor = rgb(0, 1, 0);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const p = isoToWorld(c, r, width, height, TILE_W, TILE_H)
        .subtract(vec2(0, anchorOffsetY));
      drawDiamond(p, halfW, halfH, gridColor, 0.02);
    }
  }

  // Hover highlight
  const worldMouse = screenToWorld(mousePosScreen);
  const isoMouse = worldToIso(
    worldMouse.x, worldMouse.y, width, height, TILE_W, TILE_H, anchorOffsetY - 0.5
  );
  const cMouse = Math.floor(isoMouse.x);
  const rMouse = Math.floor(isoMouse.y);
  if (cMouse >= 0 && cMouse < width && rMouse >= 0 && rMouse < height) {
    const pos = isoToWorld(cMouse, rMouse, width, height, TILE_W, TILE_H)
      .subtract(vec2(0, anchorOffsetY));
    drawDiamond(pos, halfW, halfH, rgb(1, 1, 0), 0.05);
  }

  // Player marker
  if (playerPos) {
    const feet = playerPos.add(playerFeetOffset);
    const isoPlayer = worldToIso(
      feet.x, feet.y, width, height, TILE_W, TILE_H, anchorOffsetY - 0.5
    );
    const cPlayer = Math.floor(isoPlayer.x);
    const rPlayer = Math.floor(isoPlayer.y);
    if (cPlayer >= 0 && rPlayer >= 0 && cPlayer < width && rPlayer < height) {
      const p = isoToWorld(cPlayer, rPlayer, width, height, TILE_W, TILE_H)
        .subtract(vec2(0, anchorOffsetY));
      drawDiamond(p, halfW, halfH, rgb(0, 0.6, 1), 0.06);
    }
  }

  // Colliders
  if (colliders?.length) {
    const red = rgb(1, 0, 0);
    for (const c of colliders)
      for (let i = 0; i < c.pts.length; i++)
        drawLine(c.pts[i], c.pts[(i + 1) % c.pts.length], 0.06, red);
  }

  // Click debug
  if (mouseWasPressed(0))
    console.log('Tile debug clicked at', cMouse, rMouse);
}

/** Draws the wall polygon (yellow) and casted depth plane (blue). */
export function drawDepthDebug(wallPoly, playerFeet, getPolygonDepthYAtX) {
  if (!wallPoly) return;
  const pts = wallPoly.worldPoly;

  // Yellow polygon
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    drawLine(a, b, 0.03, new Color(1, 0.8, 0.1, 0.9));
  }

  // Blue horizontal depth slice
  const polyY = getPolygonDepthYAtX(playerFeet, pts);
  if (polyY !== null) {
    drawLine(
      vec2(playerFeet.x - 0.15, polyY),
      vec2(playerFeet.x + 0.15, polyY),
      0.05,
      new Color(0.1, 0.6, 1, 0.9)
    );
  }
}

/** Utility to draw diamonds for grid and highlights. */
function drawDiamond(center, halfW, halfH, color, thick) {
  const p = center;
  const pts = [
    vec2(p.x, p.y + halfH),
    vec2(p.x + halfW, p.y),
    vec2(p.x, p.y - halfH),
    vec2(p.x - halfW, p.y),
  ];
  for (let i = 0; i < 4; i++)
    drawLine(pts[i], pts[(i + 1) % 4], thick, color);
}
