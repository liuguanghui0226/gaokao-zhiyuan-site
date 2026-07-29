#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(root, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = {
  admissionTrendEvidence,
  admissionTrendKey,
  admissionTrendSeries,
  trendForRecord,
  setTrendRecords(records) {
    state.data = { admissionScoreLayer: { records } };
    admissionTrendIndexCache = null;
  },
};`;
const context = vm.createContext({ console, Intl, Date });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;

const route = {
  province: "北京",
  subjectType: "综合",
  batch: "本科批",
  schoolName: "示例大学",
  dataType: "major-admission",
  majorName: "计算机科学与技术",
  majorGroup: "物理+化学组",
  admissionSubtype: "普通",
  campus: "主校区",
  electiveRequirement: "物理+化学",
};
const third2025 = {
  ...route,
  id: "third-2025",
  year: 2025,
  minScore: 500,
  sourceQuality: "third-party-score-summary",
};
const school2025 = {
  ...route,
  id: "school-2025",
  year: 2025,
  minScore: 610,
  sourceQuality: "official-school-score",
  formalScoreScope: "school-official-only",
};
const third2024 = { ...third2025, id: "third-2024", year: 2024, minScore: 490 };
const school2024 = { ...school2025, id: "school-2024", year: 2024, minScore: 600 };
api.setTrendRecords([third2025, school2025, third2024, school2024]);
const officialTrend = api.trendForRecord(third2025);
assert.ok(officialTrend);
assert.equal(officialTrend.bonus, 5);
assert.equal(officialTrend.evidenceLabel, "");
assert.match(officialTrend.text, /2025年610/);
assert.match(officialTrend.text, /2024年600/);
assert.doesNotMatch(officialTrend.text, /2025年500/);

const anotherCampus2024 = { ...school2024, id: "campus-2024", campus: "异地校区" };
api.setTrendRecords([school2025, anotherCampus2024]);
assert.notEqual(api.admissionTrendKey(school2025), api.admissionTrendKey(anotherCampus2024));
assert.equal(api.trendForRecord(school2025), null);

const anotherElective2024 = { ...school2024, id: "elective-2024", electiveRequirement: "物理" };
api.setTrendRecords([school2025, anotherElective2024]);
assert.notEqual(api.admissionTrendKey(school2025), api.admissionTrendKey(anotherElective2024));
assert.equal(api.trendForRecord(school2025), null);

const thirdOnly2025 = { ...third2025, id: "third-only-2025", schoolName: "第三方示例大学", minScore: 580 };
const thirdOnly2024 = { ...thirdOnly2025, id: "third-only-2024", year: 2024, minScore: 570 };
api.setTrendRecords([thirdOnly2025, thirdOnly2024]);
const thirdPartyTrend = api.trendForRecord(thirdOnly2025);
assert.equal(thirdPartyTrend.bonus, 2);
assert.equal(thirdPartyTrend.evidenceLabel, "趋势含待复核第三方");
assert.match(thirdPartyTrend.caution, /不能据此推断录取概率/);

console.log(JSON.stringify({
  status: "ok",
  officialFirstScores: [610, 600],
  officialTrendBonus: officialTrend.bonus,
  campusCrossRouteTrend: null,
  electiveCrossRouteTrend: null,
  thirdPartyTrendBonus: thirdPartyTrend.bonus,
  thirdPartyWarning: thirdPartyTrend.evidenceLabel,
}, null, 2));
