// src/events/doorTeleport1.js — 🕯️ Narrative door + fog reveal AFTER teleport completes
'use strict';
import { keyWasPressed } from 'littlejsengine';
import { audioManager } from '../audio/AudioManager.js';
import { getPortrait } from '../util/portraitCache.js';

export const event = {
  id: 'door_teleport_1',
  description: 'Narrative entry door: multi-skill checks (some return to menu, some open)',

  async execute(scene, player) {
    if (scene.dialog.isActive()) return;
    player.frozen = true;

    // ─────────────────────────────────────────────
    // Wait for any previous dialog to close
    // ─────────────────────────────────────────────
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

    const portrait = await getPortrait('./assets/portraits/doorway.png');
    scene.dialog.portrait = portrait;
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

    // ─────────────────────────────────────────────
    // Transition helper: open the door + teleport
    // ─────────────────────────────────────────────
    const openDoorSequence = async (finalText) => {
      audioManager.playSound('door_open', null, 1);
      scene.fog?.setBackgroundMode?.(true);
      scene.fog?.setDensity?.(0.9);
      scene.lighting?.setRainMode?.('background');
      scene.lighting?.setLightningMode?.('background');
      scene.lighting.lightningEnabled = false;

      // 🔹 fade to white/grey before map switch
      scene.fog?.fadeOut();
      await new Promise((r) => setTimeout(r, 500));

      // 🔹 perform the actual teleport
      await scene.loadNewMap('./assets/map/inside.tmj', 9.857, 11.983);
      scene.fog?.setBackgroundMode?.(false);
      scene.fog.enabled = true;

      // 🔹 narrative line appears AFTER teleport
      scene.dialog.setMode('monologue');
      scene.dialog.setText(
        finalText ||
          'The door yields to your will.\n\nA cold breath escapes from the darkness beyond.'
      );
      scene.dialog.visible = true;
      await waitForContinue();

      // ✅ reveal Fog of War only NOW, after teleport + final text
      scene.fogOfWar?.revealByEvent?.('door_teleport_1');

      player.frozen = false;
    };

    // ─────────────────────────────────────────────
    // Menu reopen helper
    // ─────────────────────────────────────────────
    const reopenMenu = async () => {
      const opts = baseOptions.map((o) => ({
        ...o,
        disabled: used.has(o.value),
      }));
      scene.dialog.setMode('dialogue');
      scene.dialog.setText(intro, opts, handler);
      scene.dialog.portrait = portrait;
      scene.dialog.visible = true;
    };

    // ─────────────────────────────────────────────
    // Handler for each dialogue option
    // ─────────────────────────────────────────────
    const handler = async (value) => {
      if (used.has(value)) return;
      used.add(value);

      scene.dialog.visible = false;
      scene.dialog.text = '';
      scene.dialog.typeProgress = 0;

      switch (value) {
        // ————————————————————————————————————
        case 'key': {
          const result = scene.skillChecks.roll('decay', 0.55, {
            lightning: scene.lighting?.lastFlash || false,
            environment: 'dark',
          });

          const color = result.success ? '#8f8' : '#ff7070';
          scene.skillChecks.toasts.show(
            `Rusty Key Check: ${result.success ? 'Success' : 'Fail'}`,
            color,
            3
          );
          scene.skillChecks.toasts.show(result.flavor, '#fff', 4);

          scene.dialog.setMode('monologue');
          scene.dialog.setText(result.flavor);
          scene.dialog.visible = false;
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

          const color = result.success ? '#aef' : '#f55';
          scene.skillChecks.toasts.show(
            `Resonance Check: ${result.success ? 'Success' : 'Fail'}`,
            color,
            3
          );
          scene.skillChecks.toasts.show(result.flavor, '#fff', 4);

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

          await reopenMenu();
          break;
        }

        // ————————————————————————————————————
        case 'knock': {
          const result = scene.skillChecks.roll('faith', 0.5, {
            environment: 'dark',
            stress: 0.5,
          });

          const color = result.success ? '#ffe77a' : '#ff6060';
          scene.skillChecks.toasts.show(
            `Faith Check: ${result.success ? 'Success' : 'Fail'}`,
            color,
            3
          );
          scene.skillChecks.toasts.show(result.flavor, '#fff', 4);

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

          await reopenMenu();
          break;
        }

        // ————————————————————————————————————
        case 'open': {
          scene.dialog.setMode('monologue');
          scene.dialog.setText(
            'You grip the handle and pull.\n\nIt resists, then yields with a deep groan.'
          );
          scene.dialog.visible = true;
          await waitForContinue();

          scene.skillChecks.toasts.show('You open the door.', '#8f8', 3);
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

    // ─────────────────────────────────────────────
    // Initial menu
    // ─────────────────────────────────────────────
    const opts = baseOptions.map((o) => ({ ...o, disabled: false }));
    scene.dialog.setText(intro, opts, handler);
    scene.dialog.portrait = portrait;
    scene.dialog.visible = true;
  },
};
