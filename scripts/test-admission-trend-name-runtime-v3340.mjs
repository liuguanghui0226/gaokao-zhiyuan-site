#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
if (root.startsWith("/Volumes/")) throw new Error("Refusing external-volume test execution.");
const releaseDir = path.join(root, "site/data/release-v3.275");
const readGzip = (name) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, name))).toString("utf8"));
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, "data/admissions", name), "utf8"));
const expectedVersion = "local-deterministic-v3.344-current-official-plan-corroboration-868426records";
const historicalVersion = "local-deterministic-v3.340-typography-safe-trends-868426records";

const core = readGzip("knowledge-core.json.gz");
const lite = readGzip("knowledge-core-lite.json.gz");
const manifest = readGzip("manifest.json.gz");
const runtime = readJson("admission-trend-name-variants-v3340-runtime-manifest.json");
const evidence = readJson("evidence-v3340-admission-trend-name-variants-manifest.json");
const liteAudit = readJson("runtime-core-lite-v3340-manifest.json");
const policy = core.modelPolicy.admissionEvidencePolicy.trendEvidencePolicy;

assert.equal(core.modelVersion, expectedVersion);
assert.equal(lite.modelVersion, expectedVersion);
assert.equal(manifest.modelVersion, expectedVersion);
assert.equal(runtime.after.modelVersion, historicalVersion);
assert.equal(manifest.runtimeProfile.version, "v3.344");
assert.equal(liteAudit.modelVersion, historicalVersion);
assert.equal(core.generatedAt, "2026-07-30T07:30:00+08:00");
assert.equal(manifest.generatedAt, "2026-07-30T07:30:00+08:00");
assert.equal(policy.routeIsolated, true);
assert.deepEqual(policy.sameYearPreference, [
  "official-exam-authority",
  "school-official",
  "other",
  "third-party",
]);
assert.equal(policy.samePriorityRankPreference, true);
assert.deepEqual(policy.trendBonus, {
  officialOrSchoolOfficial: 5,
  other: 3,
  thirdParty: 2,
});
assert.equal(policy.thirdPartyTrendWarningRequired, true);
assert.equal(policy.majorCodeExcludedFromCrossYearIdentity, true);
assert.ok(policy.routeKeyFields.includes("campus"));
assert.ok(policy.routeKeyFields.includes("electiveRequirement"));
assert.equal(policy.typographyCanonicalization.unicodeNormalization, "NFKC");
assert.equal(policy.typographyCanonicalization.preservesWordsDigitsAndQualifiers, true);
assert.equal(policy.typographyCanonicalization.exactKeyFallbackOnSameYearBoundaryConflict, true);
assert.equal(policy.typographyCanonicalization.sameYearBoundaryConflictGroups, 140);
assert.equal(policy.typographyCanonicalization.recoveredMultiYearGroups, 3834);
assert.equal(policy.typographyCanonicalization.extendedExistingMultiYearGroups, 1071);
assert.equal(policy.typographyCanonicalization.addedDistinctYearLinks, 4959);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 133640);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5136);
assert.equal(evidence.provinces, 31);
assert.equal(evidence.majorAdmissionRecords, 475801);
assert.equal(evidence.exactTrendKeys, 301738);
assert.equal(evidence.canonicalTrendKeys, 296607);
assert.equal(evidence.exactMultiYearKeys, 106989);
assert.equal(evidence.safePolicyMultiYearGroups, 110770);
assert.equal(evidence.recoveredMultiYearGroups, 3834);
assert.equal(evidence.extendedExistingMultiYearGroups, 1071);
assert.equal(evidence.addedDistinctYearLinks, 4959);
assert.equal(evidence.sameYearBoundaryConflictGroups, 140);
assert.equal(evidence.recoveredOfficialOnlyGroups, 3710);
assert.equal(evidence.recoveredRecordCount, 7669);
assert.equal(runtime.after.records, 868426);
assert.equal(runtime.after.ranks, 133640);
assert.equal(runtime.after.notes, 5136);

console.log(JSON.stringify({
  status: "ok",
  modelVersion: expectedVersion,
  runtimeProfile: manifest.runtimeProfile.version,
  correctedGeneratedAt: core.generatedAt,
  counts: {
    records: runtime.after.records,
    ranks: runtime.after.ranks,
    notes: runtime.after.notes,
    majorAdmissionRecordsAudited: evidence.majorAdmissionRecords,
  },
  trendControls: {
    recoveredMultiYearGroups: evidence.recoveredMultiYearGroups,
    extendedExistingMultiYearGroups: evidence.extendedExistingMultiYearGroups,
    addedDistinctYearLinks: evidence.addedDistinctYearLinks,
    sameYearBoundaryConflictGroups: evidence.sameYearBoundaryConflictGroups,
  },
}, null, 2));
