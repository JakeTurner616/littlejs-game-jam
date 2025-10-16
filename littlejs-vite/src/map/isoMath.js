// src/map/isoMath.js
import { vec2 } from 'littlejsengine';

/** Convert tile coordinates → world-space isometric position */
export function isoToWorld(c, r, mapW, mapH, tileW, tileH) {
  const x = (c - r) * (tileW / 2);
  const y = -(c + r) * (tileH / 2);
  const offsetX = (mapW - 1) * (tileW / 2);
  const offsetY = mapH * (tileH / 2);
  return vec2(x + offsetX, y + offsetY);
}

/** Convert Tiled pixel coordinates → world-space (optional use) */
export function tmxPxToWorld(xPx, yPx, mapW, mapH, tileW, tileH, ppu) {
  const xWorldUnit = xPx / ppu;
  const yWorldUnit = yPx / ppu;
  const xIso = (xWorldUnit - yWorldUnit) * (tileW / 2);
  const yIso = -(xWorldUnit + yWorldUnit) * (tileH / 2) ;
  const offsetX = (mapW - 1) * (tileW / 2);
  const offsetY = mapH * (tileH / 2);
  return vec2(xIso + offsetX, yIso + offsetY);
}
