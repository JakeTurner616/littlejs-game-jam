// src/scenes/GameScene.js
'use strict';
import { vec2, drawText, hsl, screenToWorld, mousePosScreen, mouseWasPressed } from 'littlejsengine';
import { loadTiledMap } from '../map/mapLoader.js';
import { renderMap, setDebugMapEnabled } from '../map/mapRenderer.js';
import { PolygonEventSystem } from '../map/polygonEvents.js';
import { ObjectTriggerEventSystem } from '../map/objectTriggers.js';
import { PlayerController } from '../character/playerController.js';
import { DialogBox } from '../ui/DialogBox.js';
import { EventRegistry } from '../map/eventRegistry.js';
import { LightingSystem } from '../environment/lightingSystem.js';
import { ObjectSystem } from '../map/objectSystem.js';
import { WitchManager } from '../character/WitchManager.js';
import { CameraController } from '../core/CameraController.js';
import { audioManager } from '../audio/AudioManager.js';
import { isoToWorld, worldToIso } from '../map/isoMath.js';

setDebugMapEnabled(false);

export class GameScene {
  constructor(skipInit = false) {
    this.ready = skipInit;
    this.map = null;
    this.player = null;
    this.objects = null;
    this.dialog = new DialogBox('monologue');
    this.lighting = new LightingSystem();
    this.events = null;
    this.objectTriggers = null;
    this.camera = new CameraController();
    this.witchManager = new WitchManager(this);

    this._thunderTimer = 0;
    this._nextThunderDelay = 0;
    this._lightningEnabled = true;

    // For click-to-debug
    this.debugClickEnabled = true;
  }

  async onEnter() {
    const PPU = 128;
    const MAP_PATH = '/assets/map/sample-iso.tmj';
    this.map = await loadTiledMap(MAP_PATH, PPU);

    const { mapData, TILE_W, TILE_H } = this.map;
    const { width, height } = mapData;

    // ✅ Stable tile-space spawn
    this.spawnC = 6.91;
    this.spawnR = 13.72;
    const PLAYER_SPAWN = isoToWorld(this.spawnC, this.spawnR, width, height, TILE_W, TILE_H);

    this.player = new PlayerController(PLAYER_SPAWN, { idleStartIndex: 0, walkStartIndex: 8 }, PPU);
    this.player.setColliders(this.map.colliders);
    await this.player.loadAllAnimations();

    this.objects = new ObjectSystem(this.map, PPU);
    await this.objects.load();

    this.events = new PolygonEventSystem(this.map, (poly) => {
      if (poly?.eventId && EventRegistry[poly.eventId])
        EventRegistry[poly.eventId].execute(this, this.player);
    });

    audioManager.loadSound('jump_scare', '/assets/audio/jump-scare-sound.ogg');
    audioManager.loadSound('door_open', '/assets/audio/door-open.ogg');

    this.objectTriggers = new ObjectTriggerEventSystem(this.map, PPU, (trigger) => {
      if (trigger?.eventId === 'witch_spawn') {
        this.witchManager.spawn(trigger);
        audioManager.playSound('jump_scare', null, 0.5);
        console.log('[GameScene] Jump scare triggered!');
      } else if (trigger?.eventId && EventRegistry[trigger.eventId])
        EventRegistry[trigger.eventId].execute(this, this.player);
    });
    this.objectTriggers.loadFromMap();

    this.camera.setTarget(this.player);
    this.camera.snapToTarget();

    await this.dialog.loadFont();
    this.dialog.setMode('monologue');
    this.dialog.setText('Hello world.');
    this.dialog.visible = true;

    this.lighting.setRainMode('overlay');
    this.lighting.setLightningMode('overlay');
    this.lighting.lightningEnabled = true;
    this._scheduleNextLightning();

    await this.witchManager.preload();
    this._initAudio();

    // Dev helpers
    window.scene = this;
    window.triggerLightning = (i = 0.8) => {
      this.lighting.triggerLightning(i);
      console.log(`[Lighting] Manual trigger (intensity ${i})`);
    };
        window.printPlayerPosition = () => {
      if (!this.player || !this.map) return console.warn('[printPlayerPosition] No player or map loaded');
      const { mapData, TILE_W, TILE_H } = this.map;
      const { width, height } = mapData;
      const feet = this.player.pos.add(this.player.feetOffset);
      const tile = worldToIso(feet.x, feet.y, width, height, TILE_W, TILE_H);

      console.log(
        `%c[Player] WORLD (x=${feet.x.toFixed(2)}, y=${feet.y.toFixed(2)}) → TILE (c=${tile.x.toFixed(2)}, r=${tile.y.toFixed(2)})  `,
        'color:#6ff;font-weight:bold;'
      );
    };
    console.log(`[GameScene] Player spawn tile: c=${this.spawnC}, r=${this.spawnR}`);
    this.ready = true;
  }

