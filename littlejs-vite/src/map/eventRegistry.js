// src/map/eventRegistry.js
'use strict';
import { setCameraPos, setCameraScale, vec2 } from 'littlejsengine';

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
    // no cinematic mode needed here
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
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " +
      "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. " +
      "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur."
    );

    // ✅ Immediately resume normal camera follow
    scene.cinematicMode = false;
  }
},

  /*───────────────────────────────────────────────
    MANUAL POLYGON TRIGGER — WINDOW EVENT
  ────────────────────────────────────────────────*/
  window_scene_1: {
    description: 'Triggers dialogue at the creepy window with smooth camera movement and zoom.',
    async execute(scene, player) {
      // ✅ ENABLE CINEMATIC MODE
      scene.cinematicMode = true;

      const startPos = player.pos.copy();
      const startScale = 128;
      const targetPos = player.pos.add(vec2(-0.5, 0.7));
      const targetScale = 160;
      const duration = 3.5;
      let elapsed = 0;

      const easeInOutCubic = (t) => (t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2);

      const animateCamera = () => {
        elapsed += 1 / 60;
        const t = Math.min(elapsed / duration, 1.0);
        const easedT = easeInOutCubic(t);

        const currentPos = vec2(
          startPos.x + (targetPos.x - startPos.x) * easedT,
          startPos.y + (targetPos.y - startPos.y) * easedT
        );

        const currentScale = startScale + (targetScale - startScale) * easedT;

        setCameraPos(currentPos);
        setCameraScale(currentScale);

        if (t < 1.0) {
          requestAnimationFrame(animateCamera);
        } else {
          showDialogue();
        }
      };

      const showDialogue = async () => {
        if (scene.lighting) {
          scene.lighting.setRainMode('background');
          scene.lighting.setLightningMode('background');
          scene.lighting.lightningEnabled = false;
        }

        scene.dialog.setMode('dialogue');
        await scene.dialog.loadPortrait('/assets/portraits/window_face.png');
        scene.dialog.visible = true;
        scene.dialog.setText(
          "Window: The glass hums softly, like it's breathing.\n\n" +
          "You lean closer—your reflection blinks.\n\n" +
          "Voice: 'It's not polite to stare, child... you'll wake her.'"
        );

        setTimeout(() => resetCamera(), 2500);
      };

      const resetCamera = () => {
        let resetElapsed = 0;
        const resetDuration = 1.0;

        const animateReset = () => {
          resetElapsed += 1 / 60;
          const t = Math.min(resetElapsed / resetDuration, 1.0);
          const easedT = easeInOutCubic(t);

          const currentPos = vec2(
            targetPos.x + (player.pos.x - targetPos.x) * easedT,
            targetPos.y + (player.pos.y - targetPos.y) * easedT
          );

          const currentScale = targetScale + (startScale - targetScale) * easedT;

          setCameraPos(currentPos);
          setCameraScale(currentScale);

          if (t < 1.0) {
            requestAnimationFrame(animateReset);
          } else {
            scene.cinematicMode = false; // ✅ Re-enable camera follow
          }
        };

        animateReset();
      };

      animateCamera();
    }
  },
};
