// src/scenes/GameScene.js
'use strict';
import {
  vec2, setCameraPos, setCameraScale, drawText, hsl
} from 'littlejsengine';
import { loadTiledMap } from '../map/mapLoader.js';
import { renderMap, setDebugMapEnabled } from '../map/mapRenderer.js';
import { PolygonEventSystem } from '../map/polygonEvents.js';
import { PlayerController } from '../character/playerController.js';
import { DialogBox } from '../ui/DialogBox.js';
import { EventRegistry } from '../map/eventRegistry.js';
import { LightingSystem } from '../environment/lightingSystem.js';
import { ObjectSystem } from '../map/objectSystem.js';

setDebugMapEnabled(true);

export class GameScene {
  constructor(skipInit = false) {
    this.ready = skipInit;
    this.map = null;
    this.player = null;
    this.objects = null;
    this.entities = [];
    this.dialog = new DialogBox('monologue');
    this.events = null;
    this.lighting = new LightingSystem();
  }

  async onEnter() {
    const PPU = 128;
    const MAP_PATH = '/assets/map/sample-iso.tmj';
    this.map = await loadTiledMap(MAP_PATH, PPU);

    const PLAYER_SPAWN = vec2(8.92, -12.67);
    this.player = new PlayerController(PLAYER_SPAWN, { idleStartIndex: 0, walkStartIndex: 8 }, PPU);
    this.player.setColliders(this.map.colliders);
    await this.player.loadAllAnimations();

    // ✅ Load object sprites
    this.objects = new ObjectSystem(this.map, PPU);
    await this.objects.load();

    this.events = new PolygonEventSystem(this.map, (poly) => {
      if (poly?.eventId && EventRegistry[poly.eventId])
        EventRegistry[poly.eventId].execute(this, this.player);
    });

    this.entities = [this.player];
    setCameraScale(PPU);
    setCameraPos(this.player.pos);

    await this.dialog.loadFont();
    this.dialog.setMode('monologue');
    this.dialog.setText('Hello world.');
    this.dialog.visible = true;

    this.lighting.setRainMode('overlay');
    this.lighting.setLightningMode('overlay');

    window.scene = this;
    this.ready = true;
  }

  isLoaded() { return this.ready && this.player?.ready && this.map; }

  update() {
    if (!this.isLoaded()) return;
    const dt = 1 / 60;
    this.lighting.update(dt);
    this.player.update();
    this.events?.update();
    this.dialog.update(dt);

    // ✅ update object fade based on player position
    const playerFeet = this.player.pos.add(this.player.feetOffset);
    this.objects?.update(playerFeet);

    if (window.triggerLightningOnce) {
      this.lighting.triggerLightning();
      window.triggerLightningOnce = false;
    }
    if (window.toggleRain) {
      this.lighting.toggleRain();
      window.toggleRain = false;
    }
  }

  updatePost() {
    if (this.isLoaded()) setCameraPos(this.player.pos);
  }

  render() {
    if (!this.isLoaded()) {
      drawText('Loading...', vec2(0, 0), 0.5, hsl(0.1, 1, 0.7));
      return;
    }

    // Base & mid-layer lighting (under player)
    this.lighting.renderBase();
    this.lighting.renderMidLayer();

    // Draw map base
    renderMap(this.map, this.player.ppu, this.player.pos, this.player.pos, this.player.feetOffset);

    // ✅ Draw all static object sprites (chairs, etc.)
    this.objects?.draw();

    // ✅ Draw player and entities
    for (const e of this.entities) e?.draw?.();

    // Overlay lighting drawn last
    this.lighting.renderOverlay();

    // Hover effects + dialog/UI
    this.events?.renderHoverOverlay();
    if (this.dialog.visible) this.dialog.draw();
  }

  renderPost() {}
}
