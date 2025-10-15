// src/main.js
'use strict';

import {
  engineInit, vec2, setCameraPos, setCameraScale,
  setShowSplashScreen, setTileFixBleedScale
} from 'littlejsengine';

import { loadTiledMap } from './map/mapLoader.js';
import { renderMap } from './map/mapRenderer.js';
import { PlayerController } from './character/playerController.js';

// ──────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────
const MAP_PATH = '/assets/map/sample-iso.tmj';
const PPU = 128;
let map, cameraPos, player;

// Disable splash and texture bleeding
setShowSplashScreen(false);
setTileFixBleedScale(0.5);

// ──────────────────────────────────────────────────────────────
// ENGINE INIT — all lifecycle callbacks are defined
// ──────────────────────────────────────────────────────────────
engineInit(
  gameInit,
  gameUpdate,
  gameUpdatePost,
  gameRender,
  gameRenderPost,
  [
    // Idle directions
    '/assets/character/Idle/Businessman_Idle_dir1.png',
    '/assets/character/Idle/Businessman_Idle_dir2.png',
    '/assets/character/Idle/Businessman_Idle_dir3.png',
    '/assets/character/Idle/Businessman_Idle_dir4.png',
    '/assets/character/Idle/Businessman_Idle_dir5.png',
    '/assets/character/Idle/Businessman_Idle_dir6.png',
    '/assets/character/Idle/Businessman_Idle_dir7.png',
    '/assets/character/Idle/Businessman_Idle_dir8.png',
    // Walk directions
    '/assets/character/Walk/Businessman_Walk_dir1.png',
    '/assets/character/Walk/Businessman_Walk_dir2.png',
    '/assets/character/Walk/Businessman_Walk_dir3.png',
    '/assets/character/Walk/Businessman_Walk_dir4.png',
    '/assets/character/Walk/Businessman_Walk_dir5.png',
    '/assets/character/Walk/Businessman_Walk_dir6.png',
    '/assets/character/Walk/Businessman_Walk_dir7.png',
    '/assets/character/Walk/Businessman_Walk_dir8.png'
  ]
);

// ──────────────────────────────────────────────────────────────
// LIFECYCLE METHODS
// ──────────────────────────────────────────────────────────────
async function gameInit() {
  // Load the map
  map = await loadTiledMap(MAP_PATH, PPU);

  // ── MANUAL SPAWN VECTOR (simple and explicit)
  const spawnPos = vec2(8, -6); // world-space position

  // Create the player and pass PPU for correct movement scaling
  player = new PlayerController(spawnPos, {
    idleStartIndex: 0,
    walkStartIndex: 8
  }, PPU);

  await player.loadAllAnimations();

  // Center camera on player
  cameraPos = vec2(spawnPos.x, spawnPos.y);
  setCameraPos(cameraPos);
  setCameraScale(PPU);
}

function gameUpdate() {
  player?.update();
}

// ──────────────────────────────────────────────────────────────
// CAMERA FOLLOW LOGIC
// ──────────────────────────────────────────────────────────────
function gameUpdatePost() {
  if (player) {
    cameraPos = vec2(player.pos.x, player.pos.y);
    setCameraPos(cameraPos);
  }
}

// ──────────────────────────────────────────────────────────────
// RENDERING
// ──────────────────────────────────────────────────────────────
function gameRender() {
  renderMap(map, PPU, cameraPos);
  player?.draw();
}

function gameRenderPost() {
  // Optional debug overlays
}
