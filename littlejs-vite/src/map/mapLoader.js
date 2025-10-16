// src/map/mapLoader.js
import { vec2, TextureInfo, TileInfo, textureInfos } from 'littlejsengine';
import { tmxPxToWorld } from './isoMath.js';

export async function loadTiledMap(MAP_PATH, PPU) {
  const mapData = await fetchJSON(MAP_PATH);
  const TILE_W = mapData.tilewidth / PPU;
  const TILE_H = mapData.tileheight / PPU;
  const mapW = mapData.width;
  const mapH = mapData.height;

  // ── Load tileset images ───────────────────────────────
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

  // ─────────────────────────────────────────────────────
  // COLLISION POLYGONS: extract from object layers named "Collision"
  // ─────────────────────────────────────────────────────
  const colliders = [];
  for (const layer of objectLayers) {
    if (layer.name !== 'Collision') continue;
    for (const obj of layer.objects || []) {
      if (!obj.polygon) continue;

      // Convert polygon points to world space
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
        return vec2(w.x, w.y);
      });

      // ────── Reliability Improvements ──────
      pts = cleanAndInflatePolygon(pts, 0.002);

      colliders.push({ id: obj.id, name: obj.name, pts });
    }
  }

  // Return everything (for rendering + collision)
  return {
    mapData,
    rawImages,
    tileInfos,
    layers,
    objectLayers,
    colliders,
    TILE_W,
    TILE_H
  };
}

// ──────────────────────────────────────────────
// Helper: clean small or skinny polygons
// ──────────────────────────────────────────────
function cleanAndInflatePolygon(pts, inflate = 0.002) {
  if (!pts.length) return pts;

  // Remove duplicate / near-zero-length edges
  const EPS = 1e-5;
  const clean = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (a.distance(b) > EPS) clean.push(a);
  }

  if (clean.length < 3) return clean;

  // Compute area to ensure clockwise order (negative = CCW)
  let area = 0;
  for (let i = 0; i < clean.length; i++) {
    const a = clean[i], b = clean[(i + 1) % clean.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (area < 0) clean.reverse();

  // Inflate small polygons slightly
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

// ── Helpers ─────────────────────────────────────────────
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
