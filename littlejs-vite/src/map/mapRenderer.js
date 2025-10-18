// src/map/mapRenderer.js  
'use strict';  
  
import {  
  drawTile, drawRect, vec2, hsl, Color, clamp  
} from 'littlejsengine';  
import { isoToWorld, tmxPxToWorld } from './isoMath.js';  
import { renderMapDebug, drawDepthDebug } from './mapDebug.js';  
  
/*───────────────────────────────────────────────────────────────  
  DEBUG CONTROL  
───────────────────────────────────────────────────────────────*/  
let DEBUG_MAP_ENABLED = true;  
export function setDebugMapEnabled(v) { DEBUG_MAP_ENABLED = !!v; }  
export function isDebugMapEnabled() { return DEBUG_MAP_ENABLED; }  
  
/*───────────────────────────────────────────────────────────────  
  DEPTH POLYGON UTILITIES  
    
  These functions handle the "depth polygon" system for isometric  
  wall tiles. Depth polygons are defined in Tiled and determine  
  when a player is "behind" a wall tile, triggering transparency.  
───────────────────────────────────────────────────────────────*/  
  
/**  
 * Calculate the maximum Y intersection of a vertical line at point p.x  
 * with a polygon. This determines the "depth plane" of a wall tile.  
 *   
 * @param {Vector2} p - Point to test (typically player feet position)  
 * @param {Array<Vector2>} poly - Polygon vertices in world space  
 * @returns {Number|null} - Maximum Y coordinate where line intersects polygon  
 */  
export function getPolygonDepthYAtX(p, poly) {
  const intersections = [];

  // Cast a vertical line at player.x through the polygon
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (Math.abs(a.x - b.x) < 1e-6) continue;

    const t = (p.x - a.x) / (b.x - a.x);
    if (t >= 0 && t <= 1) {
      intersections.push(a.y + (b.y - a.y) * t);
    }
  }

  if (!intersections.length) return null;

  // FIX: choose the intersection *nearest to the player* (just behind their Y)
  // instead of always the maximum or minimum.
  const playerY = p.y;
  // Sort intersections by distance from playerY (ascending)
  intersections.sort((a, b) => Math.abs(playerY - a) - Math.abs(playerY - b));

  // Return the intersection just *in front* of the player if any,
  // otherwise fall back to the nearest overall.
  for (const y of intersections) {
    if (y <= playerY) return y; // plane just behind or at player
  }
  return intersections[0];
}
  
/**  
 * Parse depth polygons from Tiled object layers.  
 * These polygons are attached to specific tiles via custom properties.  
 *   
 * @param {Object} map - Map data from mapLoader  
 * @param {Number} PPU - Pixels per unit (world space conversion)  
 * @returns {Array<Object>} - Array of {c, r, worldPoly} objects  
 */  
function parseWallPolygons(map, PPU) {  
  const polygons = [];  
  const { objectLayers, mapData, TILE_W, TILE_H } = map;  
  const { width, height } = mapData;  
  if (!objectLayers) return polygons;  
  
  // Look for the "DepthPolygons" layer in Tiled  
  for (const layer of objectLayers) {  
    if (layer.name !== 'DepthPolygons') continue;  
      
    for (const obj of layer.objects || []) {  
      if (!obj.polygon || !obj.properties) continue;  
        
      // Each polygon must have tile_c and tile_r properties  
      // to associate it with a specific tile in the grid  
      const c = obj.properties.find(p => p.name === 'tile_c')?.value;  
      const r = obj.properties.find(p => p.name === 'tile_r')?.value;  
      if (c == null || r == null) continue;  
  
      // Convert Tiled pixel coordinates to world space  
      const worldPoly = obj.polygon.map(pt => {  
        const w = tmxPxToWorld(  
          obj.x + pt.x,  
          obj.y + pt.y,  
          width,  
          height - 8,  
          TILE_W,  
          TILE_H,  
          PPU  
        );  
        return vec2(w.x, w.y - TILE_H);  
      });  
        
      polygons.push({ c, r, worldPoly });  
    }  
  }  
  return polygons;  
}  
  
/**  
 * Pixel-perfect overlap check between player feet and tile sprite.  
 * This prevents tiles from fading when the player is just near them  
 * but not actually overlapping the visible pixels.  
 *   
 * @param {Vector2} playerFeet - Player's feet position in world space  
 * @param {Vector2} tileWorldPos - Tile's draw position in world space  
 * @param {HTMLImageElement} img - Tile's source image  
 * @param {Number} imgW_world - Image width in world units  
 * @param {Number} imgH_world - Image height in world units  
 * @param {Number} PPU - Pixels per unit  
 * @param {Number} TILE_H - Base tile height in world units  
 * @returns {Boolean} - True if player overlaps non-transparent pixels  
 */  
