// src/debug/DebugStateManager.js
'use strict';

/**
 * DebugStateManager — developer warp system
 * -----------------------------------------
 * • Jumps instantly between gameplay states.
 * • Now includes environment sync to match doorTeleport1.
 */
export const DebugStateManager = {
  states: {
    start: {
      description: 'Outdoor starting area',
      map: '/assets/map/inside.tmj',
      c: 3.99,
      r: 11.49,
      type: 'outdoor'
    },
    indoor_entry: {
      description: 'Indoor after door teleport 2',
      map: '/assets/map/indoor-room.tmj',
      c: 6.25,
      r: 8.75,
      type: 'indoor'
    },
  },

  async jump(name, scene) {
    const s = this.states[name];
    if (!s) return console.warn(`[DebugState] Unknown state '${name}'`);
    console.groupCollapsed(`[DebugState] Jumping to '${name}'`);
    console.log(s.description || '');

    try {
      // 🗺️ Load the requested map
      await scene.loadNewMap(s.map, s.c, s.r);
      console.log(`[DebugState] ✅ Map loaded → ${s.map}`);

      // 🧭 Environment sync (imitates doorTeleport1)
      if (s.type === 'indoor') {
        console.log('[DebugState] Applying indoor environment settings...');

        // Fade out world fog
        if (scene.fog) {
          scene.fog.fadeOut?.();
          console.log(' ├─ Fog fade-out triggered');
        }

        // Reveal all fog-of-war polygons
        if (scene.fogOfWar) {
          scene.fogOfWar.revealAll?.();
          scene.fogOfWar.enabled = true;
          for (const a of scene.fogOfWar.areas || []) a.hidden = false;
          console.log(' ├─ Fog-of-war fully revealed');
        }

        // Set rain and lightning to background
        if (scene.lighting) {
          scene.lighting.setRainMode?.('background');
          scene.lighting.setLightningMode?.('background');
          scene.lighting.lightningEnabled = false;
          console.log(' └─ Rain & lightning set to background mode');
        }
      }

      // Show small confirmation monologue
      scene.dialog.setMode('monologue');
      scene.dialog.setText(`🧭 Developer warp: ${name}`);
      scene.dialog.visible = true;
    } catch (err) {
      console.error(`[DebugState] Failed to jump to '${name}':`, err);
    }

    console.groupEnd();
  },

  list() {
    console.table(
      Object.entries(this.states).map(([k, v]) => ({
        name: k,
        map: v.map,
        c: v.c,
        r: v.r,
        type: v.type || '—',
        description: v.description,
      }))
    );
  },
};
