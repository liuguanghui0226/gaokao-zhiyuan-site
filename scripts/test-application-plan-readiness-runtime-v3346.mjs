#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
if (root.startsWith("/Volumes/")) {
  throw new Error("Refusing external-volume test execution.");
}
const releaseDir = path.join(root, "site/data/release-v3.275");
const readGzip = (name) => JSON.parse(zlib.gunzipSync(
  fs.readFileSync(path.join(releaseDir, name)),
).toString("utf8"));
const readJson = (name) => JSON.parse(fs.readFileSync(
  path.join(root, "data/admissions", name),
  "utf8",
));
const expectedVersion = "local-deterministic-v3.346-current-plan-readiness-gate-868426records";

const core = readGzip("knowledge-core.json.gz");
const lite = readGzip("knowledge-core-lite.json.gz");
const manifest = readGzip("manifest.json.gz");
const runtime = readJson("application-plan-readiness-v3346-runtime-manifest.json");
const evidence = readJson("evidence-v3346-application-plan-readiness-manifest.json");
const liteAudit = readJson("runtime-core-lite-v3346-manifest.json");
const policy = core.modelPolicy.admissionEvidencePolicy.applicationPlanReadiness;

assert.equal(core.modelVersion, expectedVersion);
assert.equal(lite.modelVersion, expectedVersion);
assert.equal(manifest.modelVersion, expectedVersion);
assert.equal(runtime.after.modelVersion, expectedVersion);
assert.equal(liteAudit.modelVersion, expectedVersion);
assert.equal(manifest.runtimeProfile.version, "v3.346");
assert.equal(core.generatedAt, "2026-07-30T10:45:00+08:00");
assert.equal(manifest.generatedAt, "2026-07-30T10:45:00+08:00");
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 133640);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5136);

assert.equal(policy.currentYear, 2026);
assert.equal(policy.listTitle, "院校专业候选清单");
assert.equal(policy.executableClaimRemoved, true);
assert.equal(policy.historicalFitTierKeptSeparateFromCurrentPlanReadiness, true);
assert.equal(policy.perOptionReadinessRequired, true);
assert.equal(policy.headerConfirmedCountRequired, true);
assert.equal(policy.missingCurrentPlanMeansUnknownNotDiscontinued, true);
assert.equal(policy.unresolvedCurrentPlanNeverPresentedAsFormalListEligible, true);
assert.equal(policy.currentPlanEvidenceNeverCreatesAdmissionProbability, true);
assert.deepEqual(policy.readinessStateIds, [
  "current-plan-confirmed",
  "current-plan-unmatched",
  "near-year-only",
  "current-plan-needs-check",
  "current-plan-conflict",
  "current-plan-ambiguous",
  "plan-only",
]);
assert.equal(policy.candidateGroups, 389435);
assert.equal(policy.currentPlanConfirmedGroups, 2142);
assert.equal(policy.currentPlanPendingGroups, 387293);
assert.equal(policy.nearYearOnlyGroups, 313);
assert.equal(policy.recentPlanMatchedGroups, 2455);
assert.equal(policy.noRecentPlanMatchGroups, 386980);
assert.equal(policy.exactCurrentPlanMatchedGroups, 1640);
assert.equal(policy.transitionCurrentPlanMatchedGroups, 502);
assert.equal(policy.currentPlanCoverageRate, 0.0055);

assert.equal(evidence.counts.candidateGroups, policy.candidateGroups);
assert.equal(
  evidence.counts.currentPlanConfirmedGroups + evidence.counts.currentPlanPendingGroups,
  evidence.counts.candidateGroups,
);
assert.equal(evidence.policy.executableClaimRemoved, true);
assert.equal(evidence.readinessStates.length, 7);
assert.equal(
  evidence.readinessStates.filter((item) => item.formalListEligible).length,
  1,
);
assert.equal(runtime.after.records, 868426);
assert.equal(runtime.after.ranks, 133640);
assert.equal(runtime.after.notes, 5136);
assert.equal(liteAudit.fullCore.bytes, 16049620);
assert.equal(liteAudit.fullCore.compressedBytes, 2437374);
assert.equal(liteAudit.liteCore.bytes, 3029884);
assert.equal(liteAudit.liteCore.compressedBytes, 486984);

console.log(JSON.stringify({
  status: "ok",
  modelVersion: expectedVersion,
  runtimeProfile: manifest.runtimeProfile.version,
  readiness: {
    candidateGroups: policy.candidateGroups,
    currentPlanConfirmedGroups: policy.currentPlanConfirmedGroups,
    currentPlanPendingGroups: policy.currentPlanPendingGroups,
    currentPlanCoverageRate: policy.currentPlanCoverageRate,
    readinessStates: policy.readinessStateIds.length,
  },
}, null, 2));
