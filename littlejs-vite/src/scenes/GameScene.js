// src/scenes/GameScene.js  (entire fixed file)
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
import { FogSystem } from '../environment/FogSystem.js';
import { FogOfWarSystem } from '../environment/FogOfWarSystem.js';
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
    this.fog = new FogSystem();
    this.fogOfWar = new FogOfWarSystem();
    this.events = null;
    this.objectTriggers = null;
    this.camera = new CameraController();
    this.witchManager = new WitchManager(this);

    this._thunderTimer = 0;
    this._nextThunderDelay = 0;
    this._lightningEnabled = true;
    this.debugClickEnabled = true;
  }

  async onEnter() {
    const PPU = 128;
    const MAP_PATH = '/assets/map/sample-iso.tmj';
    this.map = await loadTiledMap(MAP_PATH, PPU);

    const { mapData, TILE_W, TILE_H } = this.map;
    const { width, height } = mapData;

    this.spawnC = 3.99;
    this.spawnR = 11.49;
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

    this.fog.setDensity(0.85);
    this.fog.setColor(0.7, 0.75, 0.78);
    console.log('[GameScene] Silent Hill fog system initialized');

    this.fogOfWar.loadFromMap(this.map);
    console.log('[GameScene] Fog of War system loaded');

    await this.witchManager.preload();
    this._initAudio();

    // Dev helpers
    window.scene = this;
    window.triggerLightning = (i = 0.8) => {
      this.lighting.triggerLightning(i);
      console.log(`[Lighting] Manual trigger (intensity ${i})`);
    };
    window.revealAllFog = () => this.fogOfWar.revealAll();
    window.revealFog = (name) => this.fogOfWar.revealArea(name);
    window.resetFog = () => this.fogOfWar.resetAll();

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

  update() {
    if (!this.isLoaded()) return;
    const dt = 1 / 60;
    this._updateLightning(dt);
    this.lighting.update(dt);
    this.fog.update(dt, this.player.pos);
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

    // ---- LAYER 1: base lighting and background ----
    this.lighting.renderBase(cam);
    this.witchManager.renderBelow();

    if (this.lighting.lightningRenderMode === 'background')
      this.lighting.renderMidLayer(cam);

    // ---- LAYER 2: mid fog before world ----
    this.fog.render(this.player.pos, 'midlayer');

    // ---- LAYER 3: world map + objects ----
    renderMap(this.map, this.player.ppu, this.player.pos, this.player.pos, this.player.feetOffset);
    this.objects?.draw();

    // ---- LAYER 4: entities ----
    const stack = [...this.witchManager.entitiesAbove, this.player];
    stack.sort((a, b) => a.pos.y - b.pos.y);
    for (const e of stack) e?.draw?.();

    // ---- LAYER 5: debug overlays ----
    this.events?.renderHoverOverlay();

    // ---- LAYER 6: rain + lightning overlays (both on overlayContext) ----
    if (this.lighting.rainRenderMode === 'overlay')
      this.lighting._renderRain(cam, false);

    if (this.lighting.lightningRenderMode === 'overlay') {
      this.lighting.renderOverlay(cam);
      if (this.fogOfWar) this.fogOfWar.render(); // behind lightning
    }

    // ---- LAYER 7: top fog overlay ----
    this.fog.render(this.player.pos, 'overlay');

    // ---- LAYER 8: UI (dialog + monologue always on top) ----
    if (this.dialog.visible)
      this.dialog.draw();
  }
}
