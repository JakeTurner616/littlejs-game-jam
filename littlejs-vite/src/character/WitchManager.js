// src/character/WitchManager.js
'use strict';
import { vec2 } from 'littlejsengine';
import { WitchEntity } from './witchEntity.js';
import { isoToWorld } from '../map/isoMath.js';

let WITCH_CACHE = null;

/**
 * WitchManager — manages all witch spawns via triggers
 * ---------------------------------------------------
 * ✅ Trigger-based only (no auto spawn)
 * ✅ Always uses tile coordinates (defaults: c=10.73, r=6.27)
 * ✅ Compatible with lightning + camera cinematic
 */
export class WitchManager {
  constructor(scene) {
    this.scene = scene;
    this.entitiesBelow = [];
    this.entitiesAbove = [];

    // fallback spawn coordinates (tile-space)
    this.defaultC = 10.73;
    this.defaultR = 6.27;
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

  /**
   * Trigger-based spawn
   * If trigger properties lack spawn_c/spawn_r, uses fixed tile coordinates.
   */
  spawn(trigger) {
    if (!this.scene?.map) {
      console.warn('[WitchManager] Missing map context.');
      return;
    }

    const props = trigger?.properties || {};
    const { TILE_W, TILE_H, mapData } = this.scene.map;
    const { width, height } = mapData;

    // 🔹 Use trigger-provided tile coords if present, else fallback
    const c = props.spawn_c != null ? +props.spawn_c : this.defaultC;
    const r = props.spawn_r != null ? +props.spawn_r : this.defaultR;

    const spawnPos = isoToWorld(c, r, width, height, TILE_W, TILE_H);
    const direction = +props.direction || 0;

    const witch = new WitchEntity(spawnPos, direction, this.scene.player.ppu, 'below');

    if (WITCH_CACHE) {
      witch.frames = WITCH_CACHE.frames;
      witch.durations = WITCH_CACHE.durations;
      witch.texIndex = WITCH_CACHE.texIndex;
      witch.ready = true;
    } else {
      witch.load().then(() => (witch.ready = true));
    }

    this.entitiesBelow.push(witch);
    this.scene.camera.startCinematic(spawnPos, 170);

    // ⚡ Trigger lightning flash on spawn
    if (this.scene.lighting) {
      this.scene.lighting.triggerLightning();
      setTimeout(() => this.scene.lighting.triggerLightning(), 180);
    }

    console.log(
      `%c[WitchManager] Witch triggered → TILE (c=${c}, r=${r}) | WORLD (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)})`,
      'color:#f6f;font-weight:bold;'
    );
  }

  update(dt) {
    for (const e of [...this.entitiesBelow, ...this.entitiesAbove]) e.update(dt);
    this.entitiesBelow = this.entitiesBelow.filter(e => !e.dead);
  }

  renderBelow() {
    this.entitiesBelow.sort((a, b) => a.pos.y - b.pos.y);
    for (const e of this.entitiesBelow) e.draw();
  }
}