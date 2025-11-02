// src/audio/FadeAudioSystem.js — parametric fade system (fade in/out + wait)
'use strict';
import { audioManager } from './AudioManager.js';

export class FadeAudioSystem {
  constructor() {
    this.fadeOutDuration = 1.0;
    this.fadeInDuration = 1.0;
    this.waitTime = 0;
    this.targetVolume = 0.5;
    this.timer = 0;
    this.state = 'idle'; // 'idle' | 'fadingOut' | 'waiting' | 'fadingIn'
    this.pendingSfx = null;
  }

  update(dt) {
    const a = audioManager.musicElement;
    if (!a) return;

    switch (this.state) {
      case 'fadingOut': {
        this.timer += dt;
        const t = Math.min(this.timer / this.fadeOutDuration, 1);
        a.volume = this.targetVolume * (1 - t);
        if (t >= 1) {
          a.volume = 0;
          this.timer = 0;
          this.state = 'waiting';

          // play the SFX now that the music is silent
          if (this.pendingSfx) {
            audioManager.playSound(this.pendingSfx);
            this.pendingSfx = null;
          }
        }
        break;
      }

      case 'waiting': {
        this.timer += dt;
        if (this.timer >= this.waitTime) {
          this.timer = 0;
          this.state = 'fadingIn';
        }
        break;
      }

      case 'fadingIn': {
        this.timer += dt;
        const t = Math.min(this.timer / this.fadeInDuration, 1);
        a.volume = this.targetVolume * t;
        if (t >= 1) {
          a.volume = this.targetVolume;
          this.state = 'idle';
        }
        break;
      }
    }
  }

  /**
   * Triggers the full fade sequence.
   * @param {string} sfxName - Name of the SFX to play while music is muted.
   * @param {number} fadeOut - Seconds to fade out music.
   * @param {number} wait - Seconds to keep music muted.
   * @param {number} fadeIn - Seconds to fade back in music.
   */
  triggerFadeSfxSequence(sfxName, fadeOut = 1, wait = 5, fadeIn = 1) {
    const a = audioManager.musicElement;
    if (!a) {
      audioManager.playSound(sfxName);
      return;
    }

    this.fadeOutDuration = fadeOut;
    this.fadeInDuration = fadeIn;
    this.waitTime = wait;
    this.pendingSfx = sfxName;
    this.timer = 0;
    this.state = 'fadingOut';
  }
}

export const fadeAudioSystem = new FadeAudioSystem();