// src/character/playerCollision.js
'use strict';

export function pointInsideAnyCollider(colliders, p) {
  for (const c of colliders)
    if (pointInPoly(p, c.pts)) return true;
  return false;
}

export function pointInPoly(p, v) {
  let inside = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const xi = v[i].x, yi = v[i].y, xj = v[j].x, yj = v[j].y;
    const inter = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < (xj - xi) * (p.y - yi) / ((yj - yi) || 1e-9) + xi);
    if (inter) inside = !inside;
  }
  return inside;
}
