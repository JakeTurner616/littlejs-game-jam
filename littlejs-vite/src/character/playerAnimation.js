// src/character/playerAnimation.js — 🧍 Added "take" animation
'use strict';
import { timeDelta } from 'littlejsengine';

export async function loadAllAnimations(p) {
  const dirs = Array.from({ length: 8 }, (_, i) => i + 1);
  const idle = { cols: 9, rows: 9, frameW: 394, frameH: 504, total: 75, dur: 1 / 30 };
  const walk = { cols: 6, rows: 6, frameW: 394, frameH: 502, total: 31, dur: 1 / 30 };
  const take = { cols: 9, rows: 8, frameW: 176, frameH: 453, total: 68, dur: 1 / 30 };

  for (const d of dirs) {
    p.frames[`idle_${d}`] = genFrames(idle);
    p.frames[`walk_${d}`] = genFrames(walk);
    p.frames[`take_${d}`] = genFrames(take);

    p.durations[`idle_${d}`] = Array(idle.total).fill(idle.dur);
    p.durations[`walk_${d}`] = Array(walk.total).fill(walk.dur);
    p.durations[`take_${d}`] = Array(take.total).fill(take.dur);
  }

  p.ready = true;
}

function genFrames({ cols, rows, frameW, frameH, total }) {
  const f = []; let n = 0;
  for (let y = 0; y < rows && n < total; y++)
    for (let x = 0; x < cols && n < total; x++, n++)
      f.push({ x: x * frameW, y: y * frameH, w: frameW, h: frameH });
  return f;
}

export function handlePlayerAnimation(p) {
  const frames = p.frames[p.currentAnimKey] || [];
  if (!frames.length) return;

  p.frameTimer += timeDelta;
  const frameDuration = p.durations[p.currentAnimKey]?.[p.frameIndex] || 1 / 30;
  if (p.frameTimer >= frameDuration) {
    p.frameTimer = 0;
    p.frameIndex = (p.frameIndex + 1) % frames.length;
  }
}