function pixelOverlapCheck(playerFeet, tileWorldPos, img, imgW_world, imgH_world, PPU, TILE_H) {  
  // Create temporary canvas to read pixel data  
  const canvas = document.createElement('canvas');  
  const ctx = canvas.getContext('2d');  
  canvas.width = img.width;  
  canvas.height = img.height;  
  ctx.drawImage(img, 0, 0);  
  const maskData = ctx.getImageData(0, 0, img.width, img.height).data;  
  
  // Convert player world position to local image coordinates  
  const anchorOffsetY = (imgH_world - TILE_H) / 2;  
  const relativeX = playerFeet.x - tileWorldPos.x;  
  const relativeY = playerFeet.y - tileWorldPos.y;  
  
  const localX = (relativeX / imgW_world + 0.5) * img.width;  
  const localY = (1 - (relativeY / imgH_world + 0.5)) * img.height;  
  
  // Check a small radius around the player position  
  const radius = 6;  
  for (let y = -radius; y <= radius; y++) {  
    for (let x = -radius; x <= radius; x++) {  
      const px = Math.floor(localX + x);  
      const py = Math.floor(localY + y);  
        
      // Skip out-of-bounds pixels  
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;  
        
      // Check alpha channel (index 3 in RGBA array)  
      const idx = (py * img.width + px) * 4 + 3;  
      if (maskData[idx] > 32) return true; // Non-transparent pixel found  
    }  
  }  
  return false;  
}  
  
/*───────────────────────────────────────────────────────────────  
  FADE STATE MANAGEMENT  
    
  Persistent map to track smooth alpha transitions for each tile.  
  Key format: "layerName:row,col"  
───────────────────────────────────────────────────────────────*/  
const fadeAlphaMap = new Map();  
  
/*───────────────────────────────────────────────────────────────  
  MAIN RENDER FUNCTION  
    
  This implements a THREE-PASS rendering system:  
  1. Opaque tiles (always behind entities)  
  2. Transparent tiles + entities (depth-sorted together)  
  3. Debug overlays  
    
  This ensures players render UNDER transparent wall tiles while  
  maintaining correct depth ordering with other entities.  
───────────────────────────────────────────────────────────────*/  
  
/**  
 * Render the isometric map with depth-sorted transparency.  
 *   
 * @param {Object} map - Map data from loadTiledMap()  
 * @param {Number} PPU - Pixels per unit (128 in our game)  
 * @param {Vector2} cameraPos - Camera position (unused, kept for API compatibility)  
 * @param {Vector2} playerPos - Player position in world space  
 * @param {Vector2} playerFeetOffset - Offset from player pos to feet (default vec2(0, 0.45))  
 * @param {Array<Object>} entities - Array of {y, draw} objects for depth sorting  
 */  
