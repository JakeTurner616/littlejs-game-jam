// src/main.js — 🧩 Correct overlay-phase draw handling
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
setSoundVolume(0.6);
setSoundDefaultRange(40);

const playerTextures = [
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir1.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir2.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir3.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir4.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir5.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir6.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir7.png',
  '/assets/little-man/littleman-idle/littleman-idle-small_export_dir8.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir1.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir2.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir3.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir4.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir5.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir6.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir7.png',
  '/assets/little-man/littleman-walking/littleman-walking-small_export_dir8.png',
  '/assets/little-man/littleman-take/littleman-take-fullanimate_export_ArmaturemixamocomLayer0_dir1.png',
  '/assets/little-man/littleman-take/littleman-take-fullanimate_export_ArmaturemixamocomLayer0_dir2.png',
  '/assets/little-man/littleman-take/littleman-take-fullanimate_export_ArmaturemixamocomLayer0_dir3.png',
  '/assets/little-man/littleman-take/littleman-take-fullanimate_export_ArmaturemixamocomLayer0_dir4.png',
  '/assets/little-man/littleman-take/littleman-take-fullanimate_export_ArmaturemixamocomLayer0_dir5.png',
  '/assets/little-man/littleman-take/littleman-take-fullanimate_export_ArmaturemixamocomLayer0_dir6.png',
  '/assets/little-man/littleman-take/littleman-take-fullanimate_export_ArmaturemixamocomLayer0_dir7.png',
  '/assets/little-man/littleman-take/littleman-take-fullanimate_export_ArmaturemixamocomLayer0_dir8.png',
];

const mapAssets = [
  '/assets/map/inside.tmj',
  '/assets/map/outside.tmj',
  '/assets/map/indoor-room.tmj',
  '/assets/map/cornfield.tmj',
];

const portraitTextures = [
  '/assets/portraits/doorway.png',
  '/assets/portraits/window_face.png',
];
preloadPortraits(portraitTextures);

const witchTextures = [
  '/assets/witch/ghost_woman_idle/ghost-woman-idle_export_ArmaturemixamocomLayer0001_dir1.png',
];

const preloadImages = [
  ...playerTextures,
  ...mapAssets,
  ...portraitTextures,
  ...witchTextures,
];

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
  const s = sceneManager.current;
  if (s?.renderWorld) s.renderWorld();
  else sceneManager.render();
}
function gameRenderPost() {
  const s = sceneManager.current;
  if (s?.renderUI) s.renderUI();
  else sceneManager.renderPost();
}

export const PLAYER_TEXTURE_BASE = 0;
export const BOXER_TEXTURE_BASE = playerTextures.length;