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
  electiveRequirementForProfile,
  profileAdmissionRecords,
  buildAdmissionOptions,
  setRecords(records) {
    state.data = { admissionScoreLayer: { records } };
    profileAdmissionRecordsCache = { records: null, key: "", value: [] };
    profilePlanRecordsCache = { records: null, key: "", value: [] };
    admissionPlanEvidenceIndexCache = { records: null, index: null };
  },
};`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;

const admission = {
  id: "admission-2025",
  province: "江西",
  year: 2025,
  subjectType: "物理类",
  batch: "本科一批",
  schoolName: "示例理工大学",
  schoolCode: "10001",
  dataType: "major-admission",
  majorName: "计算机科学与技术",
  majorCode: "080901",
  admissionType: "普通录取",
  admissionSubtype: "本科一批",
  minScore: 590,
  minRankEnd: 20000,
  sourceQuality: "official-exam-authority-major-admission",
};
const currentPlan = {
  id: "plan-2026",
  province: "江西",
  year: 2026,
  subjectType: "物理类",
  batch: "本科一批",
  schoolName: "示例理工大学",
  schoolCode: "10001",
  dataType: "admission-plan",
  majorName: "计算机科学与技术",
  majorCode: "080901",
  admissionType: "普通录取",
  admissionSubtype: "本科一批",
  electiveRequirement: "物理+化学",
  planCount: 6,
  sourceQuality: "official-exam-authority-plan",
  sourceId: "official-plan-2026",
};
const matchingProfile = {
  province: "江西",
  subject: "物理/理科",
  electives: "化学 生物",
  score: "593",
  rank: "17798",
};

api.setRecords([admission, currentPlan]);
const evidence = api.currentPlanEvidenceForAdmissionRecord(admission, matchingProfile);
assert.equal(evidence.year, 2026);
assert.equal(evidence.current, true);
assert.equal(evidence.label, "2026计划在招");
assert.equal(evidence.planCount, 6);
assert.equal(evidence.eligibility.state, "matched");
assert.equal(evidence.rankingBonus, 8);
assert.match(evidence.text, /计划存在只证明当年专业池，不代表录取概率/);
assert.equal(api.currentPlanAllowsProfile(admission, matchingProfile), true);
assert.equal(api.profileAdmissionRecords(matchingProfile).length, 1);
const visibleOptions = api.buildAdmissionOptions({
  id: "engineering-industry",
  disciplines: ["08"],
  keywords: ["计算机"],
  cities: [],
}, matchingProfile);
assert.equal(visibleOptions.length, 1);
assert.ok(visibleOptions[0].tags.includes("2026计划在招"));
assert.ok(visibleOptions[0].tags.includes("计划6名"));
assert.ok(visibleOptions[0].tags.includes("当前选科符合"));
assert.match(visibleOptions[0].focus, /计划存在只证明当年专业池，不代表录取概率/);

const missingChemistryProfile = { ...matchingProfile, electives: "生物 地理" };
assert.equal(
  api.electiveRequirementForProfile(currentPlan, missingChemistryProfile).state,
  "unmatched",
);
assert.equal(api.currentPlanAllowsProfile(admission, missingChemistryProfile), false);
assert.equal(api.profileAdmissionRecords(missingChemistryProfile).length, 0);

const missingElectivesProfile = { ...matchingProfile, electives: "" };
const pendingEvidence = api.currentPlanEvidenceForAdmissionRecord(admission, missingElectivesProfile);
assert.equal(pendingEvidence.eligibility.state, "needs-check");
assert.equal(pendingEvidence.rankingBonus, 3);
assert.equal(api.currentPlanAllowsProfile(admission, missingElectivesProfile), true);

const primaryOnlyPlan = { ...currentPlan, electiveRequirement: "物理" };
assert.equal(api.electiveRequirementForProfile(primaryOnlyPlan, matchingProfile).state, "matched");
assert.equal(
  api.electiveRequirementForProfile(primaryOnlyPlan, { ...matchingProfile, subject: "历史/文科" }).state,
  "unmatched",
);

const priorPlan = { ...currentPlan, id: "plan-2025", year: 2025 };
api.setRecords([admission, priorPlan]);
const priorEvidence = api.currentPlanEvidenceForAdmissionRecord(admission, missingChemistryProfile);
assert.equal(priorEvidence.label, "2025计划曾招");
assert.equal(priorEvidence.rankingBonus, 2);
assert.equal(api.currentPlanAllowsProfile(admission, missingChemistryProfile), true);

const oldPlan = { ...currentPlan, id: "plan-2024", year: 2024 };
api.setRecords([admission, oldPlan]);
assert.equal(api.currentPlanEvidenceForAdmissionRecord(admission, matchingProfile), null);
assert.equal(api.currentPlanAllowsProfile(admission, matchingProfile), true);

const vacancyPlan = {
  ...currentPlan,
  id: "vacancy-plan",
  planStage: "征集志愿",
  formalScoreScope: "vacancy-plan-only",
};
api.setRecords([admission, vacancyPlan]);
assert.equal(api.currentPlanEvidenceForAdmissionRecord(admission, matchingProfile), null);

const specialPlan = {
  ...currentPlan,
  id: "special-plan",
  batch: "国家专项",
};
api.setRecords([admission, specialPlan]);
assert.equal(api.currentPlanEvidenceForAdmissionRecord(admission, matchingProfile), null);

const renamedPlan = {
  ...currentPlan,
  id: "renamed-plan",
  majorName: "计算机科学与技术(拔尖创新实验班)",
  majorCode: "",
};
api.setRecords([{ ...admission, majorCode: "" }, renamedPlan]);
assert.equal(api.currentPlanEvidenceForAdmissionRecord({ ...admission, majorCode: "" }, matchingProfile), null);
assert.equal(api.profileAdmissionRecords(matchingProfile).length, 1);

console.log(JSON.stringify({
  status: "ok",
  exactCurrentPlan: {
    label: evidence.label,
    planCount: evidence.planCount,
    eligibility: evidence.eligibility.state,
    rankingBonus: evidence.rankingBonus,
  },
  safeguards: {
    currentElectiveConflictExcluded: true,
    missingPlanDoesNotMeanDiscontinued: true,
    oldPlanIgnored: true,
    vacancyPlanIgnored: true,
    restrictedPlanIgnored: true,
    semanticRenameNotMerged: true,
    priorPlanDoesNotExclude: true,
  },
}, null, 2));
