// src/audio/AudioManager.js
'use strict';
import { SoundWave } from 'littlejsengine';

export class AudioManager {
  constructor() {
    this.sounds = Object.create(null);
    this.musicElement = null;
    this.musicStartTime = 0;
  }

  /*───────────────────────────────────────────────
    SOUND EFFECTS
  ────────────────────────────────────────────────*/
  loadSound(name, path) {
    const s = new SoundWave(path);
    this.sounds[name] = s;
    return s;
  }

  playSound(name, pos = null, volume = 1, pitch = 1) {
    const s = this.sounds[name];
    if (s) s.play(pos, volume, pitch);
  }

  /*───────────────────────────────────────────────
    MUSIC — STREAMED VIA <audio>
  ────────────────────────────────────────────────*/
  playMusic(path, volume = 0.5, loop = true) {
    this.stopMusic(); // ensures only one audio element active

    const audio = new Audio(path);
    audio.loop = loop;
    audio.volume = volume;
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.autoplay = false;

    // small inline unlock function (no closure allocations each play)
    const unlock = () => {
      audio.play().then(() => {
        this.musicStartTime = performance.now() * 0.001;
      }).catch(() => {});
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    // start loading immediately
    audio.load();
    this.musicElement = audio;
  }

  getMusicTime() {
    const a = this.musicElement;
    return a ? a.currentTime : 0;
  }

  stopMusic() {
    const a = this.musicElement;
    if (a) {
      a.pause();
      a.currentTime = 0;
      this.musicElement = null;
    }
  }
}

export const audioManager = new AudioManager();
