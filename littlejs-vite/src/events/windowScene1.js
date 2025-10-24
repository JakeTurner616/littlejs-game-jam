// src/events/windowScene1.js
'use strict';
import { vec2, keyWasPressed, timeDelta } from 'littlejsengine';
import { WitchEntity } from '../character/witchEntity.js';

export const event = {
  id: 'window_scene_1',
  description: 'A haunting figure appears at the window.',
  async execute(scene, player) {
    if (scene.dialog.isActive()) return;

    if (scene.lighting) {
      scene.lighting.setRainMode('background');
      scene.lighting.lightningEnabled = false;
    }

    // Phase 1: monologue
    scene.dialog.setMode('monologue');
    player.frozen = false;
    scene.dialog.setText('You catch a flicker of motion beyond the windowpane...');
    await new Promise((resolve) => {
      const wait = () => (!scene.dialog.visible ? resolve() : requestAnimationFrame(wait));
      wait();
    });

    // Phase 2: dialogue
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

    const fadeOutWitch = () => {
      const manager = scene.witchManager;
      if (!manager) return;
      const witch = [...manager.entitiesBelow, ...manager.entitiesAbove]
        .find(e => e instanceof WitchEntity && !e.fading);
      if (witch) witch.fadeOut(0.05);
    };

    const showOptions = () => {
      scene.dialog.setText(intro, options, async (value) => {
        if (value === 'closer') {
          player.frozen = true;
          const start = player.pos.copy();
          const step = vec2(0.6, 0.6 * player.tileRatio);
          const target = player.pos.add(step);
          const steps = 28;
          const duration = 0.6;
          const delay = (duration * 1000) / steps;

          player.state = 'walk';
          player.direction = 4;
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
                player.durations[`walk_${player.direction + 1}`][player.frameIndex] || 1 / 30;
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
          scene.dialog.setText('The figure looks through you with hollow eyes.');
          await new Promise((r) => setTimeout(r, 2500));
          scene.dialog.visible = false;
          fadeOutWitch();
          player.frozen = false;
          scene.dialog.setText('Just like that the figure is gone.');
          scene.dialog.visible = false;
        } else if (value === 'away') {
          scene.dialog.setText('You avert your gaze, but the feeling of being watched lingers.');
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
          scene.dialog.setText(
            'The figure vanishes as you look away, leaving only an empty window pane behind.'
          );
        }
      });
    };
    showOptions();
  },
};