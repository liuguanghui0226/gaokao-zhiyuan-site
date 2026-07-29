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
  admissionOptionBaseIdentityKey,
  admissionRecordsShareRoute,
  admissionRouteIdentityKey,
  dedupeAdmissionRecords,
};`;
const context = vm.createContext({ console, Intl, Date });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;

const base = {
  id: "third-party-spaced",
  province: "北京",
  subjectType: "综合",
  year: 2025,
  batch: "专科批",
  schoolName: "北京示例职业学院",
  dataType: "vocational-admission",
  majorName: "计算机 应用技术 (校企班)",
  majorGroup: "",
  minScore: 252,
  sourceQuality: "third-party-school-score-summary-imported-score-only",
};
const officialTypographyAlias = {
  ...base,
  id: "official-compact",
  majorName: "计算机应用技术（校企班）",
  sourceQuality: "official-exam-authority-major-filing",
};

assert.equal(
  api.admissionOptionBaseIdentityKey(base),
  api.admissionOptionBaseIdentityKey(officialTypographyAlias),
);
assert.equal(api.admissionRecordsShareRoute(base, officialTypographyAlias), true);
assert.equal(api.dedupeAdmissionRecords([base, officialTypographyAlias]).length, 1);
assert.equal(api.dedupeAdmissionRecords([base, officialTypographyAlias])[0].id, "official-compact");

const earlierAscii = {
  ...base,
  id: "earlier-ascii",
  year: 2024,
  dataType: "major-admission",
  batch: "本科批",
  majorName: "大数据管理与应用(英才班)",
  minScore: 640,
};
const latestFullWidth = {
  ...earlierAscii,
  id: "latest-fullwidth",
  year: 2025,
  majorName: "大数据管理与应用（英才班）",
  minScore: 645,
};
assert.equal(api.admissionRecordsShareRoute(earlierAscii, latestFullWidth), true);
assert.equal(api.dedupeAdmissionRecords([earlierAscii, latestFullWidth]).length, 1);
assert.equal(api.dedupeAdmissionRecords([earlierAscii, latestFullWidth])[0].id, "latest-fullwidth");

const conflictingBoundary = {
  ...officialTypographyAlias,
  id: "conflicting-boundary",
  majorName: "计算机应用技术（校企班）",
  minScore: 251,
};
assert.equal(api.admissionRecordsShareRoute(base, conflictingBoundary), false);
assert.equal(api.dedupeAdmissionRecords([base, conflictingBoundary]).length, 2);

const distinctCampus = {
  ...officialTypographyAlias,
  id: "distinct-campus",
  campus: "新校区",
};
const distinctBatch = {
  ...officialTypographyAlias,
  id: "distinct-batch",
  batch: "专科提前批",
};
assert.equal(api.admissionRecordsShareRoute(officialTypographyAlias, distinctCampus), false);
assert.equal(api.admissionRecordsShareRoute(officialTypographyAlias, distinctBatch), false);
assert.notEqual(
  api.admissionRouteIdentityKey(officialTypographyAlias),
  api.admissionRouteIdentityKey(distinctCampus),
);

console.log(JSON.stringify({
  status: "ok",
  sameYearOfficialWinner: "official-compact",
  crossYearLatestWinner: "latest-fullwidth",
  preservedBoundaryConflicts: 2,
  preservedDistinctRoutes: ["campus", "batch"],
}, null, 2));
