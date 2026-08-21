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

const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = {
  RECOMMEND_SHORTLIST_STORAGE_KEY,
  shortlistProfileKey,
  loadRecommendationShortlist,
  saveRecommendationShortlist,
  clearRecommendationShortlist,
  recommendationExportText,
};`;
const storage = new Map();
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
const profile = {
  province: "江西",
  subject: "物理/理科",
  score: "593",
  rank: "17798",
  rankInput: "17798",
  disciplineFocus: "08",
  interest: "计算机 软件",
  cities: "南昌 武汉",
  budget: "中等敏感",
  strategy: "均衡",
};
const otherProfile = { ...profile, province: "湖南" };
const items = [
  {
    key: "jiangxi|physics|school-a|computer",
    schoolName: "示例大学",
    majorName: "计算机科学与技术",
    tierLabel: "优先核验",
    readinessLabel: "2026计划已佐证",
    sourceUrl: "https://example.com/source",
  },
  {
    key: "jiangxi|physics|school-a|computer",
    schoolName: "重复项",
    majorName: "不应覆盖原项",
  },
];

assert.equal(typeof api.RECOMMEND_SHORTLIST_STORAGE_KEY, "string");
assert.ok(api.shortlistProfileKey(profile).includes("江西"));
assert.notEqual(api.shortlistProfileKey(profile), api.shortlistProfileKey(otherProfile));
assert.equal(JSON.stringify(api.loadRecommendationShortlist(profile)), "[]");

api.saveRecommendationShortlist(profile, items);
const saved = api.loadRecommendationShortlist(profile);
assert.equal(saved.length, 1, "shortlist entries must be deduplicated by candidate key");
assert.equal(saved[0].schoolName, "示例大学");
assert.equal(JSON.stringify(api.loadRecommendationShortlist(otherProfile)), "[]", "profiles must not share shortlist items");

storage.set(api.RECOMMEND_SHORTLIST_STORAGE_KEY, "not-json");
assert.equal(JSON.stringify(api.loadRecommendationShortlist(profile)), "[]", "malformed shortlist storage must be ignored");
api.saveRecommendationShortlist(profile, [items[0]]);
api.clearRecommendationShortlist(profile);
assert.equal(JSON.stringify(api.loadRecommendationShortlist(profile)), "[]", "clearing a profile must remove only its shortlist");

const exported = api.recommendationExportText({
  generatedAt: "2026-08-22T10:00:00.000Z",
  profile,
  band: { label: "稳妥段" },
  results: [{
    title: "计算机类",
    examples: ["示例大学"],
    confidence: "A-",
    stance: "稳妥候选",
    warnings: ["2026计划待核"],
  }],
  shortlist: [items[0]],
});
assert.match(exported, /我的核验清单/);
assert.match(exported, /示例大学/);
assert.match(exported, /计算机科学与技术/);
assert.match(exported, /不等于录取概率/);
assert.ok(source.includes("加入核验清单"), "application-plan shortlist action missing");
assert.ok(source.includes("data-shortlist-key"), "shortlist action must expose a stable candidate key");

console.log(JSON.stringify({
  ok: true,
  profileScoped: true,
  deduplicated: true,
  malformedStorageIgnored: true,
  exportIncludesShortlist: true,
}, null, 2));
