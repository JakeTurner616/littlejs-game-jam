// src/scenes/GameScene.js — cinematic witch spawn (smooth return, no invalid imports)
'use strict';
import {
  vec2, setCameraPos, setCameraScale, drawText, hsl
} from 'littlejsengine';
import { loadTiledMap } from '../map/mapLoader.js';
import { renderMap, setDebugMapEnabled } from '../map/mapRenderer.js';
import { PolygonEventSystem } from '../map/polygonEvents.js';
import { ObjectTriggerEventSystem } from '../map/objectTriggers.js';
import { PlayerController } from '../character/playerController.js';
import { DialogBox } from '../ui/DialogBox.js';
import { EventRegistry } from '../map/eventRegistry.js';
import { LightingSystem } from '../environment/lightingSystem.js';
import { ObjectSystem } from '../map/objectSystem.js';
import { WitchEntity } from '../character/witchEntity.js';
import { isoToWorld } from '../map/isoMath.js';

setDebugMapEnabled(true);
let WITCH_CACHE = null;

export class GameScene {
  constructor(skipInit = false) {
    this.ready = skipInit;
    this.map = null;
    this.player = null;
    this.objects = null;
    this.entitiesAbove = [];
    this.entitiesBelow = [];
    this.dialog = new DialogBox('monologue');
    this.events = null;
    this.objectTriggers = null;
    this.lighting = new LightingSystem();
    this.cinematicMode = false;
    this.cinematicPhase = null;
    this.cinematicTimer = 0;

    // 🔧 Internal camera tracking (since LittleJS doesn't export getters)
    this.cameraPos = vec2(0, 0);
    this.cameraScale = 128;
    this.cameraTargetPos = vec2(0, 0);
    this.cameraTargetScale = 128;
  }

  async onEnter() {
    const PPU = 128;
    const MAP_PATH = '/assets/map/sample-iso.tmj';
    this.map = await loadTiledMap(MAP_PATH, PPU);

    const PLAYER_SPAWN = vec2(8.92, -12.67);
    this.player = new PlayerController(PLAYER_SPAWN, { idleStartIndex: 0, walkStartIndex: 8 }, PPU);
    this.player.setColliders(this.map.colliders);
    await this.player.loadAllAnimations();

    this.objects = new ObjectSystem(this.map, PPU);
    await this.objects.load();

    this.events = new PolygonEventSystem(this.map, (poly) => {
      if (poly?.eventId && EventRegistry[poly.eventId])
        EventRegistry[poly.eventId].execute(this, this.player);
    });

    this.objectTriggers = new ObjectTriggerEventSystem(this.map, PPU, (trigger) => {
      if (trigger?.eventId === 'witch_spawn') this.handleWitchSpawn(trigger);
      else if (trigger?.eventId && EventRegistry[trigger.eventId])
        EventRegistry[trigger.eventId].execute(this, this.player);
    });
    this.objectTriggers.loadFromMap();

    this.cameraPos = this.player.pos.copy();
    this.cameraTargetPos = this.cameraPos.copy();
    this.cameraScale = PPU;
    this.cameraTargetScale = PPU;
    setCameraPos(this.cameraPos);
    setCameraScale(this.cameraScale);

    await this.dialog.loadFont();
    this.dialog.setMode('monologue');
    this.dialog.setText('Hello world.');
    this.dialog.visible = true;

    this.lighting.setRainMode('overlay');
    this.lighting.setLightningMode('background');

    await this.preloadWitch();

    window.scene = this;
    this.ready = true;
  }

  /*───────────────────────────────────────────────
    WITCH TEXTURE PRELOAD
  ────────────────────────────────────────────────*/
  async preloadWitch() {
    if (WITCH_CACHE) return;
    const dummy = new WitchEntity(vec2(0, 0), 0, 128, 'below');
    await dummy.load();
    WITCH_CACHE = {
      frames: dummy.frames,
      durations: dummy.durations,
      texIndex: dummy.texIndex,
    };
  }

  /*───────────────────────────────────────────────
    TRIGGER EVENT → cinematic start
  ────────────────────────────────────────────────*/
  handleWitchSpawn(trigger) {
    this.cinematicMode = true;
    this.cinematicPhase = 'zoomIn';
    this.cinematicTimer = 0;
    this.instantWitchSpawn(trigger);
    this.lighting.triggerLightning();

    this.cinematicFocus = vec2(17.47, -8.5);
    this.cameraTargetPos = this.cinematicFocus.copy();
    this.cameraTargetScale = 170;
  }

