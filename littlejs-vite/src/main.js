// src/main.js
'use strict';
import {
  engineInit, setShowSplashScreen, setTileFixBleedScale,
} from 'littlejsengine';
import { sceneManager } from './core/sceneManager.js';
import { TitleScene } from './scenes/TitleScene.js';

setShowSplashScreen(false);
setTileFixBleedScale(0.5);

// ──────────────────────────────────────────────
// 1️⃣ BUSINESSMAN (player)
// ──────────────────────────────────────────────
const playerTextures = [
  '/assets/character/Idle/Businessman_Idle_dir1.png',
  '/assets/character/Idle/Businessman_Idle_dir2.png',
  '/assets/character/Idle/Businessman_Idle_dir3.png',
  '/assets/character/Idle/Businessman_Idle_dir4.png',
  '/assets/character/Idle/Businessman_Idle_dir5.png',
  '/assets/character/Idle/Businessman_Idle_dir6.png',
  '/assets/character/Idle/Businessman_Idle_dir7.png',
  '/assets/character/Idle/Businessman_Idle_dir8.png',
  '/assets/character/Walk/Businessman_Walk_dir1.png',
  '/assets/character/Walk/Businessman_Walk_dir2.png',
  '/assets/character/Walk/Businessman_Walk_dir3.png',
  '/assets/character/Walk/Businessman_Walk_dir4.png',
  '/assets/character/Walk/Businessman_Walk_dir5.png',
  '/assets/character/Walk/Businessman_Walk_dir6.png',
  '/assets/character/Walk/Businessman_Walk_dir7.png',
  '/assets/character/Walk/Businessman_Walk_dir8.png',
];

// ──────────────────────────────────────────────
// 2️⃣ BOXER (melee character)
// ──────────────────────────────────────────────
const boxerTextures = [
  // Idle1 (used for standing still)
  '/assets/melee-character/Idle1/Boxer__Idle1_dir1.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir2.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir3.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir4.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir5.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir6.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir7.png',
  '/assets/melee-character/Idle1/Boxer__Idle1_dir8.png',

  // WalkFoward (used for moving)
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

function gameInit() { sceneManager.set(new TitleScene()); }
function gameUpdate() { sceneManager.update(); }
function gameUpdatePost() { sceneManager.updatePost(); }
function gameRender() { sceneManager.render(); }
function gameRenderPost() { sceneManager.renderPost(); }

// Export texture index bases
export const PLAYER_TEXTURE_BASE = 0;
export const BOXER_TEXTURE_BASE = playerTextures.length; // Boxer starts after player
