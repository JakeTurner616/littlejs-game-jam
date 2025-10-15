// src/map/mapLoader.js
// Simplified: no spawn detection or South anchor logic.
import { vec2, TextureInfo, TileInfo, textureInfos } from 'littlejsengine';

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

  // No spawn detection here — we’ll just return map data
  return { mapData, rawImages, tileInfos, layers, objectLayers, TILE_W, TILE_H };
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
