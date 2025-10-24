// src/events/doorTeleport1.js
'use strict';
import { keyWasPressed } from 'littlejsengine';

export const event = {
  id: 'door_teleport_1',
  description: 'Two-phase event: monologue intro → interactive dialogue',
  async execute(scene, player) {
    if (scene.dialog.isActive()) return;
    player.frozen = true;

    // Wait for previous text
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
        } else if (value === 'open') {
          player.pos.set(11.14, -11.04);
          scene.dialog.visible = false;

          // switch rain to background (indoor)
          if (scene.lighting) {
            scene.lighting.setRainMode('background');
            scene.lighting.lightningEnabled = false;
          }

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
