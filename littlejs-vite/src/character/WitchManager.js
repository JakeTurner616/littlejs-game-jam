// src/character/WitchManager.js
'use strict';
import { vec2 } from 'littlejsengine';
import { WitchEntity } from './witchEntity.js';
import { isoToWorld } from '../map/isoMath.js';

let WITCH_CACHE = null;

export class WitchManager {
  constructor(scene) {
    this.scene = scene;
    this.entitiesBelow = [];
    this.entitiesAbove = [];
  }

  async preload() {
    if (WITCH_CACHE) return;
    const dummy = new WitchEntity(vec2(0, 0), 0, 128, 'below');
    await dummy.load();
    WITCH_CACHE = {
      frames: dummy.frames,
      durations: dummy.durations,
      texIndex: dummy.texIndex,
    };
  }

  spawn(trigger) {
    if (!WITCH_CACHE) return this.spawnFull(trigger);
    const props = trigger.properties || {};
    const { TILE_W, TILE_H, mapData } = this.scene.map;
    const { width, height } = mapData;

    let spawnPos = trigger.pos;
    if (props.spawn_c !== undefined && props.spawn_r !== undefined)
      spawnPos = isoToWorld(+props.spawn_c, +props.spawn_r, width, height, TILE_W, TILE_H);
    else if (props.spawn_x !== undefined && props.spawn_y !== undefined)
      spawnPos = vec2(+props.spawn_x, +props.spawn_y);

    const direction = +props.direction || 0;
    const witch = new WitchEntity(spawnPos, direction, this.scene.player.ppu, 'below');
    witch.frames = WITCH_CACHE.frames;
    witch.durations = WITCH_CACHE.durations;
    witch.texIndex = WITCH_CACHE.texIndex;
    witch.ready = true;
    this.entitiesBelow.push(witch);
    this.scene.camera.startCinematic(spawnPos, 170);
  }

  spawnFull(trigger) {
    const props = trigger.properties || {};
    const { TILE_W, TILE_H, mapData } = this.scene.map;
    const { width, height } = mapData;
    let spawnPos = trigger.pos;
    if (props.spawn_c !== undefined && props.spawn_r !== undefined)
      spawnPos = isoToWorld(+props.spawn_c, +props.spawn_r, width, height, TILE_W, TILE_H);
    else if (props.spawn_x !== undefined && props.spawn_y !== undefined)
      spawnPos = vec2(+props.spawn_x, +props.spawn_y);

    const direction = +props.direction || 0;
    const witch = new WitchEntity(spawnPos, direction, this.scene.player.ppu, 'below');
    witch.load().then(() => this.entitiesBelow.push(witch));
  }

  update(dt) {
    for (const e of [...this.entitiesBelow, ...this.entitiesAbove]) {
      e.update(dt);
    }
    this.entitiesBelow = this.entitiesBelow.filter(e => !e.dead);
  }

  renderBelow() {
    this.entitiesBelow.sort((a, b) => a.pos.y - b.pos.y);
    for (const e of this.entitiesBelow) e.draw();
  }
}
