// src/scenes/GameScene.js — 🎮 Strict trigger-before-event ordering fix
'use strict';
import {
  vec2, drawText, hsl
} from 'littlejsengine';
import { loadTiledMap } from '../map/mapLoader.js';
import { renderMap, setDebugMapEnabled, isDebugMapEnabled } from '../map/mapRenderer.js';
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
import { isoToWorld } from '../map/isoMath.js';
import { DebugStateManager } from '../debug/DebugStateManager.js';
import { initPaintSystem, updatePaintSystem } from '../map/paintSystem.js';

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
    this.debugClickEnabled = true;
  }

  async loadNewMap(mapPath, spawnC, spawnR) {
    const PPU = 128;
    const newMap = await loadTiledMap(mapPath, PPU);
    this.map = newMap;

    const { mapData, TILE_W, TILE_H } = newMap;
    const { width, height } = mapData;
    const worldSpawn = isoToWorld(spawnC, spawnR, width, height, TILE_W, TILE_H);
    this.player.pos = worldSpawn.subtract(this.player.feetOffset);
    this.player.setColliders(newMap.colliders);
    this.player.state = 'idle';
    this.player.direction = 4;
    this.player.path = [];

    if (this.objects) {
      this.objects.map = newMap;
      this.objects.objects.length = 0;
      this.objects.depthPolygons.length = 0;
      await this.objects.load();
    } else {
      this.objects = new ObjectSystem(newMap, PPU);
      await this.objects.load();
    }

    if (this.objectTriggers) {
      this.objectTriggers.map = newMap;
      this.objectTriggers.triggers.length = 0;
      this.objectTriggers.enabled = true;
      this.objectTriggers.loadFromMap();
    } else {
      this.objectTriggers = new ObjectTriggerEventSystem(newMap, PPU, (trigger) => {
        if (trigger?.eventId === 'witch_spawn') {
          this.witchManager.spawn(trigger);
          audioManager.playSound('jump_scare', null, 0.5);
        } else if (trigger?.eventId && EventRegistry[trigger.eventId])
          EventRegistry[trigger.eventId].execute(this, this.player);
      });
      this.objectTriggers.loadFromMap();
    }

    if (this.events) {
      this.events.map = newMap;
      this.events.enabled = true;
    } else {
      this.events = new PolygonEventSystem(newMap, (poly) => {
        if (poly?.eventId && EventRegistry[poly.eventId])
          EventRegistry[poly.eventId].execute(this, this.player);
      });
    }

    // 🔗 Link trigger system reference so prerequisite checks work
    this.events.setTriggerSystem(this.objectTriggers);

    initPaintSystem(this.map, this.player);
    this.ready = true;
  }

  async onEnter() {
    const PPU = 128;
    const MAP_PATH = '/assets/map/outside.tmj';
    const SPAWN_C = 3.99;
    const SPAWN_R = 11.49;

    this.player = new PlayerController(vec2(), { idleStartIndex: 0, walkStartIndex: 8 }, PPU);
    await this.player.loadAllAnimations();
    this.camera.setTarget(this.player);
    this.camera.snapToTarget();

    await this.loadNewMap(MAP_PATH, SPAWN_C, SPAWN_R);
    await this.dialog.loadFont();
    this.dialog.setMode('monologue');
    this.dialog.setText('Hello world.');
    this.dialog.visible = true;

    await this.witchManager.preload();
    window.scene = this;
    window.debug = DebugStateManager;
    window.player = this.player;
    this.ready = true;
  }

  isLoaded() { return this.ready && this.player?.ready && this.map; }

  update() {
    if (!this.isLoaded()) return;
    const dt = 1 / 60;

    if (!this._paintInitialized && this.player?.ready) {
      updatePaintSystem(0);
      this._paintInitialized = true;
    }
    updatePaintSystem(dt);

    const playerFeet = this.player.pos.add(this.player.feetOffset);
    this.objects?.update(playerFeet);

    // ✅ Trigger system first
    this.objectTriggers?.update(this.player.pos, this.player.feetOffset);

    // ✅ Polygon events after triggers — prevents early fire
    this.events?.update();

    this.witchManager.update(dt);
    this.player.update();
    this.camera.update(dt);
    this.dialog.update(dt);
    this.lighting.update(dt);
    this.fog.update(dt, this.player.pos);
  }

  render() {
    if (!this.isLoaded()) {
      drawText('Loading...', vec2(0, 0), 0.5, hsl(0.1, 1, 0.7));
      return;
    }

    const cam = this.player.pos;
    this.lighting.renderBase(cam);
    this.witchManager.renderBelow();
    this.fog.render(this.player.pos, 'midlayer');
    renderMap(this.map, this.player.ppu, this.player.pos, this.player.pos, this.player.feetOffset);
    this.objects?.draw();
    const stack = [...this.witchManager.entitiesAbove, this.player];
    stack.sort((a, b) => a.pos.y - b.pos.y);
    for (const e of stack) e?.draw?.();
    this.events?.renderHoverOverlay();
    if (this.dialog.visible) this.dialog.draw();
  }
}
