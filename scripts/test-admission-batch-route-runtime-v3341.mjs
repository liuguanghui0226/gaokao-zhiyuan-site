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
const expectedVersion = "local-deterministic-v3.343-multiyear-official-boundary-guard-868426records";
const historicalVersion = "local-deterministic-v3.341-batch-isolated-admission-options-868426records";

const core = readGzip("knowledge-core.json.gz");
const lite = readGzip("knowledge-core-lite.json.gz");
const manifest = readGzip("manifest.json.gz");
const runtime = readJson("admission-batch-route-safety-v3341-runtime-manifest.json");
const evidence = readJson("evidence-v3341-admission-batch-route-collisions-manifest.json");
const liteAudit = readJson("runtime-core-lite-v3341-manifest.json");
const policy = core.modelPolicy.admissionEvidencePolicy;
const batchPolicy = policy.batchRoutePolicy;

assert.equal(core.modelVersion, expectedVersion);
assert.equal(lite.modelVersion, expectedVersion);
assert.equal(manifest.modelVersion, expectedVersion);
assert.equal(runtime.after.modelVersion, historicalVersion);
assert.equal(manifest.runtimeProfile.version, "v3.343");
assert.equal(liteAudit.modelVersion, historicalVersion);
assert.equal(core.generatedAt, "2026-07-30T06:30:00+08:00");
assert.equal(manifest.generatedAt, "2026-07-30T06:30:00+08:00");
assert.equal(policy.routeSafeDedupe, true);
assert.ok(policy.preservedRouteFields.includes("batch"));
assert.ok(policy.preservedRouteFields.includes("majorGroup"));
assert.ok(policy.preservedRouteFields.includes("campus"));
assert.equal(batchPolicy.semanticBatchRouteIsolation, true);
assert.equal(batchPolicy.semanticAliasesRetained, 4052);
assert.equal(batchPolicy.distinctRoutePairsPreserved, 9085);
assert.equal(batchPolicy.distinctRouteGroupsPreserved, 4740);
assert.equal(batchPolicy.boundaryConflictPairsPreserved, 8348);
assert.equal(batchPolicy.officialInvolvedPairsPreserved, 3479);
assert.equal(batchPolicy.sameSemanticRouteEvidencePreferencePreserved, true);
assert.equal(batchPolicy.batchShownInCandidateTags, true);
assert.ok(batchPolicy.ordinaryInitialAliases.includes("综合改革（3+1+2）"));
assert.ok(batchPolicy.preservedDistinctRoutes.includes("国家专项"));
assert.ok(batchPolicy.preservedDistinctRoutes.includes("征集轮次"));
assert.equal(policy.trendEvidencePolicy.typographyCanonicalization.unicodeNormalization, "NFKC");
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 133640);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5136);
assert.equal(evidence.provinces, 31);
assert.equal(evidence.admissionRecords, 794934);
assert.equal(evidence.crossBatchSharedRouteGroups, 7607);
assert.equal(evidence.crossBatchSharedRoutePairs, 13137);
assert.equal(evidence.preventedCrossBatchGroups, 4740);
assert.equal(evidence.preventedCrossBatchPairs, 9085);
assert.equal(evidence.retainedAliasPairs, 4052);
assert.equal(evidence.preventedBoundaryConflictPairs, 8348);
assert.equal(evidence.preventedOfficialInvolvedPairs, 3479);
assert.equal(runtime.after.records, 868426);
assert.equal(runtime.after.ranks, 133640);
assert.equal(runtime.after.notes, 5136);

console.log(JSON.stringify({
  status: "ok",
  modelVersion: expectedVersion,
  runtimeProfile: manifest.runtimeProfile.version,
  generatedAt: core.generatedAt,
  counts: {
    records: runtime.after.records,
    ranks: runtime.after.ranks,
    notes: runtime.after.notes,
    admissionRecordsAudited: evidence.admissionRecords,
  },
  batchRouteControls: {
    preventedCrossBatchGroups: evidence.preventedCrossBatchGroups,
    preventedCrossBatchPairs: evidence.preventedCrossBatchPairs,
    retainedAliasPairs: evidence.retainedAliasPairs,
    preventedBoundaryConflictPairs: evidence.preventedBoundaryConflictPairs,
    preventedOfficialInvolvedPairs: evidence.preventedOfficialInvolvedPairs,
  },
}, null, 2));
