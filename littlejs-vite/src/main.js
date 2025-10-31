// src/main.js
'use strict';
import {
  engineInit,
  setShowSplashScreen,
  setTileFixBleedScale,
  setSoundVolume,
  setSoundDefaultRange,
} from 'littlejsengine';
import { sceneManager } from './core/sceneManager.js';
import { TitleScene } from './scenes/TitleScene.js';
import { preloadPortraits } from './util/portraitCache.js';

setShowSplashScreen(false);
setTileFixBleedScale(0.5);

// Global sound configuration
setSoundVolume(0.6);
setSoundDefaultRange(40);

// ──────────────────────────────────────────────
// 1️⃣ LITTLE MAN (player)
// ──────────────────────────────────────────────
const playerTextures = [
  // Idle (8 directions)
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir1.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir2.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir3.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir4.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir5.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir6.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir7.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir8.png',

  // Walk (8 directions)
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir1.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir2.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir3.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir4.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir5.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir6.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir7.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir8.png',

  // Take (8 directions)
  '/assets/little-man/littleman-take/littleman-take_export_ArmaturemixamocomLayer0_dir1.png',
  '/assets/little-man/littleman-take/littleman-take_export_ArmaturemixamocomLayer0_dir2.png',
  '/assets/little-man/littleman-take/littleman-take_export_ArmaturemixamocomLayer0_dir3.png',
  '/assets/little-man/littleman-take/littleman-take_export_ArmaturemixamocomLayer0_dir4.png',
  '/assets/little-man/littleman-take/littleman-take_export_ArmaturemixamocomLayer0_dir5.png',
  '/assets/little-man/littleman-take/littleman-take_export_ArmaturemixamocomLayer0_dir6.png',
  '/assets/little-man/littleman-take/littleman-take_export_ArmaturemixamocomLayer0_dir7.png',
  '/assets/little-man/littleman-take/littleman-take_export_ArmaturemixamocomLayer0_dir8.png',
];

// ──────────────────────────────────────────────
// 2️⃣ BOXER (melee character)
// ──────────────────────────────────────────────
const MapAssets = [
  '/assets/map/inside.tmj',
  '/assets/map/outside.tmj',
  '/assets/map/indoor-room.tmj',
];

const portraitTextures = [
  '/assets/portraits/doorway.png',
  '/assets/portraits/window_face.png',
];
preloadPortraits(portraitTextures);
const witchTextures = [
  '/assets/witch/ghost_woman_idle/ghost-woman-idle_export_ArmaturemixamocomLayer0001_dir1.png',
];

// Combined preload list
const preloadImages = [
  ...playerTextures,
  ...MapAssets,
  ...portraitTextures,
  ...witchTextures,
];

// ──────────────────────────────────────────────
// ENGINE INIT
// ──────────────────────────────────────────────
engineInit(
  gameInit,
  gameUpdate,
  gameUpdatePost,
  gameRender,
  gameRenderPost,
  preloadImages
);

function gameInit() {
  sceneManager.set(new TitleScene());
}
function gameUpdate() {
  sceneManager.update();
}
function gameUpdatePost() {
  sceneManager.updatePost();
}
function gameRender() {
  sceneManager.render();
}
function gameRenderPost() {
  sceneManager.renderPost();
}

// Export texture index bases
export const PLAYER_TEXTURE_BASE = 0;
export const BOXER_TEXTURE_BASE = playerTextures.length;