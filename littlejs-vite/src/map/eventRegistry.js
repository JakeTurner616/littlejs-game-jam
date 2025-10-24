// src/map/eventRegistry.js
'use strict';
import { vec2, keyWasPressed, timeDelta } from 'littlejsengine';
import { WitchEntity } from '../character/witchEntity.js';

export const EventRegistry = {
  /*───────────────────────────────────────────────
    DOOR EVENT
  ────────────────────────────────────────────────*/
  door_teleport_1: {
    description: 'Two-phase event: monologue intro → interactive dialogue',
    async execute(scene, player) {
      if (scene.dialog.isActive()) return;
      player.frozen = true;

      // Wait until text fully typed or dismissed
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
  },

  /*───────────────────────────────────────────────
    WINDOW SCENE — haunting figure event
  ────────────────────────────────────────────────*/
  window_scene_1: {
    description: 'A haunting figure appears at the window.',
    async execute(scene, player) {
      if (scene.dialog.isActive()) return;

      if (scene.lighting) {
        scene.lighting.setRainMode('background');
        scene.lighting.lightningEnabled = false;
      }

      // ── PHASE 1: Monologue intro ──
      scene.dialog.setMode('monologue');
      player.frozen = false;
      scene.dialog.setText('You catch a flicker of motion beyond the windowpane...');

      await new Promise((resolve) => {
        const wait = () => (!scene.dialog.visible ? resolve() : requestAnimationFrame(wait));
        wait();
      });

      // ── PHASE 2: Dialogue interaction ──
      scene.dialog.setMode('dialogue');
      player.frozen = true;
      await scene.dialog.loadPortrait('/assets/portraits/window_face.png');
      scene.dialog.visible = true;

      const intro =
        'Something stands there... just beyond the glass.\n' +
        'It does not move.\nIt only watches.';

      const options = [
        { label: 'Step closer', value: 'closer' },
        { label: 'Look away', value: 'away' },
      ];

      // Helper: find and fade the witch out
      const fadeOutWitch = () => {
        const witch = scene.entitiesBelow.find((e) => e instanceof WitchEntity);
        if (witch && !witch.fading) witch.fadeOut(0.02);
      };

      const showOptions = () => {
        scene.dialog.setText(intro, options, async (value) => {
          if (value === 'closer') {
            player.frozen = true;

            // ──────────────────────────────────────────────
            // Auto-walk NE (simulate W+D input)
            // ──────────────────────────────────────────────
            const start = player.pos.copy();
            const step = vec2(0.6, 0.6 * player.tileRatio);
            const target = player.pos.add(step);
            const steps = 28;
            const duration = 0.6;
            const delay = (duration * 1000) / steps;

            player.state = 'walk';
            player.direction = 4; // northeast
            player.frameIndex = 0;
            player.frameTimer = 0;
            player.footstepTimer = 0;

            for (let i = 0; i <= steps; i++) {
              const t = i / steps;
              player.pos = vec2(
                start.x + (target.x - start.x) * t,
                start.y + (target.y - start.y) * t
              );

              player.frameTimer += timeDelta;
              const frames = player.frames[`walk_${player.direction + 1}`];
              if (frames?.length) {
                const dur =
                  player.durations[`walk_${player.direction + 1}`][player.frameIndex] ||
                  1 / 30;
                if (player.frameTimer >= dur) {
                  player.frameTimer -= dur;
                  player.frameIndex = (player.frameIndex + 1) % frames.length;
                }
              }

              if (i % 8 === 0) player.emitFootstepParticle(vec2(1, 1));
              await new Promise((r) => setTimeout(r, delay));
            }

            player.state = 'idle';
            player.frameIndex = 0;

            // Dialogue after movement
            scene.dialog.setText('The figure looks through you with hollow eyes.');
            await new Promise((r) => setTimeout(r, 2500));
            scene.dialog.visible = false;
            fadeOutWitch();
            player.frozen = false;
          } else if (value === 'away') {
            scene.dialog.setText('You advert your gaze, but the feeling of being watched lingers.');

            await new Promise((resolve) => {
              const waitForSpace = () => {
                if (keyWasPressed('Space')) return resolve();
                if (!scene.dialog.visible) return resolve();
                requestAnimationFrame(waitForSpace);
              };
              waitForSpace();
            });

            scene.dialog.visible = false;
            fadeOutWitch();
            player.frozen = false;

                  scene.dialog.setMode('monologue');

          scene.dialog.setText('The figure vanishes as you look away, leaving only an empty window pane behind.');
          }
        });
      };

      showOptions();
    },
  },
};
