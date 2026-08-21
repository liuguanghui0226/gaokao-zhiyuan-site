#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
assert.ok(source.includes("state.prefillProfile = loadSavedRecommendationProfile();"));
assert.ok(source.includes("saveCurrentRecommendationDraft();"));
assert.ok(source.includes("表单草稿仅保存在本机浏览器"));
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const storage = new Map();
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = {
  RECOMMEND_PROFILE_STORAGE_KEY,
  loadSavedRecommendationProfile,
  saveRecommendationProfile,
  clearSavedRecommendationProfile,
};`;
const context = vm.createContext({
  console,
  localStorage: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;
const profile = { province: "江西", score: "593", subject: "物理/理科", interest: "计算机" };

assert.equal(api.loadSavedRecommendationProfile(), null);
api.saveRecommendationProfile(profile);
assert.equal(JSON.stringify(api.loadSavedRecommendationProfile()), JSON.stringify(profile));

storage.set(api.RECOMMEND_PROFILE_STORAGE_KEY, "not-json");
assert.equal(api.loadSavedRecommendationProfile(), null);
storage.set(api.RECOMMEND_PROFILE_STORAGE_KEY, JSON.stringify(["not-a-profile"]));
assert.equal(api.loadSavedRecommendationProfile(), null);

api.saveRecommendationProfile(profile);
api.clearSavedRecommendationProfile();
assert.equal(api.loadSavedRecommendationProfile(), null);

console.log(JSON.stringify({ ok: true, localOnly: true, malformedDataIgnored: true, cleared: true }, null, 2));
