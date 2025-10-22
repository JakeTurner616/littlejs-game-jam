// src/scenes/GameScene.js
'use strict';
import {
  vec2,
  setCameraPos,
  setCameraScale,
  drawText,
  hsl,
} from 'littlejsengine';

import { loadTiledMap } from '../map/mapLoader.js';
import { renderMap, setDebugMapEnabled } from '../map/mapRenderer.js';
import { PolygonEventSystem } from '../map/polygonEvents.js';
import { PlayerController } from '../character/playerController.js';
import { DialogBox } from '../ui/DialogBox.js';

setDebugMapEnabled(false);

export class GameScene {
  constructor(skipInit = false) {
    this.ready = skipInit;
    this.map = null;
    this.player = null;
    this.entities = [];
    this.dialog = new DialogBox();
    this.events = null;
  }

  async onEnter() {
    const PPU = 128;
    const MAP_PATH = '/assets/map/sample-iso.tmj';
    this.map = await loadTiledMap(MAP_PATH, PPU);

    const PLAYER_SPAWN = vec2(8.92, -12.67);
    this.player = new PlayerController(PLAYER_SPAWN, { idleStartIndex: 0, walkStartIndex: 8 }, PPU);
    this.player.setColliders(this.map.colliders);
    await this.player.loadAllAnimations();

    this.events = new PolygonEventSystem(this.map, () => {}, false);
    this.entities = [this.player];

    setCameraScale(PPU);
    setCameraPos(this.player.pos);

    await this.dialog.loadFont();
    this.dialog.visible = true;
    this.dialog.setText('Hello world.');
    this.ready = true;
  }

  isLoaded() {
    return this.ready && this.player && this.map && this.player.ready;
  }

  update() {
    if (!this.isLoaded()) return;
    this.player.update();
    this.events?.update();
    this.dialog.update(1 / 60);
  }

  updatePost() {
    if (this.isLoaded()) setCameraPos(this.player.pos);
  }

  render() {
    if (!this.isLoaded()) {
      drawText('Loading...', vec2(0, 0), 0.5, hsl(0.1, 1, 0.7));
      return;
    }

    renderMap(
      this.map,
      this.player.ppu,
      this.player.pos,
      this.player.pos,
      this.player.feetOffset
    );

    this.events?.renderHoverOverlay();
    for (const e of this.entities)
      e?.draw?.();

    if (this.dialog.visible)
      this.dialog.draw();
  }

  renderPost() {}
}
