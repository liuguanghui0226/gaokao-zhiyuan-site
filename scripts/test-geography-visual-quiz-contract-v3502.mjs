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

assert.match(appSource, /data-visual-quiz/);
assert.match(appSource, /visual-quiz/);
assert.match(appSource, /先观察/);

for (const card of visuals.cards) {
  assert.ok(card.quiz, `${card.id} needs a visual self-check question`);
  assert.ok(card.quiz.prompt, `${card.id} quiz needs a prompt`);
  assert.ok(Array.isArray(card.quiz.options) && card.quiz.options.length === 3, `${card.id} quiz needs exactly three options`);
  assert.ok(card.quiz.options.every((option) => option.label && option.detail), `${card.id} quiz options need labels and explanations`);
  assert.equal(Number.isInteger(card.quiz.answerIndex), true, `${card.id} quiz needs an answer index`);
  assert.ok(card.quiz.answerIndex >= 0 && card.quiz.answerIndex < card.quiz.options.length, `${card.id} quiz answer index must point to an option`);
  assert.ok(card.quiz.explanation, `${card.id} quiz needs a learning explanation`);
}

const bootIndex = appSource.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "standalone app must retain a boot failure boundary");
const view = { innerHTML: "" };
const elements = new Map([["#geographyApp", view]]);
const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__geographyTest = { renderVisualLearning, state };`;
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      return elements.get(selector) || null;
    },
    querySelectorAll() {
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

assert.equal((view.innerHTML.match(/class="visual-quiz"/g) || []).length, visuals.cards.length);
assert.match(view.innerHTML, /先观察图示，再选择最合理的解释/);
assert.match(view.innerHTML, /data-visual-quiz=/);
assert.match(view.innerHTML, /<details class="visual-quiz"[^>]*>/);
assert.match(view.innerHTML, /class="visual-quiz-options"/);
assert.match(view.innerHTML, /class="visual-quiz-answer"/);
assert.match(view.innerHTML, /正确思路/);
assert.match(fs.readFileSync(path.join(projectRoot, "site/geography/assets/styles.css"), "utf8"), /\.visual-quiz/);

console.log(JSON.stringify({
  ok: true,
  visualCards: visuals.cards.length,
  quizOptionsPerCard: 3,
  interaction: "native-details-reveal",
}, null, 2));