  /*───────────────────────────────────────────────
    CAMERA CINEMATIC — smooth lerp like window event
  ────────────────────────────────────────────────*/
  updateCinematic(dt) {
    if (!this.cinematicMode) return;

    const smoothLerp = (a, b, s) => a + (b - a) * (1 - Math.pow(0.001, s));

    const lerpVec = (v, t, s) => vec2(
      v.x + (t.x - v.x) * (1 - Math.pow(0.001, s)),
      v.y + (t.y - v.y) * (1 - Math.pow(0.001, s))
    );

    if (this.cinematicPhase === 'zoomIn') {
      this.cameraPos = lerpVec(this.cameraPos, this.cameraTargetPos, dt * 60);
      this.cameraScale = smoothLerp(this.cameraScale, this.cameraTargetScale, dt * 3);
      setCameraPos(this.cameraPos);
      setCameraScale(this.cameraScale);

      this.cinematicTimer += dt;
      if (this.cinematicTimer > 2.0) {
        this.cinematicPhase = 'zoomOut';
        this.cinematicTimer = 0;
        this.cameraTargetPos = this.player.pos.copy();
        this.cameraTargetScale = 128;
      }
    }

    else if (this.cinematicPhase === 'zoomOut') {
      // Smooth camera return to player
      this.cameraPos = lerpVec(this.cameraPos, this.cameraTargetPos, dt * 80);
      this.cameraScale = smoothLerp(this.cameraScale, this.cameraTargetScale, dt * 5);
      setCameraPos(this.cameraPos);
      setCameraScale(this.cameraScale);

      const dist = this.cameraPos.distance(this.cameraTargetPos);
      const diff = Math.abs(this.cameraScale - this.cameraTargetScale);
      if (dist < 0.02 && diff < 0.2) {
        this.cinematicMode = false;
        this.cinematicPhase = null;
        this.cinematicTimer = 0;
      }
    }
  }

  /*───────────────────────────────────────────────
    INSTANT WITCH SPAWN
  ────────────────────────────────────────────────*/
  instantWitchSpawn(trigger) {
    if (!WITCH_CACHE) return this.spawnWitch(trigger);

    const props = trigger.properties || {};
    const { TILE_W, TILE_H, mapData } = this.map;
    const { width, height } = mapData;
    let spawnPos = trigger.pos;
    if (props.spawn_c !== undefined && props.spawn_r !== undefined)
      spawnPos = isoToWorld(+props.spawn_c, +props.spawn_r, width, height, TILE_W, TILE_H);
    else if (props.spawn_x !== undefined && props.spawn_y !== undefined)
      spawnPos = vec2(+props.spawn_x, +props.spawn_y);

    const direction = +props.direction || 0;
    const witch = new WitchEntity(spawnPos, direction, this.player.ppu, 'below');
    witch.frames = WITCH_CACHE.frames;
    witch.durations = WITCH_CACHE.durations;
    witch.texIndex = WITCH_CACHE.texIndex;
    witch.ready = true;
    this.entitiesBelow.push(witch);

    console.log('%c[GameScene] Witch spawned under map and flash.', 'color:#9ff');
  }

  spawnWitch(trigger) {
    const props = trigger.properties || {};
    const { TILE_W, TILE_H, mapData } = this.map;
    const { width, height } = mapData;
    let spawnPos = trigger.pos;
    if (props.spawn_c !== undefined && props.spawn_r !== undefined)
      spawnPos = isoToWorld(+props.spawn_c, +props.spawn_r, width, height, TILE_W, TILE_H);
    else if (props.spawn_x !== undefined && props.spawn_y !== undefined)
      spawnPos = vec2(+props.spawn_x, +props.spawn_y);
    const direction = +props.direction || 0;
    const witch = new WitchEntity(spawnPos, direction, this.player.ppu, 'below');
    witch.load().then(() => this.entitiesBelow.push(witch));
  }

  /*───────────────────────────────────────────────
    MAIN LOOP
  ────────────────────────────────────────────────*/
  isLoaded() { return this.ready && this.player?.ready && this.map; }

  update() {
    if (!this.isLoaded()) return;
    const dt = 1 / 60;
    this.lighting.update(dt);
    this.player.update();
    this.updateCinematic(dt);
    this.events?.update();
    this.dialog.update(dt);
    const playerFeet = this.player.pos.add(this.player.feetOffset);
    this.objects?.update(playerFeet);
    this.objectTriggers?.update(this.player.pos, this.player.feetOffset);
    for (const e of [...this.entitiesBelow, ...this.entitiesAbove]) e?.update?.(dt);
  }

  updatePost() {
    if (!this.isLoaded()) return;

    if (!this.cinematicMode) {
      this.cameraTargetPos = this.player.pos.copy();
      this.cameraTargetScale = 128;
      this.cameraPos = this.cameraPos.lerp(this.cameraTargetPos, 1 - Math.pow(0.001, 1));
      setCameraPos(this.cameraPos);
      setCameraScale(this.cameraTargetScale);
    }
  }

  /*───────────────────────────────────────────────
    RENDER
  ────────────────────────────────────────────────*/
  render() {
    if (!this.isLoaded()) {
      drawText('Loading...', vec2(0, 0), 0.5, hsl(0.1, 1, 0.7));
      return;
    }

    this.lighting.renderBase();
    this.entitiesBelow.sort((a, b) => a.pos.y - b.pos.y);
    for (const e of this.entitiesBelow) e?.draw?.();
    this.lighting.renderMidLayer();
    renderMap(this.map, this.player.ppu, this.player.pos, this.player.pos, this.player.feetOffset);
    this.objects?.draw();
    const stack = [...this.entitiesAbove, this.player];
    stack.sort((a, b) => a.pos.y - b.pos.y);
    for (const e of stack) e?.draw?.();
    if (this.objectTriggers) this.objectTriggers.drawDebug();
    if (this.lighting.rainRenderMode === 'overlay')
      this.lighting._renderRain(this.player.pos, false);
    this.events?.renderHoverOverlay();
    if (this.dialog.visible) this.dialog.draw();
  }

  renderPost() {}
}
