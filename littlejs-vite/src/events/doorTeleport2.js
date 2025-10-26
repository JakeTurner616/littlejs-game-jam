// src/events/doorTeleport2.js
'use strict';
import { keyWasPressed } from 'littlejsengine';
import { isoToWorld } from '../map/isoMath.js';
import { audioManager } from '../audio/AudioManager.js';

export const event = {
  id: 'door_teleport_2',
  description: 'Alternate door teleport (cinematic fog + thunder transition)',
  async execute(scene, player) {
    if (scene.dialog.isActive()) return;
    player.frozen = true;

    // Wait for any visible monologue to finish
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

    // Prepare dialogue mode
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
          // 🎧 Sound + fog fade + teleport
          scene.dialog.visible = false;

          try {
            audioManager.playSound('door_open', null, 1.0);
            console.log('[doorTeleport2] Door open sound played');
          } catch (err) {
            console.warn('[doorTeleport2] Failed to play door sound:', err);
          }

          // 🌫️ Fog fade out for dramatic transition
          if (scene.fog) scene.fog.fadeOut(1.5);
          if (scene.lighting) {
            scene.lighting.setRainMode('background');
            scene.lighting.lightningEnabled = false;
          }

          // 🚪 Target tile + direction
          const { mapData, TILE_W, TILE_H } = scene.map;
          const { width, height } = mapData;
          const targetC = 5.42;
          const targetR = 9.18;
          const targetDir = 2; // NE direction

          const worldFeet = isoToWorld(targetC, targetR, width, height, TILE_W, TILE_H);
          player.pos = worldFeet.subtract(player.feetOffset);
          player.direction = targetDir;
          player.state = 'idle';

          console.log(
            `%c[doorTeleport2] Teleport → TILE(c=${targetC}, r=${targetR}) DIR=${targetDir}`,
            'color:#aef;font-weight:bold;'
          );

          // 💨 Brief lightning effect for ambience
          if (scene.lighting) scene.lighting.triggerLightning(0.6);

          // 📜 Continue monologue
          scene.dialog.setMode('monologue');
          scene.dialog.setText(
            'The door swings open to reveal a narrow corridor.\n' +
            'A faint metallic scent lingers in the air...\n\n' +
            'Somewhere deeper inside, something moves.'
          );
          scene.dialog.visible = true;

          // Re-enable player control
          player.frozen = false;
        }
      });
    };

    showOptions();
  },
};
