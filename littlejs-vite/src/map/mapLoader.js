// src/map/mapLoader.js — ✅ ManeuverNodes with Auto-Connection Fallback
import { vec2, TextureInfo, TileInfo, textureInfos } from 'littlejsengine';
import { tmxPxToWorld } from './isoMath.js';

/**
 * Load a Tiled JSON map and convert into game-ready world data
 * ------------------------------------------------------------
 * • Handles tile + object layers
 * • Builds collider polygons and event polygons
 * • Loads object sprites and maneuver nodes (with auto-connections)
 */
export async function loadTiledMap(MAP_PATH, PPU) {
  const mapData = await fetchJSON(MAP_PATH);
  const TILE_W = mapData.tilewidth / PPU;
  const TILE_H = mapData.tileheight / PPU;
  const mapW = mapData.width;
  const mapH = mapData.height;

  // cache tileset
  const tilesetDef = mapData.tilesets[0];
  const firstgid = tilesetDef.firstgid || 1;
  const rawImages = Object.create(null);
  const tileInfos = Object.create(null);

  // prefetch all tiles
  const tiles = tilesetDef.tiles || [];
  const imagePromises = tiles.map(t => {
    const gid = t.id + firstgid;
    const imgPath = `/assets/map/${t.image}`;
    return loadImage(imgPath).then(img => {
      rawImages[gid] = img;
      const texInfo = new TextureInfo(img);
      textureInfos.push(texInfo);
      const texIndex = textureInfos.length - 1;
      tileInfos[gid] = new TileInfo(vec2(0, 0), vec2(img.width, img.height), texIndex);
    });
  });
  await Promise.all(imagePromises);

  const layers = mapData.layers.filter(l => l.type === 'tilelayer');
  const objectLayers = mapData.layers.filter(l => l.type === 'objectgroup');

  // precompute offset maps
  const floorOffsets = new Map();
  const wallOffsets = new Map();
  for (const layer of layers) {
    const name = layer.name.trim();
    const worldOffset = (layer.offsety ?? 0) / PPU;
    (name.startsWith('FloorOffset') ? floorOffsets : wallOffsets).set(name, worldOffset);
  }

  const colliders = [];
  const eventPolygons = [];
  const objectSprites = [];
  let outManeuverNodes = [];

  for (const layer of objectLayers) {
    const { name, objects = [] } = layer;

    // ──────────────────────────────────────────────
    // Collision polygons
    // ──────────────────────────────────────────────
    if (name === 'Collision') {
      for (const obj of objects) {
        const poly = obj.polygon;
        if (!poly) continue;
        const pts = poly.map(pt => {
          const w = tmxPxToWorld(obj.x + pt.x, obj.y + pt.y, mapW, mapH, TILE_W, TILE_H, PPU, true);
          return vec2(w.x, w.y - TILE_H / 2);
        });
        colliders.push({ id: obj.id, name: obj.name, pts: cleanAndInflatePolygon(pts, 0.002) });
      }
    }

    // ──────────────────────────────────────────────
    // Event polygons
    // ──────────────────────────────────────────────
    else if (name === 'EventPolygons') {
      for (const obj of objects) {
        const poly = obj.polygon;
        if (!poly) continue;
        const pts = poly.map(pt => {
          const w = tmxPxToWorld(obj.x + pt.x, obj.y + pt.y, mapW, mapH, TILE_W, TILE_H, PPU, true);
          return vec2(w.x, w.y - TILE_H / 2);
        });
        const eventId = obj.properties?.find(p => p.name === 'eventId')?.value || null;
        eventPolygons.push({ id: obj.id, name: obj.name || `event_${obj.id}`, pts, eventId });
      }
    }

    // ──────────────────────────────────────────────
    // Object sprites
    // ──────────────────────────────────────────────
    else if (name === 'ObjectSprites') {
      for (const obj of objects) {
        const spriteName = obj.properties?.find(p => p.name === 'spriteName')?.value;
        if (!spriteName) continue;
        objectSprites.push({ name: spriteName, x: obj.x, y: obj.y, properties: obj.properties || [] });
      }
    }

    // ──────────────────────────────────────────────
    // Maneuver nodes (for pathfinding)
    // ──────────────────────────────────────────────
else if (name === 'ManeuverNodes') {
  const maneuverNodes = [];
  for (const obj of objects) {
    const id = obj.name || `node_${obj.id}`;
    // same coordinate math as colliders
    const w = tmxPxToWorld(obj.x, obj.y, mapW, mapH, TILE_W, TILE_H, PPU, true);
    const pos = vec2(w.x, w.y - TILE_H / 2); // ✅ anchor fix for proper floor alignment
    const connections = obj.properties?.find(p => p.name === 'connections')?.value
      ?.split(',').map(s => s.trim()).filter(Boolean) || [];
    maneuverNodes.push({ id, pos, connections });
  }

  // ✅ Auto-connect nearby nodes if none explicitly set
  const AUTO_RANGE = 2.0; // world-space units
  for (const n of maneuverNodes) {
    if (!n.connections.length) {
      n.connections = maneuverNodes
        .filter(o => o !== n && n.pos.distance(o.pos) < AUTO_RANGE)
        .map(o => o.id);
    }
  }

  outManeuverNodes = maneuverNodes;
}
  }

  // ──────────────────────────────────────────────
  // Return assembled map object
  // ──────────────────────────────────────────────
  return {
    mapData,
    rawImages,
    tileInfos,
    layers,
    objectLayers,
    colliders,
    eventPolygons,
    objectSprites,
    TILE_W,
    TILE_H,
    floorOffsets,
    wallOffsets,
    maneuverNodes: outManeuverNodes,
  };
}

/*───────────────────────────────────────────────*/
function cleanAndInflatePolygon(pts, inflate = 0.002) {
  const n = pts.length;
  if (n < 3) return pts;
  const EPS = 1e-5;
  const clean = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    if (a.distance(b) > EPS) clean.push(a);
  }
  if (clean.length < 3) return clean;

  // ensure CCW orientation
  let area = 0;
  for (let i = 0, j = clean.length - 1; i < clean.length; j = i++)
    area += (clean[j].x - clean[i].x) * (clean[j].y + clean[i].y);
  if (area > 0) clean.reverse();

  // inflate from center
  const cx = clean.reduce((s, p) => s + p.x, 0) / clean.length;
  const cy = clean.reduce((s, p) => s + p.y, 0) / clean.length;
  const center = vec2(cx, cy);
  return clean.map(p => {
    const dir = p.subtract(center);
    const len = dir.length() || 1;
    return center.add(dir.scale(1 + inflate / len));
  });
}

/*───────────────────────────────────────────────*/
const fetchJSON = url => fetch(url).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return r.json();
});

const loadImage = src => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => rej(new Error('Image failed: ' + src));
  img.src = src;
});
