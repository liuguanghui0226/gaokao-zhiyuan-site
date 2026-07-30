#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
if (root.startsWith("/Volumes/")) {
  throw new Error("Refusing external-volume test execution.");
}
const appFile = path.join(root, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = {
  applicationPlanReadiness,
  applicationPlanDetail,
  renderApplicationPlan,
  setProfile(profile) {
    state.recommendation = { profile };
  },
};`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;
api.setProfile({
  province: "吉林",
  subject: "物理/理科",
  electives: "化学 生物",
});

function admissionOption(id, planEvidence) {
  return {
    name: `示例大学${id}`,
    role: "稳妥",
    optionScore: 86,
    admissionFit: {
      zone: "稳妥",
      score: 86,
      text: "位次比近年最低位次靠前，仍须核验当年计划",
      recency: { fresh: true, label: "近1年" },
    },
    planEvidence,
    record: {
      id: `admission-${id}`,
      dataType: "major-admission",
      province: "吉林",
      subjectType: "物理类",
      year: 2025,
      batch: "普通本科批",
      schoolName: `示例大学${id}`,
      majorName: `示例专业${id}`,
      minScore: 560,
      minRankEnd: 22000,
      sourceQuality: "official-exam-authority-major-admission",
      sourceUrl: "https://example.edu.cn/admission",
    },
  };
}

const confirmed = admissionOption("A", {
  current: true,
  year: 2026,
  eligibility: { state: "matched" },
});
const unmatched = admissionOption("B", null);
const nearYear = admissionOption("C", {
  current: false,
  year: 2025,
  eligibility: { state: "matched" },
});
const electiveConflict = admissionOption("D", {
  current: true,
  year: 2026,
  routeTransition: true,
  eligibility: { state: "unmatched" },
});
const electivePending = admissionOption("E", {
  current: true,
  year: 2026,
  eligibility: { state: "needs-check" },
});
const ambiguous = admissionOption("F", {
  current: true,
  year: 2026,
  ambiguousPlanRequirements: true,
  eligibility: { state: "needs-check" },
});
const planOnly = {
  name: "计划大学",
  role: "计划核验",
  optionScore: 60,
  admissionFit: { zone: "计划核验", score: 46, text: "计划层候选" },
  record: {
    id: "plan-only",
    dataType: "admission-plan",
    province: "吉林",
    subjectType: "物理类",
    year: 2026,
    batch: "普通本科批",
    schoolName: "计划大学",
    majorName: "计划专业",
    sourceQuality: "official-exam-authority-plan",
  },
};

assert.deepEqual(
  { ...api.applicationPlanReadiness(confirmed) },
  {
    state: "current-plan-confirmed",
    label: "2026计划已佐证",
    text: "已命中2026官方计划且当前科类、选科未发现冲突；这仍不代表录取概率。",
    confirmed: true,
    admissionOption: true,
  },
);
assert.equal(api.applicationPlanReadiness(unmatched).state, "current-plan-unmatched");
assert.equal(api.applicationPlanReadiness(nearYear).state, "near-year-only");
assert.equal(api.applicationPlanReadiness(electiveConflict).state, "current-plan-conflict");
assert.equal(api.applicationPlanReadiness(electivePending).state, "current-plan-needs-check");
assert.equal(api.applicationPlanReadiness(ambiguous).state, "current-plan-ambiguous");
assert.equal(api.applicationPlanReadiness(planOnly).state, "plan-only");

const unmatchedDetail = api.applicationPlanDetail(unmatched);
assert.ok(unmatchedDetail.tags.includes("2026计划待核"));
assert.match(unmatchedDetail.text, /核验前不能进入正式志愿单/);
const conflictDetail = api.applicationPlanDetail(electiveConflict);
assert.ok(conflictDetail.tags.includes("2026选科冲突待核"));
assert.match(conflictDetail.text, /只保留为人工复核项/);
const ambiguousDetail = api.applicationPlanDetail(ambiguous);
assert.ok(ambiguousDetail.tags.includes("2026计划多口径待核"));
assert.match(ambiguousDetail.text, /多个选科或招生口径/);

const html = api.renderApplicationPlan([{
  title: "08 工学产业就业院校池",
  total: 80,
  schoolOptions: [
    confirmed,
    unmatched,
    nearYear,
    electiveConflict,
    electivePending,
    ambiguous,
    planOnly,
  ],
}]);
assert.match(html, /院校专业候选清单/);
assert.doesNotMatch(html, /可执行院校专业清单/);
assert.match(html, /1\/5 当前计划已佐证/);
for (const label of [
  "2026计划已佐证",
  "2026计划待核",
  "仅2025计划佐证",
  "2026选科冲突待核",
  "2026选科待核",
  "计划层候选",
]) {
  assert.match(html, new RegExp(label));
}

console.log(JSON.stringify({
  status: "ok",
  title: "院校专业候选清单",
  currentPlanConfirmed: 1,
  displayedAdmissionOptions: 5,
  readinessStates: [
    "current-plan-confirmed",
    "current-plan-unmatched",
    "near-year-only",
    "current-plan-conflict",
    "current-plan-needs-check",
    "current-plan-ambiguous",
    "plan-only",
  ],
}, null, 2));
