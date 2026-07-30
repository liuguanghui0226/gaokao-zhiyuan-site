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
const expectedVersion = "local-deterministic-v3.346-current-plan-readiness-gate-868426records";
const historicalVersion = "local-deterministic-v3.345-plan-route-transition-safety-868426records";

const core = readGzip("knowledge-core.json.gz");
const lite = readGzip("knowledge-core-lite.json.gz");
const manifest = readGzip("manifest.json.gz");
const runtime = readJson("admission-plan-route-transition-v3345-runtime-manifest.json");
const evidence = readJson("evidence-v3345-admission-plan-route-transition-manifest.json");
const liteAudit = readJson("runtime-core-lite-v3346-manifest.json");
const policy = core.modelPolicy.admissionEvidencePolicy;
const planPolicy = policy.currentPlanCorroboration;

assert.equal(core.modelVersion, expectedVersion);
assert.equal(lite.modelVersion, expectedVersion);
assert.equal(manifest.modelVersion, expectedVersion);
assert.equal(runtime.after.modelVersion, historicalVersion);
assert.equal(manifest.runtimeProfile.version, "v3.346");
assert.equal(liteAudit.modelVersion, expectedVersion);
assert.equal(core.generatedAt, "2026-07-30T10:45:00+08:00");
assert.equal(manifest.generatedAt, "2026-07-30T10:45:00+08:00");
assert.equal(policy.multiyearBoundaryGuard.guardDirection, "downgrade-only");
assert.equal(planPolicy.positiveEvidenceOnly, true);
assert.equal(planPolicy.officialOrdinaryPlansOnly, true);
assert.equal(planPolicy.currentYear, 2026);
assert.deepEqual(planPolicy.acceptedPlanYears, [2025, 2026]);
assert.equal(planPolicy.schoolAndMajorIdentityMustMatch, true);
assert.equal(planPolicy.canonicalTypographyOnly, true);
assert.equal(planPolicy.semanticMajorRenamesNeverMerged, true);
assert.equal(planPolicy.strictBatchRouteMatchPreferred, true);
assert.equal(planPolicy.canonicalBatchRouteMustMatchForExactEvidence, true);
assert.equal(planPolicy.ordinaryUndergraduateRouteTransitionFallback, true);
assert.equal(planPolicy.exactSchoolMajorIdentityRequiredForTransition, true);
assert.equal(planPolicy.explicitBatchQualifierConflictRejected, true);
assert.equal(planPolicy.transitionNeverCrossesEducationOrSpecialRoute, true);
assert.equal(planPolicy.subjectAndOptionalRouteMustBeCompatible, true);
assert.equal(planPolicy.vacancySupplementAndRestrictedPlansExcluded, true);
assert.equal(planPolicy.missingMatchMeansUnknownNotDiscontinued, true);
assert.equal(planPolicy.exactCurrentPlanElectiveConflictExcludesOption, true);
assert.equal(planPolicy.transitionElectiveConflictReviewOnly, true);
assert.equal(planPolicy.priorYearPlanElectiveConflictDoesNotExclude, true);
assert.equal(planPolicy.ambiguousPlanRequirementsReviewOnly, true);
assert.equal(planPolicy.missingOptionalPlanFieldIsNotAConflict, true);
assert.equal(planPolicy.planPresenceNeverCreatesAdmissionProbability, true);
assert.equal(planPolicy.planPresenceNeverRaisesAdmissionFitZone, true);
assert.equal(planPolicy.maximumRankingEvidenceBonus, 8);
assert.equal(planPolicy.transitionCurrentYearMaximumRankingBonus, 5);
assert.equal(planPolicy.allPlanRecords, 71894);
assert.equal(planPolicy.ordinaryPlanRecords, 62358);
assert.equal(planPolicy.eligibleRecentPlanRecords, 54675);
assert.equal(planPolicy.currentYearPlanRecords, 28422);
assert.equal(planPolicy.exactRouteMatchedCandidateGroups, 1869);
assert.equal(planPolicy.routeTransitionMatchedCandidateGroups, 586);
assert.equal(planPolicy.matchedCandidateGroups, 2455);
assert.equal(planPolicy.exactCurrentYearMatchedCandidateGroups, 1640);
assert.equal(planPolicy.transitionCurrentYearMatchedCandidateGroups, 502);
assert.equal(planPolicy.currentYearMatchedCandidateGroups, 2142);
assert.equal(planPolicy.nearYearMatchedCandidateGroups, 313);
assert.equal(planPolicy.matchedWithPlanCount, 2455);
assert.equal(planPolicy.matchedWithElectiveRequirement, 1890);
assert.equal(planPolicy.admissionMissingElectiveButPlanSupplies, 1790);
assert.equal(planPolicy.plansExcludedAsVacancy, 6534);
assert.equal(planPolicy.supplementPlansExcluded, 1902);
assert.equal(planPolicy.oldPlanRecordsExcluded, 7683);
assert.equal(planPolicy.provincesWithPlans, 31);
assert.equal(planPolicy.provincesWithRouteTransitions, 4);
assert.equal(planPolicy.provincesWithCurrentYearMatches, 21);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 133640);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5136);
assert.equal(evidence.counts.provinces, 31);
assert.equal(evidence.counts.admissionRecords, 746748);
assert.equal(evidence.counts.namedAdmissionRecords, 596431);
assert.equal(evidence.counts.candidateGroups, 389435);
assert.equal(evidence.counts.ordinaryPlanRecords, 62358);
assert.equal(evidence.counts.eligibleRecentPlanRecords, 54675);
assert.equal(evidence.counts.exactRouteMatchedCandidateGroups, 1869);
assert.equal(evidence.counts.routeTransitionMatchedCandidateGroups, 586);
assert.equal(evidence.counts.matchedCandidateGroups, 2455);
assert.equal(evidence.counts.currentYearMatchedCandidateGroups, 2142);
assert.equal(evidence.counts.supplementPlansExcluded, 1902);
assert.equal(evidence.counts.plansExcludedAsVacancy, 6534);
assert.equal(evidence.counts.provincesWithRouteTransitions, 4);
assert.equal(runtime.after.records, 868426);
assert.equal(runtime.after.ranks, 133640);
assert.equal(runtime.after.notes, 5136);
assert.equal(liteAudit.fullCore.bytes, 16049620);
assert.equal(liteAudit.liteCore.bytes, 3029884);
assert.equal(liteAudit.liteCore.compressedBytes, 486984);

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
    exactMatches: planPolicy.exactRouteMatchedCandidateGroups,
    transitionMatches: planPolicy.routeTransitionMatchedCandidateGroups,
    combinedMatches: planPolicy.matchedCandidateGroups,
    vacancyPlansExcluded: planPolicy.plansExcludedAsVacancy,
  },
}, null, 2));