  _initAudio() {
    try {
      audioManager.playMusic('/assets/audio/sh2-Forest-Custom-Cover-with-thunder.ogg', 0.35, true);
      console.log('[GameScene] Ambient rain + thunder loaded as music');
    } catch (err) {
      console.error('[GameScene] Audio init failed:', err);
    }
  }

  _scheduleNextLightning() {
    const intervals = [6, 8, 10, 12, 14, 16, 18];
    this._nextThunderDelay = intervals[(Math.random() * intervals.length) | 0];
    this._thunderTimer = 0;
  }

  _updateLightning(dt) {
    if (!this._lightningEnabled) return;
    this._thunderTimer += dt;
    if (this._thunderTimer >= this._nextThunderDelay) {
      console.log('[Lighting] Auto lightning triggered!');
      this._thunderTimer = 0;
      this.lighting.triggerLightning();
      this._scheduleNextLightning();
    }
  }

  isLoaded() { return this.ready && this.player?.ready && this.map; }

  /*───────────────────────────────────────────────
    Click-to-Debug
  ────────────────────────────────────────────────*/
  _handleClickDebug() {
    if (!this.debugClickEnabled || !mouseWasPressed(0) || !this.map) return;

    const world = screenToWorld(mousePosScreen);
    const { mapData, TILE_W, TILE_H } = this.map;
    const { width, height } = mapData;
    const tile = worldToIso(world.x, world.y, width, height, TILE_W, TILE_H);

    console.log(
      `%c[DEBUG] Click → tile (c=${tile.x.toFixed(2)}, r=${tile.y.toFixed(2)})  world (${world.x.toFixed(2)}, ${world.y.toFixed(2)})`,
      'color:#6f6;font-weight:bold;'
    );
    console.log(
      `%c[DEBUG] Player spawn tile (c=${this.spawnC}, r=${this.spawnR})`,
      'color:#6ff;font-weight:bold;'
    );
  }

  update() {
    if (!this.isLoaded()) return;
    const dt = 1 / 60;

    this._handleClickDebug();
    this._updateLightning(dt);
    this.lighting.update(dt);
    this.player.update();
    this.camera.update(dt);
    this.dialog.update(dt);

    const playerFeet = this.player.pos.add(this.player.feetOffset);
    this.objects?.update(playerFeet);
    this.events?.update();
    this.objectTriggers?.update(this.player.pos, this.player.feetOffset);
    this.witchManager.update(dt);
  }

  render() {
    if (!this.isLoaded()) {
      drawText('Loading...', vec2(0, 0), 0.5, hsl(0.1, 1, 0.7));
      return;
    }

    const cam = this.player.pos;
    this.lighting.renderBase(cam);
    this.witchManager.renderBelow();

    if (this.lighting.lightningRenderMode === 'background')
      this.lighting.renderMidLayer(cam);

    renderMap(this.map, this.player.ppu, this.player.pos, this.player.pos, this.player.feetOffset);
    this.objects?.draw();

    const stack = [...this.witchManager.entitiesAbove, this.player];
    stack.sort((a, b) => a.pos.y - b.pos.y);
    for (const e of stack) e?.draw?.();

    if (this.objectTriggers && this.objectTriggers.debugEnabled)
      this.objectTriggers.drawDebug();

    this.events?.renderHoverOverlay();
    if (this.dialog.visible) this.dialog.draw();

    if (this.lighting.rainRenderMode === 'overlay')
      this.lighting._renderRain(cam, false);

    if (this.lighting.lightningRenderMode === 'overlay')
      this.lighting.renderOverlay(cam);
  }
}
