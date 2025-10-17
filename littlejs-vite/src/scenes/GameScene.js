// src/scenes/GameScene.js
'use strict';
import {
  vec2,
  setCameraPos,
  setCameraScale,
  keyWasPressed,
  drawText,
  hsl
} from 'littlejsengine';
import { cachedMap, cachedPlayer } from '../util/preloadGameAssets.js';
import { renderMap, setDebugMapEnabled } from '../map/mapRenderer.js';
import { MeleeCharacterController } from '../character/meleeCharacterController.js';

export class GameScene {
  constructor(skipInit = false) {
    this.ready = skipInit;
    this.map = cachedMap;
    this.player = cachedPlayer;

    // Example combat test character
    this.enemy = new MeleeCharacterController(vec2(10, -6), 128);
    this.debugAnimList = Object.keys(this.enemy.animationMeta);
    this.debugIndex = 0;

    this.entities = [this.player, this.enemy];

    // 🧩 Toggle map debugging safely
    setDebugMapEnabled(true); // or false to disable all debug overlays
  }

  async onEnter() {
    console.log('Entered Game Scene');
    await this.enemy.loadAllAnimations();

    if (!this.ready) return;
    setCameraScale(this.player.ppu);
    setCameraPos(this.player.pos);
  }

  update() {
    if (!this.ready) return;

    this.player.update();

    // Debug animation cycling
    if (keyWasPressed('KeyE')) {
      this.debugIndex = (this.debugIndex + 1) % this.debugAnimList.length;
      const anim = this.debugAnimList[this.debugIndex];
      console.log(`Enemy animation → ${anim}`);
      this.enemy.state = anim;
      this.enemy.frameIndex = 0;
      this.enemy.frameTimer = 0;
    }
    if (keyWasPressed('KeyQ')) {
      this.debugIndex =
        (this.debugIndex - 1 + this.debugAnimList.length) %
        this.debugAnimList.length;
      const anim = this.debugAnimList[this.debugIndex];
      console.log(`Enemy animation → ${anim}`);
      this.enemy.state = anim;
      this.enemy.frameIndex = 0;
      this.enemy.frameTimer = 0;
    }

    this.enemy.update();
  }

  updatePost() {
    if (!this.ready) return;
    setCameraPos(this.player.pos);
  }

  render() {
    if (!this.ready) {
      drawText('Loading...', vec2(0, 0), 0.5, hsl(0, 0, 1));
      return;
    }

    // Map rendering (includes debug if enabled)
    renderMap(
      this.map,
      this.player.ppu,
      this.player.pos,
      this.player.pos,
      this.player.feetOffset
    );

    // Y-sorted entities
    const drawables = this.entities
      .filter(e => e && e.pos && e.draw)
      .map(e => ({ y: e.pos.y, draw: () => e.draw() }));

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    drawText(
      this.enemy.state,
      this.enemy.pos.add(vec2(0, 2)),
      0.3,
      hsl(0.1, 1, 0.5)
    );
  }

  renderPost() {}
}
