// src/map/maskUtils.js — 🧠 Alpha-mask extraction & overlap detection
'use strict';
import { vec2 } from 'littlejsengine';
import { clamp } from 'littlejsengine';

const alphaMaskCache = new Map();

/*───────────────────────────────────────────────
  ADAPTIVE FILLED MASK (with morphological cleanup)
───────────────────────────────────────────────*/
export function extractAdaptiveFilledMask(info, atlasTexture, threshold = 254) {
  const key = `${info.pos.x},${info.pos.y},${info.size.x},${info.size.y}-adaptive`;
  if (alphaMaskCache.has(key)) return alphaMaskCache.get(key);

  const img = atlasTexture.image;
  const { x: sx, y: sy } = info.pos;
  const { x: w, y: h } = info.size;

  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const ctx = off.getContext('2d');
  ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const mask = new Uint8Array(w * h);
  let filledCount = 0;
  for (let i = 0, j = 3; i < mask.length; i++, j += 4) {
    const val = data[j] > threshold ? 1 : 0;
    mask[i] = val;
    filledCount += val;
  }

  const density = filledCount / (w * h);
  if (density < 0.05 || density > 0.9)
    blurMask(mask, w, h);

  dilateMask(mask, w, h, 2);

  const result = { w, h, filled: mask };
  alphaMaskCache.set(key, result);
  return result;
}

/*───────────────────────────────────────────────
  HELPER OPS
───────────────────────────────────────────────*/
function blurMask(mask, w, h) {
  const out = new Uint8Array(mask);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let sum = 0;
      for (let yy = -1; yy <= 1; yy++)
        for (let xx = -1; xx <= 1; xx++)
          sum += mask[i + yy * w + xx];
      out[i] = sum >= 5 ? 1 : 0;
    }
  }
  mask.set(out);
}

function dilateMask(mask, w, h, passes) {
  for (let p = 0; p < passes; p++) {
    const src = mask.slice();
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const sum = src[i - w] + src[i - 1] + src[i] + src[i + 1] + src[i + w];
        if (sum >= 3) mask[i] = 1;
      }
    }
  }
}

/*───────────────────────────────────────────────
  PLAYER ↔ TILE MASK OVERLAP CHECK
───────────────────────────────────────────────*/
export function playerOverlapsTileMask(playerPos, playerSize, posDraw, sizeDraw, info, atlasTexture) {
  const pMinX = playerPos.x - playerSize.x / 2, pMaxX = playerPos.x + playerSize.x / 2;
  const pMinY = playerPos.y - playerSize.y / 2, pMaxY = playerPos.y + playerSize.y / 2;
  const minX = posDraw.x - sizeDraw.x / 2, maxX = posDraw.x + sizeDraw.x / 2;
  const minY = posDraw.y - sizeDraw.y / 2, maxY = posDraw.y + sizeDraw.y / 2;
  if (pMaxX < minX || pMinX > maxX || pMaxY < minY || pMinY > maxY) return false;

  const { w, h, filled } = extractAdaptiveFilledMask(info, atlasTexture);
  const scaleX = sizeDraw.x / w, scaleY = sizeDraw.y / h;
  const cx = posDraw.x - sizeDraw.x / 2, cy = posDraw.y - sizeDraw.y / 2;
  const step = Math.max(1, Math.floor((w * h) / 3000));

  for (let i = 0; i < w * h; i += step) {
    if (!filled[i]) continue;
    const x = i % w, y = (i / w) | 0;
    const wx = cx + x * scaleX;
    const wy = cy + (h - y) * scaleY;
    if (wx >= pMinX && wx <= pMaxX && wy >= pMinY && wy <= pMaxY)
      return true;
  }
  return false;
}
