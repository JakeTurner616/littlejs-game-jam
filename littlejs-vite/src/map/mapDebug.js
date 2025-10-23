// src/map/mapDebug.js
'use strict';
import {
  drawLine, vec2, rgb, screenToWorld, mousePosScreen, mouseWasPressed, Color, keyWasPressed, drawText
} from 'littlejsengine';
import { isoToWorld, worldToIso } from './isoMath.js';

/*───────────────────────────────────────────────
  ELEVATION OFFSET STATE
───────────────────────────────────────────────*/
let currentOffsetIndex = 0;
let availableOffsets = [0];

/**
 * Renders debug grid, hover highlight, player marker, and colliders.
 * Now also supports depth polygon debug visualization for walls + objects.
 */
export function renderMapDebug(map, playerPos, playerFeetOffset, PPU, DEBUG_ENABLED = true) {
  if (!DEBUG_ENABLED || !map.mapData) return;

  const { mapData, layers, colliders, TILE_W, TILE_H, floorOffsets } = map;
  const { width, height } = mapData;
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;

  if (availableOffsets.length === 1 && floorOffsets) {
    const values = Array.from(floorOffsets.values());
    const unique = [0, ...values.filter((v, i, a) => a.indexOf(v) === i)];
    availableOffsets = unique.sort((a, b) => a - b);
  }

  if (keyWasPressed('KeyQ')) {
    currentOffsetIndex = (currentOffsetIndex - 1 + availableOffsets.length) % availableOffsets.length;
    console.log('[MapDebug] Switched to offset', availableOffsets[currentOffsetIndex]);
  }
  if (keyWasPressed('KeyE')) {
    currentOffsetIndex = (currentOffsetIndex + 1) % availableOffsets.length;
    console.log('[MapDebug] Switched to offset', availableOffsets[currentOffsetIndex]);
  }

  const floorOffsetWorld = availableOffsets[currentOffsetIndex] || 0;
  const anchorOffsetY = ((4.0) - TILE_H) / 2 * 2;

  // ──────────────────────────────────────────────
  // GRID
  // ──────────────────────────────────────────────
  const gridColor = rgb(0, 1, 0);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const p = isoToWorld(c, r, width, height, TILE_W, TILE_H)
        .subtract(vec2(0, anchorOffsetY + floorOffsetWorld));
      drawDiamond(p, halfW, halfH, gridColor, 0.02);
    }
  }

  // Hover highlight
  const worldMouse = screenToWorld(mousePosScreen);
  const isoMouse = worldToIso(
    worldMouse.x, worldMouse.y, width, height, TILE_W, TILE_H, anchorOffsetY + floorOffsetWorld - 0.5
  );
  const cMouse = Math.floor(isoMouse.x);
  const rMouse = Math.floor(isoMouse.y);
  if (cMouse >= 0 && cMouse < width && rMouse >= 0 && rMouse < height) {
    const pos = isoToWorld(cMouse, rMouse, width, height, TILE_W, TILE_H)
      .subtract(vec2(0, anchorOffsetY + floorOffsetWorld));
    drawDiamond(pos, halfW, halfH, rgb(1, 1, 0), 0.05);
  }

  // Player marker
  if (playerPos) {
    const feet = playerPos.add(playerFeetOffset);
    const isoPlayer = worldToIso(
      feet.x, feet.y, width, height, TILE_W, TILE_H, anchorOffsetY + floorOffsetWorld - 0.5
    );
    const cPlayer = Math.floor(isoPlayer.x);
    const rPlayer = Math.floor(isoPlayer.y);
    if (cPlayer >= 0 && rPlayer >= 0 && cPlayer < width && rPlayer < height) {
      const p = isoToWorld(cPlayer, rPlayer, width, height, TILE_W, TILE_H)
        .subtract(vec2(0, anchorOffsetY + floorOffsetWorld));
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

  // HUD offset text
  drawText(
    `Offset ${floorOffsetWorld.toFixed(3)} (${currentOffsetIndex + 1}/${availableOffsets.length})`,
    vec2(0.5, 0.5),
    0.25,
    rgb(1, 1, 1)
  );

  // ✅ NEW: visualize all depth polygons (walls + objects)
  drawAllDepthPolygons(map, playerPos, playerFeetOffset);
}

/**
 * Unified fade debug overlay: draws yellow polygon and blue depth line
 * for both wall and object depth polygons.
 */
function drawAllDepthPolygons(map, playerPos, playerFeetOffset) {
  const { _wallPolygonsCache, _objectSystemRef } = map;
  const playerFeet = playerPos.add(playerFeetOffset);

  // walls (cached in mapRenderer)
  if (Array.isArray(_wallPolygonsCache))
    for (const p of _wallPolygonsCache)
      drawDepthDebug({ worldPoly: p.worldPoly }, playerFeet, p._depthFunc);

  // objects (if objectSystem is attached)
  if (_objectSystemRef?.depthPolygons?.length)
    for (const p of _objectSystemRef.depthPolygons)
      drawDepthDebug({ worldPoly: p.polyPts }, playerFeet, _objectSystemRef.getDepthFunc?.());
}

/**
 * Draws one depth polygon (yellow outline) and its depth slice (blue line)
 */
export function drawDepthDebug(polyObj, playerFeet, getPolygonDepthYAtX) {
  if (!polyObj?.worldPoly) return;
  const pts = polyObj.worldPoly;

  // yellow polygon
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    drawLine(a, b, 0.03, new Color(1, 0.8, 0.1, 0.9));
  }

  // blue depth plane
  if (typeof getPolygonDepthYAtX === 'function') {
    const polyY = getPolygonDepthYAtX(playerFeet, pts);
    if (polyY !== null)
      drawLine(
        vec2(playerFeet.x - 0.15, polyY),
        vec2(playerFeet.x + 0.15, polyY),
        0.05,
        new Color(0.1, 0.6, 1, 0.9)
      );
  }
}

/** Utility diamond */
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
