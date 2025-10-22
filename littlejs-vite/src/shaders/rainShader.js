// src/shaders/rainShader.js  
'use strict';  
import { initPostProcess } from 'littlejsengine';  
  
let rainShaderInitialized = false;  
  
/**  
 * Initializes the rain shader effect.  
 * Call this once during setup (e.g., onEnter).  
 */  
export function initRainShader() {  
  if (rainShaderInitialized) return;  
    
  const rainShaderCode = `  
    // Shadertoy-style rain overlay  
    void mainImage(out vec4 fragColor, vec2 fragCoord) {  
      vec2 uv = fragCoord / iResolution.xy;  
      vec4 color = texture(iChannel0, uv);  
  
      // Basic rain layers  
      float rain = 0.0;  
      for (int i = 0; i < 3; i++) {  
        float layer = float(i);  
        vec2 rainUV = uv * vec2(1.0, 0.5) + vec2(layer * 0.3, iTime * (0.5 + layer * 0.2));  
        rainUV.x += sin(rainUV.y * 10.0 + iTime * 1.2) * 0.02;  
  
        float streak = fract(rainUV.y * 20.0);  
        streak = smoothstep(0.9, 1.0, streak);  
        rain += streak * 0.12;  
      }  
  
      // Subtle blue tint overlay  
      fragColor = color + vec4(rain * 0.4, rain * 0.5, rain * 0.6, 0.0);  
    }  
  `;  
  
  initPostProcess(rainShaderCode, false);  
  rainShaderInitialized = true;  
}