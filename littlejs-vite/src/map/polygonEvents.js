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
  clamp,
} from 'littlejsengine';

/**
 * PolygonEventSystem — in-game interactive polygon logic
 * ------------------------------------------------------
 * • Hover detection + tint overlay (smooth fade)
 * • Click dispatch via callback
 * • Walk-up logic: requireWalkUp enforces valid navigation path before event fires
 */
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

    if (!newHover) document.body.style.cursor = 'default';
    if (newHover !== this.hovered) {
      this.lastHovered = this.hovered;
      this.hovered = newHover;
    }

    this.fadeTimer += (this.hovered ? 1 : -1) / 20;
    this.fadeTimer = clamp(this.fadeTimer, 0, 1);

    // 🟡 Click handling
    if (mouseWasPressed(0) && this.hovered) {
      const poly = this.hovered;
      console.log('[PolygonEvent] Triggered:', poly.name, poly.eventId);

      const requireWalk = poly.properties?.find(p => p.name === 'requireWalkUp')?.value;
      const player = window.scene?.player;
      const map = window.scene?.map;

      if (requireWalk && player && map) {
        const center = poly.pts.reduce((s, p) => s.add(p), vec2(0, 0)).scale(1 / poly.pts.length);
        const nodes = map.maneuverNodes || [];

        if (!nodes.length) {
          console.warn('[PolygonEvent] No maneuver nodes found — cannot satisfy walk-up requirement.');
          return; // ❌ Abort: no nodes
        }

        // 🧭 Find closest ManeuverNode to polygon center
        let nearestNode = nodes[0];
        let nearestDist = Infinity;
        for (const n of nodes) {
          const d = n.pos.distance(center);
          if (d < nearestDist) {
            nearestDist = d;
            nearestNode = n;
          }
        }

        const { x, y } = nearestNode.pos;
        const target = vec2(x, y);
        const path = player.buildSmartPath(target);
        console.log('[PolygonEvent] Walk-up → nearest node', nearestNode.id, 'path length', path.length);

        if (path.length > 0) {
          // ✅ Valid path: begin walking
          player.path = path;
          player.destinationMarker = target;
          player.markerAlpha = 1;
          this.activeTintTimer = 0.25;

          window.scene.map.debugTempMarker = target;

          // Wait for arrival before firing event
          const waitArrival = () => {
            const feet = player.pos.add(player.feetOffset);
            const dist = feet.distance(target);
            if (dist < player.reachThreshold) {
              console.log('[PolygonEvent] Arrived at destination, firing event.');
              this.onEvent?.(poly);
            } else if (player.path.length) {
              requestAnimationFrame(waitArrival);
            } else {
              console.warn('[PolygonEvent] Walk-up canceled or blocked; event not triggered.');
            }
          };
          waitArrival();
          return;
        } else {
          // ❌ Abort: cannot find a valid path
          console.warn('[PolygonEvent] No valid path to maneuver node; event canceled.');
          return;
        }
      }

      // 🔶 Default instant trigger (no requireWalkUp)
      this.onEvent?.(poly);
      this.activeTintTimer = 0.25;
    }

    if (this.activeTintTimer > 0) this.activeTintTimer -= 1 / 60;
    this.renderHoverOverlay();
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

    if (this.debug) console.log(`[Hover] ${poly.name} (${poly.eventId})`);
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

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const pos = vec2((minX + maxX) / 2, (minY + maxY) / 2);
  const size = vec2(maxX - minX || 0.001, maxY - minY || 0.001);

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
