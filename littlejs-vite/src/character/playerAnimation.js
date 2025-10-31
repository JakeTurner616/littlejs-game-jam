// src/character/playerAnimation.js — 🧩 hard state clamp for take → idle transition
'use strict';
import { timeDelta } from 'littlejsengine';

/*───────────────────────────────────────────────
  Load all animations
───────────────────────────────────────────────*/
export async function loadAllAnimations(p) {
  const dirs = Array.from({ length: 8 }, (_, i) => i + 1);
  const idle = { cols: 9, rows: 9, frameW: 394, frameH: 504, total: 75, dur: 1 / 30 };
  const walk = { cols: 6, rows: 6, frameW: 394, frameH: 502, total: 31, dur: 1 / 30 };
  const take = { cols: 8, rows: 9, frameW: 394, frameH: 502, total: 60, dur: 1 / 30 };

  for (const d of dirs) {
    p.frames[`idle_${d}`] = genFrames(idle);
    p.frames[`walk_${d}`] = genFrames(walk);
    p.frames[`take_${d}`] = genFrames(take);
    p.durations[`idle_${d}`] = Array(idle.total).fill(idle.dur);
    p.durations[`walk_${d}`] = Array(walk.total).fill(walk.dur);
    p.durations[`take_${d}`] = Array(take.total).fill(take.dur);
  }

  console.log(`[AnimLoader] ✅ Loaded idle(${idle.total}), walk(${walk.total}), take(${take.total}) frames per direction`);
  p.ready = true;
}

/*───────────────────────────────────────────────
  Frame generation helper
───────────────────────────────────────────────*/
function genFrames({ cols, rows, frameW, frameH, total }) {
  const f = [];
  for (let y = 0, n = 0; y < rows && n < total; y++)
    for (let x = 0; x < cols && n < total; x++, n++)
      f.push({ x: x * frameW, y: y * frameH, w: frameW, h: frameH });
  return f;
}

/*───────────────────────────────────────────────
  Animation handler
───────────────────────────────────────────────*/
export function handlePlayerAnimation(p) {
  const frames = p.frames[p.currentAnimKey];
  if (!frames?.length) return;

  // 🟡 Core frame update logic
  p.frameTimer += timeDelta;
  const frameDuration = p.durations[p.currentAnimKey]?.[p.frameIndex] || 1 / 30;

  if (p.frameTimer >= frameDuration) {
    p.frameTimer = 0;
    p.frameIndex++;
  }

  // 🧩 Hard clamp: if take anim is done, force instant exit
  if (p.state === 'take' && p.frameIndex >= frames.length) {
    console.warn(`[Animation] ⏹ TAKE DONE — forcing idle switch (frames=${frames.length})`);

    p.frameIndex = frames.length - 1; // clamp draw
    const dir = p.direction + 1;

    // Immediately return to idle
    p.state = 'idle';
    p.currentAnimKey = `idle_${dir}`;
    p.frameIndex = 0;
    p.frameTimer = 0;
    p.frozen = false;
    p.animating = false;

    // Fire callback safely
    if (typeof p.onceAnimationComplete === 'function') {
      const cb = p.onceAnimationComplete;
      p.onceAnimationComplete = null;
      cb();
    }

    console.log(`[Animation] 🔁 take→idle_${dir} instant`);
    return;
  }

  // ✅ Normal looping behavior
  if (p.frameIndex >= frames.length)
    p.frameIndex = 0;


}
