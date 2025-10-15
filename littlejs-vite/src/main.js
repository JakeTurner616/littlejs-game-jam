// src/main.js
'use strict';

import {
  engineInit, setShowSplashScreen, setTileFixBleedScale,
} from 'littlejsengine';

import { sceneManager } from './core/sceneManager.js';
import { TitleScene } from './scenes/TitleScene.js';

// ──────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────
setShowSplashScreen(false);
setTileFixBleedScale(0.5);

// All character sprite sheets must preload before engineInit completes
const preloadImages = [
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
  '/assets/character/Walk/Businessman_Walk_dir8.png',
];

// ──────────────────────────────────────────────────────────────
// ENGINE INIT
// ──────────────────────────────────────────────────────────────
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