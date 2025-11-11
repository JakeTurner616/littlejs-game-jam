// src/map/mapLoader.js — ⚡ Diagnostic Logging + Timing Breakdown
import { vec2, TextureInfo, TileInfo, textureInfos } from 'littlejsengine';
import { tmxPxToWorld } from './isoMath.js';

let atlasData = null;
let atlasTexture = null;
let atlasTexIndex = -1;

/*───────────────────────────────────────────────
  LOAD ATLAS (once globally)
───────────────────────────────────────────────*/
async function loadAtlas() {
  const atlasStart = performance.now();
  if (atlasData && atlasTexture) {
    console.log(`[mapLoader] ✅ Atlas already cached`);
    return { atlasData, atlasTexture, atlasTexIndex };
  }

  console.groupCollapsed('[mapLoader] Loading TextureAtlas');
  const [json, img] = await Promise.all([
    fetch('./assets/map/Sprites/texture.json').then(r => r.json()),
    loadImage('./assets/map/Sprites/texture.png')
  ]);
  atlasData = json.frames;
  atlasTexture = new TextureInfo(img);
  textureInfos.push(atlasTexture);
  atlasTexIndex = textureInfos.length - 1;
  console.log(`⏱️ TextureAtlas load: ${(performance.now() - atlasStart).toFixed(2)} ms`);
  console.groupEnd();

  return { atlasData, atlasTexture, atlasTexIndex };
}

