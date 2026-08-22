#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.indexOf("async function boot()");
if (bootIndex < 0) throw new Error("Could not find app boot boundary");

assert.match(source, /id="recommendResultRegion"[^>]*role="region"/);
assert.match(source, /id="recommendResultRegion"[^>]*aria-live="polite"/);
assert.match(source, /id="recommendResultRegion"[^>]*tabindex="-1"/);
assert.match(source, /focusRecommendationResults\(\);/);
assert.match(source, /推荐结果已生成，已跳转到结果区域/);

let focusOptions = null;
const region = {
  focus(options) {
    focusOptions = options;
  },
};
const status = { textContent: "" };
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__recommendationResultFocusTest = { focusRecommendationResults };`;
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      if (selector === "#recommendResultRegion") return region;
      if (selector === "#recommendStatus") return status;
      return null;
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });

const api = context.__recommendationResultFocusTest;
assert.equal(api.focusRecommendationResults(), true);
assert.equal(focusOptions.preventScroll, false);
assert.equal(status.textContent, "推荐结果已生成，已跳转到结果区域。");

console.log(JSON.stringify({
  ok: true,
  resultRegionIsLive: true,
  focusMovedToResults: true,
  completionAnnouncement: true,
}, null, 2));
