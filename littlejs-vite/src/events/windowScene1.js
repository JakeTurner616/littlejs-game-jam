// src/events/windowScene1.js
'use strict';
import { vec2, keyWasPressed } from 'littlejsengine';
import { WitchEntity } from '../character/witchEntity.js';

export const event = {
  id: 'window_scene_1',
  description: 'A haunting figure appears at the window.',
  async execute(scene, player) {
    if (scene.dialog.isActive()) return;

    // Scene setup
    if (scene.lighting) {
      scene.lighting.setRainMode('background');
      scene.lighting.lightningEnabled = false;
    }

    // Phase 1: monologue
    scene.dialog.setMode('monologue');
    player.frozen = false;
    scene.dialog.setText('You catch a flicker of motion beyond the windowpane...');
    await waitForDialog(scene);

    // Phase 2: dialogue
    scene.dialog.setMode('dialogue');
    player.frozen = true;
    await scene.dialog.loadPortrait('./assets/portraits/window_face.png');
    scene.dialog.visible = true;

    const intro =
      'Something stands there... just beyond the glass.\n' +
      'It does not move.\nIt only watches.';

    const options = [
      { label: 'Step closer', value: 'closer' },
      { label: 'Look away', value: 'away' },
    ];

    const fadeOutWitch = () => {
      const manager = scene.witchManager;
      if (!manager) return;
      const witch = [...manager.entitiesBelow, ...manager.entitiesAbove]
        .find(e => e instanceof WitchEntity && !e.fading);
      if (witch) witch.fadeOut(0.05);
    };

    const showOptions = () => {
      scene.dialog.setText(intro, options, async value => {
        if (value === 'closer') {
          // hide dialog for cinematic transition
          scene.dialog.visible = false;

          // 🧭 Move toward nearest ManeuverNode
          const nodes = scene.map?.maneuverNodes || [];
          if (!nodes.length) {
            console.warn('[WindowScene1] No maneuver nodes found!');
          } else {
            const feet = player.pos.add(player.feetOffset);
            let nearestNode = nodes[0];
            let nearestDist = Infinity;
            for (const n of nodes) {
              const d = feet.distance(n.pos);
              if (d < nearestDist) {
                nearestDist = d;
                nearestNode = n;
              }
            }

            const target = vec2(nearestNode.pos.x, nearestNode.pos.y);
            const path = player.buildSmartPath(target);
            console.log(`[WindowScene1] Step closer → node ${nearestNode.id}, path length ${path.length}`);

            if (path.length > 0) {
              // ✅ Allow walking again for natural movement
              player.frozen = false;
              player.path = path;
              player.destinationMarker = target;
              player.markerAlpha = 1;

              await waitUntilArrived(player, target);
              // freeze again once reached
              player.frozen = true;
            } else {
              console.warn('[WindowScene1] Could not find valid path to nearest node.');
            }
          }

          // When arrived
          player.state = 'idle';
          player.currentAnimKey = `idle_${player.direction + 1}`;
          scene.dialog.setMode('monologue');
          scene.dialog.setText('The figure looks through you with hollow eyes...');
          await waitForDialog(scene);

          fadeOutWitch();
          player.frozen = false;
          scene.dialog.setText('Just like that the figure is gone.');
        }

        else if (value === 'away') {
          scene.dialog.setText('You avert your gaze, but the feeling of being watched lingers.');
          await waitForSpaceOrClose(scene);
          fadeOutWitch();
          player.frozen = false;
          scene.dialog.setMode('monologue');
          scene.dialog.setText(
            'The figure vanishes as you look away, leaving only an empty window pane behind.'
          );
        }
      });
    };

    showOptions();
  },
};

/*───────────────────────────────────────────────
  Utility helpers
───────────────────────────────────────────────*/
function waitForDialog(scene) {
  return new Promise(resolve => {
    const check = () =>
      (!scene.dialog.visible || scene.dialog.typeProgress >= scene.dialog.text.length)
        ? resolve()
        : requestAnimationFrame(check);
    check();
  });
}

function waitForSpaceOrClose(scene) {
  return new Promise(resolve => {
    const check = () => {
      if (keyWasPressed('Space') || !scene.dialog.visible) return resolve();
      requestAnimationFrame(check);
    };
    check();
  });
}

function waitUntilArrived(player, target) {
  return new Promise(resolve => {
    const check = () => {
      const feet = player.pos.add(player.feetOffset);
      if (feet.distance(target) < player.reachThreshold) return resolve();
      if (!player.path.length) return resolve(); // canceled or blocked
      requestAnimationFrame(check);
    };
    check();
  });
}
