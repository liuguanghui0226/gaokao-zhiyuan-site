#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
if (root.startsWith("/Volumes/")) throw new Error("Refusing external-volume test execution.");
const appFile = path.join(root, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = {
  currentPlanEvidenceForAdmissionRecord,
  currentPlanAllowsProfile,
  isVacancyPlanRecord,
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

function readShard(name) {
  return JSON.parse(zlib.gunzipSync(
    fs.readFileSync(path.join(root, "site/data/release-v3.275", name)),
  ).toString("utf8"));
}

const jilin = readShard("jilin.json.gz");
const jilinRecords = jilin.records || [];
const financeAdmission = jilinRecords
  .filter((record) =>
    record.schoolName === "韩山师范学院" &&
    record.majorName === "财务管理" &&
    record.dataType === "major-admission"
  )
  .sort((left, right) => Number(right.year) - Number(left.year))[0];
const financePlan = jilinRecords.find((record) =>
  record.schoolName === "韩山师范学院" &&
  record.majorName === "财务管理" &&
  record.dataType === "admission-plan" &&
  Number(record.year) === 2026
);
assert.ok(financeAdmission, "Expected real Jilin finance admission record");
assert.ok(financePlan, "Expected real Jilin 2026 finance plan");

const jilinProfile = {
  province: "吉林",
  subject: "物理/理科",
  electives: "化学 生物",
  score: "450",
  rank: "50000",
};
api.setRecords(jilinRecords);
const financeEvidence = api.currentPlanEvidenceForAdmissionRecord(financeAdmission, jilinProfile);
assert.equal(financeEvidence.record.id, financePlan.id);
assert.equal(financeEvidence.exactRoute, false);
assert.equal(financeEvidence.routeTransition, true);
assert.equal(financeEvidence.label, "2026普通本科计划佐证");
assert.equal(financeEvidence.planCount, 1);
assert.equal(financeEvidence.eligibility.state, "not-required");
assert.equal(financeEvidence.rankingBonus, 5);
assert.match(financeEvidence.text, /普通类本科二批A段/);
assert.match(financeEvidence.text, /普通本科批/);

const materialAdmission = jilinRecords.find((record) =>
  record.schoolName === "吉林工程技术师范学院" &&
  record.majorName === "材料成型及控制工程" &&
  record.dataType === "major-admission" &&
  Number(record.year) === 2023
);
assert.ok(materialAdmission, "Expected real Jilin material admission record");
const noChemistryProfile = { ...jilinProfile, electives: "生物 地理" };
const materialEvidence = api.currentPlanEvidenceForAdmissionRecord(
  materialAdmission,
  noChemistryProfile,
);
assert.equal(materialEvidence.year, 2026);
assert.equal(materialEvidence.routeTransition, true);
assert.equal(materialEvidence.record.electiveRequirement, "化学");
assert.equal(materialEvidence.eligibility.state, "unmatched");
assert.equal(materialEvidence.rankingBonus, 0);
assert.equal(api.currentPlanAllowsProfile(materialAdmission, noChemistryProfile), true);

const yunnan = readShard("yunnan.json.gz");
const supplementPlan = yunnan.records.find((record) =>
  record.sourceId === "official-yunnan-vocational-supplement-plan-2025"
);
assert.ok(supplementPlan, "Expected real Yunnan supplement plan");
assert.equal(api.isVacancyPlanRecord(supplementPlan), true);

const xizang = readShard("xizang.json.gz");
const xizangRecords = xizang.records || [];
const socialWorkAdmission = xizangRecords
  .filter((record) =>
    record.schoolName === "南京理工大学" &&
    record.majorName === "社会工作" &&
    record.dataType === "major-admission" &&
    record.batch === "本科一批"
  )
  .sort((left, right) => Number(right.year) - Number(left.year))[0];
assert.ok(socialWorkAdmission, "Expected real Xizang NJUST social-work admission");
api.setRecords(xizangRecords);
const socialWorkEvidence = api.currentPlanEvidenceForAdmissionRecord(socialWorkAdmission, {
  province: "西藏",
  subject: "历史/文科",
  electives: "思想政治 地理",
  score: "450",
  rank: "",
  candidateCategory: "",
});
assert.equal(socialWorkEvidence.year, 2026);
assert.equal(socialWorkEvidence.exactRoute, true);
assert.equal(socialWorkEvidence.ambiguousPlanRequirements, false);
assert.equal(socialWorkEvidence.planCount, 3);
assert.equal(socialWorkEvidence.record.electiveRequirement, "历史");

const audit = JSON.parse(fs.readFileSync(
  path.join(root, "data/admissions/evidence-v3345-admission-plan-route-transition-manifest.json"),
  "utf8",
));
assert.equal(audit.counts.provinces, 31);
assert.equal(audit.counts.allPlanRecords, 71894);
assert.equal(audit.counts.ordinaryPlanRecords, 62358);
assert.equal(audit.counts.eligibleRecentPlanRecords, 54675);
assert.equal(audit.counts.currentYearPlanRecords, 28422);
assert.equal(audit.counts.exactRouteMatchedCandidateGroups, 1869);
assert.equal(audit.counts.routeTransitionMatchedCandidateGroups, 586);
assert.equal(audit.counts.matchedCandidateGroups, 2455);
assert.equal(audit.counts.currentYearMatchedCandidateGroups, 2142);
assert.equal(audit.counts.transitionCurrentYearMatchedCandidateGroups, 502);
assert.equal(audit.counts.supplementPlansExcluded, 1902);
assert.equal(audit.counts.plansExcludedAsVacancy, 6534);
assert.equal(audit.counts.ambiguousPlanRequirementGroups, 0);
assert.equal(audit.counts.provincesWithRouteTransitions, 4);

console.log(JSON.stringify({
  status: "ok",
  jilin: {
    schoolName: financeAdmission.schoolName,
    majorName: financeAdmission.majorName,
    admissionBatch: financeAdmission.batch,
    planBatch: financeEvidence.record.batch,
    planCount: financeEvidence.planCount,
    chemistryConflictReviewOnly: true,
  },
  yunnan: {
    supplementPlanId: supplementPlan.id,
    excludedFromOrdinaryEvidence: true,
  },
  xizang: {
    schoolName: socialWorkAdmission.schoolName,
    majorName: socialWorkAdmission.majorName,
    duplicateSourcesWithoutConflict: true,
  },
  nationwide: audit.counts,
}, null, 2));
