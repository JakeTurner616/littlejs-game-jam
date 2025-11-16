// src/scenes/TitleScene.js — 🎬 Dominion Minor — atmospheric intro with typing monologue
'use strict';
import {
  vec2, hsl, drawCanvas2D,
  mainCanvas, overlayContext, time, keyWasPressed
} from 'littlejsengine';
import { sceneManager } from '../core/sceneManager.js';
import { GameScene } from './GameScene.js';
import { preloadGameAssets } from '../util/preloadGameAssets.js';
import { audioManager } from '../audio/AudioManager.js';
import { LightingSystem } from '../environment/lightingSystem.js';
import { DialogBox } from '../ui/DialogBox.js';

export class TitleScene {
  constructor() {
    this.startTime = 0;
    this.fadeIn = 0;
    this.assetsReady = false;
    this.musicStarted = false;
    this.logoGlow = 0;
    this.blinkTimer = 0;
    this.showPrompt = true;
    this.monologueDone = false;

    // 🔥 Environmental systems
    this.lighting = new LightingSystem();
    this.lighting.setRainMode('overlay');
    this.lighting.setLightningMode('overlay');
    this.lighting.rainEnabled = true;

    // 🕯️ Monologue box (typing intro)
    this.dialog = new DialogBox('monologue');
    this.dialog.setText(
      [
        'The road ends before you realize it.',
        'Rain mixes with the dirt beneath the corn.',
        //'Somewhere ahead, a porch light flickers — faint, unsteady.',
        //'You don’t remember driving here.',
        //'You don’t even remember owning a car.',
        //'The path through the stalks feels carved for you alone.',
        //'A house waits beyond the field, smaller than you remember.',
        //'The wind shifts, and the corn whispers:',
        //'"Welcome back."'
      ].join(' ')
    );
  }

  async onEnter() {
    this.startTime = time;
    await this.dialog.loadFont();

    preloadGameAssets().then(() => {
      this.assetsReady = true;
      console.log('%c[TitleScene] Assets preloaded', 'color:#8f8');
    });
  }

  update() {
    const dt = 1 / 60;
    const t = time - this.startTime;
    this.fadeIn = Math.min(1, t * 0.25);
    this.logoGlow = 0.5 + Math.sin(t * 2) * 0.5;
    this.blinkTimer += dt;
    if (this.blinkTimer > 0.7) {
      this.showPrompt = !this.showPrompt;
      this.blinkTimer = 0;
    }

    if (this.assetsReady && !this.musicStarted) {
      try {
        audioManager.playMusic('./assets/audio/sh2-Forest-Custom-Cover-with-thunder.ogg', 0.35, true);
        this.musicStarted = true;
      } catch (e) {
        console.warn('[TitleScene] Could not play music:', e);
      }
    }

    if (Math.random() < 0.002) this.lighting.triggerLightning();
    this.lighting.update(dt);
    this.dialog.update(dt);

    // Allow game start only after monologue finishes
    if (!this.dialog.isActive() && (keyWasPressed('Enter') || keyWasPressed('Space')) && this.assetsReady) {
      sceneManager.set(new GameScene(true));
    }
  }

  render() {
    const ctx = overlayContext;
    const w = mainCanvas.width, h = mainCanvas.height;
    const t = time - this.startTime;
    const fade = this.fadeIn;

    // ───────────────────────────── background tint
    drawCanvas2D(vec2(0, 0), vec2(20, 12), 0, false, (g) => {

    }, false, ctx);

    // ───────────────────────────── rain + lightning overlay
    this.lighting.renderMidLayer(vec2(0, 0));
    this.lighting.renderOverlay(vec2(0, 0));

    // ───────────────────────────── title logo
    const title = 'Dominion Minor';
    const fontSize = 64 + Math.sin(t * 0.8) * 2;
    ctx.save();
    ctx.font = `${fontSize}px "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glow = Math.max(0, this.logoGlow);
    const baseColor = `hsl(38,60%,${25 + glow * 25}%)`;
    ctx.shadowColor = `hsl(38,100%,${50 + glow * 30}%)`;
    ctx.shadowBlur = 30 * glow;
    ctx.fillStyle = baseColor;
    ctx.fillText(title, w / 2, h / 2 - 60);
    ctx.restore();

    // ───────────────────────────── monologue (typing effect)
    this.dialog.draw();

    // ───────────────────────────── press prompt (after monologue)
    if (!this.dialog.isActive()) {
      if (!this.assetsReady) {
        ctx.save();
        ctx.font = `${fontSize}px "Times New Roman", serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('...', w / 2, h * 0.88);
        ctx.restore();
      }
    }

    // ───────────────────────────── credits
    ctx.save();
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText('© 2025 JakeTurner616', 40, 40);
    ctx.restore();

    // ───────────────────────────── fade from black
    if (fade < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - fade;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  onExit() {
    this.assetsReady = false;
  }
}
