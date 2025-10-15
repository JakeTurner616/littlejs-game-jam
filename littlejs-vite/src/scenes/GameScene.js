// src/scenes/GameScene.js
'use strict';
import {
  vec2, setCameraPos, setCameraScale, drawText, hsl
} from 'littlejsengine';
import { loadTiledMap } from '../map/mapLoader.js';
import { renderMap } from '../map/mapRenderer.js';
import { PlayerController } from '../character/playerController.js';

const MAP_PATH = '/assets/map/sample-iso.tmj';
const PPU = 128;

export class GameScene {
  constructor() {
    this.ready = false;
    this.map = null;
    this.player = null;
  }

  async onEnter() {
    console.log('Entered Game Scene');
    try {
      // Load map and player in parallel
      const [map] = await Promise.all([
        loadTiledMap(MAP_PATH, PPU)
      ]);

      this.map = map;
      this.player = new PlayerController(vec2(8, -6), {
        idleStartIndex: 0,
        walkStartIndex: 8,
      }, PPU);

      await this.player.loadAllAnimations();

      setCameraPos(this.player.pos);
      setCameraScale(PPU);

      this.ready = true;
      console.log('GameScene ready');
    } catch (e) {
      console.error('Failed to load game scene:', e);
    }
  }

  update() {
    if (!this.ready) return;
    this.player.update();
  }

  updatePost() {
    if (!this.ready) return;
    setCameraPos(this.player.pos);
  }

  render() {
    if (!this.ready) {
      // Loading screen
      drawText('Loading...', vec2(0, 0), 0.5, hsl(0, 0, 1));
      return;
    }

    renderMap(this.map, PPU, this.player.pos);
    this.player.draw();
  }

  renderPost() {}
}
