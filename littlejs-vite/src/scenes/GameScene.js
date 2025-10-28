// src/scenes/GameScene.js — ✅ noclip-ready + debug sprite collision visualization
'use strict';
import { vec2, drawText, hsl, screenToWorld, mousePosScreen, mouseWasPressed } from 'littlejsengine';
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

    if (this.events) {
      this.events.map = newMap;
      this.events.enabled = true;
    } else {
      this.events = new PolygonEventSystem(newMap, (poly) => {
        if (poly?.eventId && EventRegistry[poly.eventId])
          EventRegistry[poly.eventId].execute(this, this.player);
      });
    }

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

    this.fogOfWar.loadFromMap(newMap);
    this.fogOfWar.resetAll?.();
    this.lighting.lightningEnabled = true;
    this.witchManager.entitiesAbove.length = 0;
    this.witchManager.entitiesBelow.length = 0;
    this.camera.snapToTarget();
    this.ready = true;
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
    window.player = this.player;

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
    this.fogOfWar.loadFromMap(this.map);
    await this.witchManager.preload();
    this._initAudio();

    window.scene = this;
    window.debug = DebugStateManager;
    window.player = this.player;
    this.ready = true;
  }

  _initAudio() {
    try {
      audioManager.playMusic('/assets/audio/sh2-Forest-Custom-Cover-with-thunder.ogg', 0.35, true);
    } catch (err) { console.error(err); }
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

    if (isDebugMapEnabled()) this.checkSpriteCollisions();
  }

  checkSpriteCollisions() {
    const playerBounds = this.player.getSpriteBounds();
    if (!playerBounds) return;
    for (const obj of this.objects.objects) {
      if (obj.name.toLowerCase().includes('floor')) continue;
      const objMinX = obj.pos.x - obj.size.x / 2;
      const objMaxX = obj.pos.x + obj.size.x / 2;
      const objMinY = obj.pos.y - obj.size.y / 2;
      const objMaxY = obj.pos.y + obj.size.y / 2;
      const overlaps = !(playerBounds.maxX < objMinX ||
                         playerBounds.minX > objMaxX ||
                         playerBounds.maxY < objMinY ||
                         playerBounds.minY > objMaxY);
      if (overlaps) {
        console.log(`[Collision] Player overlaps with ${obj.name}`);
        if (obj.collisionMask) {
          const hit = this.checkPixelCollision(playerBounds, obj);
          if (hit) console.log(`[Collision] Pixel-level collision with ${obj.name}`);
        }
      }
    }
  }

  checkPixelCollision(bounds, obj) {
    const overlapMinX = Math.max(bounds.minX, obj.pos.x - obj.size.x / 2);
    const overlapMaxX = Math.min(bounds.maxX, obj.pos.x + obj.size.x / 2);
    const overlapMinY = Math.max(bounds.minY, obj.pos.y - obj.size.y / 2);
    const overlapMaxY = Math.min(bounds.maxY, obj.pos.y + obj.size.y / 2);
    if (overlapMinX >= overlapMaxX || overlapMinY >= overlapMaxY) return false;

    const mask = obj.collisionMask;
    const pxW = mask.width, pxH = mask.height;
    const worldToPx = (wx, wy) => ({
      x: ((wx - (obj.pos.x - obj.size.x / 2)) / obj.size.x) * pxW,
      y: ((wy - (obj.pos.y - obj.size.y / 2)) / obj.size.y) * pxH
    });

    const step = Math.max((obj.size.x / pxW), (obj.size.y / pxH));
    for (let y = overlapMinY; y < overlapMaxY; y += step)
      for (let x = overlapMinX; x < overlapMaxX; x += step) {
        const p = worldToPx(x, y);
        const idx = (Math.floor(p.y) * pxW + Math.floor(p.x)) | 0;
        if (mask.data[idx]) return true;
      }
    return false;
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
    this.fog.render(this.player.pos, 'midlayer');
    renderMap(this.map, this.player.ppu, this.player.pos, this.player.pos, this.player.feetOffset);
    this.objects?.draw();
    const stack = [...this.witchManager.entitiesAbove, this.player];
    stack.sort((a, b) => a.pos.y - b.pos.y);
    for (const e of stack) e?.draw?.();
    this.events?.renderHoverOverlay();

    if (this.lighting.rainRenderMode === 'overlay')
      this.lighting._renderRain(cam, false);
    if (this.lighting.lightningRenderMode === 'overlay') {
      this.lighting.renderOverlay(cam);
      if (this.fogOfWar) this.fogOfWar.render();
    }
    this.fog.render(this.player.pos, 'overlay');
    if (this.dialog.visible) this.dialog.draw();
  }
}