/*───────────────────────────────────────────────
  MAIN MAP LOADER — uses atlas instead of per-tile PNGs
───────────────────────────────────────────────*/
export async function loadTiledMap(MAP_PATH, PPU) {
  const tStart = performance.now();
  console.groupCollapsed(`[mapLoader] Loading ${MAP_PATH}`);

  // 1️⃣ Fetch + parse JSON
  const f1 = performance.now();
  const resp = await fetch(MAP_PATH);
  const f2 = performance.now();
  const mapData = await resp.json();
  const f3 = performance.now();

  console.log(`⏱️ fetch(): ${(f2 - f1).toFixed(2)} ms`);
  console.log(`⏱️ JSON.parse(): ${(f3 - f2).toFixed(2)} ms`);

  // 2️⃣ Load or reuse atlas
  const atlasLoadStart = performance.now();
  const { atlasData, atlasTexture, atlasTexIndex } = await loadAtlas();
  console.log(`⏱️ loadAtlas(): ${(performance.now() - atlasLoadStart).toFixed(2)} ms`);

  // 3️⃣ Tile constants
  const TILE_W = mapData.tilewidth / PPU;
  const TILE_H = mapData.tileheight / PPU;
  const mapW = mapData.width;
  const mapH = mapData.height;

  // 4️⃣ Build gid→name map
  const gidStart = performance.now();
  const tileset = mapData.tilesets[0];
  const firstgid = tileset.firstgid || 1;
  const gidToName = {};
  for (const tile of tileset.tiles || []) {
    const name = tile.image.split('/').pop();
    gidToName[firstgid + tile.id] = name;
  }
  console.log(`⏱️ GID→Name build: ${(performance.now() - gidStart).toFixed(2)} ms (${Object.keys(gidToName).length} entries)`);

  // 5️⃣ Build TileInfo objects
  const tileInfoStart = performance.now();
  const tileInfos = Object.create(null);
  for (const [name, frameObj] of Object.entries(atlasData)) {
    const f = frameObj.frame;
    tileInfos[name] = new TileInfo(vec2(f.x, f.y), vec2(f.w, f.h), atlasTexIndex);
  }
  console.log(`⏱️ TileInfos build: ${(performance.now() - tileInfoStart).toFixed(2)} ms (${Object.keys(tileInfos).length} atlas frames)`);

  // 6️⃣ Filter layers
  const layerStart = performance.now();
  const layers = mapData.layers.filter(l => l.type === 'tilelayer');
  const objectLayers = mapData.layers.filter(l => l.type === 'objectgroup');
  console.log(`⏱️ Layer separation: ${(performance.now() - layerStart).toFixed(2)} ms (${layers.length} tile, ${objectLayers.length} object)`);

  // 7️⃣ Offset maps
  const offsetStart = performance.now();
  const floorOffsets = new Map();
  const wallOffsets = new Map();
  for (const layer of layers) {
    const name = layer.name.trim();
    const worldOffset = (layer.offsety ?? 0) / PPU;
    (name.startsWith('FloorOffset') ? floorOffsets : wallOffsets).set(name, worldOffset);
  }
  console.log(`⏱️ Offsets setup: ${(performance.now() - offsetStart).toFixed(2)} ms`);

  // 8️⃣ Parse object layers
  const objStart = performance.now();
  const colliders = [];
  const eventPolygons = [];
  const objectSprites = [];
  let outManeuverNodes = [];

  for (const layer of objectLayers) {
    const { name, objects = [] } = layer;
    const lStart = performance.now();

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
    else if (name === 'EventPolygons') {
      for (const obj of objects) {
        const poly = obj.polygon;
        if (!poly) continue;
        const pts = poly.map(pt => {
          const w = tmxPxToWorld(obj.x + pt.x, obj.y + pt.y, mapW, mapH, TILE_W, TILE_H, PPU, true);
          return vec2(w.x, w.y - TILE_H / 2);
        });
        const props = obj.properties || [];
        const eventId = props.find(p => p.name === 'eventId')?.value || null;
        eventPolygons.push({ id: obj.id, name: obj.name || `event_${obj.id}`, pts, eventId, properties: props });
      }
    }
    else if (name === 'ObjectSprites') {
      for (const obj of objects) {
        const spriteName = obj.properties?.find(p => p.name === 'spriteName')?.value;
        if (!spriteName || !atlasData[spriteName]) continue;
        const f = atlasData[spriteName].frame;
        const tileInfo = new TileInfo(vec2(f.x, f.y), vec2(f.w, f.h), atlasTexIndex);
        const w = tmxPxToWorld(obj.x, obj.y, mapW, mapH, TILE_W, TILE_H, PPU, true);
        const pos = vec2(w.x, w.y - TILE_H / 2);
        objectSprites.push({ name: spriteName, tileInfo, pos, properties: obj.properties || [] });
      }
    }
    else if (name === 'ManeuverNodes') {
      const nodes = [];
      for (const obj of objects) {
        const id = obj.name || `node_${obj.id}`;
        const w = tmxPxToWorld(obj.x, obj.y, mapW, mapH, TILE_W, TILE_H, PPU, true);
        const pos = vec2(w.x, w.y - TILE_H / 2);
        const connections = obj.properties?.find(p => p.name === 'connections')?.value
          ?.split(',').map(s => s.trim()).filter(Boolean) || [];
        nodes.push({ id, pos, connections });
      }
      const AUTO_RANGE = 2.0;
      for (const n of nodes)
        if (!n.connections.length)
          n.connections = nodes.filter(o => o !== n && n.pos.distance(o.pos) < AUTO_RANGE).map(o => o.id);
      outManeuverNodes = nodes;
    }

    console.log(`   ↳ ${name} parsed in ${(performance.now() - lStart).toFixed(2)} ms (${objects.length} objects)`);
  }
  console.log(`⏱️ Object layer parsing total: ${(performance.now() - objStart).toFixed(2)} ms`);

  // 9️⃣ Build gidTileInfos
  const gidInfoStart = performance.now();
  const gidTileInfos = {};
  for (const [gid, name] of Object.entries(gidToName)) {
    gidTileInfos[gid] = tileInfos[name];
  }
  console.log(`⏱️ gidTileInfos build: ${(performance.now() - gidInfoStart).toFixed(2)} ms`);

  // 🔟 Done
  const total = (performance.now() - tStart).toFixed(2);
  console.log(`🚀 TOTAL loadTiledMap(): ${total} ms`);
  console.groupEnd();

  return {
    mapData,
    atlasData,
    atlasTexture,
    atlasTexIndex,
    tileInfos: gidTileInfos,
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
  let area = 0;
  for (let i = 0, j = clean.length - 1; i < clean.length; j = i++)
    area += (clean[j].x - clean[i].x) * (clean[j].y + clean[i].y);
  if (area > 0) clean.reverse();
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
const loadImage = src => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => rej(new Error('Image failed: ' + src));
  img.src = src;
});
