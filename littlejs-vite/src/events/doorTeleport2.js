// src/events/doorTeleport2.js — ✅ Enhanced: environment background sync + fog/fogOfWar visibility fix
'use strict';
import { keyWasPressed } from 'littlejsengine';
import { audioManager } from '../audio/AudioManager.js';

/*
  NOTE 🧭
  The fog, fog-of-war, and lighting adjustments here are primarily for
  **debug jump safety** — ensuring that skipping door_teleport_1 still
  produces a visually consistent indoor environment.
  During normal gameplay, door_teleport_1 already handles this transition.
*/

export const event = {
  id: 'door_teleport_2',
  description: 'Alternate door teleport (clean map switch + sound + dialogue)',
  async execute(scene, player) {
    if (scene.dialog.isActive()) return;
    player.frozen = true;

    // ──────────────────────────────────────────────
    // 🩹 Environment Sync (for debug direct jumps)
    // ──────────────────────────────────────────────
    try {
      // 🌀 Fog fade-out if still active
      if (scene.fog && scene.fog.enabled && !scene.fog.fadingOut) {
        scene.fog.fadeOut();
        console.log('[doorTeleport2] 🧭 Debug: Forced fog fade-out');
      }

      // 🌫️ Fog-of-war visibility correction
      if (scene.fogOfWar) {
        // ensure polygons are visible again
        for (const a of scene.fogOfWar.areas || []) a.hidden = false;
        scene.fogOfWar.enabled = true;
        console.log('[doorTeleport2] 🧭 Debug: Restored fog-of-war polygons visibility');
      }

      // 🌧️ Ensure lighting is in background mode
      if (scene.lighting) {
        const l = scene.lighting;
        if (l.rainRenderMode !== 'background') {
          l.setRainMode('background');
          console.log('[doorTeleport2] 🧭 Debug: Set rain to background mode');
        }
        if (l.lightningRenderMode !== 'background') {
          l.setLightningMode('background');
          console.log('[doorTeleport2] 🧭 Debug: Set lightning to background mode');
        }
        if (l.lightningEnabled) {
          l.lightningEnabled = false;
          console.log('[doorTeleport2] 🧭 Debug: Disabled lightning flashes');
        }
      }
    } catch (err) {
      console.warn('[doorTeleport2] Debug environment sync skipped:', err);
    }

    // ──────────────────────────────────────────────
    // Normal event flow
    // ──────────────────────────────────────────────
    await new Promise(resolve => {
      const check = () => {
        if (!scene.dialog.visible) return resolve();
        if (scene.dialog.typeProgress >= scene.dialog.text.length)
          setTimeout(() => {
            const waitDismiss = () => {
              if (!scene.dialog.visible) resolve();
              else requestAnimationFrame(waitDismiss);
            };
            waitDismiss();
          }, 300);
        else requestAnimationFrame(check);
      };
      check();
    });

    // 🗣️ Dialogue intro
    if (scene.dialog.visible) scene.dialog.visible = false;
    scene.dialog.setMode('dialogue');
    await scene.dialog.loadPortrait('/assets/portraits/doorway.png');
    scene.dialog.visible = true;

    const intro =
      'A heavy iron door looms before you.\n' +
      'It hums faintly, as if alive.\n\n' +
      'The handle is ice cold to the touch.';

    const options = [
      { label: 'Turn the handle', value: 'open' },
      { label: 'Step back', value: 'leave' },
    ];

    const showOptions = () => {
      scene.dialog.setText(intro, options, async value => {
        if (value === 'leave') {
          scene.dialog.setText('You step back, unease prickling your neck.');
          await new Promise(resolve => {
            const check = () => {
              if (keyWasPressed('Space') || !scene.dialog.visible) return resolve();
              requestAnimationFrame(check);
            };
            check();
          });
          scene.dialog.visible = false;
          player.frozen = false;
        }

        else if (value === 'open') {
          // 🎧 Door open SFX
          scene.dialog.visible = false;
          try {
            audioManager.playSound('door_open', null, 1.0);
            console.log('[doorTeleport2] Door open sound played');
          } catch (err) {
            console.warn('[doorTeleport2] Failed to play door sound:', err);
          }

          // 🗺️ Switch to new map (indoor)
          await scene.loadNewMap('/assets/map/indoor-room.tmj', 6.25, 8.75);
          console.log('[doorTeleport2] Loaded new map: indoor-room.tmj');

          // 🌩️ Subtle ambience for indoor tone
          if (scene.lighting) {
            scene.lighting.setRainMode('background');
            scene.lighting.setLightningMode('background');
            scene.lighting.lightningEnabled = false;
            scene.lighting.triggerLightning(0.6);
          }

          // 🌫️ Ensure fog-of-war is visible post-load
          if (scene.fogOfWar) {
            for (const a of scene.fogOfWar.areas || []) a.hidden = false;
            scene.fogOfWar.enabled = true;
          }

          // 📜 Continue monologue
          scene.dialog.setMode('monologue');
          scene.dialog.setText(
            'The door swings open to reveal a narrow corridor.\n' +
            'A faint metallic scent lingers in the air...\n\n' +
            'Somewhere deeper inside, something moves.'
          );
          scene.dialog.visible = true;

          player.frozen = false;
        }
      });
    };

    showOptions();
  },
};
