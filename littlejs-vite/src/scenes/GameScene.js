// src/scenes/GameScene.js
'use strict';
import { vec2, setCameraPos, setCameraScale } from 'littlejsengine';
import { cachedMap, cachedPlayer } from '../util/preloadGameAssets.js';
import { renderMap } from '../map/mapRenderer.js';

export class GameScene {
  constructor(skipInit = false) {
    this.ready = skipInit;
    this.map = cachedMap;
    this.player = cachedPlayer;
  }

  async onEnter() {
    console.log('Entered Game Scene');
    if (!this.ready) return;
    setCameraScale(this.player.ppu);
    setCameraPos(this.player.pos);
  }

  update() {
    if (!this.ready) return;
    this.player.update();
  }

  updatePost() {
    if (!this.ready) return;
    setCameraPos(this.player.pos);
  }

  render() {
    if (!this.ready) return;
    renderMap(this.map, this.player.ppu, this.player.pos);
    this.player.draw();
  }

  renderPost() {}
}
