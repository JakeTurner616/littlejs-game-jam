// src/events/doorTeleport1.js
'use strict';
import { keyWasPressed, vec2 } from 'littlejsengine';
import { isoToWorld } from '../map/isoMath.js';
import { audioManager } from '../audio/AudioManager.js';

export const event = {
  id: 'door_teleport_1',
  description: 'Two-phase event: monologue intro → interactive dialogue (tile-based teleport)',
  async execute(scene, player) {
    if (scene.dialog.isActive()) return;
    player.frozen = true;

    // Wait for any visible monologue to finish
    await new Promise((resolve) => {
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

    if (scene.dialog.visible) scene.dialog.visible = false;
    scene.dialog.setMode('dialogue');
    await scene.dialog.loadPortrait('/assets/portraits/doorway.png');
    scene.dialog.visible = true;

    const intro =
      'The disheveled door stands tall.\n' +
      'A sign above clearly reads “KEEP OUT.”\n\n' +
      'The wood seems to breathe ever so slightly…';

    const options = [
      { label: 'Open the door', value: 'open' },
      { label: 'Knock', value: 'knock' },
    ];

    const showOptions = () => {
      scene.dialog.setText(intro, options, async (value) => {
        if (value === 'knock') {
          scene.dialog.setText('You rap gently.\n\nYou hear nothing.');
          await new Promise((resolve) => {
            const waitForSpace = () => {
              if (keyWasPressed('Space')) return resolve();
              if (!scene.dialog.visible) return resolve();
              requestAnimationFrame(waitForSpace);
            };
            waitForSpace();
          });
          showOptions();
        }

        else if (value === 'open') {
          // 🔑 Door opening logic
          scene.dialog.visible = false;

          // 🎧 Play door open sound
          try {
            audioManager.playSound('door_open', null, 1.0);
            console.log('[doorTeleport1] Door open sound played');
          } catch (err) {
            console.warn('[doorTeleport1] Failed to play door sound:', err);
          }

          // 🚪 Convert tile-space → world-space (aligned to player feet)
          const { mapData, TILE_W, TILE_H } = scene.map;
          const { width, height } = mapData;

          // ✅ Target tile + facing direction
          const targetC = 10.18;
          const targetR = 11.98;
          const targetDir = 4; // SW (0–7 range)

          const worldFeet = isoToWorld(targetC, targetR, width, height, TILE_W, TILE_H);
          player.pos = worldFeet.subtract(player.feetOffset); // align feet perfectly
          player.direction = targetDir;
          player.state = 'idle';

          console.log(
            `%c[doorTeleport1] Teleport to TILE (c=${targetC}, r=${targetR}) DIR=${targetDir}`,
            'color:#6ff;font-weight:bold;'
          );
          if (scene.fog) {
            scene.fog.fadeOut();
            console.log('[doorTeleport1] Fog fade-out triggered');
          }
          // 🕯️ Switch to indoor lighting
          if (scene.lighting) {
            scene.lighting.setRainMode('background');
            scene.lighting.setLightningMode('background');
            scene.lighting.lightningEnabled = false;
            console.log('[doorTeleport1] Switched to indoor lighting (background mode)');
          }

          // 📜 Continue monologue
          scene.dialog.setMode('monologue');
          scene.dialog.setText(
            'The dusty door creaks open, revealing a dimly lit room beyond.\n\n' +
            'As you step inside, the air grows colder, and a sense of unease washes over you.'
          );
          scene.dialog.visible = true;

          player.frozen = false;
        }
      });
    };

    showOptions();
  },
};
