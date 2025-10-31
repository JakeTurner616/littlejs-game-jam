// src/map/polygonEvents.js — hover pointer via CursorManager (centralized)
'use strict';
import {
  mouseWasPressed, mousePosScreen, screenToWorld,
  drawLine, Color, vec2, drawCanvas2D, clamp,
} from 'littlejsengine';
import { requestPointer } from '../ui/CursorManager.js';

export class PolygonEventSystem {
  constructor(map, onEvent, debug = false) {
    this.map = map;
    this.onEvent = onEvent;
    this.enabled = true;
    this.hovered = null;
    this.lastHovered = null;
    this.fadeTimer = 0;
    this.activeTintTimer = 0;
    this.debug = debug;
    this.triggerSystem = null;
  }

  setTriggerSystem(triggerSystem) {
    this.triggerSystem = triggerSystem;
  }

  update() {
    if (!this.enabled || !this.map?.eventPolygons?.length) return;

    const worldMouse = screenToWorld(mousePosScreen);
    let newHover = null;

    // 🔍 Hover detection
    for (const poly of this.map.eventPolygons) {
      if (pointInPolygon(worldMouse, poly.pts)) {
        newHover = poly;
        // 👉 Ask the CursorManager for pointer this frame
        requestPointer();
        break;
      }
    }

    // Hover transition bookkeeping
    if (newHover !== this.hovered) {
      this.lastHovered = this.hovered;
      this.hovered = newHover;
    }
    this.fadeTimer = clamp(this.fadeTimer + (this.hovered ? 1 : -1) / 20, 0, 1);

    // 🟡 Click
    if (mouseWasPressed(0) && this.hovered) {
      const poly = this.hovered;
      const requiresTrigger = poly.properties?.find(p => p.name === 'requiresTrigger')?.value?.trim();
      const blockedMsg = poly.properties?.find(p => p.name === 'blockedMessage')?.value?.trim();

      if (requiresTrigger && this.triggerSystem) {
        const fired = this.triggerSystem.hasFired(requiresTrigger);
        if (!fired) {
          const scene = window.scene;
          if (scene?.dialog) {
            const msg = blockedMsg || getDefaultBlockedMessage(poly.eventId, requiresTrigger);
            scene.dialog.setMode('monologue');
            scene.dialog.visible = true;
            scene.dialog.setText(msg);
          }
          this.activeTintTimer = 0.25;
          return;
        }
      }

      // ✅ Execute event
      const scene = window.scene;
      if (scene?.dialog?.clearIfMonologue) scene.dialog.clearIfMonologue();
      this.onEvent?.(poly);
      this.activeTintTimer = 0.25;
    }

    if (this.activeTintTimer > 0) this.activeTintTimer -= 1 / 60;
    // (Rendering stays separate; GameScene calls renderHoverOverlay() during render)
  }

  renderHoverOverlay() {
    const poly = this.hovered || this.lastHovered;
    if (!poly || this.fadeTimer <= 0) return;

    const pts = poly.pts;
    const alpha = this.fadeTimer;
    const activeAlpha = Math.max(this.activeTintTimer * 2, alpha);

    const fillColor = this.activeTintTimer > 0
      ? new Color(1, 0.5, 0.1, 0.35 * activeAlpha)
      : new Color(1, 0.9, 0.2, 0.25 * alpha);

    const lineColor = this.activeTintTimer > 0
      ? new Color(1, 0.6, 0.1, 0.9 * activeAlpha)
      : new Color(1, 1, 0.3, 0.8 * alpha);

    fillPolygon(pts, fillColor);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      drawLine(a, b, 0.05, lineColor);
    }
  }
}

/* Helpers unchanged */
function getDefaultBlockedMessage(eventId, prereqId) {
  switch (eventId) {
    case 'window_scene_1':
      return "Something feels off... You sense you shouldn't approach that window yet.";
    case 'door_teleport_2':
      return "The door won't budge. A chill runs down your spine... as if something unseen holds it shut.";
    default:
      return `It seems nothing happens... Perhaps something else must occur before '${eventId}' can unfold.`;
  }
}

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

function fillPolygon(pts, color) {
  if (!pts || pts.length < 3) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pos = vec2((minX + maxX) / 2, (minY + maxY) / 2);
  const size = vec2(maxX - minX || 0.001, maxY - minY || 0.001);
  drawCanvas2D(pos, size, 0, color, ctx => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x - pos.x, pts[0].y - pos.y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - pos.x, pts[i].y - pos.y);
    ctx.closePath();
    ctx.fillStyle = color.toString();
    ctx.fill();
  });
}
