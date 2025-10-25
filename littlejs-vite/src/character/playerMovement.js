// src/character/playerMovement.js
'use strict';
import {
  keyIsDown, mouseWasPressed, screenToWorld, mousePosScreen,
  vec2, clamp, timeDelta, ParticleEmitter, Color, PI
} from 'littlejsengine';

export function handlePlayerMovement(p) {
  const move = vec2(0, 0);

  // 🟡 Click-to-move (Particle-based destination marker)
  if (mouseWasPressed(0)) {
    const target = screenToWorld(mousePosScreen);
    p.clickTarget = target;
    const path = p.buildSmartPath(target);
    p.path = path;

    // Destroy any existing emitter first
    if (p.markerEmitter) {
      p.markerEmitter.emitRate = 0;
      p.markerEmitter.emitTime = 0;
      p.markerEmitter = null;
    }

    // ✅ Only create particle marker if path is valid
    if (path && path.length > 0) {
      p.destinationMarker = target;
      p.markerAlpha = 1.0;

      // Create a particle emitter at destination
p.markerEmitter = new ParticleEmitter(  
  target,             // position  
  0,                  // angle  
  0.6,               // emitSize (smaller = tighter halo)  
  0,                  // emitTime (0 = infinite)  
  6,                 // emitRate (reduced from 50 for subtlety)  
  0.2,                // emitCone (narrow cone instead of PI)  
  undefined,          // tileInfo  
  // 90's horror tone — sickly amber fade with red decay
  new Color(0.9, 0.75, 0.3, 0.45),   // colorStartA (dim ochre / candlelight)
  new Color(0.8, 0.6, 0.25, 0.4),    // colorStartB (slightly redder tone)
  new Color(0.4, 0.1, 0.0, 0.0),     // colorEndA (dark blood-red fade)
  new Color(0.2, 0.0, 0.0, 0.0),     // colorEndB (nearly black-red)
  1.5, 0.06, 0.02, 0.02, 0,    // particleTime, sizeStart, sizeEnd, speed (very slow), angleSpeed  
  0.98, 1, 0, 0.2, 0.15,       // damping, angleDamping, gravityScale, particleCone (narrow), fadeRate  
  0.1, false, true, true, 1e9  // randomness (low), collide, additive, colorLinear, renderOrder  
);
    } else {
      // No valid path → clear marker
      p.destinationMarker = null;
      p.markerAlpha = 0;
    }
  }

  // Keyboard input
  const keyMove =
    keyIsDown('KeyW') || keyIsDown('ArrowUp') ||
    keyIsDown('KeyS') || keyIsDown('ArrowDown') ||
    keyIsDown('KeyA') || keyIsDown('ArrowLeft') ||
    keyIsDown('KeyD') || keyIsDown('ArrowRight');

  if (keyMove) p.path = [];

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
      else
        p.path = [];
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
  if (p.destinationMarker && p.path.length === 0) {
    const distToMarker = feet.distance(p.destinationMarker);
    if (distToMarker < p.reachThreshold) {
      p.markerAlpha -= timeDelta * 3;
      if (p.markerAlpha <= 0) {
        p.destinationMarker = null;
        p.markerAlpha = 0;

        // Stop and remove emitter
        if (p.markerEmitter) {
          p.markerEmitter.emitRate = 0;
          p.markerEmitter.emitTime = 0.4; // allow short fade-out
          p.markerEmitter = null;
        }
      }
    }
  }
}

function angleToDir(a) {
  if (a < 0) a += Math.PI * 2;
  const off = Math.PI / 8;
  return (Math.floor(((a + off) % (2 * Math.PI)) / (Math.PI / 4)) + 5) % 8;
}
