// src/map/isoMath.js
import { vec2 } from 'littlejsengine';

/* --------------------------------------------------------------------------
   ISOMETRIC COORDINATE MATH — MATCHES TILED "RIGHT-DOWN" ORIENTATION
   --------------------------------------------------------------------------
   Tiled's grid cells are nominally 256×128, but the real visual footprint of
   each tile in this project is 256×248 px. We treat that as the effective
   isometric cell size so that debug overlays (green lines, hover diamonds)
   and collision geometry align with what is seen on-screen.
---------------------------------------------------------------------------*/

export const TILE_PX_W = 256;
export const TILE_PX_H = 128;

/**
 * Convert grid coordinates (column c, row r)
 * → world-space position (bottom-center anchor).
 */
export function isoToWorld(c, r, mapW, mapH, tileW, tileH) {
  const x = (c - r) * (tileW / 2);
  const y = -(c + r) * (tileH / 2);

  const offsetX = (mapW - 1) * (tileW / 2);
  const offsetY = 0;

  return vec2(x + offsetX, y + offsetY);
}

/**
 * Convert world-space position → fractional tile coordinates.
 * (Inverse of isoToWorld)
 * Optional anchorOffsetY ensures perfect sync with debug grid and rendering.
 */
export function worldToIso(worldX, worldY, mapW, mapH, tileW, tileH, anchorOffsetY = 0) {
  const tw = tileW;
  const th = TILE_PX_H / (TILE_PX_W / tileW);
  const offsetX = (mapW - 1) * (tw / 2);
  const offsetY = 0;

  // ✅ Adjust for same anchor offset as isoToWorld() rendering
  const adjY = worldY + anchorOffsetY;

  const x = worldX - offsetX;
  const y = adjY - offsetY;

  const c = (x / (tw / 2) - y / (th / 2)) / 2;
  const r = (-y / (th / 2) - x / (tw / 2)) / 2;

  return vec2(c, r);
}

/**
 * Convert Tiled pixel coordinates → world-space (south anchor)
 */
export function tmxPxToWorld(xPx, yPx, mapW, mapH, tileW, tileH, ppu) {
  const tw = tileW;
  const th = TILE_PX_H / (TILE_PX_W / tileW);

  const xWorld = xPx / ppu;
  const yWorld = yPx / ppu;

  // Tiled uses Y-down, so we need to convert
  const xIso = (xWorld - yWorld) * (tw / 2);
  const yIso = -(xWorld + yWorld) * (th / 2);

  const offsetX = (mapW - 1) * (tw / 2);
  const offsetY = (mapH - 1) * (th / 2);

  return vec2(xIso + offsetX, yIso + offsetY);
}
