// src/map/mapLoader.js
import { vec2, TextureInfo, TileInfo, textureInfos } from 'littlejsengine';
import { tmxPxToWorld } from './isoMath.js';

export async function loadTiledMap(MAP_PATH, PPU) {
  const mapData = await fetchJSON(MAP_PATH);
  const TILE_W = mapData.tilewidth / PPU;
  const TILE_H = mapData.tileheight / PPU;
  const mapW = mapData.width;
  const mapH = mapData.height;

  // ──────────────────────────────────────────────
  // LOAD TILESET IMAGES
  // ──────────────────────────────────────────────
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

  // ──────────────────────────────────────────────
  // FILTER TILE AND OBJECT LAYERS
  // ──────────────────────────────────────────────
  const layers = mapData.layers.filter(l => l.type === 'tilelayer');

  // ✅ NEW: include all object layers (e.g. Collision, DepthPolygons)
  const objectLayers = mapData.layers.filter(l => l.type === 'objectgroup');

  // Debug check — verify DepthPolygons is loaded
  console.log(
    '[MapLoader] Object Layers:',
    objectLayers.map(l => l.name)
  );

  // ──────────────────────────────────────────────
  // COLLISION POLYGONS
  // ──────────────────────────────────────────────
  const colliders = [];
  for (const layer of objectLayers) {
    if (layer.name !== 'Collision') continue;
    for (const obj of layer.objects || []) {
      if (!obj.polygon) continue;

      // Convert polygon points from Tiled pixels → world-space
      let pts = obj.polygon.map(pt => {
        const w = tmxPxToWorld(
          obj.x + pt.x,
          obj.y + pt.y,
          mapW,
          mapH - 8,
          TILE_W,
          TILE_H,
          PPU
        );
        // shift collider down slightly to match base plane
        return vec2(w.x, w.y - TILE_H);
      });

      pts = cleanAndInflatePolygon(pts, 0.002);
      colliders.push({ id: obj.id, name: obj.name, pts });
    }
  }

  // ──────────────────────────────────────────────
  // RETURN MAP OBJECT
  // ──────────────────────────────────────────────
  return {
    mapData,
    rawImages,
    tileInfos,
    layers,
    objectLayers, // ✅ ensures DepthPolygons is available for renderMap
    colliders,
    TILE_W,
    TILE_H,
  };
}

// ──────────────────────────────────────────────
// Helper: clean small or skinny polygons
// ──────────────────────────────────────────────
function cleanAndInflatePolygon(pts, inflate = 0.002) {
  if (!pts.length) return pts;

  const EPS = 1e-5;
  const clean = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (a.distance(b) > EPS) clean.push(a);
  }

  if (clean.length < 3) return clean;

  // Ensure clockwise order
  let area = 0;
  for (let i = 0; i < clean.length; i++) {
    const a = clean[i], b = clean[(i + 1) % clean.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (area < 0) clean.reverse();

  const cx = clean.reduce((s, p) => s + p.x, 0) / clean.length;
  const cy = clean.reduce((s, p) => s + p.y, 0) / clean.length;
  const center = vec2(cx, cy);

  const inflated = clean.map(p => {
    const dir = p.subtract(center);
    const len = dir.length() || 1;
    return center.add(dir.scale(1 + inflate / len));
  });

  return inflated;
}

// ──────────────────────────────────────────────
// Utility: JSON & Image Loaders
// ──────────────────────────────────────────────
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
