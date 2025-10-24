// src/scenes/GameScene.js
'use strict';
import { vec2, setCameraPos, setCameraScale, drawText, hsl } from 'littlejsengine';
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

setDebugMapEnabled(true);

export class GameScene {
  constructor(skipInit = false) {
    this.ready = skipInit;
    this.map = null;
    this.player = null;
    this.objects = null;
    this.entitiesAbove = [];
    this.entitiesBelow = [];
    this.dialog = new DialogBox('monologue');
    this.lighting = new LightingSystem();
    this.events = null;
    this.objectTriggers = null;

    // modular controllers
    this.camera = new CameraController();
    this.witchManager = new WitchManager(this);
  }

  async onEnter() {
    const PPU = 128;
    const MAP_PATH = '/assets/map/sample-iso.tmj';
    this.map = await loadTiledMap(MAP_PATH, PPU);

    // player
    const PLAYER_SPAWN = vec2(8.92, -12.67);
    this.player = new PlayerController(PLAYER_SPAWN, { idleStartIndex: 0, walkStartIndex: 8 }, PPU);
    this.player.setColliders(this.map.colliders);
    await this.player.loadAllAnimations();

    // map objects
    this.objects = new ObjectSystem(this.map, PPU);
    await this.objects.load();

    // event systems
    this.events = new PolygonEventSystem(this.map, (poly) => {
      if (poly?.eventId && EventRegistry[poly.eventId])
        EventRegistry[poly.eventId].execute(this, this.player);
    });

    this.objectTriggers = new ObjectTriggerEventSystem(this.map, PPU, (trigger) => {
      if (trigger?.eventId === 'witch_spawn') this.witchManager.spawn(trigger);
      else if (trigger?.eventId && EventRegistry[trigger.eventId])
        EventRegistry[trigger.eventId].execute(this, this.player);
    });
    this.objectTriggers.loadFromMap();

    // setup camera
    this.camera.setTarget(this.player);
    this.camera.snapToTarget();

    await this.dialog.loadFont();
    this.dialog.setMode('monologue');
    this.dialog.setText('Hello world.');
    this.dialog.visible = true;

    this.lighting.setRainMode('overlay');
    this.lighting.setLightningMode('background');

    await this.witchManager.preload();

    window.scene = this;
    this.ready = true;
  }

  isLoaded() { return this.ready && this.player?.ready && this.map; }

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
  }

  render() {
    if (!this.isLoaded()) {
      drawText('Loading...', vec2(0, 0), 0.5, hsl(0.1, 1, 0.7));
      return;
    }

    this.lighting.renderBase();
    this.witchManager.renderBelow();
    this.lighting.renderMidLayer();
    renderMap(this.map, this.player.ppu, this.player.pos, this.player.pos, this.player.feetOffset);
    this.objects?.draw();

    // draw player + above entities
    const stack = [...this.witchManager.entitiesAbove, this.player];
    stack.sort((a, b) => a.pos.y - b.pos.y);
    for (const e of stack) e?.draw?.();

    if (this.objectTriggers) this.objectTriggers.drawDebug();
    if (this.lighting.rainRenderMode === 'overlay')
      this.lighting._renderRain(this.player.pos, false);
    this.events?.renderHoverOverlay();
    if (this.dialog.visible) this.dialog.draw();
  }
}
