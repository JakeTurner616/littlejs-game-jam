// src/character/playerMovement.js — 🧭 click-consume aware + emitter cleanup fix
'use strict';
import {
  keyIsDown, mouseWasPressed, screenToWorld, mousePosScreen,
  vec2, clamp, timeDelta, ParticleEmitter, Color,
  cameraPos, cameraScale, mainCanvas
} from 'littlejsengine';
import { worldToIso } from '../map/isoMath.js';

export function handlePlayerMovement(p) {
  const move = vec2(0, 0);
  let pathCanceled = false;

  // 🟡 Click-to-move (skip if another system consumed the click)
  if (mouseWasPressed(0) && !window.__clickConsumed) {
    const target = screenToWorld(mousePosScreen);

    // 🧹 Always clear old marker emitter before setting a new one
    if (p.markerEmitter) {
      p.markerEmitter.emitRate = 0;
      p.markerEmitter.emitTime = 0;
      if (typeof p.markerEmitter.stop === 'function')
        p.markerEmitter.stop();
      p.markerEmitter = null;
    }

    p.clickTarget = target;
    const path = p.buildSmartPath(target);
    p.path = path;

    if (path && path.length > 0) {
      p.destinationMarker = target;
      p.markerAlpha = 1.0;

      // ✨ New emitter for the destination marker
      p.markerEmitter = new ParticleEmitter(
        target, 0, 0.6, 0, 6, 0.2, undefined,
        new Color(0.9, 0.75, 0.3, 0.45),
        new Color(0.8, 0.6, 0.25, 0.4),
        new Color(0.4, 0.1, 0.0, 0.0),
        new Color(0.2, 0.0, 0.0, 0.0),
        1.5, 0.06, 0.02, 0.02, 0,
        0.98, 1, 0, 0.2, 0.15,
        0.1, false, true, true, 1e9
      );
    } else {
      p.destinationMarker = null;
      p.markerAlpha = 0;
    }
  }

  // ✅ reset click consumption after handling
  window.__clickConsumed = false;

  // Keyboard input cancels auto-path navigation
  const keyMove =
    keyIsDown('KeyW') || keyIsDown('ArrowUp') ||
    keyIsDown('KeyS') || keyIsDown('ArrowDown') ||
    keyIsDown('KeyA') || keyIsDown('ArrowLeft') ||
    keyIsDown('KeyD') || keyIsDown('ArrowRight');

  if (keyMove && p.path.length) {
    p.path = [];
    pathCanceled = true;
  }

  // Base keyboard motion
  if (keyIsDown('KeyW') || keyIsDown('ArrowUp')) move.y += 1;
  if (keyIsDown('KeyS') || keyIsDown('ArrowDown')) move.y -= 1;
  if (keyIsDown('KeyA') || keyIsDown('ArrowLeft')) move.x -= 1;
  if (keyIsDown('KeyD') || keyIsDown('ArrowRight')) move.x += 1;

  const feet = p.pos.add(p.feetOffset);

  // 🟢 Smooth path navigation
  if (!keyMove && p.path.length) {
    const next1 = p.path[0];
    const next2 = p.path[1] || next1;
    const dirA = next1.subtract(feet);
    const dirB = next2.subtract(next1);
    const lenA = dirA.length(), lenB = dirB.length();
    const normA = lenA ? dirA.scale(1 / lenA) : vec2(0, 0);
    const normB = lenB ? dirB.scale(1 / lenB) : vec2(0, 0);
    const distToNext = feet.distance(next1);
    const t = clamp(1 - (distToNext / p.smoothBlendDist), 0, 1);
    const curveDir = normA.scale(1 - t).add(normB.scale(t));
    const blendedNext = next1.add(curveDir.scale(0.5 * p.smoothBlendDist));
    const delta = blendedNext.subtract(feet);
    const dist = delta.length();

    if (dist > p.reachThreshold) {
      move.x = delta.x;
      move.y = delta.y / p.tileRatio;
    } else {
      p.path.shift();
    }
  }

  // 🔶 Movement + animation state
  const isMoving = (move.x !== 0 || move.y !== 0);
  const newState = isMoving ? 'walk' : 'idle';
  const oldDirection = p.direction;
  let newDir = oldDirection;
  const stepDist = p.speed * timeDelta * 60;
  p.shadowTarget = isMoving ? 1.15 : 1.0;
  p.shadowScale += (p.shadowTarget - p.shadowScale) * clamp(timeDelta * p.shadowLerp, 0, 1);

  if (isMoving) {
    const isoMove = vec2(move.x, move.y * p.tileRatio);
    const mag = Math.hypot(isoMove.x, isoMove.y);
    if (mag > 0) {
      const step = isoMove.scale(stepDist / mag);
      const nextFeet = feet.add(step);
      if (!p.pointInsideAnyCollider(nextFeet))
        p.pos = nextFeet.subtract(p.feetOffset);
      else {
        p.path = [];
        pathCanceled = true;
      }
      const ang = Math.atan2(-move.y, move.x);
      newDir = angleToDir(ang);
    }
  }

  const directionChanged = newDir !== oldDirection;
  const stateChanged = newState !== p.state;
  if (stateChanged || directionChanged) {
    p.state = newState;
    p.direction = newDir;
    p.frameIndex = 0;
    p.frameTimer = 0;
    p.currentAnimKey = `${newState}_${newDir + 1}`;
  }

  // 🟡 Marker fade-out and emitter cleanup
  if (p.destinationMarker) {
    const distToMarker = feet.distance(p.destinationMarker);
    const shouldFade = (p.path.length === 0 && distToMarker < p.reachThreshold) || pathCanceled;

    if (shouldFade) {
      p.markerAlpha -= timeDelta * 3;
      if (p.markerAlpha <= 0) {
        p.destinationMarker = null;
        p.markerAlpha = 0;

        if (p.markerEmitter) {
          p.markerEmitter.emitRate = 0;
          p.markerEmitter.emitTime = 0.4;
          if (typeof p.markerEmitter.stop === 'function')
            p.markerEmitter.stop();
          p.markerEmitter = null;
        }
      }
    }
  }

  if (pathCanceled && p.markerEmitter) {
    p.markerEmitter.emitRate = 0;
    p.markerEmitter.emitTime = 0.5;
    if (typeof p.markerEmitter.stop === 'function')
      p.markerEmitter.stop();
    p.markerEmitter = null;
  }
}

