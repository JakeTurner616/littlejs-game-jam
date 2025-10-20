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
];

// ──────────────────────────────────────────────
// 2️⃣ BOXER (melee character)
// ──────────────────────────────────────────────
const boxerTextures = [
  '/assets/melee-character/Idle1/Boxer__Idle1_dir1.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir2.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir3.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir4.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir5.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir6.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir7.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir8.png',

  '/assets/melee-character/WalkFoward/Boxer__WalkFoward_dir1.png',
  '/assets/melee-character/WalkFoward/Boxer__WalkFoward_dir2.png',
  '/assets/melee-character/WalkFoward/Boxer__WalkFoward_dir3.png',
  '/assets/melee-character/WalkFoward/Boxer__WalkFoward_dir4.png',
  '/assets/melee-character/WalkFoward/Boxer__WalkFoward_dir5.png',
  '/assets/melee-character/WalkFoward/Boxer__WalkFoward_dir6.png',
  '/assets/melee-character/WalkFoward/Boxer__WalkFoward_dir7.png',
  '/assets/melee-character/WalkFoward/Boxer__WalkFoward_dir8.png',
];

// ──────────────────────────────────────────────
// 3️⃣ MAP TILESET
// ──────────────────────────────────────────────
const mapTextures = ['/assets/map/sample-iso.png'];

// Combined preload list
const preloadImages = [
  ...playerTextures,
  ...boxerTextures,
  ...mapTextures,
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