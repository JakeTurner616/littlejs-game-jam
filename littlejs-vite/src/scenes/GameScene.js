// src/scenes/GameScene.js — fixed camera race condition with cinematicMode
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

setDebugMapEnabled(false);

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
    this.cinematicMode = false; // ✅ NEW FLAG
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

  handleWitchSpawn(trigger) {
    this.lighting.triggerLightning();

    const props = trigger.properties || {};
    const { TILE_W, TILE_H, mapData } = this.map;
    const { width, height } = mapData;

    // Default spawn at trigger center if no custom coords
    let spawnPos = trigger.pos;

    if (props.spawn_c !== undefined && props.spawn_r !== undefined) {
      const c = Number(props.spawn_c);
      const r = Number(props.spawn_r);
      spawnPos = isoToWorld(c, r, width, height, TILE_W, TILE_H);
    } else if (props.spawn_x !== undefined && props.spawn_y !== undefined) {
      spawnPos = vec2(Number(props.spawn_x), Number(props.spawn_y));
    }

    const direction = Number(props.direction ?? 0);
    const renderLayer = props.renderLayer === 'below' ? 'below' : 'above';

    const witch = new WitchEntity(spawnPos, direction, this.player.ppu, renderLayer);
    witch.load().then(() => {
      if (renderLayer === 'below')
        this.entitiesBelow.push(witch);
      else
        this.entitiesAbove.push(witch);
      console.log(`[GameScene] Witch spawned (${renderLayer}) at ${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)}`);
    });
  }

  isLoaded() { return this.ready && this.player?.ready && this.map; }

  update() {
    if (!this.isLoaded()) return;
    const dt = 1 / 60;
    this.lighting.update(dt);
    this.player.update();
    this.events?.update();
    this.dialog.update(dt);

    const playerFeet = this.player.pos.add(this.player.feetOffset);
    this.objects?.update(playerFeet);
    this.objectTriggers?.update(this.player.pos, this.player.feetOffset);

    for (const e of [...this.entitiesBelow, ...this.entitiesAbove]) e?.update?.(dt);
  }

  // ✅ Camera only updates if NOT in cinematic mode
  updatePost() {
    if (this.isLoaded() && !this.cinematicMode) {
      setCameraPos(this.player.pos);
    }
  }

  render() {
    if (!this.isLoaded()) {
      drawText('Loading...', vec2(0, 0), 0.5, hsl(0.1, 1, 0.7));
      return;
    }

    // 1️⃣ LIGHTING BACKGROUND
    this.lighting.renderBase();
    this.lighting.renderMidLayer();

    // 2️⃣ BELOW-MAP ENTITIES FIRST
    this.entitiesBelow.sort((a, b) => a.pos.y - b.pos.y);
    for (const e of this.entitiesBelow) e?.draw?.();

    // 3️⃣ DRAW MAP
    renderMap(this.map, this.player.ppu, this.player.pos, this.player.pos, this.player.feetOffset);

    // 4️⃣ ABOVE-MAP ENTITIES (player, objects, etc.)
    this.objects?.draw();
    const aboveStack = [...this.entitiesAbove, this.player];
    aboveStack.sort((a, b) => a.pos.y - b.pos.y);
    for (const e of aboveStack) e?.draw?.();

    // 5️⃣ LIGHTING & UI
    this.lighting.renderOverlay();
    this.events?.renderHoverOverlay();
    if (this.dialog.visible) this.dialog.draw();
  }

  renderPost() {}
}
