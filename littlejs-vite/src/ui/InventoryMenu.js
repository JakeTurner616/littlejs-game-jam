// src/ui/InventoryMenu.js — 🧩 Connected-grid Resident Evil–style inventory (drag, hover info)
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

  addItem(id, name, iconPath, desc, count = 1, gridW, gridH) {
    const existing = this.items.find(i => i.id === id);
    if (existing) {
      existing.count += count;
      return;
    }
    const img = this._ensureImage(iconPath);
    let w = gridW || 1;
    let h = gridH || 1;
    img.onload = () => {
      w = gridW || Math.max(1, Math.round(img.width / this.slotSize));
      h = gridH || Math.max(1, Math.round(img.height / this.slotSize));
      console.log(`[InventoryMenu] 🧩 ${id} size detected: ${w}x${h}`);
      const item = this.items.find(it => it.id === id);
      if (item) { item.gridW = w; item.gridH = h; }
    };
    this.items.push({
      id, name, iconPath, iconImage: img, desc, count,
      gridW: w, gridH: h, slotX: 0, slotY: 0
    });
  }

  toggle() {
    this.visible = !this.visible;
    this.fade = 0;
    console.log(`[InventoryMenu] visibility = ${this.visible}`);
  }

  update(dt) {
    const target = this.visible ? 1 : 0;
    this.fade += (target - this.fade) * dt * 8;
    this.fade = Math.max(0, Math.min(1, this.fade));
    if (!this.items.length) return;

    if (keyWasPressed('ArrowRight')) this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
    if (keyWasPressed('ArrowLeft')) this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
    if (keyWasPressed('ArrowDown')) this.selectedIndex = (this.selectedIndex + this.columns) % this.items.length;
    if (keyWasPressed('ArrowUp')) this.selectedIndex = (this.selectedIndex - this.columns + this.items.length) % this.items.length;

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
          this.dragOffset.x = mx - gx;
          this.dragOffset.y = my - gy;
        }
      }
    }

    if (this.draggingItem && !mouseIsDown(0)) {
      const it = this.draggingItem;
      const gridLeft = boxX + this.outerMargin;
      const gridTop = boxY + 40 * uiScale + this.outerMargin;
      const col = Math.floor((mx - gridLeft) / this.slotSize);
      const row = Math.floor((my - gridTop) / this.slotSize);
      if (row >= 0 && col >= 0 && col + it.gridW <= this.columns && row + it.gridH <= this.rows) {
        it.slotX = col;
        it.slotY = row;
        console.log(`[InventoryMenu] 📦 Moved ${it.id} to ${col},${row}`);
      }
      this.draggingItem = null;
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

    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it === this.draggingItem) continue;
      const gx = gridLeft + it.slotX * this.slotSize;
      const gy = gridTop + it.slotY * this.slotSize;
      const gw = it.gridW * this.slotSize;
      const gh = it.gridH * this.slotSize;
      const selected = i === this.selectedIndex || i === this.hoverIndex;

      overlayContext.fillStyle = selected ? 'rgba(120,255,120,0.15)' : 'rgba(255,255,255,0.05)';
      overlayContext.fillRect(gx, gy, gw, gh);
      overlayContext.strokeStyle = selected ? 'rgba(120,255,120,0.7)' : 'rgba(255,255,255,0.15)';
      overlayContext.strokeRect(gx, gy, gw, gh);

      const img = it.iconImage;
      if (img && img.complete && img.naturalWidth > 0)
        overlayContext.drawImage(img, gx + 4, gy + 4, gw - 8, gh - 8);

      if (it.count > 1) {
        overlayContext.fillStyle = '#fff';
        overlayContext.font = `${14 * uiScale}px ${this.fontFamily}`;
        overlayContext.textAlign = 'right';
        overlayContext.textBaseline = 'bottom';
        overlayContext.fillText(`x${it.count}`, gx + gw - 4, gy + gh - 4);
      }
    }

    if (this.draggingItem) {
      const it = this.draggingItem;
      const img = it.iconImage;
      const gw = it.gridW * this.slotSize;
      const gh = it.gridH * this.slotSize;
      const gx = mousePosScreen.x * uiScale - this.dragOffset.x;
      const gy = mousePosScreen.y * uiScale - this.dragOffset.y;
      overlayContext.globalAlpha = 0.8;
      overlayContext.fillStyle = 'rgba(120,255,120,0.1)';
      overlayContext.fillRect(gx, gy, gw, gh);
      if (img && img.complete)
        overlayContext.drawImage(img, gx + 4, gy + 4, gw - 8, gh - 8);
      overlayContext.globalAlpha = 1;
    }

    if (this.hoverIndex >= 0) {
  const it = this.items[this.hoverIndex];
  const mx = mousePosScreen.x * uiScale;
  const my = mousePosScreen.y * uiScale;
  const tooltipW = 280 * uiScale;
  const tooltipH = 110 * uiScale;
  const tx = Math.min(mx + 20, canvasW - tooltipW - 10);
  const ty = Math.min(my + 20, canvasH - tooltipH - 10);

  overlayContext.fillStyle = 'rgba(0,0,0,0.88)';
  overlayContext.fillRect(tx, ty, tooltipW, tooltipH);
  overlayContext.strokeStyle = 'rgba(255,255,255,0.25)';
  overlayContext.strokeRect(tx, ty, tooltipW, tooltipH);

  // 🏷️ Larger item name
  overlayContext.font = `${19 * uiScale}px ${this.fontFamily}`;
  overlayContext.fillStyle = '#fff';
  overlayContext.textAlign = 'left';
  overlayContext.textBaseline = 'top';
  overlayContext.fillText(it.name, tx + 12, ty + 10);

  // 📝 Larger description text
  overlayContext.font = `${25.5 * uiScale}px ${this.fontFamily}`;
  overlayContext.fillStyle = 'rgba(255,255,255,0.85)';
  const wrapped = this._wrapText(it.desc || '', tooltipW - 24);
  let yy = ty + 34;
  for (const line of wrapped) {
    overlayContext.fillText(line, tx + 12, yy);
    yy += 29 * uiScale;
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
