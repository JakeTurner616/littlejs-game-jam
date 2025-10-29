// src/map/renderDebug.js    
'use strict';    
import { drawRect, drawEllipse, Color, vec2 } from 'littlejsengine';    
import { renderMapDebug } from './mapDebug.js';    
    
export function drawDebugPlayerBox(pos, size) {    
  drawRect(pos, size, new Color(0, 1, 0, 1), 0.04, true);    
}    
    
export function drawDebugGrid(map, playerPos, playerFeetOffset, PPU) {    
  renderMapDebug(map, playerPos, playerFeetOffset, PPU, true);    
}    
    
export function drawDebugRevealRadius(playerPos, playerFeetOffset, revealRadius, TILE_W, TILE_H) {  
  const center = playerPos.add(playerFeetOffset);  
  const worldRevealRadius = revealRadius * TILE_W;  
  const aspectRatio = TILE_W / TILE_H;  
    
  const radiusX = worldRevealRadius;  
  const radiusY = worldRevealRadius / aspectRatio;  
    
  // ✅ Match the working pattern from playerController.js  
  drawEllipse(  
    center,                           // pos (vec2)  
    vec2(radiusX, radiusY),          // size (vec2) - exactly like the shadow  
    new Color(0, 1, 0, 0.2),         // color  
    0                                 // angle  
  );  
}