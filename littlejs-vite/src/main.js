/*
  LittleJS Isometric Map Renderer — PERFECT CENTER VERSION + OBJECT LAYER DEBUG
  -----------------------------------------------------------------------------
  ✅ Correct Y-flip and scaling
  ✅ Ground diamond centered in camera
  ✅ Aligned bases for tall 512px sprites
  ✅ Object layer polygons rendered in red (iso-aligned)
  ✅ Uses "South" layer (1 tile) as alignment reference
*/

'use strict';

import {
  engineInit, vec2, hsl, rgb, drawRect, drawTile, drawLine, debugText,
  setCameraPos, setCameraScale, setShowSplashScreen, setTileFixBleedScale,
  mainCanvas, textureInfos, TextureInfo, TileInfo, keyIsDown
} from 'littlejsengine';

// ──────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────
const MAP_PATH = '/assets/map/sample-iso.tmj';
const PPU = 128;
let TILE_W = 256 / PPU;
let TILE_H = 128 / PPU;
const CAMERA_SPEED = 0.1;

// ──────────────────────────────────────────────────────────────
let mapData;
let rawImages = {};
let tileInfos = {};
let layers = [];
let objectLayers = [];
let cameraPos = vec2(0, 0);

// ──────────────────────────────────────────────────────────────
(async function preload() {
  setShowSplashScreen(false);
  setTileFixBleedScale(.5);

  mapData = await fetchJSON(MAP_PATH);
  TILE_W = mapData.tilewidth / PPU;
  TILE_H = mapData.tileheight / PPU;

  const tilesetDef = mapData.tilesets[0];
  const tilesetTiles = tilesetDef.tiles || [];
  const firstgid = tilesetDef.firstgid || 1;

  for (const t of tilesetTiles) {
    const gid = t.id + firstgid;
    const imgPath = `/assets/map/${t.image}`;
    rawImages[gid] = await loadImage(imgPath);
    console.log(`[iso] preloaded ${t.image}`);
  }

  engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost);
})();

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

// ──────────────────────────────────────────────────────────────
function isoToWorld(c, r, mapW, mapH) {
  const x = (c - r) * (TILE_W / 2);
  const y = -(c + r) * (TILE_H / 2);
  const offsetX = (mapW - 1) * (TILE_W / 2);
  const offsetY = mapH * (TILE_H / 2);
  return vec2(x + offsetX, y + offsetY);
}

// Convert raw Tiled pixel coordinate to world units
function tmxPxToWorld(xPx, yPx, mapW, mapH) {
  const xWorldUnit = xPx / PPU;
  const yWorldUnit = yPx / PPU;
  const xIso = (xWorldUnit - yWorldUnit) * (TILE_W / 2);
  const yIso = -(xWorldUnit + yWorldUnit) * (TILE_H / 2);
  const offsetX = (mapW - 1) * (TILE_W / 2);
  const offsetY = mapH * (TILE_H / 2);
  return vec2(xIso + offsetX, yIso + offsetY);
}

// ──────────────────────────────────────────────────────────────
function gameInit() {
  for (const gid in rawImages) {
    const img = rawImages[gid];
    const texInfo = new TextureInfo(img);
    textureInfos.push(texInfo);
    const texIndex = textureInfos.length - 1;
    const tinfo = new TileInfo(vec2(0, 0), vec2(img.width, img.height), texIndex);
    tileInfos[gid] = tinfo;
  }

  layers = mapData.layers.filter(l => l.type === 'tilelayer' && l.visible !== false);
  objectLayers = mapData.layers.filter(l => l.type === 'objectgroup' && l.visible !== false);

  const mapW = mapData.width;
  const mapH = mapData.height;
  const totalW = (mapW + mapH) * (TILE_W / 2);
  const totalH = (mapW + mapH) * (TILE_H / 2);

  const mapCenter = vec2(totalW / 2, totalH - 10);
  cameraPos = mapCenter;

  setCameraScale(PPU);
  setCameraPos(cameraPos);

  console.log(`[iso] Map ready (${mapW}×${mapH}), ${textureInfos.length} textures`);
  console.log(`[iso] Camera centered at: (${cameraPos.x.toFixed(2)}, ${cameraPos.y.toFixed(2)})`);
}

// ──────────────────────────────────────────────────────────────
function gameUpdate() {
  const move = vec2(0, 0);
  if (keyIsDown('ArrowLeft'))  move.x -= CAMERA_SPEED;
  if (keyIsDown('ArrowRight')) move.x += CAMERA_SPEED;
  if (keyIsDown('ArrowUp'))    move.y -= CAMERA_SPEED;
  if (keyIsDown('ArrowDown'))  move.y += CAMERA_SPEED;
  if (move.x || move.y) {
    cameraPos = vec2(cameraPos.x + move.x, cameraPos.y + move.y);
    setCameraPos(cameraPos);
  }
}
function gameUpdatePost() {}

// ──────────────────────────────────────────────────────────────
function gameRender() {
  drawRect(vec2(0, 0), vec2(9999, 9999), hsl(0, 0, 0.15));
  if (!mapData) return;

  const { width, height } = mapData;
  let drawn = 0;

  // Tile layers
  for (const layer of layers) {
    const data = layer.data;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const gid = data[r * width + c];
        if (!gid) continue;
        const tinfo = tileInfos[gid];
        const p = isoToWorld(c, r, width, height);
        if (tinfo) {
          const img = rawImages[gid];
          const drawSize = vec2(img.width / PPU, img.height / PPU);
          const offsetY = (img.height - mapData.tileheight) / PPU;
          const drawPos = vec2(p.x, p.y - offsetY);
          drawTile(drawPos, drawSize, tinfo);
        }
        drawn++;
      }
    }
  }

  // Object layers with South offset calibration
  let southOffset = vec2(0, 0);
  const southLayer = objectLayers.find(l => l.name === 'South');

  if (southLayer && southLayer.objects.length) {
    const refObj = southLayer.objects[0];
    // Compute anchor from bottommost (south) tile instead of top
const p = tmxPxToWorld(refObj.x, refObj.y, width, height);
const tileAnchor = isoToWorld(width - 1, height - 1, width, height);
southOffset = vec2(tileAnchor.x - p.x, tileAnchor.y - p.y - 4); // -4 to align visually
    debugText(
      `offset: ${southOffset.x.toFixed(2)}, ${southOffset.y.toFixed(2)}`,
      vec2(-3, -4),
      0.6,
      '#0f0'
    );
  }

  for (const layer of objectLayers) {
    for (const obj of layer.objects) {
      if (!obj.polygon) continue;
      const pts = obj.polygon.map(pt => {
        const w = tmxPxToWorld(obj.x + pt.x, obj.y + pt.y, width, height);
        return vec2(w.x + southOffset.x, w.y + southOffset.y);
      });
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        drawLine(a, b, 0.02, rgb(1, 0, 0));
      }
    }
  }

  debugText(`Tiles drawn: ${drawn}`, vec2(-3, -3), 0.7, '#fff');
}

// ──────────────────────────────────────────────────────────────
function gameRenderPost() {
  const cx = mainCanvas.width / 2;
  drawRect(vec2(cx - 120 / PPU, 40 / PPU), vec2(240 / PPU, 40 / PPU), rgb(0, 0, 0, 0.5));
}
