// src/events/doorTeleport1.js — ✅ door open sound sync
'use strict';
import { keyWasPressed } from 'littlejsengine';
import { audioManager } from '../audio/AudioManager.js';

export const event = {
  id: 'door_teleport_1',
  description: 'Door interaction: opens the door and loads the indoor map',
  async execute(scene, player) {
    if (scene.dialog.isActive()) return;
    player.frozen = true;

    // Wait until monologue finishes
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
          scene.dialog.visible = false;

          // 🎧 Play door open sound immediately before fog fade
          audioManager.playSound('door_open', null, 1.0);
          console.log('[doorTeleport1] Door open sound played');

          // 🌫️ Fade fog and adjust lighting
          scene.fog?.fadeOut();
          scene.lighting?.setRainMode('background');
          scene.lighting?.setLightningMode('background');
          scene.lighting.lightningEnabled = false;

          // 🗺️ Load new map
          await scene.loadNewMap('/assets/map/inside.tmj', 9.857, 11.983);

          // 🎬 Entry monologue
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
