// src/map/mapRenderer.js    
'use strict';    
    
import {    
  drawTile,    
  drawLine,    
  drawText,    
  drawRect,    
  vec2,    
  hsl,    
  rgb,    
} from 'littlejsengine';    
import { isoToWorld } from './isoMath.js';    
    
/**    
 * Render isometric Tiled map with proper sprite anchoring.    
 *     
 * Tiled uses a 256×128 grid for isometric tiles. Tile images are 256×512,    
 * but the footprint (diamond base) aligns with the 128px grid height.    
 */    
export function renderMap(map, PPU, cameraPos) {    
  if (!map.mapData) return;    
    
  const {    
    mapData,    
    rawImages,    
    tileInfos,    
    layers,    
    objectLayers,    
    colliders,    
    TILE_W,    
    TILE_H,    
  } = map;    
  const { width, height } = mapData;    
    
  drawRect(vec2(0, 0), vec2(9999, 9999), hsl(0, 0, 0.15));    
    
  // Render all tile layers    
  for (const layer of layers) {    
    if (!layer.visible || layer.type !== 'tilelayer') continue;    
    const { data } = layer;    
    
    for (let r = 0; r < height; r++) {    
      for (let c = 0; c < width; c++) {    
        const gid = data[r * width + c];    
        if (!gid) continue;    
    
        const worldPos = isoToWorld(c, r, width, height, TILE_W, TILE_H);    
        const info = tileInfos[gid];    
        if (!info) continue;    
    
        const img = rawImages[gid];    
        if (!img) continue;    
    
        // Convert image dimensions to world units    
        const imgW_world = img.width / PPU;   // 256px → 2.0 units    
        const imgH_world = img.height / PPU;  // 512px → 4.0 units    
    
        // Grid height is the actual footprint (128px from Tiled)    
        const gridHeight = TILE_H;  // 128px / PPU = 1.0 units    
    
        // Offset sprite so its bottom aligns with the grid position    
        const anchorOffsetY = (imgH_world - gridHeight) / 2;    
    
        drawTile(    
          worldPos.subtract(vec2(0, anchorOffsetY)),    
          vec2(imgW_world, imgH_world),    
          info    
        );    
      }    
    }    
  }    
    
  // Debug: render object markers    
  if (objectLayers) {    
    for (const layer of objectLayers) {    
      if (!layer.objects) continue;    
      for (const obj of layer.objects) {    
        const p = vec2(obj.x / PPU, obj.y / PPU);    
        drawRect(p, vec2(0.1, 0.1), rgb(1, 0, 0));    
      }    
    }    
  }    
    
  // Debug: render tile grid diamonds    
  const showDebugTiles = true;    
  if (showDebugTiles) {    
    const lineColor = rgb(0, 1, 0);    
    const textColor = rgb(1, 1, 0);    
        
    // Use actual grid dimensions (128px height, not 248px)    
    const halfW = TILE_W / 2;    
    const halfH = TILE_H / 2;  
      
    // Calculate anchor offset to match tile rendering  
    const imgH_world = 4.0; // 512px / 128 PPU  
    const anchorOffsetY = (imgH_world - TILE_H) / 2 * 2;  
    
    for (let r = 0; r < height; r++) {    
      for (let c = 0; c < width; c++) {    
        // Apply the same anchor offset as tile rendering  
        const p = isoToWorld(c, r, width, height, TILE_W, TILE_H).subtract(vec2(0, anchorOffsetY));  
    
        // Draw diamond outline using grid dimensions    
        const top = vec2(p.x, p.y + halfH);    
        const right = vec2(p.x + halfW, p.y);    
        const bottom = vec2(p.x, p.y - halfH);    
        const left = vec2(p.x - halfW, p.y);    
    
        drawLine(top, right, 0.02, lineColor);    
        drawLine(right, bottom, 0.02, lineColor);    
        drawLine(bottom, left, 0.02, lineColor);    
        drawLine(left, top, 0.02, lineColor);    
    
        // Draw coordinate label    
        drawText(    
          `${c},${r}`,    
          p.add(vec2(0, -TILE_H * 0.4)),    
          TILE_H * 0.3,    
          textColor,    
          0,    
          undefined,    
          'center'    
        );    
      }    
    }    
  }    
    
  if (colliders && colliders.debugDraw) {    
    colliders.debugDraw();    
  }    
}