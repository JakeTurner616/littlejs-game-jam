// src/character/playerPathfinding.js
'use strict';
import { vec2, Color, clamp } from 'littlejsengine';

/**
 * buildSmartPath(player, target)
 * ------------------------------
 * A* pathfinder that links pre-defined maneuver nodes.
 */
export function buildSmartPath(p, target) {
  const feetStart = p.pos.add(p.feetOffset);
  const feetGoal = target;
  const baseNodes = window.scene?.map?.maneuverNodes || [];
  p.debugLinks = [];
  p.debugNodes = [];

  if (rayClear(p, feetStart, feetGoal)) {
    p.debugLinks.push({ a: feetStart, b: feetGoal, color: new Color(0, 1, 0, 0.6) });
    return [feetGoal];
  }

  if (!baseNodes.length) return [];

  const nodes = new Map(baseNodes.map(n => [n.id, { ...n }]));
  const startNode = { id: 'start', pos: feetStart, connections: [] };
  const goalNode = { id: 'goal', pos: feetGoal, connections: [] };
  nodes.set('start', startNode);
  nodes.set('goal', goalNode);

  for (const n of baseNodes) {
    if (rayClear(p, feetStart, n.pos)) startNode.connections.push(n.id);
    if (rayClear(p, n.pos, feetGoal)) n.connections.push('goal');
  }

  const links = new Map();
  for (const [id, n] of nodes.entries()) {
    const adj = [];
    for (const cid of n.connections || []) {
      const t = nodes.get(cid);
      if (!t) continue;
      const clear = rayClear(p, n.pos, t.pos);
      p.debugLinks.push({
        a: n.pos, b: t.pos,
        color: clear ? new Color(1, 0.6, 0, 0.5) : new Color(1, 0, 0, 0.3),
      });
      if (clear) adj.push(t);
    }
    links.set(id, adj);
  }

  const open = [startNode];
  const came = new Map();
  const g = new Map([[startNode.id, 0]]);
  const h = (a, b) => (a?.pos && b?.pos) ? a.pos.distance(b.pos) : Infinity;

  while (open.length) {
    open.sort((a, b) => (g.get(a.id) + h(a, goalNode)) - (g.get(b.id) + h(b, goalNode)));
    const current = open.shift();
    if (!current?.pos) continue;
    if (current.id === 'goal') break;

    for (const next of links.get(current.id) || []) {
      if (!next?.pos) continue;
      const cost = g.get(current.id) + current.pos.distance(next.pos);
      if (!g.has(next.id) || cost < g.get(next.id)) {
        g.set(next.id, cost);
        came.set(next.id, current);
        if (!open.includes(next)) open.push(next);
      }
    }
  }

  const path = [];
  let cur = goalNode;
  while (came.has(cur.id)) {
    const prev = came.get(cur.id);
    path.unshift(cur.pos);
    cur = prev;
  }

  if (!path.length) return [];

  for (let i = 0; i < path.length - 1; i++)
    p.debugLinks.push({ a: path[i], b: path[i + 1], color: new Color(0, 1, 0, 0.7) });

  return path;
}

/*────────────────────────── Utility Functions ──────────────────────────*/
export function rayClear(p, a, b, step = 0.1) {
  const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
  if (!isFinite(dist) || dist <= 0) return false;
  const steps = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= steps; i++) {
    const pt = vec2(a.x + dx * (i / steps), a.y + dy * (i / steps));
    if (p.pointInsideAnyCollider(pt)) return false;
  }
  return true;
}
