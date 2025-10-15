// src/core/sceneManager.js
'use strict';

/**
 * Simple scene manager for LittleJS
 * Allows registering, switching, and updating scenes dynamically.
 */
export class SceneManager {
  constructor() {
    this.current = null;
  }

  set(scene) {
    if (this.current?.onExit) this.current.onExit();
    this.current = scene;
    if (this.current?.onEnter) this.current.onEnter();
  }

  update() {
    this.current?.update?.();
  }

  updatePost() {
    this.current?.updatePost?.();
  }

  render() {
    this.current?.render?.();
  }

  renderPost() {
    this.current?.renderPost?.();
  }
}

// Singleton instance for convenience
export const sceneManager = new SceneManager();
