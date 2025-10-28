// src/scenes/GameScene.js — ✅ noclip-ready (window.player exposed)
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
import { DebugStateManager } from '../debug/DebugStateManager.js';

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
async loadNewMap(mapPath, spawnC, spawnR) {
  console.groupCollapsed(`[GameScene] 🕒 Switching to new map: ${mapPath}`);
  const totalStart = performance.now();

  this.ready = false;
  const PPU = 128;

  // 1️⃣ Load new map data
  const t1 = performance.now();
  const newMap = await loadTiledMap(mapPath, PPU);
  const t2 = performance.now();
  console.log(`⏱️ loadTiledMap(): ${(t2 - t1).toFixed(2)} ms`);
  this.map = newMap;

  // 2️⃣ Reposition player
  const t3 = performance.now();
  const { mapData, TILE_W, TILE_H } = newMap;
  const { width, height } = mapData;
  const worldSpawn = isoToWorld(spawnC, spawnR, width, height, TILE_W, TILE_H);

  this.player.pos = worldSpawn.subtract(this.player.feetOffset);
  this.player.setColliders(newMap.colliders);
  this.player.state = 'idle';
  this.player.direction = 4;
  this.player.path = [];
  const t4 = performance.now();
  console.log(`⏱️ Reposition + collider setup: ${(t4 - t3).toFixed(2)} ms`);

  // 3️⃣ ObjectSystem
  const t5 = performance.now();
  if (this.objects) {
    this.objects.map = newMap;
    this.objects.objects.length = 0;
    this.objects.depthPolygons.length = 0;
    await this.objects.load();
  } else {
    this.objects = new ObjectSystem(newMap, PPU);
    await this.objects.load();
  }
  const t6 = performance.now();
  console.log(`⏱️ ObjectSystem.load(): ${(t6 - t5).toFixed(2)} ms`);

  // 4️⃣ PolygonEventSystem
  const t7 = performance.now();
  if (this.events) {
    this.events.map = newMap;
    this.events.enabled = true;
  } else {
    this.events = new PolygonEventSystem(newMap, (poly) => {
      if (poly?.eventId && EventRegistry[poly.eventId])
        EventRegistry[poly.eventId].execute(this, this.player);
    });
  }
  const t8 = performance.now();
  console.log(`⏱️ PolygonEventSystem setup: ${(t8 - t7).toFixed(2)} ms`);

  // 5️⃣ ObjectTriggerEventSystem
  const t9 = performance.now();
  if (this.objectTriggers) {
    this.objectTriggers.map = newMap;
    this.objectTriggers.triggers.length = 0;
    this.objectTriggers.enabled = true;
    this.objectTriggers.loadFromMap();
  } else {
    this.objectTriggers = new ObjectTriggerEventSystem(newMap, PPU, (trigger) => {
      if (trigger?.eventId && EventRegistry[trigger.eventId])
        EventRegistry[trigger.eventId].execute(this, this.player);
    });
    this.objectTriggers.loadFromMap();
  }
  const t10 = performance.now();
  console.log(`⏱️ ObjectTriggerEventSystem setup: ${(t10 - t9).toFixed(2)} ms`);

  // 6️⃣ Fog of War + Lighting
  const t11 = performance.now();
  this.fogOfWar.loadFromMap(newMap);
  this.fogOfWar.resetAll?.();
  this.lighting.lightningEnabled = true;
  const t12 = performance.now();
  console.log(`⏱️ FogOfWar + Lighting reset: ${(t12 - t11).toFixed(2)} ms`);

  // 7️⃣ Witch Manager clear
  const t13 = performance.now();
  this.witchManager.entitiesAbove.length = 0;
  this.witchManager.entitiesBelow.length = 0;
  const t14 = performance.now();
  console.log(`⏱️ WitchManager clear: ${(t14 - t13).toFixed(2)} ms`);

  // 8️⃣ Camera + finalize
  const t15 = performance.now();
  this.camera.snapToTarget();
  this.ready = true;
  const t16 = performance.now();
  console.log(`⏱️ Camera snap + finalize: ${(t16 - t15).toFixed(2)} ms`);

  const totalEnd = performance.now();
  console.log(`🚀 TOTAL MAP SWITCH TIME: ${(totalEnd - totalStart).toFixed(2)} ms`);
  console.groupEnd();
}


  async onEnter() {
    const PPU = 128;
    const MAP_PATH = '/assets/map/outside.tmj';
    this.map = await loadTiledMap(MAP_PATH, PPU);

    const { mapData, TILE_W, TILE_H } = this.map;
    const { width, height } = mapData;

    this.spawnC = 3.99;
    this.spawnR = 11.49;
    const PLAYER_SPAWN = isoToWorld(this.spawnC, this.spawnR, width, height, TILE_W, TILE_H);

    this.player = new PlayerController(PLAYER_SPAWN, { idleStartIndex: 0, walkStartIndex: 8 }, PPU);
    this.player.setColliders(this.map.colliders);
    await this.player.loadAllAnimations();
    window.player = this.player; // ✅ console debug access

    this.objects = new ObjectSystem(this.map, PPU);
    await this.objects.load();

    this.events = new PolygonEventSystem(this.map, (poly) => {
      if (poly?.eventId && EventRegistry[poly.eventId])
        EventRegistry[poly.eventId].execute(this, this.player);
    });

    // preload key sounds
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

    // ambient systems
    this.lighting.setRainMode('overlay');
    this.lighting.setLightningMode('overlay');
    this.lighting.lightningEnabled = true;
    this._scheduleNextLightning();

    this.fog.setDensity(0.85);
    this.fog.setColor(0.7, 0.75, 0.78);
    this.fogOfWar.loadFromMap(this.map);
    await this.witchManager.preload();
    this._initAudio();

    // developer tools
window.scene = this;
window.debug = DebugStateManager;

// Console helpers
window.triggerLightning = (i = 0.8) => this.lighting.triggerLightning(i);
window.revealAllFog = () => this.fogOfWar.revealAll();
window.revealFog = (name) => this.fogOfWar.revealArea(name);
window.resetFog = () => this.fogOfWar.resetAll();

// Quick debug info
console.log(`[GameScene] Player spawn tile: c=${this.spawnC}, r=${this.spawnR}`);
console.log('[Debug] Use window.debug.list() or window.debug.jump("indoor_entry") to warp.');
window.scene = this;
window.player = this.player;

// ✅ Safe printPlayerPosition (works regardless of worldToIso return type)
window.printPlayerPosition = () => {
  if (!this.player || !this.map) {
    console.warn('⚠️ Scene or player not ready yet');
    return;
  }

  const { mapData, TILE_W, TILE_H } = this.map;
  const { width, height } = mapData;
  const feet = this.player.pos.add(this.player.feetOffset);

  // Convert world → tile space (may return vec2 or {c,r})
  const iso = worldToIso(feet.x, feet.y, width, height, TILE_W, TILE_H);

  // normalize key names
  const c = iso.c ?? iso.x;
  const r = iso.r ?? iso.y;

  if (c == null || r == null) {
    console.warn('⚠️ worldToIso() did not return valid c,r or x,y values:', iso);
    return;
  }

  console.log(
    `%c🧍 Player Feet (world): x=${feet.x.toFixed(3)}, y=${feet.y.toFixed(3)}`,
    'color:#8ff;font-weight:bold'
  );
  console.log(
    `%c📐 Player Tile (for loadNewMap): c=${c.toFixed(3)}, r=${r.toFixed(3)}`,
    'color:#6f9;font-weight:bold'
  );
  console.log(
    `%c➡️  scene.loadNewMap('/assets/map/inside.tmj', ${c.toFixed(3)}, ${r.toFixed(3)})`,
    'color:#ff9;font-weight:bold'
  );
};
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

    // ---- LAYER 6: rain + lightning overlays ----
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
