// src/events/doorTeleport_main_room.js — 🕯️ Main door teleport: outside → main room
'use strict';
import { keyWasPressed } from 'littlejsengine';
import { audioManager } from '../audio/AudioManager.js';

export const event = {
  id: 'door_teleport_main_room',
  description: 'Main door teleport into the central room (fog safe, cinematic)',
  async execute(scene, player) {
    if (scene.dialog.isActive()) return;
    player.frozen = true;

    // fade environment out before switching maps
    scene.fog?.fadeOut?.();
    scene.lighting?.setRainMode?.('background');
    scene.lighting?.setLightningMode?.('background');
    scene.lighting.lightningEnabled = false;

    await new Promise(r => setTimeout(r, 500));

    await scene.loadNewMap('./assets/map/main_room.tmj', 7.0, 9.5);
    scene.fog?.setBackgroundMode?.(false);
    scene.fog.enabled = true;
    scene.lighting.triggerLightning(0.5);

    // narrative
    scene.dialog.setMode('monologue');
    scene.dialog.setText(
      'You step through the threshold.\n\nThe air shifts — thicker, stiller, older.\nSomething waits within the dim main hall.'
    );
    scene.dialog.visible = true;

    // wait until player acknowledges
    await new Promise(resolve => {
      const check = () => {
        if (keyWasPressed('Space') || !scene.dialog.visible) return resolve();
        requestAnimationFrame(check);
      };
      check();
    });

    scene.fogOfWar?.revealByEvent?.('door_teleport_main_room');
    player.frozen = false;
  }
};
