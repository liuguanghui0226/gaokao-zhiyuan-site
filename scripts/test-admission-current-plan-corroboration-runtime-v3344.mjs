#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
if (root.startsWith("/Volumes/")) throw new Error("Refusing external-volume test execution.");
const releaseDir = path.join(root, "site/data/release-v3.275");
const readGzip = (name) => JSON.parse(zlib.gunzipSync(
  fs.readFileSync(path.join(releaseDir, name)),
).toString("utf8"));
const readJson = (name) => JSON.parse(fs.readFileSync(
  path.join(root, "data/admissions", name),
  "utf8",
));
const expectedVersion = "local-deterministic-v3.344-current-official-plan-corroboration-868426records";

const core = readGzip("knowledge-core.json.gz");
const lite = readGzip("knowledge-core-lite.json.gz");
const manifest = readGzip("manifest.json.gz");
const runtime = readJson("admission-current-plan-corroboration-v3344-runtime-manifest.json");
const evidence = readJson("evidence-v3344-admission-current-plan-corroboration-manifest.json");
const liteAudit = readJson("runtime-core-lite-v3344-manifest.json");
const policy = core.modelPolicy.admissionEvidencePolicy;
const planPolicy = policy.currentPlanCorroboration;

assert.equal(core.modelVersion, expectedVersion);
assert.equal(lite.modelVersion, expectedVersion);
assert.equal(manifest.modelVersion, expectedVersion);
assert.equal(runtime.after.modelVersion, expectedVersion);
assert.equal(manifest.runtimeProfile.version, "v3.344");
assert.equal(liteAudit.modelVersion, expectedVersion);
assert.equal(core.generatedAt, "2026-07-30T07:30:00+08:00");
assert.equal(manifest.generatedAt, "2026-07-30T07:30:00+08:00");
assert.equal(policy.multiyearBoundaryGuard.guardDirection, "downgrade-only");
assert.equal(planPolicy.positiveEvidenceOnly, true);
assert.equal(planPolicy.officialOrdinaryPlansOnly, true);
assert.equal(planPolicy.currentYear, 2026);
assert.deepEqual(planPolicy.acceptedPlanYears, [2025, 2026]);
assert.equal(planPolicy.schoolAndMajorIdentityMustMatch, true);
assert.equal(planPolicy.canonicalTypographyOnly, true);
assert.equal(planPolicy.semanticMajorRenamesNeverMerged, true);
assert.equal(planPolicy.canonicalBatchRouteMustMatch, true);
assert.equal(planPolicy.subjectAndOptionalRouteMustBeCompatible, true);
assert.equal(planPolicy.vacancyAndRestrictedPlansExcluded, true);
assert.equal(planPolicy.missingMatchMeansUnknownNotDiscontinued, true);
assert.equal(planPolicy.currentPlanElectiveConflictExcludesOption, true);
assert.equal(planPolicy.priorYearPlanElectiveConflictDoesNotExclude, true);
assert.equal(planPolicy.planPresenceNeverCreatesAdmissionProbability, true);
assert.equal(planPolicy.planPresenceNeverRaisesAdmissionFitZone, true);
assert.equal(planPolicy.maximumRankingEvidenceBonus, 8);
assert.equal(planPolicy.ordinaryPlanRecords, 66735);
assert.equal(planPolicy.eligibleRecentPlanRecords, 59052);
assert.equal(planPolicy.currentYearPlanRecords, 28422);
assert.equal(planPolicy.matchedCandidateGroups, 1869);
assert.equal(planPolicy.currentYearMatchedCandidateGroups, 1640);
assert.equal(planPolicy.nearYearMatchedCandidateGroups, 229);
assert.equal(planPolicy.matchedWithPlanCount, 1869);
assert.equal(planPolicy.matchedWithElectiveRequirement, 1583);
assert.equal(planPolicy.admissionMissingElectiveButPlanSupplies, 1489);
assert.equal(planPolicy.oldPlanRecordsExcluded, 7683);
assert.equal(planPolicy.provincesWithPlans, 31);
assert.equal(planPolicy.provincesWithCurrentYearMatches, 21);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 133640);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5136);
assert.equal(evidence.counts.provinces, 31);
assert.equal(evidence.counts.admissionRecords, 746748);
assert.equal(evidence.counts.namedAdmissionRecords, 596431);
assert.equal(evidence.counts.candidateGroups, 389435);
assert.equal(evidence.counts.ordinaryPlanRecords, 66735);
assert.equal(evidence.counts.eligibleRecentPlanRecords, 59052);
assert.equal(evidence.counts.currentYearPlanRecords, 28422);
assert.equal(evidence.counts.matchedCandidateGroups, 1869);
assert.equal(evidence.counts.currentYearMatchedCandidateGroups, 1640);
assert.equal(evidence.counts.nearYearMatchedCandidateGroups, 229);
assert.equal(evidence.counts.admissionMissingElectiveButPlanSupplies, 1489);
assert.equal(evidence.counts.provincesWithPlans, 31);
assert.equal(evidence.counts.provincesWithMatches, 21);
assert.equal(evidence.counts.provincesWithCurrentYearMatches, 21);
assert.equal(runtime.after.records, 868426);
assert.equal(runtime.after.ranks, 133640);
assert.equal(runtime.after.notes, 5136);
assert.equal(liteAudit.liteCore.bytes, 3027856);
assert.equal(liteAudit.liteCore.compressedBytes, 486333);

console.log(JSON.stringify({
  status: "ok",
  modelVersion: expectedVersion,
  runtimeProfile: manifest.runtimeProfile.version,
  generatedAt: core.generatedAt,
  counts: {
    records: runtime.after.records,
    ranks: runtime.after.ranks,
    notes: runtime.after.notes,
    ordinaryPlans: planPolicy.ordinaryPlanRecords,
    eligibleRecentPlans: planPolicy.eligibleRecentPlanRecords,
    currentPlanMatches: planPolicy.currentYearMatchedCandidateGroups,
    electiveEnrichments: planPolicy.admissionMissingElectiveButPlanSupplies,
  },
}, null, 2));
