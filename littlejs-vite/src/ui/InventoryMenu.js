// src/ui/InventoryMenu.js — 🧩 Resident Evil–style inventory + item stat modifiers in tooltip
'use strict';
import {
  overlayContext,
  mainCanvasSize,
  keyWasPressed,
  mousePosScreen,
  mouseWasPressed,
  mouseIsDown,
} from 'littlejsengine';
import { TextTheme } from './TextTheme.js';
import { requestPointer } from './CursorManager.js';

export class InventoryMenu {
  constructor() {
    this.visible = false;
    this.columns = 4;
    this.rows = 3;
    this.slotSize = 80;
    this.outerMargin = 16;
    this.fade = 0;
    this.items = [];
    this.selectedIndex = 0;
    this.hoverIndex = -1;
    this.draggingItem = null;
    this.dragOrigin = null;
    this.dragOffset = { x: 0, y: 0 };
    this.onUse = null;
    this.fontFamily = TextTheme.fontFamily;
    this._iconCache = new Map();
  }

  _ensureImage(iconPath) {
    if (!iconPath) return null;
    if (this._iconCache.has(iconPath)) return this._iconCache.get(iconPath);
    const img = new Image();
    img.src = iconPath;
    this._iconCache.set(iconPath, img);
    return img;
  }

  _isOccupied(x, y, w, h, ignoreItem = null) {
    for (const it of this.items) {
      if (it === ignoreItem) continue;
      if (
        x < it.slotX + it.gridW &&
        x + w > it.slotX &&
        y < it.slotY + it.gridH &&
        y + h > it.slotY
      ) return true;
    }
    return false;
  }

  _findFreeSlot(w, h) {
    for (let y = 0; y <= this.rows - h; y++) {
      for (let x = 0; x <= this.columns - w; x++) {
        if (!this._isOccupied(x, y, w, h)) return { x, y };
      }
    }
    return null;
  }

  /**
   * Add an item to the inventory.
   * @param {string} id
   * @param {string} name
   * @param {string} iconPath
   * @param {string} desc
   * @param {number} count
   * @param {number} gridW
   * @param {number} gridH
   * @param {object} mods  Example: { willpower:+10, faith:-5 }
   */
  addItem(id, name, iconPath, desc, count = 1, gridW, gridH, mods = null) {
    const existing = this.items.find(i => i.id === id);
    if (existing) {
      existing.count += count;
      return;
    }
    const img = this._ensureImage(iconPath);
    let w = gridW || 1, h = gridH || 1;

    img.onload = () => {
      w = gridW || Math.max(1, Math.round(img.width / this.slotSize));
      h = gridH || Math.max(1, Math.round(img.height / this.slotSize));
      const item = this.items.find(it => it.id === id);
      if (item) { item.gridW = w; item.gridH = h; }
    };

    const slot = this._findFreeSlot(w, h);
    if (!slot) {
      console.warn(`[InventoryMenu] ❌ No free slot for ${id}`);
      return;
    }

    this.items.push({
      id, name, iconPath, iconImage: img, desc, count,
      gridW: w, gridH: h, slotX: slot.x, slotY: slot.y,
      mods
    });
    console.log(`[InventoryMenu] ✅ Placed ${id} at ${slot.x},${slot.y}`);
  }

  toggle() { this.visible = !this.visible; this.fade = 0; }

  update(dt) {
    const target = this.visible ? 1 : 0;
    this.fade += (target - this.fade) * dt * 8;
    this.fade = Math.max(0, Math.min(1, this.fade));
    if (!this.items.length) return;

    if (keyWasPressed('ArrowRight')) this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
    if (keyWasPressed('ArrowLeft')) this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
    if (this.visible && keyWasPressed('Escape')) this.visible = false;
    if (keyWasPressed('Enter') && this.items[this.selectedIndex] && this.onUse)
      this.onUse(this.items[this.selectedIndex]);

    const { boxX, boxY, uiScale } = this._layout();
    const mx = mousePosScreen.x * uiScale;
    const my = mousePosScreen.y * uiScale;
    this.hoverIndex = -1;

    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const gx = boxX + this.outerMargin + it.slotX * this.slotSize;
      const gy = boxY + 40 * uiScale + this.outerMargin + it.slotY * this.slotSize;
      const gw = it.gridW * this.slotSize;
      const gh = it.gridH * this.slotSize;
      if (mx >= gx && mx <= gx + gw && my >= gy && my <= gy + gh) {
        this.hoverIndex = i;
        requestPointer();
        if (mouseWasPressed(0)) {
          this.draggingItem = it;
          this.dragOrigin = { x: it.slotX, y: it.slotY };
          this.dragOffset.x = mx - gx;
          this.dragOffset.y = my - gy;
        }
      }
    }

