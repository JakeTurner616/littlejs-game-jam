// src/map/objectSystem.js
'use strict';
import { drawTile, vec2, Color, TileInfo, TextureInfo, textureInfos } from 'littlejsengine';
import { tmxPxToWorld } from './isoMath.js';
import { getPolygonDepthYAtX } from './mapRenderer.js';

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
        alpha: 1.0
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

    // expose to map for debug
    this.map._objectSystemRef = this;
    console.log(`[ObjectSystem] Loaded ${this.objects.length} objects`);
  }

  /** Update fade alpha based on player position and attached depth polygons */
  update(playerFeet) {
    const H_RADIUS = 0.6;    // horizontal fade distance threshold (~1 tile)
    const FADE_RANGE = 0.4;  // vertical fade range
    const FADE_MIN = 0.35;   // minimum alpha when behind

    for (const o of this.objects) {
      const poly = this.depthPolygons.find(p => p.owner === o.name);
      let targetAlpha = 1.0;

      if (poly) {
        const pts = poly.polyPts;
        const minX = Math.min(...pts.map(p => p.x));
        const maxX = Math.max(...pts.map(p => p.x));
        const polyY = getPolygonDepthYAtX(playerFeet, pts);

        // Only fade if horizontally near the polygon
        const withinX = playerFeet.x > minX - H_RADIUS && playerFeet.x < maxX + H_RADIUS;

        if (polyY !== null && withinX) {
          const dist = playerFeet.y - polyY;
          if (dist > 0 && dist < FADE_RANGE) {
            targetAlpha = Math.max(1.0 - dist / FADE_RANGE, FADE_MIN);
          }
        }
      }

      // Smooth interpolation
      o.alpha += (targetAlpha - o.alpha) * 0.15;
    }
  }

  draw() {
    for (const o of this.objects)
      drawTile(o.pos, o.size, o.tile, new Color(1, 1, 1, o.alpha));
  }

  /** Debug system uses this to get fade function pointer */
  getDepthFunc() { return getPolygonDepthYAtX; }
}

/*───────────────────────────────────────────────
  Helpers
───────────────────────────────────────────────*/
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed: ' + src));
    img.src = src;
  });
}