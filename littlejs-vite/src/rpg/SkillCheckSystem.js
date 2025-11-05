// src/rpg/SkillCheckSystem.js — 🎲 Narrative RNG skill framework + styled toast feedback
'use strict';
import { mainCanvasSize, vec2, Color, overlayContext } from 'littlejsengine';
import { TextTheme } from '../ui/TextTheme.js';

class ToastManager {
  constructor() {
    this.list = [];
    this.fontFamily = TextTheme.fontFamily;
    this.fontSize = 24;
    this.spacing = 36;
  }

  /**
   * Show a toast message. Supports inline color segments via {text,color}.
   */
  show(parts, duration = 2.8) {
    // normalize: accept either string or array of parts
    const msg = Array.isArray(parts) ? parts : [{ text: String(parts), color: '#fff' }];
    this.list.push({ parts: msg, timer: duration, alpha: 0 });
  }

  update(dt) {
    for (const t of this.list) {
      t.timer -= dt;
      if (t.timer > 0.3) t.alpha = Math.min(1, t.alpha + dt * 4);
      else t.alpha = Math.max(0, t.alpha - dt * 6);
    }
    this.list = this.list.filter(t => t.timer > 0);
  }

  draw() {
    if (!this.list.length) return;
    const ctx = overlayContext;
    const scale = window.devicePixelRatio || 1;
    const w = mainCanvasSize.x * scale;
    const h = mainCanvasSize.y * scale;
    const cx = w / 2;
    const startY = h * 0.18;
    const pad = 24 * scale;

    ctx.save();
    ctx.resetTransform?.();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${this.fontSize * scale}px ${this.fontFamily}`;

    let y = startY;
    for (const t of this.list) {
      if (t.alpha <= 0) continue;

      // measure text width by summing parts
      let textW = 0;
      for (const p of t.parts) textW += ctx.measureText(p.text).width;
      const boxW = textW + pad * 2;
      const boxH = this.fontSize * scale + pad;
      const x = cx - boxW / 2;

      ctx.globalAlpha = t.alpha * 0.7;
      ctx.fillStyle = TextTheme.boxColor.toString();
      ctx.fillRect(x, y, boxW, boxH);
      ctx.strokeStyle = TextTheme.borderColor.toString();
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(x, y, boxW, boxH);

      // draw text parts inline
      ctx.globalAlpha = t.alpha;
      let drawX = x + pad;
      for (const p of t.parts) {
        ctx.fillStyle = p.color || '#fff';
        ctx.fillText(p.text, drawX + ctx.measureText(p.text).width / 2, y + boxH / 2);
        drawX += ctx.measureText(p.text).width;
      }

      y += boxH + this.spacing * scale;
    }

    ctx.restore();
  }
}

export class SkillCheckSystem {
  constructor(inventory, scene) {
    this.inventory = inventory;
    this.scene = scene;
    this.stats = {
      willpower: 50,
      insight: 50,
      dexterity: 50,
      faith: 50,
      memory: 50,
    };
    this.failCounters = new Map();
    this.toasts = new ToastManager();
  }

  roll(type, base = 0.5, ctx = {}) {
    const skill = this._mapTypeToSkill(type);
    const stat = this.stats[skill] ?? 50;
    let chance = base * 100 + (stat - 50) * 0.5;
    const itemMod = this._applyItemMods(type, ctx);
    const envMod = this._applyEnvMods(ctx);
    chance += itemMod + envMod;
    chance = Math.max(1, Math.min(99, chance));

    const roll = Math.floor(Math.random() * 100) + 1;
    const success = roll <= chance;
    const label = success ? 'Success' : 'Fail';

    // 🎨 Color only the "Success"/"Fail" word
    this.toasts.show([
      { text: `${type.charAt(0).toUpperCase() + type.slice(1)} Check: `, color: '#fff' },
      { text: label, color: success ? '#8f8' : '#f77' }
    ]);

    console.groupCollapsed(`🎲 [SkillCheck] ${type.toUpperCase()} (${skill})`);
    console.log(`• Stat: ${stat} | Roll: ${roll}/${chance.toFixed(1)}% → ${success ? '✅' : '❌'}`);
    console.groupEnd();

    return { success, roll, total: chance };
  }

  update(dt) { this.toasts.update(dt); }
  draw() { this.toasts.draw(); }

  _mapTypeToSkill(type) {
    switch (type) {
      case 'resonance': return 'willpower';
      case 'decay': return 'dexterity';
      case 'memory': return 'memory';
      case 'faith': return 'faith';
      default: return 'insight';
    }
  }

  _applyItemMods(type, ctx) {
    let mod = 0;
    for (const it of this.inventory.items) {
      if (type === 'resonance' && it.id === 'music_box') mod += 15;
      if (type === 'decay' && it.id === 'rusty_key') {
        const fails = this.failCounters.get(it.id) || 0;
        mod -= fails * 8;
      }
    }
    return mod;
  }

  _applyEnvMods(ctx) {
    let mod = 0;
    if (ctx.environment === 'dark') mod -= 10;
    if (ctx.lightning) mod += 12;
    if (ctx.stress) mod -= ctx.stress * 5;
    return mod;
  }

  registerFailure(itemId) {
    const c = this.failCounters.get(itemId) || 0;
    this.failCounters.set(itemId, c + 1);
    if (c + 1 >= 3) this._breakItem(itemId);
    else console.warn(`[SkillCheck] ${itemId} degradation: ${c + 1}/3`);
  }

  _breakItem(itemId) {
    const idx = this.inventory.items.findIndex(i => i.id === itemId);
    if (idx >= 0) {
      console.warn(`[SkillCheck] ${itemId} has broken!`);
      this.inventory.items.splice(idx, 1);
      if (this.scene?.dialog) {
        this.scene.dialog.setMode('monologue');
        this.scene.dialog.setText('The rusty key snaps in the lock.');
        this.scene.dialog.visible = true;
      }
      this.toasts.show([{ text: `${itemId} broke!`, color: '#ff8080' }], 3);
    }
  }
}
