// src/map/mapLoader.js  ✅ optimized without feature loss
import { vec2, TextureInfo, TileInfo, textureInfos } from 'littlejsengine';
import { tmxPxToWorld } from './isoMath.js';

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

  // prefetch all images concurrently
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

  for (const layer of objectLayers) {
    const { name, objects = [] } = layer;

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
        const eventId = obj.properties?.find(p => p.name === 'eventId')?.value || null;
        eventPolygons.push({ id: obj.id, name: obj.name || `event_${obj.id}`, pts, eventId });
      }
    } 
    else if (name === 'ObjectSprites') {
      for (const obj of objects) {
        const spriteName = obj.properties?.find(p => p.name === 'spriteName')?.value;
        if (!spriteName) continue;
        objectSprites.push({ name: spriteName, x: obj.x, y: obj.y, properties: obj.properties || [] });
      }
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
    objectSprites,
    TILE_W,
    TILE_H,
    floorOffsets,
    wallOffsets,
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

  // compute signed area quickly
  let area = 0;
  for (let i = 0, j = clean.length - 1; i < clean.length; j = i++)
    area += (clean[j].x - clean[i].x) * (clean[j].y + clean[i].y);
  if (area > 0) clean.reverse();

  // center + inflate
  const cx = clean.reduce((s, p) => s + p.x, 0) / clean.length;
  const cy = clean.reduce((s, p) => s + p.y, 0) / clean.length;
  const center = vec2(cx, cy);
  return clean.map(p => {
    const dir = p.subtract(center);
    const len = dir.length() || 1;
    return center.add(dir.scale(1 + inflate / len));
  });
}

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