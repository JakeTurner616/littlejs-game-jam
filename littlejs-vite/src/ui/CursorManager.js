// src/ui/CursorManager.js
'use strict';

let desired = 'default';

export function beginFrame() {
  // Reset desired cursor each frame; systems will "request" pointer if needed.
  desired = 'default';
}

export function requestPointer() {
  // Request a pointer cursor for this frame.
  desired = 'pointer';
}

export function request(mode = 'default') {
  desired = mode;
}

export function apply() {
  // Apply to <body> and all canvases to defeat CSS/canvas-level overrides.
  try {
    document.body.style.cursor = desired;
    const canvases = document.querySelectorAll('canvas');
    for (const c of canvases) c.style.cursor = desired;
  } catch (e) {
    // noop: DOM not ready or running headless
  }
}
