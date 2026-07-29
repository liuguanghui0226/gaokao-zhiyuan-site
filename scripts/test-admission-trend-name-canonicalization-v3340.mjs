#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
if (root.startsWith("/Volumes/")) throw new Error("Refusing external-volume test execution.");
const appFile = path.join(root, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = {
  admissionTrendCanonicalMergeSafe,
  admissionTrendExactKey,
  admissionTrendKey,
  normalizeAdmissionTrendTypography,
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
  majorGroup: "物理+化学",
  admissionSubtype: "普通",
  campus: "主校区",
  electiveRequirement: "物理／化学（均须选考）",
  sourceQuality: "official-school-score",
  formalScoreScope: "school-official-only",
};
const fullwidth2025 = {
  ...route,
  id: "fullwidth-2025",
  year: 2025,
  majorName: "计算机科学与技术（拔尖班）",
  minScore: 610,
};
const ascii2024 = {
  ...route,
  id: "ascii-2024",
  year: 2024,
  majorName: "计算机科学与技术(拔尖班)",
  electiveRequirement: "物理/化学(均须选考)",
  minScore: 600,
};
assert.equal(
  api.normalizeAdmissionTrendTypography(fullwidth2025.majorName),
  api.normalizeAdmissionTrendTypography(ascii2024.majorName),
);
assert.equal(api.admissionTrendKey(fullwidth2025), api.admissionTrendKey(ascii2024));
assert.notEqual(api.admissionTrendExactKey(fullwidth2025), api.admissionTrendExactKey(ascii2024));
api.setTrendRecords([fullwidth2025, ascii2024]);
const recoveredTrend = api.trendForRecord(fullwidth2025);
assert.ok(recoveredTrend);
assert.match(recoveredTrend.text, /2025年610/);
assert.match(recoveredTrend.text, /2024年600/);

const otherCampus2024 = { ...ascii2024, id: "other-campus-2024", campus: "异地校区" };
api.setTrendRecords([fullwidth2025, otherCampus2024]);
assert.notEqual(api.admissionTrendKey(fullwidth2025), api.admissionTrendKey(otherCampus2024));
assert.equal(api.trendForRecord(fullwidth2025), null);

const ascii2025 = { ...ascii2024, id: "ascii-2025", year: 2025, minScore: 605 };
api.setTrendRecords([fullwidth2025, ascii2025, ascii2024]);
assert.equal(api.admissionTrendCanonicalMergeSafe([fullwidth2025, ascii2025, ascii2024]), false);
const fallbackTrend = api.trendForRecord(ascii2025);
assert.ok(fallbackTrend);
assert.match(fallbackTrend.text, /2025年605/);
assert.match(fallbackTrend.text, /2024年600/);
assert.doesNotMatch(fallbackTrend.text, /2025年610/);
assert.equal(api.trendForRecord(fullwidth2025), null);

console.log(JSON.stringify({
  status: "ok",
  canonicalTypography: api.normalizeAdmissionTrendTypography(fullwidth2025.majorName),
  recoveredTrend: [610, 600],
  routeIsolationPreserved: true,
  conflictFallback: [605, 600],
}, null, 2));
