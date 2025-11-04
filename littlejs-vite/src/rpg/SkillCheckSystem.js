// src/rpg/SkillCheckSystem.js — 🎲 Narrative RNG skill framework (with full debug logging)
'use strict';

/**
 * SkillCheckSystem
 * ----------------
 * Handles thematic RNG skill checks (Willpower, Insight, Dexterity, Faith, Memory).
 * Supports item + environment modifiers and persistent degradation (e.g., Decay).
 */
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
    this.failCounters = new Map(); // e.g., keyID → failCount
  }

  /**
   * Run a named check with contextual modifiers and narrative hooks.
   * @param {string} type - e.g. "resonance", "decay", "memory", "faith"
   * @param {number} base - base chance 0–1
   * @param {object} ctx - context (environment, stress, item, etc.)
   * @returns {{success:boolean, roll:number, total:number, flavor:string}}
   */
  roll(type, base = 0.5, ctx = {}) {
    const skill = this._mapTypeToSkill(type);
    const stat = this.stats[skill] ?? 50;

    // Base and stat adjustment
    let chance = base * 100 + (stat - 50) * 0.5;

    const itemMod = this._applyItemMods(type, ctx);
    const envMod = this._applyEnvMods(ctx);

    chance += itemMod + envMod;
    chance = Math.max(1, Math.min(99, chance));

    const roll = Math.floor(Math.random() * 100) + 1;
    const success = roll <= chance;
    const flavor = this._getFlavor(type, success, roll, chance);

    // 🧾 Detailed console output for testing and balancing
    console.groupCollapsed(`🎲 [SkillCheck] ${type.toUpperCase()} (${skill})`);
    console.log(`• Stat value: ${stat}`);
    console.log(`• Base chance: ${(base * 100).toFixed(1)}%`);
    console.log(`• Stat influence: ${(stat - 50) * 0.5 >= 0 ? '+' : ''}${((stat - 50) * 0.5).toFixed(1)}%`);
    console.log(`• Item modifier: ${itemMod >= 0 ? '+' : ''}${itemMod.toFixed(1)}%`);
    console.log(`• Env modifier: ${envMod >= 0 ? '+' : ''}${envMod.toFixed(1)}%`);
    console.log(`→ Final total chance: ${chance.toFixed(1)}%`);
    console.log(`→ Roll result: ${roll}  → ${success ? '✅ SUCCESS' : '❌ FAIL'}`);
    console.log(`→ Flavor: ${flavor}`);
    console.groupEnd();

    return { success, roll, total: chance, flavor };
  }

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
        mod -= fails * 8; // each failure rusts further
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

  _getFlavor(type, success, roll, chance) {
    switch (type) {
      case 'resonance':
        return success
          ? 'The melody hums softly. The fog recedes.'
          : 'A warped note rings out. Whispers answer from the dark.';
      case 'decay':
        return success
          ? 'The key turns with effort. Metal groans, but holds.'
          : 'The rust flakes away. The teeth of the key bend slightly.';
      case 'memory':
        return success
          ? 'Fragments align — the truth resurfaces.'
          : 'Images twist. A false memory takes hold.';
      case 'faith':
        return success
          ? 'A faint warmth steadies your heart.'
          : 'Cold breath brushes your neck. The shadows lengthen.';
      default:
        return success ? 'You succeed.' : 'You fail.';
    }
  }

  // 🧩 Optional decay tracking for items (e.g., rusty key)
  registerFailure(itemId) {
    const c = this.failCounters.get(itemId) || 0;
    this.failCounters.set(itemId, c + 1);
    if (c + 1 >= 3) {
      this._breakItem(itemId);
    } else {
      console.warn(`[SkillCheck] ${itemId} degradation: ${c + 1} / 3`);
    }
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
    }
  }
}
