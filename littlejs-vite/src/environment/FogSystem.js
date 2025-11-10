// src/environment/FogSystem.js — 🚫 Shaderless stub (keeps API, removes shader overhead)
// The fog system is super annoying to work with, super frustrating to debug and get working on slow devices like my laptop!
'use strict';

export class FogSystem {
  constructor() {
    // keep interface used by GameScene
    this.enabled = false;
    this.visible = false;
    this.density = 0.0;
    this.color = { r: 0.7, g: 0.73, b: 0.76 };
  }

  // Dummy update & render (no shader)
  update() {}
  render() {}

  // API stubs so nothing else breaks
  fadeOut() { this.visible = false; }
  fadeIn() { this.visible = true; }
  toggle() { this.enabled = !this.enabled; return this.enabled; }
  setDensity(v) { this.density = v; }
  setColor(r, g, b) {
    if (typeof r === 'object') this.color = r;
    else this.color = { r, g, b };
  }
  setBackgroundMode() {}
}
