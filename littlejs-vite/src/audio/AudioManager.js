// src/audio/AudioManager.js
'use strict';
import { SoundWave } from 'littlejsengine';

export class AudioManager {
  constructor() {
    this.sounds = {};
    this.music = null;
    this.musicElement = null;
    this.musicStartTime = 0;
    this.audioContext = null;
  }

  // ──────────────────────────────────────────────
  // SOUND EFFECTS
  // ──────────────────────────────────────────────
  loadSound(name, path) {
    this.sounds[name] = new SoundWave(path);
    return this.sounds[name];
  }

  playSound(name, pos = null, volume = 1, pitch = 1) {
    const s = this.sounds[name];
    if (s) s.play(pos, volume, pitch);
  }

  // ──────────────────────────────────────────────
  // MUSIC — STREAMED VIA <audio>
  // ──────────────────────────────────────────────
  async playMusic(path, volume = 0.5, loop = true) {
    this.stopMusic();
    console.log(`[AudioManager] Streaming music from: ${path}`);

    const audio = new Audio(path);
    audio.loop = loop;
    audio.volume = volume;
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.autoplay = true;

    // Unlock on user gesture (autoplay restrictions)
    const unlock = () => {
      audio.play().then(() => {
        this.musicStartTime = performance.now() / 1000;
        console.log(`[AudioManager] Music started → ${path}`);
      }).catch(err => console.warn('[AudioManager] Music play blocked:', err));
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);

    this.musicElement = audio;
  }

  // Real-time playback position (always in sync)
  getMusicTime() {
    if (!this.musicElement) return 0;
    return this.musicElement.currentTime || 0;
  }

  stopMusic() {
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.currentTime = 0;
      console.log('[AudioManager] Music stopped');
      this.musicElement = null;
    }
  }
}

export const audioManager = new AudioManager();
