// src/util/preloadGameAssets.js
'use strict';
import { vec2 } from 'littlejsengine';
import { loadTiledMap } from '../map/mapLoader.js';
import { PlayerController } from '../character/playerController.js';

const MAP_PATH = '/assets/map/sample-iso.tmj';
const PPU = 128;

export let cachedMap = null;
export let cachedPlayer = null;

export async function preloadGameAssets() {
  if (cachedMap && cachedPlayer) return;

  console.log('Preloading map and player...');
  const [map] = await Promise.all([loadTiledMap(MAP_PATH, PPU)]);

  const player = new PlayerController(vec2(8, -6), {
    idleStartIndex: 0,
    walkStartIndex: 8,
  }, PPU);
  await player.loadAllAnimations();

  cachedMap = map;
  cachedPlayer = player;
}
