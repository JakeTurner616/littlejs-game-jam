// src/map/renderDebug.js — 🧩 Debug utilities
'use strict';
import { drawRect, Color } from 'littlejsengine';
import { renderMapDebug } from './mapDebug.js';

export function drawDebugPlayerBox(pos, size) {
  drawRect(pos, size, new Color(0, 1, 0, 1), 0.04, true);
}

export function drawDebugGrid(map, playerPos, playerFeetOffset, PPU) {
  renderMapDebug(map, playerPos, playerFeetOffset, PPU, true);
}
