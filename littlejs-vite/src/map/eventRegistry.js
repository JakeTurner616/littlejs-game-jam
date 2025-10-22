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
    description: 'Teleports player to door target area',
    execute(scene, player) {
      const pos = { x: 11.14, y: -11.04 }; // 👈 From debug measurement
      console.log('[EventRegistry] Teleport →', pos);
      player.pos.set(pos.x, pos.y);
      setCameraPos(player.pos);
    }
  },

  /*───────────────────────────────────────────────
    DIALOG EVENTS
  ────────────────────────────────────────────────*/
  note_a: {
    description: 'Shows note text near stairwell',
    execute(scene) {
      scene.dialog.visible = true;
      scene.dialog.setText("The note reads: 'Don’t go upstairs.'");
    }
  },

  portrait_inspect: {
    description: 'Examines the creepy portrait',
    execute(scene) {
      scene.dialog.visible = true;
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