function angleToDir(a) {
  if (a < 0) a += Math.PI * 2;
  const off = Math.PI / 8;
  return (Math.floor(((a + off) % (2 * Math.PI)) / (Math.PI / 4)) + 5) % 8;
}

/*───────────────────────────────────────────────
  🔍 Debug helper: prints player position + direction
───────────────────────────────────────────────*/
export function printPlayerPosition() {
  const scene = window.scene;
  const p = scene?.player;
  const map = scene?.map;
  if (!p || !map) {
    console.warn('[printPlayerPosition] Player or map not ready');
    return;
  }

  const feet = p.pos.add(p.feetOffset);

  // ✅ Screen position for debugging
  const screen = vec2(
    (feet.x - cameraPos.x) * cameraScale + mainCanvas.width / 2,
    (feet.y - cameraPos.y) * -cameraScale + mainCanvas.height / 2
  );

  // ✅ Convert world → isometric tile coordinates (adjusted to match loadNewMap)
  const cr = worldToIso(
    p.pos.x,
    p.pos.y,
    map.mapData.width,
    map.mapData.height,
    map.TILE_W,
    map.TILE_H
  );

  console.log(`[Player] Dir=${p.direction} (${dirToText(p.direction)})`);
  console.log(`  World: (${feet.x.toFixed(2)}, ${feet.y.toFixed(2)})`);
  console.log(`  Screen: (${screen.x.toFixed(1)}, ${screen.y.toFixed(1)})`);
  console.log(`  Tile CR (for loadNewMap): (${cr.x.toFixed(2)}, ${cr.y.toFixed(2)})`);
  console.log(`  👉 Usage: await scene.loadNewMap('yourmap.tmj', ${cr.x.toFixed(2)}, ${cr.y.toFixed(2)});`);
}

function dirToText(d) {
  const dirs = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
  return dirs[d % 8] || '?';
}

window.printPlayerPosition = printPlayerPosition;
