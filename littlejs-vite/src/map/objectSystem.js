// src/map/objectSystem.js — 🧱 unified paint distance math (world-space grid fix)
'use strict';
import {
  drawTile, drawRect, vec2, Color,
  TileInfo, TextureInfo, textureInfos, clamp
} from 'littlejsengine';
import { isoToWorld } from './isoMath.js';
import { getPolygonDepthYAtX } from './wallUtils.js';
import { isDebugMapEnabled } from './mapRenderer.js';
import { getTileBrightness } from './paintSystem.js';
import { mapRef as _paintMapRef, playerRef as _paintPlayerRef } from './paintSystem.js';

export class ObjectSystem {
  constructor(map, PPU) {
    this.map = map;
    this.PPU = PPU;
    this.objects = [];
    this.depthPolygons = [];
  }

  async load() {
    const { objectLayers, mapData, TILE_W, TILE_H } = this.map;
    const { width, height } = mapData;

    const spriteLayer = objectLayers.find(l => l.name === 'ObjectSprites');
    if (!spriteLayer) return;

    for (const obj of spriteLayer.objects || []) {
      const spriteProp = obj.properties?.find(p => p.name === 'spriteName');
      if (!spriteProp?.value) continue;

      const spriteName = spriteProp.value;
      const imgPath = `/assets/objects/${spriteName}.png`;
      const img = await loadImage(imgPath);

      const texInfo = new TextureInfo(img);
      textureInfos.push(texInfo);
      const texIndex = textureInfos.length - 1;
      const tile = new TileInfo(vec2(0, 0), vec2(img.width, img.height), texIndex);

      // ✅ Convert world-space object coords → grid
      // (obj.x / obj.y already world units after map loader)
      const c = Math.floor(obj.x / TILE_W);
      const r = Math.floor(obj.y / TILE_H);

      // ✅ Same anchor logic as mapRenderer & paintSystem
      const worldPos = isoToWorld(c, r, width, height, TILE_W, TILE_H);

      this.objects.push({
        name: spriteName,
        img,
        tile,
        pos: worldPos,
        size: vec2(img.width / this.PPU, img.height / this.PPU),
        alpha: 1.0,
        targetAlpha: 1.0,
        gridR: r,
        gridC: c,
        layerKey: 'ObjectSprites',
        mask: await this.createCollisionMask(img)
      });
    }

    // Optional depth polygons
    const polyLayer = objectLayers.find(l => l.name === 'DepthPolygons');
    if (polyLayer) {
      for (const obj of polyLayer.objects || []) {
        if (!obj.polygon) continue;
        const pts = obj.polygon.map(pt => {
          const c = Math.floor((obj.x + pt.x) / TILE_W);
          const r = Math.floor((obj.y + pt.y) / TILE_H);
          return isoToWorld(c, r, width, height, TILE_W, TILE_H);
        });
        const owner = obj.properties?.find(p => p.name === 'spriteName')?.value;
        this.depthPolygons.push({ owner, polyPts: pts });
      }
    }

    this.map._objectSystemRef = this;
    console.log(`[ObjectSystem] Loaded ${this.objects.length} objects`);
  }

  async createCollisionMask(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    const mask = new Uint8Array(img.width * img.height);
    for (let i = 0; i < data.length; i += 4)
      mask[i / 4] = data[i + 3] > 128 ? 1 : 0;
    return { width: img.width, height: img.height, data: mask };
  }

  update() {
    for (const o of this.objects)
      o.alpha += (o.targetAlpha - o.alpha) * 0.15;
  }

  draw() {
    if (!_paintMapRef || !_paintPlayerRef) return;

    for (const o of this.objects) {
      const brightness = clamp(getTileBrightness(o.layerKey, o.gridR, o.gridC), 0, 1);
      const color = new Color(brightness, brightness, brightness, o.alpha);

      drawTile(o.pos, o.size, o.tile, color);

      if (isDebugMapEnabled() && !o.name.toLowerCase().includes('floor'))
        drawRect(o.pos, o.size, new Color(1, 0, 0, 0.3), 0, false);
    }
  }

  getDepthFunc() { return getPolygonDepthYAtX; }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed: ' + src));
    img.src = src;
  });
}
