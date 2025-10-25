// src/map/mapDebug.js
'use strict';
import {
  drawLine, vec2, rgb, screenToWorld, mousePosScreen, mouseWasPressed,
  Color, keyWasPressed, drawText
} from 'littlejsengine';
import { isoToWorld, worldToIso } from './isoMath.js';

let currentOffsetIndex = 0;
let availableOffsets = [0];

/**
 * Renders grid, hover highlight, player marker, colliders,
 * and (NEW) object + wall depth polygons.
 */
export function renderMapDebug(map, playerPos, playerFeetOffset, PPU, DEBUG_ENABLED = true) {
  if (!DEBUG_ENABLED || !map.mapData) return;

  const { mapData, colliders, TILE_W, TILE_H, floorOffsets } = map;
  const { width, height } = mapData;
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;

  // collect all offset levels
  if (availableOffsets.length === 1 && floorOffsets) {
    const values = Array.from(floorOffsets.values());
    const unique = [0, ...values.filter((v, i, a) => a.indexOf(v) === i)];
    availableOffsets = unique.sort((a, b) => a - b);
  }

  // keyboard cycle
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

  /*───────────────────────────────────────────────
    GRID + HOVER
  ────────────────────────────────────────────────*/
  const gridColor = rgb(0, 1, 0);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const p = isoToWorld(c, r, width, height, TILE_W, TILE_H)
        .subtract(vec2(0, anchorOffsetY + floorOffsetWorld));
      drawDiamond(p, halfW, halfH, gridColor, 0.02);
    }
  }

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

  /*───────────────────────────────────────────────
    COLLIDERS
  ────────────────────────────────────────────────*/
  if (colliders?.length) {
    const red = rgb(1, 0, 0);
    for (const c of colliders)
      for (let i = 0; i < c.pts.length; i++)
        drawLine(c.pts[i], c.pts[(i + 1) % c.pts.length], 0.06, red);
  }

  /*───────────────────────────────────────────────
    DEPTH POLYGONS (orange) + DYNAMIC PLANE (blue)
  ────────────────────────────────────────────────*/
  const objectSys = map._objectSystemRef;
  if (objectSys?.depthPolygons?.length) {
    const orange = new Color(1, 0.6, 0, 0.9);
    for (const poly of objectSys.depthPolygons) {
      const pts = poly.polyPts;
      for (let i = 0; i < pts.length; i++)
        drawLine(pts[i], pts[(i + 1) % pts.length], 0.04, orange);
    }
  }

  // Blue dynamic plane — visualize getPolygonDepthYAtX() projection
  if (objectSys?.getDepthFunc && playerPos) {
    const func = objectSys.getDepthFunc();
    const feet = playerPos.add(playerFeetOffset);
    const blue = new Color(0.2, 0.6, 1, 0.9);

    for (const poly of objectSys.depthPolygons) {
      const polyY = func(feet, poly.polyPts);
      if (polyY !== null)
        drawLine(
          vec2(feet.x - 0.15, polyY),
          vec2(feet.x + 0.15, polyY),
          0.05,
          blue
        );
    }
  }

  /*───────────────────────────────────────────────
    CLICK LOG
  ────────────────────────────────────────────────*/
  if (mouseWasPressed(0)) {
    console.log(
      `%c[MapDebug] Clicked tile → World (X:${worldMouse.x.toFixed(2)}, Y:${worldMouse.y.toFixed(2)})`,
      'color:#6ff;font-weight:bold;'
    );
  }

  drawText(
    `Offset ${floorOffsetWorld.toFixed(3)} (${currentOffsetIndex + 1}/${availableOffsets.length})`,
    vec2(0.5, 0.5),
    0.25,
    rgb(1, 1, 1)
  );
}

/*───────────────────────────────────────────────
  DEPTH POLYGON DEBUG HELPER (used by mapRenderer)
───────────────────────────────────────────────*/
export function drawDepthDebug(polyObj, playerFeet, getPolygonDepthYAtX) {
  if (!polyObj?.worldPoly) return;
  const pts = polyObj.worldPoly;
  for (let i = 0; i < pts.length; i++)
    drawLine(pts[i], pts[(i + 1) % pts.length], 0.03, new Color(1, 0.8, 0.1, 0.9));

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

/*───────────────────────────────────────────────
  DIAMOND SHAPE HELPER
───────────────────────────────────────────────*/
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
