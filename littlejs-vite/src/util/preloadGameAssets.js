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

  console.log('Preloading map and Little Man...');
  const [map] = await Promise.all([loadTiledMap(MAP_PATH, PPU)]);

  const player = new PlayerController(vec2(8, -6), {
    idleStartIndex: 0,
    walkStartIndex: 8,
  }, PPU);
  await player.loadAllAnimations();

  if (map.colliders && map.colliders.length) {
    player.setColliders(map.colliders);
    console.log(`Loaded ${map.colliders.length} map colliders`);
  } else {
    console.warn('No colliders found in map.');
  }

  cachedMap = map;
  cachedPlayer = player;
}