export function renderMap(  
  map,  
  PPU,  
  cameraPos,  
  playerPos,  
  playerFeetOffset = vec2(0, 0.45),  
  entities = []  
) {  
  if (!map.mapData) return;  
  const { mapData, rawImages, tileInfos, layers, TILE_W, TILE_H } = map;  
  const { width, height } = mapData;  
  
  // Draw background (LittleJS uses world space, so this covers the entire visible area)  
  drawRect(vec2(0, 0), vec2(9999, 9999), hsl(0, 0, 0.15));  
  
  // Calculate player's feet position for depth checks  
  const playerFeet = playerPos.add(playerFeetOffset);  
    
  // Parse all depth polygons from the map  
  const wallPolygons = parseWallPolygons(map, PPU);  
  
  /*─────────────────────────────────────────────────────────────  
    TILE PROCESSING: Separate opaque vs transparent tiles  
      
    We need to separate tiles into two lists because:  
    - Opaque tiles should ALWAYS render behind entities  
    - Transparent tiles should depth-sort WITH entities  
      
    This prevents the player from appearing under solid walls.  
  ─────────────────────────────────────────────────────────────*/  
  const opaqueTiles = [];  
  const transparentTiles = [];  
  
  // Process each tile layer from Tiled  
  for (const layer of layers) {  
    if (!layer.visible || layer.type !== 'tilelayer') continue;  
    const { data, name: layerName } = layer;  
  
    // Iterate through the tile grid  
    for (let r = 0; r < height; r++) {  
      for (let c = 0; c < width; c++) {  
        const gid = data[r * width + c];  
        if (!gid) continue; // Empty tile  
  
        // Convert grid coordinates to world space (LittleJS uses world units, not pixels)  
        const worldPos = isoToWorld(c, r, width, height, TILE_W, TILE_H);  
          
        // Get tile rendering info (LittleJS TileInfo for drawTile)  
        const info = tileInfos[gid];  
        const img = rawImages[gid];  
        if (!info || !img) continue;  
  
        // Calculate tile dimensions in world space  
        const imgW_world = img.width / PPU;  
        const imgH_world = img.height / PPU;  
          
        // anchorOffsetY: Tall tiles (like walls) need to be shifted up  
        // so their base aligns with the isometric grid  
        const anchorOffsetY = (imgH_world - TILE_H) / 2;  
          
        // Check if this tile has an associated depth polygon  
        const wallPoly = wallPolygons.find(p => p.c === c && p.r === r);  
  
        /*───────────────────────────────────────────────────────  
          FADE CALCULATION: Determine if tile should be transparent  
        ───────────────────────────────────────────────────────*/  
        const tileKey = `${layerName}:${r},${c}`;  
        let currentAlpha = fadeAlphaMap.get(tileKey) ?? 1.0; // Smooth interpolated value  
        let targetAlpha = 1.0; // Desired final alpha  
  
        // Only fade tiles with depth polygons  
        if (wallPoly) {  
          // Get the depth plane Y coordinate at the player's X position  
          const polyY = getPolygonDepthYAtX(playerFeet, wallPoly.worldPoly);  
            
          if (polyY !== null) {  
            // Calculate distance from player to depth plane  
            const dist = playerFeet.y - polyY;  
              
            // Get tile's visual position for pixel overlap check  
            const tileWorldPos = worldPos.subtract(vec2(0, anchorOffsetY));  
              
            // Only fade if player actually overlaps the tile's pixels  
            const pixelOverlap = pixelOverlapCheck(  
              playerFeet, tileWorldPos,  
              img, imgW_world, imgH_world, PPU, TILE_H  
            );  
              
            if (pixelOverlap) {
  // Player's vertical distance from the depth plane
  const dist = playerFeet.y - polyY;

  // Only start fading once the player is BEHIND the depth plane
  if (dist > 0) {
    // Linear fade from 1 → 0.35 over 0.4 world units behind the plane
    const fadeRange = 0.4;
    const fadeMin = 0.35;
    targetAlpha = clamp(1.0 - dist / fadeRange, fadeMin, 1.0);
  } else {
    // Fully opaque when in front or exactly at the depth plane
    targetAlpha = 1.0;
  }
}
          }  
        }  
  
        // Smooth interpolation towards target alpha (prevents jarring transitions)  
        const fadeSpeed = 0.15;  
        currentAlpha += (targetAlpha - currentAlpha) * fadeSpeed;  
        fadeAlphaMap.set(tileKey, currentAlpha);  
  
        /*───────────────────────────────────────────────────────  
          CREATE DRAWABLE OBJECT  
            
          Each tile becomes a drawable with:  
          - y: Visual Y position for depth sorting  
          - alpha: Current transparency value  
          - draw: Function that renders the tile using LittleJS  
        ───────────────────────────────────────────────────────*/  
        const tileDrawable = {  
          // CRITICAL: Use visual Y position (where tile is drawn)  
          // NOT the logical base position (worldPos.y)  
          y: worldPos.y - anchorOffsetY,  
          alpha: currentAlpha,  
          wallPoly,  
          draw: () => {  
            // LittleJS drawTile: renders a textured sprite  
            drawTile(  
              worldPos.subtract(vec2(0, anchorOffsetY)), // Draw position  
              vec2(imgW_world, imgH_world),              // Size in world units  
              info,                                       // TileInfo (texture coords)  
              new Color(1, 1, 1, currentAlpha),          // Tint color with alpha  
              0,                                          // Rotation  
              false                                       // Mirror flag  
            );  
  
            // Optional debug visualization  
            if (DEBUG_MAP_ENABLED && wallPoly)  
              drawDepthDebug(wallPoly, playerFeet, getPolygonDepthYAtX);  
          },  
        };  
  
        /*───────────────────────────────────────────────────────  
          CATEGORIZE TILE: Opaque vs Transparent  
            
          KEY FIX: Check targetAlpha (intended state) not currentAlpha  
          (interpolated state). This prevents tiles from being  
          incorrectly categorized during fade transitions.  
        ───────────────────────────────────────────────────────*/  
        if (targetAlpha < 1.0) {  
          // Tile SHOULD BE transparent → depth-sort with entities  
          transparentTiles.push(tileDrawable);  
        } else {  
          // Tile SHOULD BE opaque → always render behind entities  
          opaqueTiles.push(tileDrawable);  
        }  
      }  
    }  
  }  
  
  // ──────────────────────────────────────────────  
  // THREE-PASS RENDERING  
  // ──────────────────────────────────────────────  
    
  // Pass 1: Draw all opaque tiles (always behind entities)  
  for (const tile of opaqueTiles) {  
    tile.draw();  
  }  
  
  // Pass 2: Depth-sort and draw transparent tiles + entities  
  const depthSorted = [...transparentTiles, ...entities];  
  depthSorted.sort((a, b) => a.y - b.y);  
  for (const drawable of depthSorted) {  
    drawable.draw();  
  }  
  
  // Pass 3: Debug overlays  
  if (DEBUG_MAP_ENABLED)  
    renderMapDebug(map, playerPos, playerFeetOffset, PPU, true);  
}