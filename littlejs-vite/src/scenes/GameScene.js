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
import { audioManager } from '../audio/AudioManager.js'; // ✅ optimized internal audio system

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

    // Ambient + state flags
    this._thunderTimer = 0;
    this._nextThunderDelay = 4 + Math.random() * 8;
  }

  async onEnter() {
    const PPU = 128;
    const MAP_PATH = '/assets/map/sample-iso.tmj';
    this.map = await loadTiledMap(MAP_PATH, PPU);

    // player setup
    const PLAYER_SPAWN = vec2(8.92, -12.67);
    this.player = new PlayerController(
      PLAYER_SPAWN,
      { idleStartIndex: 0, walkStartIndex: 8 },
      PPU
    );
    this.player.setColliders(this.map.colliders);
    await this.player.loadAllAnimations();

    // map objects
    this.objects = new ObjectSystem(this.map, PPU);
    await this.objects.load();

    // polygon events
    this.events = new PolygonEventSystem(this.map, (poly) => {
      if (poly?.eventId && EventRegistry[poly.eventId])
        EventRegistry[poly.eventId].execute(this, this.player);
    });

    // preload jump-scare sound for instant playback
    audioManager.loadSound('jump_scare', '/assets/audio/jump-scare-sound.ogg');

    // object triggers
    this.objectTriggers = new ObjectTriggerEventSystem(this.map, PPU, (trigger) => {
      if (trigger?.eventId === 'witch_spawn') {
        // 🧙 Spawn witch
        this.witchManager.spawn(trigger);

        // ⚡ Lightning + Jump scare audio cue
        audioManager.playSound('jump_scare', null, 0.5); 
        console.log('[GameScene] Jump scare triggered!');
      } else if (trigger?.eventId && EventRegistry[trigger.eventId])
        EventRegistry[trigger.eventId].execute(this, this.player);
    });
    this.objectTriggers.loadFromMap();

    // camera setup
    this.camera.setTarget(this.player);
    this.camera.snapToTarget();

    // dialog box
    await this.dialog.loadFont();
    this.dialog.setMode('monologue');
    this.dialog.setText('Hello world.');
    this.dialog.visible = true;

    // ☀️ Outdoor lighting default
    this.lighting.setRainMode('overlay');
    this.lighting.setLightningMode('overlay');

    await this.witchManager.preload();

    // 🔉 Audio setup (ambient as music)
    this._initAudio();

    // Dev helpers
    window.scene = this;
    window.triggerLightning = (i = 0.8) => {
      this.lighting.triggerLightning();
      console.log(`[Lighting] manual trigger (intensity ${i})`);
    };

    this.ready = true;
  }

  /*───────────────────────────────────────────────
    AUDIO INITIALIZATION (BOTH TRACKS AS MUSIC)
  ────────────────────────────────────────────────*/
  _initAudio() {
    try {
      // 🎵 Ambient looping rain (treated as music)
      audioManager.playMusic('/assets/audio/sh2-Forest-Custom-Cover-with-thunder.ogg', 0.35, true);
      console.log('[GameScene] AmbientRain + Thunder loaded as music via audioManager');
    } catch (err) {
      console.error('[GameScene] Audio init failed:', err);
    }
  }

  isLoaded() {
    return this.ready && this.player?.ready && this.map;
  }

  update() {
    if (!this.isLoaded()) return;

    const dt = 1 / 60;
    this.lighting.update(dt);
    this.player.update();
    this.camera.update(dt);
    this.dialog.update(dt);

    const playerFeet = this.player.pos.add(this.player.feetOffset);
    this.objects?.update(playerFeet);
    this.events?.update();
    this.objectTriggers?.update(this.player.pos, this.player.feetOffset);
    this.witchManager.update(dt);

    // ambient lightning cycle
    this._thunderTimer += dt;
    if (this._thunderTimer > this._nextThunderDelay) {
      this._thunderTimer = 0;
      this._nextThunderDelay = 7 + Math.random() * 10; // every 7–17 seconds
      this.lighting.triggerLightning();
    }
  }

  render() {
    if (!this.isLoaded()) {
      drawText('Loading...', vec2(0, 0), 0.5, hsl(0.1, 1, 0.7));
      return;
    }

    const cam = this.player.pos;

    // ──────────────────────────────────────────────
    // RENDER STACK (dynamic lightning placement)
    // ──────────────────────────────────────────────

    // 1️⃣ ambient background layer
    this.lighting.renderBase(cam);

    // 2️⃣ below-map entities
    this.witchManager.renderBelow();

    // 3️⃣ background lightning + rain when indoors
    if (this.lighting.lightningRenderMode === 'background')
      this.lighting.renderMidLayer(cam);

    // 4️⃣ tilemap rendering
    renderMap(this.map, this.player.ppu, this.player.pos, this.player.pos, this.player.feetOffset);

    // 5️⃣ world objects
    this.objects?.draw();

    // 6️⃣ player + above entities
    const stack = [...this.witchManager.entitiesAbove, this.player];
    stack.sort((a, b) => a.pos.y - b.pos.y);
    for (const e of stack) e?.draw?.();

    // 7️⃣ overlays + dialog
    this.objectTriggers?.drawDebug();
    this.events?.renderHoverOverlay();
    if (this.dialog.visible) this.dialog.draw();

    // 8️⃣ overlay lightning/rain outdoors
    if (this.lighting.rainRenderMode === 'overlay')
      this.lighting._renderRain(cam, false);

    if (this.lighting.lightningRenderMode === 'overlay')
      this.lighting.renderOverlay(cam);
  }
}
