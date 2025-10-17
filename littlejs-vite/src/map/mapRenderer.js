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
  mouseWasPressed,
} from 'littlejsengine';
import { isoToWorld, worldToIso } from './isoMath.js';

/**
 * Render isometric Tiled map with grid, hover highlight, player highlight,
 * collider debug, and click-based tile inspector.
 */
export function renderMap(map, PPU, cameraPos, playerPos, playerFeetOffset = vec2(0, 0.45)) {
  if (!map.mapData) return;

  const { mapData, rawImages, tileInfos, layers, colliders, TILE_W, TILE_H } = map;
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
  // COMMON MEASUREMENTS
  // ──────────────────────────────────────────────
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const anchorOffsetY = ((4.0) - TILE_H) / 2 * 2;

  // ──────────────────────────────────────────────
  // 🟩 DEBUG GRID
  // ──────────────────────────────────────────────
  const gridColor = rgb(0, 1, 0);
  const showDebugTiles = true;

  if (showDebugTiles) {
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
  }

  // ──────────────────────────────────────────────
  // 🟨 HOVER TILE MARKER
  // ──────────────────────────────────────────────
  const worldMouse = screenToWorld(mousePosScreen);
  const isoMouse = worldToIso(
    worldMouse.x,
    worldMouse.y,
    width,
    height,
    TILE_W,
    TILE_H,
    anchorOffsetY - 0.5
  );
  const cMouse = Math.floor(isoMouse.x);
  const rMouse = Math.floor(isoMouse.y);

  let hoverWorldPos = null;
  if (cMouse >= 0 && cMouse < width && rMouse >= 0 && rMouse < height) {
    hoverWorldPos = isoToWorld(cMouse, rMouse, width, height, TILE_W, TILE_H)
      .subtract(vec2(0, anchorOffsetY));
    const diamond = [
      vec2(hoverWorldPos.x, hoverWorldPos.y + halfH),
      vec2(hoverWorldPos.x + halfW, hoverWorldPos.y),
      vec2(hoverWorldPos.x, hoverWorldPos.y - halfH),
      vec2(hoverWorldPos.x - halfW, hoverWorldPos.y),
    ];
    const yellow = rgb(1, 1, 0);
    for (let i = 0; i < 4; i++)
      drawLine(diamond[i], diamond[(i + 1) % 4], 0.05, yellow);
  }

  // ──────────────────────────────────────────────
  // 🔵 PLAYER TILE MARKER
  // ──────────────────────────────────────────────
  if (playerPos) {
    const feet = playerPos.add(playerFeetOffset);
    const isoPlayer = worldToIso(
      feet.x,
      feet.y,
      width,
      height,
      TILE_W,
      TILE_H,
      anchorOffsetY - 0.5
    );
    const cPlayer = Math.floor(isoPlayer.x);
    const rPlayer = Math.floor(isoPlayer.y);

    if (cPlayer >= 0 && cPlayer < width && rPlayer >= 0 && rPlayer < height) {
      const p = isoToWorld(cPlayer, rPlayer, width, height, TILE_W, TILE_H)
        .subtract(vec2(0, anchorOffsetY));
      const diamond = [
        vec2(p.x, p.y + halfH),
        vec2(p.x + halfW, p.y),
        vec2(p.x, p.y - halfH),
        vec2(p.x - halfW, p.y),
      ];
      const blue = rgb(0, 0.6, 1);
      for (let i = 0; i < 4; i++)
        drawLine(diamond[i], diamond[(i + 1) % 4], 0.06, blue);
    }
  }

  // ──────────────────────────────────────────────
  // 🔴 COLLIDER DEBUG LINES
  // ──────────────────────────────────────────────
  if (colliders && colliders.length) {
    const red = rgb(1, 0, 0);
    for (const collider of colliders) {
      const pts = collider.pts;
      if (!pts || pts.length < 2) continue;
      for (let i = 0; i < pts.length; i++)
        drawLine(pts[i], pts[(i + 1) % pts.length], 0.06, red);
    }
  }

  // ──────────────────────────────────────────────
  // 🧠 TILE DEBUGGER (CLICK)
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

    const neighbors = [
      { name: 'N', c: cMouse, r: rMouse - 1 },
      { name: 'S', c: cMouse, r: rMouse + 1 },
      { name: 'E', c: cMouse + 1, r: rMouse },
      { name: 'W', c: cMouse - 1, r: rMouse },
    ];
    info.push('Neighbors:');
    for (const n of neighbors) {
      if (n.c < 0 || n.r < 0 || n.c >= width || n.r >= height) continue;
      const gid = layers[0].data[n.r * width + n.c];
      info.push(`  ${n.name}: c=${n.c}, r=${n.r}, gid=${gid}`);
    }

    // Collider overlap test (rough AABB)
    const tileCenter = hoverWorldPos;
    const min = vec2(tileCenter.x - halfW, tileCenter.y - halfH);
    const max = vec2(tileCenter.x + halfW, tileCenter.y + halfH);
    const overlapping = colliders.filter(col =>
      col.pts.some(p => p.x >= min.x && p.x <= max.x && p.y >= min.y && p.y <= max.y)
    );
    if (overlapping.length) {
      info.push(`Overlapping Colliders: ${overlapping.length}`);
      for (const c of overlapping)
        info.push(`  • ID=${c.id}, Name=${c.name || '(unnamed)'}`);
    } else {
      info.push('Overlapping Colliders: none');
    }

    console.groupCollapsed(`🧭 Tile (${cMouse},${rMouse}) Debug`);
    info.forEach(line => console.log(line));
    console.groupEnd();
  }
}
