// src/map/mapLoader.js
import { vec2, TextureInfo, TileInfo, textureInfos } from 'littlejsengine';
import { tmxPxToWorld } from './isoMath.js';

export async function loadTiledMap(MAP_PATH, PPU) {
  const mapData = await fetchJSON(MAP_PATH);
  const TILE_W = mapData.tilewidth / PPU;
  const TILE_H = mapData.tileheight / PPU;
  const mapW = mapData.width;
  const mapH = mapData.height;

  // tileset
  const tilesetDef = mapData.tilesets[0];
  const firstgid = tilesetDef.firstgid || 1;
  const rawImages = {};
  const tileInfos = {};

  for (const t of tilesetDef.tiles || []) {
    const gid = t.id + firstgid;
    const imgPath = `/assets/map/${t.image}`;
    const img = await loadImage(imgPath);
    rawImages[gid] = img;
    const texInfo = new TextureInfo(img);
    textureInfos.push(texInfo);
    const texIndex = textureInfos.length - 1;
    tileInfos[gid] = new TileInfo(vec2(0, 0), vec2(img.width, img.height), texIndex);
  }

  const layers = mapData.layers.filter(l => l.type === 'tilelayer');
  const objectLayers = mapData.layers.filter(l => l.type === 'objectgroup');

  // floor/wall offsets
  const floorOffsets = new Map();
  const wallOffsets = new Map();
  for (const layer of layers) {
    const name = layer.name.trim();
    const offY_px = layer.offsety ?? 0;
    const worldOffset = offY_px / PPU;
    if (/^FloorOffset/i.test(name)) floorOffsets.set(name, worldOffset);
    else if (/^WallOffset/i.test(name)) wallOffsets.set(name, worldOffset);
  }

  // colliders
  const colliders = [];
  for (const layer of objectLayers) {
    if (layer.name !== 'Collision') continue;
    for (const obj of layer.objects || []) {
      if (!obj.polygon) continue;
      let pts = obj.polygon.map(pt => {
        const w = tmxPxToWorld(
          obj.x + pt.x, obj.y + pt.y,
          mapW, mapH, TILE_W, TILE_H, PPU, true
        );
        return vec2(w.x, w.y - TILE_H / 2);
      });
      pts = cleanAndInflatePolygon(pts, 0.002);
      colliders.push({ id: obj.id, name: obj.name, pts });
    }
  }

  // events
  const eventPolygons = [];
  for (const layer of objectLayers) {
    if (layer.name !== 'EventPolygons') continue;
    for (const obj of layer.objects || []) {
      if (!obj.polygon) continue;
      const pts = obj.polygon.map(pt => {
        const w = tmxPxToWorld(
          obj.x + pt.x, obj.y + pt.y,
          mapW, mapH, TILE_W, TILE_H, PPU, true
        );
        return vec2(w.x, w.y - TILE_H / 2);
      });
      const eventId = obj.properties?.find(p => p.name === 'eventId')?.value || null;
      eventPolygons.push({ id: obj.id, name: obj.name || `event_${obj.id}`, pts, eventId });
    }
  }

  // ✅ NEW: object sprites
  const objectSprites = [];
  for (const layer of objectLayers) {
    if (layer.name !== 'ObjectSprites') continue;
    for (const obj of layer.objects || []) {
      const spriteProp = obj.properties?.find(p => p.name === 'spriteName');
      if (!spriteProp?.value) continue;
      const spriteName = spriteProp.value;
      objectSprites.push({
        name: spriteName,
        x: obj.x,
        y: obj.y,
        properties: obj.properties || [],
      });
    }
  }

  return {
    mapData,
    rawImages,
    tileInfos,
    layers,
    objectLayers,
    colliders,
    eventPolygons,
    objectSprites,   // ✅ added
    TILE_W,
    TILE_H,
    floorOffsets,
    wallOffsets,
  };
}

/*───────────────────────────────────────────────
  Helpers
───────────────────────────────────────────────*/
function cleanAndInflatePolygon(pts, inflate = 0.002) {
  if (!pts.length) return pts;
  const EPS = 1e-5;
  const clean = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (a.distance(b) > EPS) clean.push(a);
  }
  if (clean.length < 3) return clean;
  let area = 0;
  for (let i = 0; i < clean.length; i++) {
    const a = clean[i], b = clean[(i + 1) % clean.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (area < 0) clean.reverse();
  const cx = clean.reduce((s, p) => s + p.x, 0) / clean.length;
  const cy = clean.reduce((s, p) => s + p.y, 0) / clean.length;
  const center = vec2(cx, cy);
  return clean.map(p => {
    const dir = p.subtract(center);
    const len = dir.length() || 1;
    return center.add(dir.scale(1 + inflate / len));
  });
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return await res.json();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed: ' + src));
    img.src = src;
  });
}
