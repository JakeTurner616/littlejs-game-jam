// src/character/playerMovement.js
'use strict';
import { keyIsDown, mouseWasPressed, screenToWorld, mousePosScreen, vec2, clamp, timeDelta } from 'littlejsengine';

export function handlePlayerMovement(p) {
  const move = vec2(0, 0);

  // Handle click pathfinding
  if (mouseWasPressed(0)) {
    const target = screenToWorld(mousePosScreen);
    p.clickTarget = target;
    p.path = p.buildSmartPath(target);
  }

  // Handle keyboard input
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

  // Path following (curved corners)
  const feet = p.pos.add(p.feetOffset);
  if (!keyMove && p.path.length) {
    let next = p.path[0];
    const prev = feet;
    const next1 = p.path[0];
    const next2 = p.path[1] || next1;

    const dirA = next1.subtract(prev);
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
}

function angleToDir(a) {
  if (a < 0) a += Math.PI * 2;
  const off = Math.PI / 8;
  return (Math.floor(((a + off) % (2 * Math.PI)) / (Math.PI / 4)) + 5) % 8;
}
