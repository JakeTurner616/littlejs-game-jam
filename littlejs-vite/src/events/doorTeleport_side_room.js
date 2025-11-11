// src/events/doorTeleport_side_room.js — 🕯️ Side door teleport: main → side room
'use strict';
import { keyWasPressed } from 'littlejsengine';
import { audioManager } from '../audio/AudioManager.js';

export const event = {
  id: 'door_teleport_side_room',
  description: 'Side door teleport into a smaller adjoining room (fog safe)',
  async execute(scene, player) {
    if (scene.dialog.isActive()) return;
    player.frozen = true;

    // ambience fade
    scene.fog?.fadeOut?.();
    audioManager.playSound('door_open', null, 1.0);
    scene.lighting?.setRainMode?.('background');
    scene.lighting?.setLightningMode?.('background');
    scene.lighting.lightningEnabled = false;

    await new Promise(r => setTimeout(r, 500));

    // load target map
    await scene.loadNewMap('./assets/map/side_room.tmj', 4.2, 8.4);
    scene.fog.enabled = true;
    scene.lighting.triggerLightning(0.3);

    // narration
    scene.dialog.setMode('monologue');
    scene.dialog.setText(
      'The small side room welcomes you with damp air and silence.\n\nSomething faintly glimmers in the corner...'
    );
    scene.dialog.visible = true;

    // wait for input
    await new Promise(resolve => {
      const check = () => {
        if (keyWasPressed('Space') || !scene.dialog.visible) return resolve();
        requestAnimationFrame(check);
      };
      check();
    });

    scene.fogOfWar?.revealByEvent?.('door_teleport_side_room');
    player.frozen = false;
  }
};
