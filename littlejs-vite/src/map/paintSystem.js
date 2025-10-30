// src/map/paintSystem.js — 🎨 Persistent reveal system with object sync
'use strict';
import { isoToWorld } from './isoMath.js';

let mapRef = null;
let playerRef = null;

let revealRadius = 1.7;
let permanentReveal = true;
let tileStates = new Map();

/*───────────────────────────────────────────────
  INIT / CONFIG
───────────────────────────────────────────────*/
export function initPaintSystem(map, player, opts = {}) {
  mapRef = map;
  playerRef = player;
  if (opts.revealRadius != null) revealRadius = opts.revealRadius | 0;
  if (opts.permanentReveal != null) permanentReveal = !!opts.permanentReveal;

  tileStates.clear();
  const { mapData, layers, objectLayers } = map;
  const n = mapData.width * mapData.height;

  // include all normal tile layers
  for (const layer of layers) {
    if (layer.type !== 'tilelayer') continue;
    for (let i = 0; i < n; i++) {
      const r = (i / mapData.width) | 0;
      const c = i % mapData.width;
      tileStates.set(`${layer.name}:${r},${c}`, 0);
    }
  }

  // ✅ include object layer(s) as "virtual" reveal grids
  if (objectLayers) {
    for (const ol of objectLayers) {
      if (!ol.objects?.length) continue;
      const layerName = ol.name || 'ObjectSprites';
      for (let r = 0; r < mapData.height; r++)
        for (let c = 0; c < mapData.width; c++)
          tileStates.set(`${layerName}:${r},${c}`, 0);
    }
  }
}

export function getTileBrightness(layerName, r, c) {
  return tileStates.get(`${layerName}:${r},${c}`) ?? 0;
}

/*───────────────────────────────────────────────
  UPDATE
───────────────────────────────────────────────*/
export function updatePaintSystem(dt = 1 / 24) {
  if (!playerRef?.pos || !mapRef?.mapData) return;

  const { mapData, TILE_W, TILE_H } = mapRef;
  const { width, height } = mapData;

  const playerWorldPos = playerRef.pos.add(playerRef.feetOffset);
  const softBand = revealRadius * 0.80;
  const blendSpeed = 0.06;
  const worldRevealRadius = revealRadius * TILE_W;
  const worldSoftBand = softBand * TILE_W;

  for (const [key, val] of tileStates) {
    const [/*layerName*/, rest] = key.split(':');
    const [rStr, cStr] = rest.split(',');
    const r = +rStr, c = +cStr;

    const tileWorldPos = isoToWorld(c, r, width, height, TILE_W, TILE_H);
    const dist = playerWorldPos.distance(tileWorldPos);

    let target = 0;
    if (dist <= worldRevealRadius)
      target = 1;
    else if (dist <= worldRevealRadius + worldSoftBand)
      target = Math.max(0, 1 - (dist - worldRevealRadius) / worldSoftBand);

    const blended = val + (target - val) * blendSpeed;
    const next = permanentReveal ? Math.max(val, blended) : blended;
    tileStates.set(key, next);
  }
}

/*───────────────────────────────────────────────
  EXPORT INTERNAL STATE (for objectSystem sync)
───────────────────────────────────────────────*/
export { mapRef, playerRef, revealRadius, tileStates };
