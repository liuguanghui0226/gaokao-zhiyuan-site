#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
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
  currentPlanEvidenceForAdmissionRecord,
  applicationPlanReadiness,
  applicationPlanDetail,
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
const records = jilin.records || [];
const baseProfile = {
  province: "吉林",
  subject: "物理/理科",
  electives: "化学 生物",
  score: "450",
  rank: "50000",
};
api.setRecords(records);

const financeAdmission = records
  .filter((record) =>
    record.schoolName === "韩山师范学院" &&
    record.majorName === "财务管理" &&
    record.dataType === "major-admission"
  )
  .sort((left, right) => Number(right.year) - Number(left.year))[0];
assert.ok(financeAdmission, "Expected real Jilin finance admission");
const financeEvidence = api.currentPlanEvidenceForAdmissionRecord(financeAdmission, baseProfile);
const financeOption = {
  name: financeAdmission.schoolName,
  record: financeAdmission,
  admissionFit: { text: "真实历史录取边界" },
  planEvidence: financeEvidence,
};
const financeReadiness = api.applicationPlanReadiness(financeOption);
assert.equal(financeReadiness.state, "current-plan-confirmed");
assert.equal(financeReadiness.label, "2026计划已佐证");
assert.equal(financeReadiness.confirmed, true);
assert.ok(api.applicationPlanDetail(financeOption).tags.includes("2026计划已佐证"));

const materialAdmission = records.find((record) =>
  record.schoolName === "吉林工程技术师范学院" &&
  record.majorName === "材料成型及控制工程" &&
  record.dataType === "major-admission" &&
  Number(record.year) === 2023
);
assert.ok(materialAdmission, "Expected real Jilin material admission");
const noChemistryProfile = { ...baseProfile, electives: "生物 地理" };
const materialEvidence = api.currentPlanEvidenceForAdmissionRecord(
  materialAdmission,
  noChemistryProfile,
);
const materialReadiness = api.applicationPlanReadiness({
  name: materialAdmission.schoolName,
  record: materialAdmission,
  admissionFit: { text: "真实历史录取边界" },
  planEvidence: materialEvidence,
});
assert.equal(materialEvidence.routeTransition, true);
assert.equal(materialEvidence.eligibility.state, "unmatched");
assert.equal(materialReadiness.state, "current-plan-conflict");
assert.equal(materialReadiness.confirmed, false);
assert.match(materialReadiness.text, /人工复核项/);

const unmatchedAdmission = records.find((record) =>
  record.dataType === "major-admission" &&
  record.majorName &&
  !api.currentPlanEvidenceForAdmissionRecord(record, baseProfile)
);
assert.ok(unmatchedAdmission, "Expected a real Jilin admission without current plan match");
const unmatchedReadiness = api.applicationPlanReadiness({
  name: unmatchedAdmission.schoolName,
  record: unmatchedAdmission,
  admissionFit: { text: "真实历史录取边界" },
  planEvidence: null,
});
assert.equal(unmatchedReadiness.state, "current-plan-unmatched");
assert.equal(unmatchedReadiness.label, "2026计划待核");
assert.match(unmatchedReadiness.text, /不表示停招/);
assert.equal(unmatchedReadiness.confirmed, false);

const audit = JSON.parse(fs.readFileSync(
  path.join(root, "data/admissions/evidence-v3346-application-plan-readiness-manifest.json"),
  "utf8",
));
assert.equal(audit.counts.provinces, 31);
assert.equal(audit.counts.candidateGroups, 389435);
assert.equal(audit.counts.currentPlanConfirmedGroups, 2142);
assert.equal(audit.counts.currentPlanPendingGroups, 387293);
assert.equal(audit.counts.currentPlanCoverageRate, 0.0055);
assert.equal(audit.policy.executableClaimRemoved, true);

console.log(JSON.stringify({
  status: "ok",
  jilin: {
    confirmed: `${financeAdmission.schoolName}-${financeAdmission.majorName}`,
    conflict: `${materialAdmission.schoolName}-${materialAdmission.majorName}`,
    unmatched: `${unmatchedAdmission.schoolName}-${unmatchedAdmission.majorName}`,
  },
  nationwide: audit.counts,
}, null, 2));
