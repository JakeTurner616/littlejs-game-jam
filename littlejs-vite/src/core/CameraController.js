// src/core/CameraController.js
'use strict';
import { vec2, setCameraPos, setCameraScale } from 'littlejsengine';

export class CameraController {
  constructor() {
    this.target = null;
    this.pos = vec2(0, 0);
    this.scale = 128;
    this.targetScale = 128;
    this.cinematic = null;
  }

  setTarget(entity) {
    this.target = entity;
    this.pos = entity.pos.copy();
  }

  snapToTarget() {
    if (this.target) {
      this.pos = this.target.pos.copy();
      setCameraPos(this.pos);
      setCameraScale(this.scale);
    }
  }

  startCinematic(targetPos, zoom = 170) {
    this.cinematic = {
      phase: 'in',
      timer: 0,
      focus: targetPos,
      zoom,
      baseScale: this.scale,
    };
  }

  update(dt) {
    if (!this.target) return;

    if (this.cinematic) {
      const lerp = (a, b, s) => a + (b - a) * (1 - Math.pow(0.001, s));
      const lerpVec = (v, t, s) => vec2(
        v.x + (t.x - v.x) * (1 - Math.pow(0.001, s)),
        v.y + (t.y - v.y) * (1 - Math.pow(0.001, s))
      );

      if (this.cinematic.phase === 'in') {
        this.pos = lerpVec(this.pos, this.cinematic.focus, dt * 60);
        this.scale = lerp(this.scale, this.cinematic.zoom, dt * 3);
        setCameraPos(this.pos);
        setCameraScale(this.scale);
        this.cinematic.timer += dt;
        if (this.cinematic.timer > 2) {
          this.cinematic.phase = 'out';
          this.cinematic.timer = 0;
        }
      } else if (this.cinematic.phase === 'out') {
        this.pos = lerpVec(this.pos, this.target.pos, dt * 80);
        this.scale = lerp(this.scale, this.cinematic.baseScale, dt * 5);
        setCameraPos(this.pos);
        setCameraScale(this.scale);
        const dist = this.pos.distance(this.target.pos);
        const diff = Math.abs(this.scale - this.cinematic.baseScale);
        if (dist < 0.02 && diff < 0.2) this.cinematic = null;
      }
    } else {
      this.pos = this.pos.lerp(this.target.pos, 1 - Math.pow(0.001, 1));
      setCameraPos(this.pos);
      setCameraScale(this.targetScale);
    }
  }
}
