// src/map/polygonEvents.js
'use strict';
import {
  mouseWasPressed,
  mousePosScreen,
  screenToWorld,
  drawLine,
  Color,
  vec2,
  drawCanvas2D,
} from 'littlejsengine';

/**
 * PolygonEventSystem — in-game interactive polygon logic
 * ------------------------------------------------------
 * • Hover detection + tint overlay (smooth fade)
 * • Click dispatch via callback
 * • Follows same line-drawing style as mapDebug.js
 */
export class PolygonEventSystem {
  constructor(map, onEvent, debug = false) {
    this.map = map;
    this.onEvent = onEvent;
    this.enabled = true;
    this.hovered = null;
    this.lastHovered = null;
    this.fadeTimer = 0;         // for smooth fade
    this.activeTintTimer = 0;   // flash on click
    this.debug = debug;
  }

  update() {
    if (!this.enabled || !this.map?.eventPolygons?.length) return;

    const worldMouse = screenToWorld(mousePosScreen);
    let newHover = null;

    // Hover detection
    for (const poly of this.map.eventPolygons) {
      if (pointInPolygon(worldMouse, poly.pts)) {
        newHover = poly;
        document.body.style.cursor = 'pointer';
        break;
      }
    }

    // Reset cursor when not hovering
    if (!newHover) document.body.style.cursor = 'default';

    // Handle hover transitions
    if (newHover !== this.hovered) {
      this.lastHovered = this.hovered;
      this.hovered = newHover;
    }

    // Fade in/out logic
    if (this.hovered) {
      this.fadeTimer = Math.min(this.fadeTimer + 1 / 20, 1.0);
    } else {
      this.fadeTimer = Math.max(this.fadeTimer - 1 / 20, 0);
    }

    // Click handling
    if (mouseWasPressed(0) && this.hovered) {
      console.log('[PolygonEvent] Triggered:', this.hovered.name, this.hovered.eventId);
      this.onEvent?.(this.hovered);
      this.activeTintTimer = 0.25; // short orange flash
    }

    // Decay click flash
    if (this.activeTintTimer > 0) this.activeTintTimer -= 1 / 60;

    // Render overlay each frame (even while fading out)
    this.renderHoverOverlay();
  }

  renderHoverOverlay() {
    const poly = this.hovered || this.lastHovered;
    if (!poly || this.fadeTimer <= 0) return;

    const pts = poly.pts;
    const alpha = this.fadeTimer;
    const activeAlpha = Math.max(this.activeTintTimer * 2, alpha);

    // Fill + outline colors, based on active or hover state
    const fillColor = this.activeTintTimer > 0
      ? new Color(1, 0.5, 0.1, 0.35 * activeAlpha) // orange click flash
      : new Color(1, 0.9, 0.2, 0.25 * alpha);       // gold hover tint

    const lineColor = this.activeTintTimer > 0
      ? new Color(1, 0.6, 0.1, 0.9 * activeAlpha)
      : new Color(1, 1, 0.3, 0.8 * alpha);

    // Fill region
    fillPolygon(pts, fillColor);

    // Outline (same draw style as debug system)
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      drawLine(a, b, 0.05, lineColor);
    }

    if (this.debug)
      console.log(`[Hover] ${poly.name} (${poly.eventId})`);
  }
}

/*───────────────────────────────────────────────
  Point-in-polygon test
───────────────────────────────────────────────*/
function pointInPolygon(p, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x, yi = verts[i].y;
    const xj = verts[j].x, yj = verts[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < (xj - xi) * (p.y - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/*───────────────────────────────────────────────
  Safe filled polygon routine for LittleJS
───────────────────────────────────────────────*/
function fillPolygon(pts, color) {
  if (!pts || pts.length < 3) return;

  // Compute approximate bounds for canvas space
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const pos = vec2((minX + maxX) / 2, (minY + maxY) / 2);
  const size = vec2(maxX - minX || 0.001, maxY - minY || 0.001);

  // ✅ Proper LittleJS call: drawCanvas2D(pos, size, rotation, color, callback)
  drawCanvas2D(pos, size, 0, color, context => {
    context.beginPath();
    context.moveTo(pts[0].x - pos.x, pts[0].y - pos.y);
    for (let i = 1; i < pts.length; i++)
      context.lineTo(pts[i].x - pos.x, pts[i].y - pos.y);
    context.closePath();
    context.fillStyle = color.toString();
    context.fill();
  });
}