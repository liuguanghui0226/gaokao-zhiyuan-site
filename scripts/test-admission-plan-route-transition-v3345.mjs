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
  currentPlanEvidenceForAdmissionRecord,
  currentPlanAllowsProfile,
  profileAdmissionRecords,
  buildAdmissionOptions,
  setRecords(records) {
    state.data = { admissionScoreLayer: { records } };
    profileAdmissionRecordsCache = { records: null, key: "", value: [] };
    profilePlanRecordsCache = { records: null, key: "", value: [] };
    admissionPlanEvidenceIndexCache = { records: null };
  },
};`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;

const admission = {
  id: "admission-2023",
  province: "吉林",
  year: 2023,
  subjectType: "物理类",
  batch: "本科二批",
  schoolName: "示例理工大学",
  schoolCode: "10001",
  dataType: "major-admission",
  majorName: "计算机科学与技术",
  majorCode: "080901",
  admissionType: "普通录取",
  minScore: 560,
  minRankEnd: 22000,
  sourceQuality: "official-exam-authority-major-admission",
};
const transitionPlan = {
  id: "transition-plan-2026",
  province: "吉林",
  year: 2026,
  subjectType: "物理类",
  batch: "普通本科批",
  schoolName: "示例理工大学",
  schoolCode: "10001",
  dataType: "admission-plan",
  majorName: "计算机科学与技术",
  majorCode: "080901",
  electiveRequirement: "物理+化学",
  planCount: 12,
  sourceQuality: "official-exam-authority-plan",
  sourceId: "official-plan-2026",
};
const matchingProfile = {
  province: "吉林",
  subject: "物理/理科",
  electives: "化学 生物",
  score: "580",
  rank: "18000",
};

api.setRecords([admission, transitionPlan]);
const transitionEvidence = api.currentPlanEvidenceForAdmissionRecord(admission, matchingProfile);
assert.equal(transitionEvidence.current, true);
assert.equal(transitionEvidence.exactRoute, false);
assert.equal(transitionEvidence.routeTransition, true);
assert.equal(transitionEvidence.matchKind, "ordinary-undergraduate-transition");
assert.equal(transitionEvidence.label, "2026普通本科计划佐证");
assert.equal(transitionEvidence.planCount, 12);
assert.equal(transitionEvidence.eligibility.state, "matched");
assert.equal(transitionEvidence.rankingBonus, 5);
assert.match(transitionEvidence.text, /批次“本科二批”与当年计划批次“普通本科批”口径不同/);
assert.match(transitionEvidence.text, /不改变录取边界/);
assert.equal(api.currentPlanAllowsProfile(admission, matchingProfile), true);

const chemistryConflict = { ...matchingProfile, electives: "生物 地理" };
const conflictEvidence = api.currentPlanEvidenceForAdmissionRecord(admission, chemistryConflict);
assert.equal(conflictEvidence.eligibility.state, "unmatched");
assert.equal(conflictEvidence.rankingBonus, 0);
assert.equal(api.currentPlanAllowsProfile(admission, chemistryConflict), true);
assert.equal(
  api.profileAdmissionRecords(chemistryConflict).some((record) => record.id === admission.id),
  true,
);
const conflictOptions = api.buildAdmissionOptions({
  id: "engineering-industry",
  disciplines: ["08"],
  keywords: ["计算机"],
  cities: [],
}, chemistryConflict);
assert.equal(conflictOptions.length, 1);
assert.ok(conflictOptions[0].tags.includes("2026普通本科计划佐证"));
assert.ok(conflictOptions[0].tags.includes("普通本科批次口径变更"));
assert.ok(conflictOptions[0].tags.includes("当前选科冲突待核"));

const exactPlan = {
  ...transitionPlan,
  id: "exact-plan-2026",
  batch: "本科二批",
  planCount: 2,
};
api.setRecords([admission, transitionPlan, exactPlan]);
const exactEvidence = api.currentPlanEvidenceForAdmissionRecord(admission, matchingProfile);
assert.equal(exactEvidence.exactRoute, true);
assert.equal(exactEvidence.label, "2026计划在招");
assert.equal(exactEvidence.planCount, 2);
assert.equal(exactEvidence.rankingBonus, 8);
assert.equal(api.currentPlanAllowsProfile(admission, chemistryConflict), false);

const vocationalPlan = {
  ...transitionPlan,
  id: "vocational-plan",
  batch: "高职专科批",
};
api.setRecords([admission, vocationalPlan]);
assert.equal(api.currentPlanEvidenceForAdmissionRecord(admission, matchingProfile), null);

const qualifierConflictPlan = {
  ...transitionPlan,
  id: "qualifier-conflict-plan",
  batch: "普通本科批B",
};
api.setRecords([{ ...admission, batch: "本科二批A" }, qualifierConflictPlan]);
assert.equal(
  api.currentPlanEvidenceForAdmissionRecord({ ...admission, batch: "本科二批A" }, matchingProfile),
  null,
);

const supplementPlan = {
  ...transitionPlan,
  id: "supplement-plan",
  batch: "高职（专科）批补录征集志愿",
  sourceId: "official-yunnan-vocational-supplement-plan-2025",
};
const vocationalAdmission = {
  ...admission,
  id: "vocational-admission",
  batch: "高职（专科）批补录征集志愿",
  dataType: "vocational-admission",
};
api.setRecords([vocationalAdmission, supplementPlan]);
assert.equal(
  api.currentPlanEvidenceForAdmissionRecord(vocationalAdmission, matchingProfile),
  null,
);

const ambiguousPlan = {
  ...exactPlan,
  id: "ambiguous-plan-2026",
  electiveRequirement: "物理+生物",
  planCount: 30,
};
api.setRecords([admission, exactPlan, ambiguousPlan]);
const ambiguousEvidence = api.currentPlanEvidenceForAdmissionRecord(admission, chemistryConflict);
assert.equal(ambiguousEvidence.ambiguousPlanRequirements, true);
assert.equal(ambiguousEvidence.label, "2026计划多口径待核");
assert.equal(ambiguousEvidence.planCount, 0);
assert.equal(ambiguousEvidence.rankingBonus, 1);
assert.equal(ambiguousEvidence.eligibility.state, "needs-check");
assert.equal(api.currentPlanAllowsProfile(admission, chemistryConflict), true);

const missingSubtypePlan = {
  ...exactPlan,
  id: "missing-subtype-plan",
  admissionSubtype: "",
  planCount: 3,
};
const explicitSubtypePlan = {
  ...exactPlan,
  id: "explicit-subtype-plan",
  admissionSubtype: "本科二批",
  planCount: 4,
};
api.setRecords([{ ...admission, admissionSubtype: "本科二批" }, missingSubtypePlan, explicitSubtypePlan]);
const compatibleMissingFieldEvidence = api.currentPlanEvidenceForAdmissionRecord(
  { ...admission, admissionSubtype: "本科二批" },
  matchingProfile,
);
assert.equal(compatibleMissingFieldEvidence.ambiguousPlanRequirements, false);
assert.equal(compatibleMissingFieldEvidence.planCount, 4);

console.log(JSON.stringify({
  status: "ok",
  transition: {
    label: transitionEvidence.label,
    planCount: transitionEvidence.planCount,
    rankingBonus: transitionEvidence.rankingBonus,
    electiveConflictReviewOnly: true,
  },
  safeguards: {
    exactRoutePriority: true,
    noUndergraduateVocationalCrossing: true,
    qualifierConflictRejected: true,
    supplementPlanExcluded: true,
    conflictingRequirementsReviewOnly: true,
    missingOptionalFieldNotAConflict: true,
  },
}, null, 2));
