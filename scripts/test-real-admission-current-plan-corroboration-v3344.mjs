#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
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

function readShard(name) {
  return JSON.parse(zlib.gunzipSync(
    fs.readFileSync(path.join(root, "site/data/release-v3.275", name)),
  ).toString("utf8"));
}

const gansu = readShard("gansu.json.gz");
const gansuRecords = gansu.records || [];
const gansuAdmission = gansuRecords
  .filter((record) =>
    record.schoolName === "南京理工大学" &&
    record.majorName === "电子信息工程(知识产权创新实践班)" &&
    record.dataType === "major-admission"
  )
  .sort((left, right) => Number(right.year) - Number(left.year))[0];
const gansuPlan = gansuRecords.find((record) =>
  record.schoolName === "南京理工大学" &&
  record.majorName === "电子信息工程(知识产权创新实践班)" &&
  record.dataType === "admission-plan" &&
  Number(record.year) === 2026
);
assert.ok(gansuAdmission, "Expected real Gansu NJUST admission record");
assert.ok(gansuPlan, "Expected real Gansu NJUST 2026 plan record");

const eligibleProfile = {
  province: "甘肃",
  subject: "物理/理科",
  electives: "化学 生物",
  score: "620",
  rank: "9000",
};
api.setRecords(gansuRecords);
const gansuEvidence = api.currentPlanEvidenceForAdmissionRecord(gansuAdmission, eligibleProfile);
assert.equal(gansuEvidence.year, 2026);
assert.equal(gansuEvidence.planCount, 4);
assert.equal(gansuEvidence.eligibility.state, "matched");
assert.equal(gansuEvidence.record.id, gansuPlan.id);
assert.match(gansuEvidence.text, /物理\+化学/);

const chemistryMissingProfile = { ...eligibleProfile, electives: "生物 地理" };
assert.equal(api.currentPlanAllowsProfile(gansuAdmission, chemistryMissingProfile), false);
assert.equal(
  api.profileAdmissionRecords(chemistryMissingProfile).some((record) => record.id === gansuAdmission.id),
  false,
);

const beijing = readShard("beijing.json.gz");
const beijingRecords = beijing.records || [];
const beijingAdmission = beijingRecords
  .filter((record) =>
    record.schoolName === "南京理工大学" &&
    record.majorName === "法学" &&
    record.dataType === "major-admission"
  )
  .sort((left, right) => Number(right.year) - Number(left.year))[0];
assert.ok(beijingAdmission, "Expected real Beijing NJUST law admission record");
api.setRecords(beijingRecords);
const beijingEvidence = api.currentPlanEvidenceForAdmissionRecord(beijingAdmission, {
  province: "北京",
  subject: "历史/文科",
  electives: "思想政治 地理",
  score: "620",
  rank: "7000",
});
assert.equal(beijingEvidence.year, 2026);
assert.equal(beijingEvidence.planCount, 4);
assert.equal(beijingEvidence.eligibility.state, "matched");
assert.equal(beijingEvidence.record.electiveRequirement, "历史");

const audit = JSON.parse(fs.readFileSync(
  path.join(root, "data/admissions/evidence-v3344-admission-current-plan-corroboration-manifest.json"),
  "utf8",
));
assert.equal(audit.counts.provinces, 31);
assert.equal(audit.counts.ordinaryPlanRecords, 66735);
assert.equal(audit.counts.eligibleRecentPlanRecords, 59052);
assert.equal(audit.counts.currentYearPlanRecords, 28422);
assert.equal(audit.counts.matchedCandidateGroups, 1869);
assert.equal(audit.counts.currentYearMatchedCandidateGroups, 1640);
assert.equal(audit.counts.nearYearMatchedCandidateGroups, 229);
assert.equal(audit.counts.admissionMissingElectiveButPlanSupplies, 1489);
assert.equal(audit.counts.provincesWithPlans, 31);
assert.equal(audit.counts.provincesWithCurrentYearMatches, 21);

console.log(JSON.stringify({
  status: "ok",
  gansu: {
    schoolName: gansuAdmission.schoolName,
    majorName: gansuAdmission.majorName,
    admissionYear: gansuAdmission.year,
    planYear: gansuEvidence.year,
    planCount: gansuEvidence.planCount,
    electiveRequirement: gansuEvidence.record.electiveRequirement,
    chemistryConflictExcluded: true,
  },
  beijing: {
    schoolName: beijingAdmission.schoolName,
    majorName: beijingAdmission.majorName,
    admissionYear: beijingAdmission.year,
    planYear: beijingEvidence.year,
    planCount: beijingEvidence.planCount,
  },
  nationwide: audit.counts,
}, null, 2));