    if (this.draggingItem && !mouseIsDown(0)) {
      const it = this.draggingItem;
      const gridLeft = boxX + this.outerMargin;
      const gridTop = boxY + 40 * uiScale + this.outerMargin;
      const col = Math.floor((mx - gridLeft - (it.gridW * this.slotSize) / 2) / this.slotSize);
      const row = Math.floor((my - gridTop - (it.gridH * this.slotSize) / 2) / this.slotSize);
      const clampedCol = Math.max(0, Math.min(this.columns - it.gridW, col));
      const clampedRow = Math.max(0, Math.min(this.rows - it.gridH, row));
      const validDrop = !this._isOccupied(clampedCol, clampedRow, it.gridW, it.gridH, it);
      if (validDrop) { it.slotX = clampedCol; it.slotY = clampedRow; }
      else { it.slotX = this.dragOrigin.x; it.slotY = this.dragOrigin.y; }
      this.draggingItem = null;
      this.dragOrigin = null;
    }
  }

  _layout() {
    const uiScale = window.devicePixelRatio || 1;
    const canvasW = mainCanvasSize.x * uiScale;
    const canvasH = mainCanvasSize.y * uiScale;
    const panelW = this.columns * this.slotSize + this.outerMargin * 2;
    const panelH = this.rows * this.slotSize + this.outerMargin * 3 + 100;
    const boxX = (canvasW - panelW) / 2;
    const boxY = (canvasH - panelH) / 2;
    return { uiScale, canvasW, canvasH, panelW, panelH, boxX, boxY };
  }

  draw() {
    if (!this.visible || this.fade <= 0) return;
    const { uiScale, canvasW, canvasH, panelW, panelH, boxX, boxY } = this._layout();

    overlayContext.save();
    overlayContext.globalAlpha = this.fade * 0.8;
    overlayContext.fillStyle = 'rgba(0,0,0,0.85)';
    overlayContext.fillRect(0, 0, canvasW, canvasH);
    overlayContext.restore();

    overlayContext.save();
    overlayContext.globalAlpha = this.fade;
    overlayContext.fillStyle = TextTheme.boxColor.toString();
    overlayContext.fillRect(boxX, boxY, panelW, panelH);
    overlayContext.strokeStyle = TextTheme.borderColor.toString();
    overlayContext.lineWidth = 3 * uiScale;
    overlayContext.strokeRect(boxX - 2, boxY - 2, panelW + 4, panelH + 4);

    overlayContext.font = `${22 * uiScale}px ${this.fontFamily}`;
    overlayContext.textAlign = 'center';
    overlayContext.textBaseline = 'top';
    overlayContext.fillStyle = '#fff';
    overlayContext.fillText('INVENTORY', boxX + panelW / 2, boxY + 10 * uiScale);

    const gridTop = boxY + 40 * uiScale + this.outerMargin;
    const gridLeft = boxX + this.outerMargin;

    overlayContext.strokeStyle = 'rgba(255,255,255,0.2)';
    overlayContext.lineWidth = 1;
    for (let r = 0; r <= this.rows; r++) {
      const y = gridTop + r * this.slotSize;
      overlayContext.beginPath();
      overlayContext.moveTo(gridLeft, y);
      overlayContext.lineTo(gridLeft + this.columns * this.slotSize, y);
      overlayContext.stroke();
    }
    for (let c = 0; c <= this.columns; c++) {
      const x = gridLeft + c * this.slotSize;
      overlayContext.beginPath();
      overlayContext.moveTo(x, gridTop);
      overlayContext.lineTo(x, gridTop + this.rows * this.slotSize);
      overlayContext.stroke();
    }

    for (const it of this.items) {
      if (it === this.draggingItem) continue;
      const gx = gridLeft + it.slotX * this.slotSize;
      const gy = gridTop + it.slotY * this.slotSize;
      const gw = it.gridW * this.slotSize;
      const gh = it.gridH * this.slotSize;
      const selected = this.items[this.selectedIndex] === it || this.items[this.hoverIndex] === it;

      overlayContext.fillStyle = selected ? 'rgba(120,255,120,0.15)' : 'rgba(255,255,255,0.05)';
      overlayContext.fillRect(gx, gy, gw, gh);
      overlayContext.strokeStyle = selected ? 'rgba(120,255,120,0.7)' : 'rgba(255,255,255,0.15)';
      overlayContext.strokeRect(gx, gy, gw, gh);

      const img = it.iconImage;
      if (img && img.complete)
        overlayContext.drawImage(img, gx + 4, gy + 4, gw - 8, gh - 8);
    }

    // Tooltip with modifiers
    if (this.hoverIndex >= 0) {
  const it = this.items[this.hoverIndex];
  const mx = mousePosScreen.x * uiScale;
  const my = mousePosScreen.y * uiScale;
  const tooltipW = 300 * uiScale;
  const maxTextW = tooltipW - 28 * uiScale;

  // Measure description lines first
  overlayContext.font = `${20 * uiScale}px ${this.fontFamily}`;
  const wrapped = this._wrapText(it.desc || '', maxTextW);
  const descH = wrapped.length * 24 * uiScale;

  // Measure modifier lines (if any)
  let modH = 0;
  if (it.mods && Object.keys(it.mods).length)
    modH = 28 * uiScale + Object.keys(it.mods).length * 22 * uiScale;

  // Dynamic tooltip height
  const tooltipH = 70 * uiScale + descH + modH;
  const tx = Math.min(mx + 20, canvasW - tooltipW - 10);
  const ty = Math.min(my + 20, canvasH - tooltipH - 10);

  // Background and border
  overlayContext.fillStyle = 'rgba(0,0,0,0.9)';
  overlayContext.fillRect(tx, ty, tooltipW, tooltipH);
  overlayContext.strokeStyle = 'rgba(255,255,255,0.25)';
  overlayContext.strokeRect(tx, ty, tooltipW, tooltipH);

  // Title
  overlayContext.font = `${19 * uiScale}px ${this.fontFamily}`;
  overlayContext.fillStyle = '#fff';
  overlayContext.textAlign = 'left';
  overlayContext.textBaseline = 'top';
  overlayContext.fillText(it.name, tx + 12, ty + 10);

  // Description (wrapped)
  overlayContext.font = `${20 * uiScale}px ${this.fontFamily}`;
  overlayContext.fillStyle = 'rgba(255,255,255,0.85)';
  let yy = ty + 34 * uiScale;
  for (const line of wrapped) {
    overlayContext.fillText(line, tx + 12, yy);
    yy += 24 * uiScale;
  }

  // Modifiers (if any)
  if (it.mods && Object.keys(it.mods).length) {
    yy += 8 * uiScale;
    overlayContext.font = `${18 * uiScale}px ${this.fontFamily}`;
    overlayContext.fillStyle = 'rgba(255,255,255,0.75)';
    overlayContext.fillText('Modifiers:', tx + 12, yy);
    yy += 20 * uiScale;

    for (const [stat, val] of Object.entries(it.mods)) {
      const color = val > 0 ? '#80ff80' : '#ff8080';
      const sign = val > 0 ? '+' : '';
      overlayContext.fillStyle = color;
      overlayContext.fillText(`• ${stat.charAt(0).toUpperCase() + stat.slice(1)} ${sign}${val}`, tx + 20, yy);
      yy += 20 * uiScale;
    }
  }
}

    overlayContext.restore();
  }

  _wrapText(text, maxWidth) {
    const ctx = overlayContext;
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
}
