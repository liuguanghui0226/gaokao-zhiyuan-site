#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

assert.match(source, /recommendationDraftStatusText/);
assert.match(source, /syncRecommendationDraftStatus/);
assert.match(source, /已保存本机草稿/);
assert.match(source, /清除草稿并恢复示例/);
assert.match(source, /recommendDraftStatus/);

const draftStatus = { textContent: "" };
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { state, recommendationDraftStatusText, syncRecommendationDraftStatus };`;
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      return selector === "#recommendDraftStatus" ? draftStatus : null;
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });

const api = context.__gaokaoTest;
api.state.prefillProfile = null;
assert.equal(
  api.recommendationDraftStatusText(),
  "当前使用示例资料；修改后会自动保存在本机浏览器。",
);
api.syncRecommendationDraftStatus();
assert.equal(draftStatus.textContent, "当前使用示例资料；修改后会自动保存在本机浏览器。");

api.state.prefillProfile = { province: "江西", score: "593" };
assert.equal(
  api.recommendationDraftStatusText(),
  "已载入本机草稿；修改会自动保存在本机浏览器。",
);
api.syncRecommendationDraftStatus("已保存本机草稿；仅保存在此浏览器。");
assert.equal(draftStatus.textContent, "已保存本机草稿；仅保存在此浏览器。");

console.log(JSON.stringify({
  ok: true,
  distinguishesExampleFromSavedDraft: true,
  exposesLiveSaveStatus: true,
  resetActionScopeIsExplicit: true,
}, null, 2));
