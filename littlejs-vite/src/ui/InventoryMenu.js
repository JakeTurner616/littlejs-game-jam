// src/ui/InventoryMenu.js — 🎒 Cinematic inventory with connected slot grid mesh + safe LittleJS image loading
'use strict';
import {
  overlayContext,
  mainCanvasSize,
  keyWasPressed,
  mousePosScreen,
  mouseWasPressed,
} from 'littlejsengine';
import { TextTheme } from './TextTheme.js';
import { requestPointer } from './CursorManager.js';

export class InventoryMenu {
  constructor() {
    this.visible = false;
    this.items = []; // {id, name, iconPath, iconImage, count, desc}
    this.selectedIndex = 0;
    this.columns = 4;
    this.rows = 3;
    this.slotSize = 80;
    this.margin = 16;
    this.fade = 0;
    this.hoverIndex = -1;
    this.onUse = null;
    this.fontFamily = TextTheme.fontFamily;
    this._iconCache = new Map(); // 🔹 cache loaded Image() objects
  }

  _ensureImage(iconPath) {
    if (!iconPath) return null;
    if (this._iconCache.has(iconPath)) return this._iconCache.get(iconPath);
    const img = new Image();
    img.src = iconPath;
    img.onload = () => console.log(`[InventoryMenu] ✅ Loaded icon: ${iconPath}`);
    img.onerror = e => console.warn(`[InventoryMenu] ⚠️ Failed to load icon: ${iconPath}`, e);
    this._iconCache.set(iconPath, img);
    return img;
  }

  addItem(id, name, iconPath, desc, count = 1) {
    const existing = this.items.find(i => i.id === id);
    if (existing) {
      existing.count += count;
      return;
    }
    const iconImage = this._ensureImage(iconPath);
    this.items.push({ id, name, iconPath, iconImage, desc, count });
  }

  toggle() {
    this.visible = !this.visible;
    this.fade = 0; // ✅ always reset fade
    console.log(`[InventoryMenu] visibility = ${this.visible}`);
  }

  update(dt) {
  // ✅ Smooth fade in/out without resetting each frame
  const target = this.visible ? 1 : 0;
  this.fade += (target - this.fade) * dt * 8;
  this.fade = Math.max(0, Math.min(1, this.fade));

  const total = this.items.length;
  if (!total) return;

  // 🔹 Navigation keys
  if (keyWasPressed('ArrowRight')) this.selectedIndex = (this.selectedIndex + 1) % total;
  if (keyWasPressed('ArrowLeft')) this.selectedIndex = (this.selectedIndex - 1 + total) % total;
  if (keyWasPressed('ArrowDown')) this.selectedIndex = (this.selectedIndex + this.columns) % total;
  if (keyWasPressed('ArrowUp')) this.selectedIndex = (this.selectedIndex - this.columns + total) % total;


  // 🔹 Use selected item
  if (keyWasPressed('Enter') && this.items[this.selectedIndex] && this.onUse)
    this.onUse(this.items[this.selectedIndex]);

  // 🔹 Mouse hover & click detection
  const { boxX, boxY, panelW, uiScale } = this._layout();
  const mx = mousePosScreen.x * uiScale;
  const my = mousePosScreen.y * uiScale;
  this.hoverIndex = -1;

  for (let i = 0; i < total; i++) {
    const col = i % this.columns;
    const row = Math.floor(i / this.columns);
    const x = boxX + this.margin + col * (this.slotSize + this.margin);
    const y = boxY + 40 * uiScale + this.margin + row * (this.slotSize + this.margin);

    if (mx >= x && mx <= x + this.slotSize && my >= y && my <= y + this.slotSize) {
      this.hoverIndex = i;
      requestPointer();
      if (mouseWasPressed(0)) {
        this.selectedIndex = i;
        if (this.onUse) this.onUse(this.items[i]);
      }
    }
  }
}
  _layout() {
    const uiScale = window.devicePixelRatio || 1; 
    const canvasW = mainCanvasSize.x * uiScale;
    const canvasH = mainCanvasSize.y * uiScale;
    const panelW = (this.slotSize + this.margin) * this.columns + this.margin * 2;
    const panelH = (this.slotSize + this.margin) * this.rows + this.margin * 3 + 100;
    const boxX = (canvasW - panelW) / 2;
    const boxY = (canvasH - panelH) / 2;
    return { uiScale, canvasW, canvasH, panelW, panelH, boxX, boxY };
  }

  draw() {
    if (!this.visible || this.fade <= 0) return;
    const { uiScale, canvasW, canvasH, panelW, panelH, boxX, boxY } = this._layout();

    overlayContext.save();
    overlayContext.globalAlpha = this.fade * 0.8;
    overlayContext.fillStyle = 'rgba(0, 0, 0, 0.85)';
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

    const gridTop = boxY + 40 * uiScale + this.margin;
    const gridLeft = boxX + this.margin;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        const i = r * this.columns + c;
        const x = gridLeft + c * (this.slotSize + this.margin);
        const y = gridTop + r * (this.slotSize + this.margin);
        const item = this.items[i];
        const selected = (i === this.selectedIndex) || (i === this.hoverIndex);

        overlayContext.fillStyle = selected
          ? 'rgba(120,255,120,0.15)'
          : 'rgba(255,255,255,0.05)';
        overlayContext.fillRect(x, y, this.slotSize, this.slotSize);

        overlayContext.strokeStyle = selected
          ? 'rgba(120,255,120,0.7)'
          : 'rgba(255,255,255,0.15)';
        overlayContext.lineWidth = 1.2 * uiScale;
        overlayContext.strokeRect(x, y, this.slotSize, this.slotSize);

        if (item) {
          const img = item.iconImage;
          if (img && img.complete && img.naturalWidth > 0) {
            overlayContext.drawImage(img, x + 8, y + 8, this.slotSize - 16, this.slotSize - 16);
          } else {
            overlayContext.fillStyle = 'rgba(255,255,255,0.1)';
            overlayContext.fillRect(x + 10, y + 10, this.slotSize - 20, this.slotSize - 20);
          }

          if (item.count > 1) {
            overlayContext.fillStyle = '#fff';
            overlayContext.font = `${14 * uiScale}px ${this.fontFamily}`;
            overlayContext.textAlign = 'right';
            overlayContext.textBaseline = 'bottom';
            overlayContext.fillText(`x${item.count}`, x + this.slotSize - 4, y + this.slotSize - 4);
          }
        }
      }
    }

    const sel = this.items[this.selectedIndex];
    if (sel) {
      overlayContext.font = `${18 * uiScale}px ${this.fontFamily}`;
      overlayContext.textAlign = 'center';
      overlayContext.textBaseline = 'top';
      overlayContext.fillStyle = '#fff';
      overlayContext.fillText(sel.name, boxX + panelW / 2, boxY + panelH - 80 * uiScale);

      overlayContext.font = `${15 * uiScale}px ${this.fontFamily}`;
      overlayContext.fillStyle = 'rgba(255,255,255,0.8)';
      const wrapped = this._wrapText(sel.desc || '', panelW * 0.8);
      let y = boxY + panelH - 55 * uiScale;
      for (const line of wrapped) {
        overlayContext.fillText(line, boxX + panelW / 2, y);
        y += 18 * uiScale;
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
