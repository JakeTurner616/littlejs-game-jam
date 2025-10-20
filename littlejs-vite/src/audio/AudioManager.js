// src/audio/AudioManager.js
'use strict';
import { SoundWave } from 'littlejsengine';

export class AudioManager {
  constructor() {
    this.sounds = {};
    this.music = null;
    this.musicSource = null;
    this.musicPath = null;
    this.isStreaming = false;
  }

  // ──────────────────────────────────────────────
  // SOUND EFFECTS (use SoundWave)
  // ──────────────────────────────────────────────
  loadSound(name, path) {
    console.log(`[AudioManager] Loading sound effect: ${name}`);
    this.sounds[name] = new SoundWave(path);
    return this.sounds[name];
  }

  playSound(name, pos = null, volume = 1, pitch = 1) {
    const s = this.sounds[name];
    if (s) s.play(pos, volume, pitch);
    else console.warn(`[AudioManager] Sound "${name}" not loaded`);
  }

  // ──────────────────────────────────────────────
  // BACKGROUND MUSIC (streaming via <audio>)
  // ──────────────────────────────────────────────
  async playMusic(path, volume = 0.5, loop = true, streaming = true) {
    this.stopMusic(); // stop any previous music

    this.musicPath = path;
    this.isStreaming = streaming;

    if (streaming) {
      console.log(`[AudioManager] Streaming music from: ${path}`);
      const audio = new Audio(path);
      audio.loop = loop;
      audio.volume = volume;
      audio.autoplay = true;
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';

      // For browsers blocking autoplay:
      const unlock = () => {
        audio.play().then(() => {
          console.log(`[AudioManager] Streaming started → ${path}`);
        }).catch(err => console.warn('[AudioManager] Stream play failed:', err));
        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
      };
      document.addEventListener('click', unlock);
      document.addEventListener('keydown', unlock);

      this.musicSource = audio;
      this.music = null;
    } else {
      // fallback: preloaded SoundWave (non-streaming)
      console.log(`[AudioManager] Loading full music file (non-streaming): ${path}`);
      this.music = new SoundWave(path, 0, 0, 0, (sound) => {
        sound.play(undefined, volume, 1, 1, loop);
        console.log(`[AudioManager] Full music started → ${path}`);
      });
    }
  }

  stopMusic() {
    if (this.musicSource) {
      this.musicSource.pause();
      this.musicSource.currentTime = 0;
      console.log('[AudioManager] Streaming music stopped');
    }
    if (this.music) {
      this.music.stop();
      console.log('[AudioManager] Preloaded music stopped');
    }
  }
}

export const audioManager = new AudioManager();