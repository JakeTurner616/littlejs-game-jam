// src/scenes/GameScene.js
'use strict';
import {
  vec2,
  setCameraPos,
  setCameraScale,
  keyWasPressed,
  drawText,
  hsl,
} from 'littlejsengine';

import { loadTiledMap } from '../map/mapLoader.js';
import { renderMap, setDebugMapEnabled } from '../map/mapRenderer.js';
import { PlayerController } from '../character/playerController.js';
import { MeleeCharacterController } from '../character/meleeCharacterController.js';

export class GameScene {
  constructor(skipInit = false) {
    this.ready = skipInit;
    this.map = null;
    this.player = null;
    this.enemy = null;
    this.entities = [];

    // Optional debug toggle
    setDebugMapEnabled(true);
  }

  // ──────────────────────────────────────────────
  // INITIALIZATION (ASYNC)
  // ──────────────────────────────────────────────
  async onEnter() {
    console.log('Entered Game Scene');

    const PPU = 128;
    const MAP_PATH = '/assets/map/sample-iso.tmj';

    // Load map data (includes objectLayers + colliders)
    this.map = await loadTiledMap(MAP_PATH, PPU);

    // Create player and load animations
    this.player = new PlayerController(vec2(0, 0), { idleStartIndex: 0, walkStartIndex: 8 }, PPU);
    this.player.setColliders(this.map.colliders);
    await this.player.loadAllAnimations(); // wait for frames to initialize

    // Create and prepare test enemy
    this.enemy = new MeleeCharacterController(vec2(10, -6), PPU);
    await this.enemy.loadAllAnimations();

    this.entities = [this.player, this.enemy];

    // Camera setup
    setCameraScale(PPU);
    setCameraPos(this.player.pos);

    // ✅ Scene is now ready for rendering and updating
    this.ready = true;
  }

  // ──────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────
  update() {
    if (!this.ready || !this.player) return;

    this.player.update();
    this.enemy?.update();

    // Debug animation cycling
    if (keyWasPressed('KeyE') || keyWasPressed('KeyQ')) {
      const dir = keyWasPressed('KeyE') ? 1 : -1;
      const list = Object.keys(this.enemy.animationMeta);
      this.debugIndex = (this.debugIndex ?? 0) + dir;
      if (this.debugIndex < 0) this.debugIndex = list.length - 1;
      if (this.debugIndex >= list.length) this.debugIndex = 0;
      this.enemy.state = list[this.debugIndex];
      this.enemy.frameIndex = 0;
      this.enemy.frameTimer = 0;
      console.log(`Enemy animation → ${this.enemy.state}`);
    }
  }

  updatePost() {
    // ✅ guard against null player
    if (!this.ready || !this.player) return;
    setCameraPos(this.player.pos);
  }

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────
  render() {
    // ✅ guard against null player/map
    if (!this.ready || !this.player || !this.map) {
      drawText('Loading...', vec2(0, 0), 0.5, hsl(0, 0, 1));
      return;
    }

    // ✅ Render the map (with DepthPolygons fade)
    renderMap(
      this.map,
      this.player.ppu,
      this.player.pos,
      this.player.pos,
      this.player.feetOffset
    );

    // ✅ Y-sorted entity rendering
    const drawables = this.entities
      .filter(e => e && e.pos && e.draw)
      .map(e => ({ y: e.pos.y, draw: () => e.draw() }));

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Debug text for current enemy animation
    drawText(
      this.enemy?.state || '',
      this.enemy?.pos?.add(vec2(0, 2)) || vec2(0, 0),
      0.3,
      hsl(0.1, 1, 0.5)
    );
  }

  renderPost() {}
}