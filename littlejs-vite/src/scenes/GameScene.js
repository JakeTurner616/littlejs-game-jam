// src/scenes/GameScene.js
'use strict';
import {
  vec2,
  setCameraPos,
  setCameraScale,
  keyWasPressed,
  drawText,
  hsl,
  timeDelta,
} from 'littlejsengine';

import { loadTiledMap } from '../map/mapLoader.js';
import { renderMap, setDebugMapEnabled } from '../map/mapRenderer.js';
import { PlayerController } from '../character/playerController.js';
import { DialogBox } from '../ui/DialogBox.js';
import { audioManager } from '../audio/AudioManager.js';

export class GameScene {
  constructor(skipInit = false) {
    this.ready = skipInit;
    this.map = null;
    this.player = null;
    this.entities = [];
    this.dialog = new DialogBox();

    setDebugMapEnabled(true);
  }

  /*───────────────────────────────────────────────
   INITIALIZATION (ASYNC)
  ────────────────────────────────────────────────*/
  async onEnter() {
    console.log('[GameScene] Entered Game Scene');

    const PPU = 128;
    const MAP_PATH = '/assets/map/sample-iso.tmj';

    try {
      console.log('[GameScene] Loading map...');
      this.map = await loadTiledMap(MAP_PATH, PPU);
      console.log('[GameScene] Map loaded successfully');
    } catch (err) {
      console.error('[GameScene] Failed to load map:', err);
      return;
    }

    try {
      console.log('[GameScene] Creating player...');
      this.player = new PlayerController(vec2(0, 0), { idleStartIndex: 0, walkStartIndex: 8 }, PPU);
      this.player.setColliders(this.map.colliders);
      await this.player.loadAllAnimations();
      console.log('[GameScene] Player loaded and ready:', this.player.ready);
    } catch (err) {
      console.error('[GameScene] Failed to create or load player:', err);
      return;
    }

    // Register player entity
    this.entities = [this.player];

    // Camera setup
    setCameraScale(PPU);
    setCameraPos(this.player.pos);

    // Load RPG dialog font
    console.log('[GameScene] Loading dialog font...');
    await this.dialog.loadFont();
    this.dialog.setText('Got a letter last week. No return address. Just three words:');
    console.log('[GameScene] Dialog font ready');

    // Load and play music
    console.log('[GameScene] Starting background music...');
    audioManager.playMusic('/assets/audio/prologue.ogg', 0.6, true, true); // streaming mode`

    // ✅ Scene ready
    this.ready = true;
    console.log('[GameScene] Scene ready → map, player, and audio initialized');
  }

  /*───────────────────────────────────────────────
   UPDATE
  ────────────────────────────────────────────────*/
  update() {
    if (!this.ready) return;

    if (!this.player?.ready) {
      console.warn('[GameScene] Player not ready yet, skipping update');
      return;
    }

    this.player.update();
    this.dialog.update(timeDelta);

    // Toggle dialog for testing
    if (keyWasPressed('Space')) {
      this.dialog.visible = !this.dialog.visible;
      if (this.dialog.visible) {
        console.log('[GameScene] Dialog opened');
        audioManager.playSound('dialog');
        this.dialog.setText('Press SPACE again to hide this text.');
      } else {
        console.log('[GameScene] Dialog closed');
      }
    }
  }

  updatePost() {
    if (this.ready && this.player) setCameraPos(this.player.pos);
  }

  /*───────────────────────────────────────────────
   RENDER
  ────────────────────────────────────────────────*/
  render() {
    if (!this.ready) {
      drawText('Loading...', vec2(0, 0), 0.5, hsl(0, 0, 1));
      return;
    }

    if (!this.player?.ready || !this.map) {
      drawText('Loading player...', vec2(0, 0), 0.5, hsl(0.1, 1, 0.7));
      return;
    }

    // Render map first
    renderMap(
      this.map,
      this.player.ppu,
      this.player.pos,
      this.player.pos,
      this.player.feetOffset
    );

    // Draw all entities (player included)
    for (const e of this.entities) {
      if (e?.draw) e.draw();
    }

    // Draw dialog box above player
    this.dialog.draw(this.player.pos.add(vec2(0, -5.5)));
  }

  renderPost() {}
}
