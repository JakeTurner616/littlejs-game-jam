// src/map/mapDebug.js
'use strict';
import {
  drawLine, vec2, rgb, screenToWorld, mousePosScreen, mouseWasPressed
} from 'littlejsengine';
import { isoToWorld, worldToIso } from './isoMath.js';

/**
 * Draws grid, hover highlight, player tile marker, collider outlines, and click-debug.
 * Only runs when `DEBUG_ENABLED` is true.
 */
export function renderMapDebug(map, playerPos, playerFeetOffset, PPU, DEBUG_ENABLED = true) {
  if (!DEBUG_ENABLED || !map.mapData) return;

  const { mapData, layers, colliders, TILE_W, TILE_H } = map;
  const { width, height } = mapData;
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const anchorOffsetY = ((4.0) - TILE_H) / 2 * 2;

  const gridColor = rgb(0, 1, 0);

  // ──────────────────────────────────────────────
  // 🟩 GRID LINES
  // ──────────────────────────────────────────────
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const p = isoToWorld(c, r, width, height, TILE_W, TILE_H)
        .subtract(vec2(0, anchorOffsetY));
      const diamond = [
        vec2(p.x, p.y + halfH),
        vec2(p.x + halfW, p.y),
        vec2(p.x, p.y - halfH),
        vec2(p.x - halfW, p.y),
      ];
      for (let i = 0; i < 4; i++)
        drawLine(diamond[i], diamond[(i + 1) % 4], 0.02, gridColor);
    }
  }

  // ──────────────────────────────────────────────
  // 🟨 HOVER HIGHLIGHT
  // ──────────────────────────────────────────────
  const worldMouse = screenToWorld(mousePosScreen);
  const isoMouse = worldToIso(
    worldMouse.x, worldMouse.y, width, height, TILE_W, TILE_H, anchorOffsetY - 0.5
  );
  const cMouse = Math.floor(isoMouse.x);
  const rMouse = Math.floor(isoMouse.y);

  let hoverWorldPos = null;
  if (cMouse >= 0 && cMouse < width && rMouse >= 0 && rMouse < height) {
    hoverWorldPos = isoToWorld(cMouse, rMouse, width, height, TILE_W, TILE_H)
      .subtract(vec2(0, anchorOffsetY));
    drawDiamond(hoverWorldPos, halfW, halfH, rgb(1, 1, 0), 0.05);
  }

  // ──────────────────────────────────────────────
  // 🔵 PLAYER TILE MARKER
  // ──────────────────────────────────────────────
  if (playerPos) {
    const feet = playerPos.add(playerFeetOffset);
    const isoPlayer = worldToIso(
      feet.x, feet.y, width, height, TILE_W, TILE_H, anchorOffsetY - 0.5
    );
    const cPlayer = Math.floor(isoPlayer.x);
    const rPlayer = Math.floor(isoPlayer.y);

    if (cPlayer >= 0 && cPlayer < width && rPlayer >= 0 && rPlayer < height) {
      const p = isoToWorld(cPlayer, rPlayer, width, height, TILE_W, TILE_H)
        .subtract(vec2(0, anchorOffsetY));
      drawDiamond(p, halfW, halfH, rgb(0, 0.6, 1), 0.06);
    }
  }

  // ──────────────────────────────────────────────
  // 🔴 COLLIDERS
  // ──────────────────────────────────────────────
  if (colliders?.length) {
    const red = rgb(1, 0, 0);
    for (const c of colliders)
      for (let i = 0; i < c.pts.length; i++)
        drawLine(c.pts[i], c.pts[(i + 1) % c.pts.length], 0.06, red);
  }

  // ──────────────────────────────────────────────
  // 🧠 CLICK DEBUG
  // ──────────────────────────────────────────────
  if (mouseWasPressed(0) && hoverWorldPos) {
    const info = [];
    info.push('──────────── TILE DEBUG ────────────');
    info.push(`Grid: c=${cMouse}, r=${rMouse}`);
    info.push(`World: x=${hoverWorldPos.x.toFixed(3)}, y=${hoverWorldPos.y.toFixed(3)}`);

    for (const layer of layers) {
      if (layer.type !== 'tilelayer' || !layer.visible) continue;
      const gid = layer.data[rMouse * width + cMouse];
      info.push(`Layer: "${layer.name}"  GID: ${gid}`);
    }

    console.groupCollapsed(`🧭 Tile (${cMouse},${rMouse}) Debug`);
    info.forEach(line => console.log(line));
    console.groupEnd();
  }
}

/** helper */
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
