// src/events/doorTeleport1.js — 🕯️ Narrative door with partial-open logic, disabled options & scroll
'use strict';
import { keyWasPressed } from 'littlejsengine';
import { audioManager } from '../audio/AudioManager.js';

export const event = {
  id: 'door_teleport_1',
  description: 'Narrative entry door: multi-skill checks (some return to menu, some open)',
  async execute(scene, player) {
    if (scene.dialog.isActive()) return;
    player.frozen = true;

    await new Promise((resolve) => {
      const check = () => {
        if (!scene.dialog.visible) return resolve();
        if (scene.dialog.typeProgress >= scene.dialog.text.length)
          setTimeout(() => {
            const wait = () => {
              if (!scene.dialog.visible) resolve();
              else requestAnimationFrame(wait);
            };
            wait();
          }, 300);
        else requestAnimationFrame(check);
      };
      check();
    });

    await scene.dialog.loadPortrait('/assets/portraits/doorway.png');
    scene.dialog.setMode('dialogue');
    scene.dialog.visible = true;

    const intro =
      'The disheveled door stands tall.\n' +
      'A sign above clearly reads “KEEP OUT.”\n\n' +
      'The wood seems to breathe ever so slightly. A faint chill seeps through the cracks.';

    const baseOptions = [
      { label: 'Try the key', value: 'key' },
      { label: 'Knock softly', value: 'knock' },
      { label: 'Listen closely', value: 'listen' },
      { label: 'Just open it', value: 'open' },
    ];
    const used = new Set();

    const waitForContinue = () =>
      new Promise((resolve) => {
        const loop = () => {
          if (keyWasPressed('Space') || !scene.dialog.visible) return resolve();
          requestAnimationFrame(loop);
        };
        loop();
      });

    const openDoorSequence = async (finalText) => {
      audioManager.playSound('door_open', null, 1);
      scene.fog?.fadeOut();
      scene.lighting?.setRainMode('background');
      scene.lighting?.setLightningMode('background');
      scene.lighting.lightningEnabled = false;

      await scene.loadNewMap('/assets/map/inside.tmj', 9.857, 11.983);
      scene.dialog.setMode('monologue');
      scene.dialog.setText(
        finalText ||
          'The door yields to your will.\n\nA cold breath escapes from the darkness beyond.'
      );
      scene.dialog.visible = true;
      await waitForContinue();
      player.frozen = false;
    };

    const reopenMenu = async () => {
      const opts = baseOptions.map(o => ({
        ...o,
        disabled: used.has(o.value),
      }));
      scene.dialog.setMode('dialogue');
      scene.dialog.setText(intro, opts, handler);
    };

    const handler = async (value) => {
      if (used.has(value)) return; // prevent repeat click
      used.add(value);
      scene.dialog.visible = false;

      switch (value) {
        // ————————————————————————————————————
        case 'key': {
          const result = scene.skillChecks.roll('decay', 0.55, {
            lightning: scene.lighting?.lastFlash || false,
            environment: 'dark',
          });
          scene.dialog.setMode('monologue');
          scene.dialog.setText(result.flavor);
          scene.dialog.visible = true;
          await waitForContinue();

          if (result.success) {
            scene.skillChecks.stats.faith += 2;
            scene.skillChecks.stats.dexterity += 1;
            audioManager.playSound('door_unlock', null, 0.9);
            scene.lighting.triggerLightning(0.3);
          } else {
            scene.skillChecks.registerFailure('rusty_key');
            scene.skillChecks.stats.faith -= 2;
            scene.skillChecks.stats.dexterity -= 1;
            audioManager.playSound('metal_creak', null, 0.8);
            scene.lighting.triggerLightning(0.1);
          }
          await openDoorSequence(
            result.success
              ? 'The key turns reluctantly, but it opens.\n\nA heavy scent of dust spills from the crack.'
              : 'The key nearly snaps, but the latch gives way at last.\n\nA breath of cold air seeps out, whispering welcome—or warning.'
          );
          break;
        }

        // ————————————————————————————————————
        case 'listen': {
          const result = scene.skillChecks.roll('resonance', 0.6, {
            environment: 'dark',
            stress: 1,
          });
          scene.dialog.setMode('monologue');
          scene.dialog.setText(
            result.success
              ? 'You hold your breath…\n\nA faint hum echoes behind the wood, steady and calm.'
              : 'You lean in close…\n\nSomething hums back—wet, uneven, alive.'
          );
          scene.dialog.visible = true;
          await waitForContinue();

          if (result.success) {
            scene.skillChecks.stats.memory += 3;
            scene.skillChecks.stats.willpower += 2;
          } else {
            scene.skillChecks.stats.memory -= 2;
            scene.skillChecks.stats.willpower -= 1;
          }
          audioManager.playSound('wind_howl', null, 0.7);
          scene.lighting.triggerLightning(result.success ? 0.3 : 0.15);

          // returns to menu, not open
          await reopenMenu();
          break;
        }

        // ————————————————————————————————————
        case 'knock': {
          const result = scene.skillChecks.roll('faith', 0.5, {
            environment: 'dark',
            stress: 0.5,
          });
          scene.dialog.setMode('monologue');
          scene.dialog.setText(
            result.success
              ? 'You rap gently.\n\nSomething moves inside—a shift, then silence.'
              : 'You knock once.\n\nThe echo answers wrong—like a laugh held too long.'
          );
          scene.dialog.visible = true;
          await waitForContinue();

          if (result.success) {
            scene.skillChecks.stats.insight += 2;
            scene.skillChecks.stats.faith += 1;
          } else {
            scene.skillChecks.stats.faith -= 1;
            scene.skillChecks.stats.insight -= 1;
          }
          audioManager.playSound('door_knock', null, 0.9);
          scene.lighting.triggerLightning(result.success ? 0.2 : 0.4);

          // knocking doesn’t open
          await reopenMenu();
          break;
        }

        // ————————————————————————————————————
        case 'open': {
          scene.dialog.setMode('monologue');
          scene.dialog.setText('You grip the handle and pull.\n\nIt resists, then yields with a deep groan.');
          scene.dialog.visible = true;
          await waitForContinue();
          await openDoorSequence(
            'The heavy air inside wraps around you like a second skin.\n\nSomething stirs deeper within the dark.'
          );
          break;
        }

        default:
          await reopenMenu();
          break;
      }
    };

    // initial
    const opts = baseOptions.map(o => ({ ...o, disabled: false }));
    scene.dialog.setText(intro, opts, handler);
  },
};
