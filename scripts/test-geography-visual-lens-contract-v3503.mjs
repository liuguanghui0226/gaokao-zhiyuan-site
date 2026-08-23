#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const visualsPath = path.join(projectRoot, "data/geography/visuals.json");
const appPath = path.join(projectRoot, "site/geography/assets/app.js");
const visuals = JSON.parse(fs.readFileSync(visualsPath, "utf8"));
const appSource = fs.readFileSync(appPath, "utf8");

assert.match(appSource, /data-visual-lens/);
assert.match(appSource, /visual-lens-controls/);
assert.match(appSource, /visual-lens-detail/);

for (const card of visuals.cards) {
  assert.ok(Array.isArray(card.lenses) && card.lenses.length === 3, `${card.id} needs three observation lenses`);
  assert.equal(new Set(card.lenses.map((lens) => lens.id)).size, 3, `${card.id} lens ids must be unique`);
  assert.ok(card.lenses.every((lens) => lens.id && lens.label && lens.detail), `${card.id} lenses need ids, labels and details`);
}

const bootIndex = appSource.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "standalone app must retain a boot failure boundary");
const view = { innerHTML: "" };
const detail = { textContent: "" };
const current = { textContent: "" };
const lensButtons = visuals.cards[0].lenses.map((lens) => ({
  dataset: { visualLens: lens.id, visualLensCard: visuals.cards[0].id },
  attributes: {},
  classList: {
    toggle() {},
  },
  addEventListener(name, handler) {
    this.listenerName = name;
    this.listener = handler;
  },
  setAttribute(name, value) {
    this.attributes[name] = value;
  },
}));
const elements = new Map([["#geographyApp", view]]);
const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__geographyTest = { renderVisualLearning, bindVisualLensEvents, filteredVisuals, state };`;
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      if (selector === "#geographyApp") return view;
      if (selector.includes("data-visual-lens-detail")) return detail;
      if (selector.includes("data-visual-lens-current")) return current;
      return elements.get(selector) || null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-visual-lens]") return lensButtons;
      if (selector === "[data-visual-lens-card]" || selector.includes("data-visual-lens-card")) return lensButtons;
      return [];
    },
  },
});
vm.runInContext(instrumented, context, { filename: appPath });

const api = context.__geographyTest;
api.state.data = { sources: [], courses: [], items: [] };
api.state.visuals = visuals;
api.state.query = "";
api.state.course = "";
api.renderVisualLearning();

assert.equal((view.innerHTML.match(/data-visual-lens=/g) || []).length, visuals.cards.length * 3);
assert.equal((view.innerHTML.match(/class="visual-lens-controls"/g) || []).length, visuals.cards.length);
assert.equal((view.innerHTML.match(/class="visual-lens-detail"/g) || []).length, visuals.cards.length);
assert.match(view.innerHTML, /aria-pressed="true"/);
assert.match(view.innerHTML, /观察镜头/);

assert.equal(lensButtons.every((button) => button.listenerName === "click"), true);
lensButtons[1].listener();
assert.equal(detail.textContent, visuals.cards[0].lenses[1].detail);
assert.equal(current.textContent, visuals.cards[0].lenses[1].label);
assert.equal(lensButtons[1].attributes["aria-pressed"], "true");
assert.equal(lensButtons[0].attributes["aria-pressed"], "false");

api.state.query = visuals.cards[0].lenses[2].detail;
assert.equal(api.filteredVisuals().length, 1, "visual search should include observation lens labels");

console.log(JSON.stringify({
  ok: true,
  visualCards: visuals.cards.length,
  lensesPerCard: 3,
  interaction: "switchable-observation-lenses",
}, null, 2));
