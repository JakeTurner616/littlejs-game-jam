// src/map/eventRegistry.js
'use strict';
import { setCameraPos } from 'littlejsengine';

/**
 * EventRegistry — centralized in-game events
 * ------------------------------------------
 * Each key matches a Tiled `eventId` string.
 */
export const EventRegistry = {
  /*───────────────────────────────────────────────
    TELEPORT EVENTS
  ────────────────────────────────────────────────*/
  door_teleport_1: {
    description: 'Teleports player to door target area and triggers dialogue',
    async execute(scene, player) {
      player.pos.set(11.14, -11.04);
      setCameraPos(player.pos);

      // ✅ Switch rain to background when inside
      if (scene.lighting)
        scene.lighting.setRainMode('background');

      scene.dialog.setMode('dialogue');
      await scene.dialog.loadPortrait('/assets/portraits/doorway.png');
      scene.dialog.visible = true;
      scene.dialog.setText(
        "Door: You're not supposed to be here.\n\n" +
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
      );
    }
  },

  /*───────────────────────────────────────────────
    DIALOG EVENTS
  ────────────────────────────────────────────────*/
  note_a: {
    description: 'Shows note text near stairwell',
    execute(scene) {
      scene.dialog.visible = true;
      scene.dialog.setMode('monologue');
      scene.dialog.setText("The note reads: 'Don’t go upstairs.'");
    }
  },

  portrait_inspect: {
    description: 'Examines the creepy portrait',
    execute(scene) {
      scene.dialog.visible = true;
      scene.dialog.setMode('monologue');
      scene.dialog.setText("A pair of eyes seem to follow you. The paint is still wet.");
    }
  },

  /*───────────────────────────────────────────────
    MISC EVENTS
  ────────────────────────────────────────────────*/
  trigger_music_change: {
    description: 'Switches the background music to a tense theme',
    execute(scene) {
      scene.audioManager.playMusic('/assets/audio/tense.ogg', 0.7, true);
    }
  },
};