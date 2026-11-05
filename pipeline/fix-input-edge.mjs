// pipeline/fix-input-edge.mjs — одноразовый патч движка:
// на 120–144 Гц кадр может не содержать fixed-step, а безусловный postUpdate()
// съедал pointerdown/нажатия до того, как update() их увидит (~50–70% тапов).
// Патч: edge-флаги ввода гасим только если был хотя бы один шаг update (или пауза).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const games = fs.readdirSync(path.join(root, 'games'));
let patched = 0, skipped = 0;

const from = `    if (E.capture && E.capture.record > 0) {
      // record-режим: игровое время привязано к wall-clock, не к частоте RAF.
      this._acc += dt;
      var n = 0, maxSteps = 60; // защита от спирали после сворачивания вкладки
      while (this._acc >= this.fixedDt && n < maxSteps) {
        if (!this.isPaused()) this.update(this.fixedDt);
        this._acc -= this.fixedDt; n++;
      }
      if (n === maxSteps) this._acc = 0;
    } else {
      this._acc += dt * this.timeScale;
      var steps2 = 0;
      while (this._acc >= this.fixedDt && steps2 < 5) {
        if (!this.isPaused()) this.update(this.fixedDt);
        this._acc -= this.fixedDt; steps2++;
      }
      if (steps2 === 5) this._acc = 0;
    }

    this.render();
    if (E.input) E.input.postUpdate();`;

const to = `    var didUpdate = false;
    if (E.capture && E.capture.record > 0) {
      // record-режим: игровое время привязано к wall-clock, не к частоте RAF.
      this._acc += dt;
      var n = 0, maxSteps = 60; // защита от спирали после сворачивания вкладки
      while (this._acc >= this.fixedDt && n < maxSteps) {
        if (!this.isPaused()) { this.update(this.fixedDt); didUpdate = true; }
        this._acc -= this.fixedDt; n++;
      }
      if (n === maxSteps) this._acc = 0;
    } else {
      this._acc += dt * this.timeScale;
      var steps2 = 0;
      while (this._acc >= this.fixedDt && steps2 < 5) {
        if (!this.isPaused()) { this.update(this.fixedDt); didUpdate = true; }
        this._acc -= this.fixedDt; steps2++;
      }
      if (steps2 === 5) this._acc = 0;
    }

    this.render();
    // Edge-флаги ввода гасим ТОЛЬКО если был хотя бы один fixed-step (или игра на паузе):
    // при 120–144 Гц кадр может не содержать шага, и безусловный postUpdate() съедал
    // pointerdown/нажатия раньше, чем update() успевал их увидеть.
    if (E.input && (didUpdate || this.isPaused())) E.input.postUpdate();`;

for (const g of games) {
  const f = path.join(root, 'games', g, 'engine', 'core.js');
  if (!fs.existsSync(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  if (src.indexOf(to) >= 0) { skipped++; continue; }
  if (src.indexOf(from) < 0) { console.log('NO MATCH', g); continue; }
  fs.writeFileSync(f, src.replace(from, to));
  patched++;
}
console.log('patched', patched, 'already', skipped);
