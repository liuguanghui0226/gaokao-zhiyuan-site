#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(root, "site/assets/app.js");
const app = fs.readFileSync(appFile, "utf8");
const bootIndex = app.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

assert.match(
  app,
  /id="scoreInput"[^>]*max="\$\{esc\(String\(scoreFieldMax\)\)\}"/,
  "The score input maximum must reflect the selected province",
);
assert.match(
  app,
  /scoreInput\.max = String\(scoreScaleForProvince\(province\)\)/,
  "Changing province must refresh the browser-level score constraint",
);

const instrumented = `${app.slice(0, bootIndex)}
globalThis.__gaokaoTest = { state, recommendationValidationIssues, renderRecommendForm, scoreScaleForProvince };`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: appFile });
const { state, recommendationValidationIssues, renderRecommendForm, scoreScaleForProvince } = context.__gaokaoTest;

state.data = {
  disciplines: [],
  admissionScoreLayer: { rankConversions: [] },
};

assert.equal(scoreScaleForProvince("上海市"), 660);
assert.equal(scoreScaleForProvince("海南省"), 900);
assert.equal(scoreScaleForProvince("江西省"), 750);

const scoreIssues = (province, score) => JSON.parse(JSON.stringify(
  recommendationValidationIssues({ province, score, rank: "" })
    .filter((issue) => issue.fieldId === "scoreInput"),
));

assert.deepEqual(scoreIssues("江西", "750"), []);
assert.deepEqual(scoreIssues("江西", "751"), [
  { fieldId: "scoreInput", message: "江西高考总分应在0至750之间" },
]);
assert.deepEqual(scoreIssues("上海", "660"), []);
assert.deepEqual(scoreIssues("上海", "661"), [
  { fieldId: "scoreInput", message: "上海高考总分应在0至660之间" },
]);
assert.deepEqual(scoreIssues("海南", "900"), []);
assert.deepEqual(scoreIssues("海南", "901"), [
  { fieldId: "scoreInput", message: "海南高考总分应在0至900之间" },
]);
assert.deepEqual(scoreIssues("江西", "1001"), [
  { fieldId: "scoreInput", message: "高考总分应在0至1000之间" },
], "The legacy global guard remains stable for obviously malformed scores");

assert.match(renderRecommendForm({ province: "上海", score: "660" }), /id="scoreInput"[^>]*max="660"/);
assert.match(renderRecommendForm({ province: "海南", score: "900" }), /id="scoreInput"[^>]*max="900"/);
assert.match(renderRecommendForm({ province: "江西", score: "750" }), /id="scoreInput"[^>]*max="750"/);

console.log(JSON.stringify({
  status: "ok",
  defaultMax: 750,
  shanghaiMax: 660,
  hainanMax: 900,
  dynamicInputConstraint: true,
}, null, 2));
