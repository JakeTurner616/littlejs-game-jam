// src/map/objectSystem.js — 🧱 object sprite depth fade + debug rects
'use strict';
import {
  drawTile, drawRect, vec2, Color,
  TileInfo, TextureInfo, textureInfos, clamp
} from 'littlejsengine';
import { tmxPxToWorld } from './isoMath.js';

// ✅ updated imports for modularized structure
import { getPolygonDepthYAtX } from './wallUtils.js';
import { isDebugMapEnabled } from './mapRenderer.js';

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
    const PPU = this.PPU;

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

      const w = tmxPxToWorld(obj.x, obj.y, width, height, TILE_W, TILE_H, PPU, true);
      const worldPos = vec2(w.x, w.y - TILE_H / 2);

      this.objects.push({
        name: spriteName,
        img,
        tile,
        pos: worldPos,
        size: vec2(img.width / PPU, img.height / PPU),
        alpha: 1.0,
        targetAlpha: 1.0,
        mask: await this.createCollisionMask(img)
      });
    }

    // optional depth polygons
    const polyLayer = objectLayers.find(l => l.name === 'DepthPolygons');
    if (polyLayer) {
      for (const obj of polyLayer.objects || []) {
        if (!obj.polygon) continue;
        const pts = obj.polygon.map(pt => {
          const w = tmxPxToWorld(
            obj.x + pt.x, obj.y + pt.y,
            width, height, TILE_W, TILE_H, PPU, true
          );
          return vec2(w.x, w.y - TILE_H / 2);
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
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const mask = new Uint8Array(img.width * img.height);
    for (let i = 0; i < imageData.data.length; i += 4)
      mask[i / 4] = imageData.data[i + 3] > 128 ? 1 : 0;
    return { width: img.width, height: img.height, data: mask };
  }

  /*───────────────────────────────────────────────
    UPDATE — Apply depth fade to all objects
  ────────────────────────────────────────────────*/
  update(playerFeet) {
    if (!playerFeet) return;

    const MIN = -1.5, RANGE = 2, MINA = 0.45;

    for (const o of this.objects) {
      // Default full visibility
      let target = 1.0;

      const poly = this.depthPolygons.find(p => p.owner === o.name);
      if (poly) {
        const py = getPolygonDepthYAtX(playerFeet, poly.polyPts);
        if (py != null) {
          const dist = playerFeet.y - py;
          if (dist > MIN && dist < RANGE) {
            // Simple AABB overlap check for performance
            const pMinX = playerFeet.x - 0.25, pMaxX = playerFeet.x + 0.25;
            const pMinY = playerFeet.y - 0.25, pMaxY = playerFeet.y + 0.25;
            const oMinX = o.pos.x - o.size.x / 2, oMaxX = o.pos.x + o.size.x / 2;
            const oMinY = o.pos.y - o.size.y / 2, oMaxY = o.pos.y + o.size.y / 2;
            const overlaps = !(pMaxX < oMinX || pMinX > oMaxX || pMaxY < oMinY || pMinY > oMaxY);
            if (overlaps) {
              const ratio = (dist - MIN) / (RANGE - MIN);
              target = clamp(1 - ratio, MINA, 1);
            }
          }
        }
      }

      o.targetAlpha = target;
      o.alpha += (o.targetAlpha - o.alpha) * 0.15;
    }
  }

  draw() {
    for (const o of this.objects) {
      drawTile(o.pos, o.size, o.tile, new Color(1, 1, 1, o.alpha));
      if (isDebugMapEnabled() && !o.name.toLowerCase().includes('floor'))
        drawRect(o.pos, o.size, new Color(1, 0, 0, 0.3), 0, false);
    }
  }

  getDepthFunc() { return getPolygonDepthYAtX; }
}

/*───────────────────────────────────────────────
  HELPER
───────────────────────────────────────────────*/
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed: ' + src));
    img.src = src;
  });
}
