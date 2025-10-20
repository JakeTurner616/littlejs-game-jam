// src/scenes/GameScene.js
'use strict';
import {
  vec2,
  setCameraPos,
  setCameraScale,
  keyWasPressed,
  drawText,
  hsl,
} from 'littlejsengine';

import { loadTiledMap } from '../map/mapLoader.js';
import { renderMap, setDebugMapEnabled } from '../map/mapRenderer.js';
import { PlayerController } from '../character/playerController.js';
import { DialogBox } from '../ui/DialogBox.js';
import { audioManager } from '../audio/AudioManager.js';

export class GameScene {
  constructor(skipInit = false) {
    this.ready = skipInit;
    this.map = null;
    this.player = null;
    this.entities = [];
    this.dialog = new DialogBox();

    // Timing + Prologue
    this.musicTimer = 0;
    this.prologueStarted = false;
    this.prologuePhase = 0;
    this.unskippable = true;
    this.dialogStartDelay = 17;

    this.wordSchedule = [
      { t: 22, word: 'Come.' },
      { t: 23, word: 'Home.' },
      { t: 24, word: 'Now.' },
    ];
    this.nextWordIndex = 0;
    this.dialogStarted = false;
    this.dialogJustStarted = false;
  }

  async onEnter() {
    console.log('[GameScene] Entered Game Scene');
    const PPU = 128;
    const MAP_PATH = '/assets/map/sample-iso.tmj';

    // Load map & player
    this.map = await loadTiledMap(MAP_PATH, PPU);
    this.player = new PlayerController(vec2(0, 0), { idleStartIndex: 0, walkStartIndex: 8 }, PPU);
    this.player.setColliders(this.map.colliders);
    await this.player.loadAllAnimations();

    this.entities = [this.player];
    setCameraScale(PPU);
    setCameraPos(this.player.pos);

    await this.dialog.loadFont();
    this.dialog.visible = false;

    // Play music (streamed)
    audioManager.playMusic('/assets/audio/prologue.ogg', 0.6, true);

    // Init state
    this.musicTimer = 0;
    this.prologueStarted = true;
    this.unskippable = true;
    this.prologuePhase = 0;
    this.dialogStarted = false;

    this.ready = true;
  }

  isLoaded() {
    return this.ready && this.player && this.map && this.player.ready;
  }

  update() {
    if (!this.isLoaded()) return;
    this.player.update();

    // Use *real* music playback time
    if (this.prologueStarted) {
      this.musicTimer = audioManager.getMusicTime();

      // 1️⃣ Trigger intro dialog
      if (!this.dialogStarted && this.musicTimer >= this.dialogStartDelay) {
        this.dialogStarted = true;
        this.dialogJustStarted = true;
        console.log('[GameScene] Dialog trigger reached at', this.musicTimer.toFixed(2));
      }

      // 2️⃣ Start dialog text one frame later
      if (this.dialogJustStarted) {
        this.dialogJustStarted = false;
        this.dialog.visible = true;
        this.dialog.setText('I received a letter last week. No return address, just three words:');
        console.log('[GameScene] First sentence typing in');
      }

      // 3️⃣ Move to buildup after +7s
      if (this.dialogStarted && this.prologuePhase === 0 &&
          this.musicTimer >= this.dialogStartDelay + 7) {
        this.prologuePhase = 1;
        this.dialog.text = '';
        this.dialog.typeProgress = 0;
        this.nextWordIndex = 0;
        console.log('[GameScene] Buildup started at', this.musicTimer.toFixed(2));
      }

      // 4️⃣ Stream “Come. Home. Now.”
      if (this.prologuePhase === 1 && this.nextWordIndex < this.wordSchedule.length) {
        const next = this.wordSchedule[this.nextWordIndex];
        if (this.musicTimer >= next.t) {
          const space = this.dialog.text.length ? ' ' : '';
          this.dialog.text += space + next.word;
          console.log('[GameScene] Added word →', next.word);
          this.nextWordIndex++;
        }
      }

      // 5️⃣ End unskippable after 30s
      if (this.musicTimer >= 30 && this.unskippable) {
        this.unskippable = false;
        console.log('[GameScene] Prologue complete — dialog now skippable');
      }
    }

    this.dialog.update(1 / 60); // fixed timestep for text reveal

    if (!this.unskippable && keyWasPressed('Space')) {
      this.dialog.visible = !this.dialog.visible;
      if (this.dialog.visible) {
        audioManager.playSound('dialog');
        this.dialog.setText('Press SPACE again to hide this text.');
      }
    }
  }

  updatePost() {
    if (this.isLoaded()) setCameraPos(this.player.pos);
  }

  render() {
    if (!this.isLoaded()) {
      const msg = this.map ? 'Loading player...' : 'Loading map...';
      drawText(msg, vec2(0, 0), 0.5, hsl(0.1, 1, 0.7));
      return;
    }

    renderMap(
      this.map,
      this.player.ppu,
      this.player.pos,
      this.player.pos,
      this.player.feetOffset
    );

    for (const e of this.entities) if (e?.draw) e.draw();
    if (this.dialog.visible) this.dialog.draw();
  }

  renderPost() {}
}
