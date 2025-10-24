// src/scenes/GameScene.js
'use strict';
import { vec2, drawText, hsl } from 'littlejsengine';
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

setDebugMapEnabled(true);

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

    // Auto-lightning timing
    this._thunderTimer = 0;
    this._nextThunderDelay = 0;
    this._lightningEnabled = true;
  }

  async onEnter() {
    const PPU = 128;
    const MAP_PATH = '/assets/map/sample-iso.tmj';
    this.map = await loadTiledMap(MAP_PATH, PPU);

    // Player setup
    const PLAYER_SPAWN = vec2(8.92, -12.67);
    this.player = new PlayerController(PLAYER_SPAWN, { idleStartIndex: 0, walkStartIndex: 8 }, PPU);
    this.player.setColliders(this.map.colliders);
    await this.player.loadAllAnimations();

    // Object system
    this.objects = new ObjectSystem(this.map, PPU);
    await this.objects.load();

    // Polygon events
    this.events = new PolygonEventSystem(this.map, (poly) => {
      if (poly?.eventId && EventRegistry[poly.eventId])
        EventRegistry[poly.eventId].execute(this, this.player);
    });

    // Preload sounds
    audioManager.loadSound('jump_scare', '/assets/audio/jump-scare-sound.ogg');
    audioManager.loadSound('door_open', '/assets/audio/door-open.ogg');

    // Object triggers
    this.objectTriggers = new ObjectTriggerEventSystem(this.map, PPU, (trigger) => {
      if (trigger?.eventId === 'witch_spawn') {
        this.witchManager.spawn(trigger);
        audioManager.playSound('jump_scare', null, 0.5);
        console.log('[GameScene] Jump scare triggered!');
      } else if (trigger?.eventId && EventRegistry[trigger.eventId])
        EventRegistry[trigger.eventId].execute(this, this.player);
    });
    this.objectTriggers.loadFromMap();

    // Camera
    this.camera.setTarget(this.player);
    this.camera.snapToTarget();

    // Dialog box
    await this.dialog.loadFont();
    this.dialog.setMode('monologue');
    this.dialog.setText('Hello world.');
    this.dialog.visible = true;

    // ✅ Lighting setup
    this.lighting.setRainMode('overlay');
    this.lighting.setLightningMode('overlay');
    this.lighting.lightningEnabled = true; // <-- KEY FIX
    this._scheduleNextLightning();

    await this.witchManager.preload();

    // Music
    this._initAudio();

    // Dev helpers
    window.scene = this;
    window.triggerLightning = (i = 0.8) => {
      this.lighting.triggerLightning(i);
      console.log(`[Lighting] Manual trigger (intensity ${i})`);
    };

    this.ready = true;
  }

  /*───────────────────────────────────────────────
    AUDIO INITIALIZATION
  ────────────────────────────────────────────────*/
  _initAudio() {
    try {
      audioManager.playMusic('/assets/audio/sh2-Forest-Custom-Cover-with-thunder.ogg', 0.35, true);
      console.log('[GameScene] Ambient rain + thunder loaded as music');
    } catch (err) {
      console.error('[GameScene] Audio init failed:', err);
    }
  }

  /*───────────────────────────────────────────────
    LIGHTNING LOGIC
  ────────────────────────────────────────────────*/
  _scheduleNextLightning() {
    // realistic time between flashes
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

  /*───────────────────────────────────────────────
    UPDATE LOOP
  ────────────────────────────────────────────────*/
  isLoaded() { return this.ready && this.player?.ready && this.map; }

  update() {
    if (!this.isLoaded()) return;

    const dt = 1 / 60;
    this._updateLightning(dt); // ✅ always runs

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

  /*───────────────────────────────────────────────
    RENDER LOOP
  ────────────────────────────────────────────────*/
  render() {
    if (!this.isLoaded()) {
      drawText('Loading...', vec2(0, 0), 0.5, hsl(0.1, 1, 0.7));
      return;
    }

    const cam = this.player.pos;

    // 1️⃣ base lighting
    this.lighting.renderBase(cam);

    // 2️⃣ below-map entities
    this.witchManager.renderBelow();

    // 3️⃣ indoor lightning
    if (this.lighting.lightningRenderMode === 'background')
      this.lighting.renderMidLayer(cam);

    // 4️⃣ map
    renderMap(this.map, this.player.ppu, this.player.pos, this.player.pos, this.player.feetOffset);

    // 5️⃣ objects
    this.objects?.draw();

    // 6️⃣ player + above entities
    const stack = [...this.witchManager.entitiesAbove, this.player];
    stack.sort((a, b) => a.pos.y - b.pos.y);
    for (const e of stack) e?.draw?.();

    // ✅ Safe debug draw
    if (this.objectTriggers && this.objectTriggers.debugEnabled)
      this.objectTriggers.drawDebug();

    // 7️⃣ events + dialog
    this.events?.renderHoverOverlay();
    if (this.dialog.visible) this.dialog.draw();

    // 8️⃣ overlay effects
    if (this.lighting.rainRenderMode === 'overlay')
      this.lighting._renderRain(cam, false);

    if (this.lighting.lightningRenderMode === 'overlay')
      this.lighting.renderOverlay(cam);
  }
}
