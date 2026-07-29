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
  admissionFit,
  applicationPlanTier,
  applicationPlanDetail,
  buildApplicationPlan,
  candidateMatchesAdmissionRecord,
  CANDIDATE_POOLS,
};`;
const context = vm.createContext({ console, Intl, Date });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;

const rankProfile = { rank: "180000", score: "500", province: "江西", subject: "物理/理科" };
assert.equal(api.admissionFit({ year: 2025, minRankEnd: 185000 }, rankProfile, "2026-07-30").zone, "临界稳");
assert.equal(api.admissionFit({ year: 2025, minRankEnd: 6000 }, { ...rankProfile, rank: "1000" }, "2026-07-30").zone, "稳");
assert.equal(api.admissionFit({ year: 2025, minRankEnd: 10000 }, { ...rankProfile, rank: "10500" }, "2026-07-30").zone, "冲");

const thirdPartyRecord = {
  id: "third-party-a",
  dataType: "major-admission",
  schoolName: "示例大学",
  majorName: "计算机科学与技术",
  majorGroup: "计算机类",
  province: "江西",
  subjectType: "物理类",
  year: 2025,
  minScore: 590,
  sourceQuality: "third-party-school-score-summary-imported-score-only",
  sourceUrl: "https://example.com/summary",
};
const duplicateRecord = {
  ...thirdPartyRecord,
  id: "third-party-b",
  batch: "本科批",
  majorGroup: "另一专业组",
  sourceUrl: "https://example.com/duplicate",
};
const fit = api.admissionFit(thirdPartyRecord, { ...rankProfile, rank: "", score: "593" }, "2026-07-30");
const thirdPartyOption = { name: "示例大学", role: "稳妥", optionScore: 90, admissionFit: fit, record: thirdPartyRecord };
assert.equal(api.applicationPlanTier(thirdPartyOption), "review");
assert.equal(api.applicationPlanDetail(thirdPartyOption).sourceLabel, "待复核第三方录取摘要");

const tiers = api.buildApplicationPlan([
  {
    title: "08 工学产业就业院校池",
    total: 72,
    schoolOptions: [
      thirdPartyOption,
      { ...thirdPartyOption, optionScore: 88, record: duplicateRecord },
    ],
  },
]);
const review = tiers.find((tier) => tier.id === "review");
assert.ok(review, "third-party records must be isolated in the review tier");
assert.equal(review.label, "待复核数据候选");
assert.equal(review.options.length, 1, "logical school-major duplicates must collapse even when record ids differ");

const elite = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "elite-platform");
const independentCollege = {
  ...thirdPartyRecord,
  schoolName: "南昌大学共青学院",
  schoolTags: ["211", "双一流", "民办/独立学院"],
};
assert.equal(
  api.candidateMatchesAdmissionRecord(elite, independentCollege, {
    ...rankProfile,
    disciplineFocus: "08",
    selectedSubjects: [],
  }),
  false,
  "independent colleges must not enter the elite platform pool even if inherited tags remain in older data",
);

console.log(JSON.stringify({
  status: "ok",
  relativeRankZones: ["临界稳", "稳", "冲"],
  thirdPartyTier: review.label,
  logicalDuplicates: review.options.length,
  independentCollegeEliteMatch: false,
}, null, 2));
