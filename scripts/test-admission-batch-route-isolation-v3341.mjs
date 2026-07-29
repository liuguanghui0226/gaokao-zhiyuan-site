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
  admissionBatchRouteKey,
  admissionRecordsShareRoute,
  admissionRouteIdentityKey,
  admissionRouteTags,
  applicationPlanDetail,
  buildApplicationPlan,
  dedupeAdmissionRecords,
};`;
const context = vm.createContext({ console, Intl, Date });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;

const base = {
  id: "ordinary-third-party",
  province: "河北",
  subjectType: "物理类",
  year: 2025,
  batch: "本科批",
  schoolName: "示例大学",
  dataType: "major-admission",
  majorName: "计算机科学与技术",
  majorGroup: "",
  minScore: 590,
  minRankEnd: 35000,
  sourceQuality: "third-party-school-score-summary-imported-score-only",
};
const ordinaryOfficialAlias = {
  ...base,
  id: "ordinary-official",
  batch: "综合改革（3+1+2）",
  sourceQuality: "official-exam-authority-major-filing",
};
assert.equal(api.admissionBatchRouteKey(base.batch), "ordinary-initial");
assert.equal(api.admissionBatchRouteKey(ordinaryOfficialAlias.batch), "ordinary-initial");
assert.equal(api.admissionRecordsShareRoute(base, ordinaryOfficialAlias), true);
assert.equal(api.dedupeAdmissionRecords([base, ordinaryOfficialAlias]).length, 1);
assert.equal(api.dedupeAdmissionRecords([base, ordinaryOfficialAlias])[0].id, "ordinary-official");

const national = { ...base, id: "national", batch: "国家专项计划", minScore: 572, minRankEnd: 53452 };
const local = { ...base, id: "local", batch: "地方专项计划", minScore: 582, minRankEnd: 42923 };
const earlyB = { ...base, id: "early-b", batch: "本科提前批B段", minScore: 575, minRankEnd: 47000 };
const firstA = { ...base, id: "first-a", batch: "本科一批A", minScore: 580, minRankEnd: 42000 };
const firstB = { ...base, id: "first-b", batch: "本科一批B（理）", minScore: 570, minRankEnd: 52000 };
const segmentTwo = { ...base, id: "segment-two", batch: "普通类第二段平行投档", minScore: 510, minRankEnd: 88000 };
const roundTwo = { ...base, id: "round-two", batch: "普通类常规批第2次志愿", minScore: 520, minRankEnd: 76000 };
const roundThree = { ...base, id: "round-three", batch: "普通类常规批第3次志愿", minScore: 500, minRankEnd: 96000 };
const distinctRoutes = [base, national, local, earlyB, firstA, firstB, segmentTwo, roundTwo, roundThree];

assert.equal(api.admissionBatchRouteKey(national.batch), "national-special");
assert.equal(api.admissionBatchRouteKey(local.batch), "local-special");
assert.equal(api.admissionBatchRouteKey(earlyB.batch), "undergraduate-early:b段");
assert.equal(api.admissionBatchRouteKey(firstA.batch), "undergraduate-1:a段");
assert.equal(api.admissionBatchRouteKey(firstB.batch), "undergraduate-1:b段:理");
assert.equal(api.admissionBatchRouteKey(segmentTwo.batch), "ordinary-segment-2");
assert.equal(api.admissionBatchRouteKey(roundTwo.batch), "ordinary-round-2");
assert.equal(api.admissionBatchRouteKey(roundThree.batch), "ordinary-round-3");
assert.equal(api.dedupeAdmissionRecords(distinctRoutes).length, distinctRoutes.length);
assert.notEqual(api.admissionRouteIdentityKey(national), api.admissionRouteIdentityKey(local));
assert.ok(api.admissionRouteTags(national).includes("国家专项计划"));

const fit = { score: 86, text: "边界匹配。", recency: { fresh: true, label: "近年" } };
const plan = api.buildApplicationPlan([{
  title: "08 工学",
  total: 82,
  schoolOptions: [base, national, local].map((record) => ({
    name: record.schoolName,
    optionScore: 90,
    admissionFit: fit,
    record,
  })),
}]);
const review = plan.find((tier) => tier.id === "review");
assert.equal(review.options.length, 3, "ordinary, national-special, and local-special routes must remain visible");
const visibleBatches = review.options.flatMap((option) => api.applicationPlanDetail(option).tags);
assert.ok(visibleBatches.includes("本科批"));
assert.ok(visibleBatches.includes("国家专项计划"));
assert.ok(visibleBatches.includes("地方专项计划"));

console.log(JSON.stringify({
  status: "ok",
  retainedOrdinaryAliasWinner: api.dedupeAdmissionRecords([base, ordinaryOfficialAlias])[0].id,
  preservedDistinctRoutes: distinctRoutes.length,
  visibleBatches: ["本科批", "国家专项计划", "地方专项计划"],
}, null, 2));
