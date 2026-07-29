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
const historicalVersion = "local-deterministic-v3.342-typography-safe-admission-options-868426records";

const core = readGzip("knowledge-core.json.gz");
const lite = readGzip("knowledge-core-lite.json.gz");
const manifest = readGzip("manifest.json.gz");
const runtime = readJson("admission-option-name-safety-v3342-runtime-manifest.json");
const evidence = readJson("evidence-v3342-admission-option-name-variants-manifest.json");
const liteAudit = readJson("runtime-core-lite-v3344-manifest.json");
const policy = core.modelPolicy.admissionEvidencePolicy;
const optionPolicy = policy.optionNameCanonicalization;

assert.equal(core.modelVersion, expectedVersion);
assert.equal(lite.modelVersion, expectedVersion);
assert.equal(manifest.modelVersion, expectedVersion);
assert.equal(runtime.after.modelVersion, historicalVersion);
assert.equal(manifest.runtimeProfile.version, "v3.344");
assert.equal(liteAudit.modelVersion, expectedVersion);
assert.equal(core.generatedAt, "2026-07-30T07:30:00+08:00");
assert.equal(manifest.generatedAt, "2026-07-30T07:30:00+08:00");
assert.equal(policy.routeSafeDedupe, true);
assert.equal(policy.batchRoutePolicy.semanticBatchRouteIsolation, true);
assert.equal(optionPolicy.unicodeNormalization, "NFKC");
assert.equal(optionPolicy.removesInternalWhitespace, true);
assert.equal(optionPolicy.normalizesMiddleDots, true);
assert.equal(optionPolicy.normalizesDashVariants, true);
assert.equal(optionPolicy.normalizesBracketVariants, true);
assert.equal(optionPolicy.preservesWordsDigitsAndQualifiers, true);
assert.equal(optionPolicy.exactBaseGroups, 428254);
assert.equal(optionPolicy.canonicalBaseGroups, 421393);
assert.equal(optionPolicy.canonicalNameVariantGroups, 6838);
assert.equal(optionPolicy.routeTypographyVariantGroups, 2689);
assert.equal(optionPolicy.affectedCandidateGroups, 2881);
assert.equal(optionPolicy.safelyRemovedDuplicateOptions, 3015);
assert.equal(optionPolicy.sameYearSafeMerges, 389);
assert.equal(optionPolicy.crossYearSafeMerges, 3468);
assert.equal(optionPolicy.officialInvolvedSafeMerges, 3371);
assert.equal(optionPolicy.boundaryConflictPairsPreserved, 537);
assert.equal(optionPolicy.sameYearBoundaryRequired, true);
assert.equal(optionPolicy.semanticRouteIsolationPreserved, true);
assert.equal(optionPolicy.evidencePreferencePreserved, true);
assert.equal(optionPolicy.originalDisplayNamesPreserved, true);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 133640);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5136);
assert.equal(evidence.provinces, 31);
assert.equal(evidence.admissionRecords, 794934);
assert.equal(evidence.exactBaseGroups, 428254);
assert.equal(evidence.canonicalBaseGroups, 421393);
assert.equal(evidence.canonicalNameVariantGroups, 6838);
assert.equal(evidence.routeTypographyVariantGroups, 2689);
assert.equal(evidence.affectedCandidateGroups, 2881);
assert.equal(evidence.safelyRemovedDuplicateOptions, 3015);
assert.equal(evidence.sameYearSafeMergePairs, 389);
assert.equal(evidence.crossYearSafeMergePairs, 3468);
assert.equal(evidence.officialInvolvedSafeMergePairs, 3371);
assert.equal(evidence.preservedSameYearBoundaryConflictPairs, 537);
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
  optionNameControls: {
    canonicalNameVariantGroups: evidence.canonicalNameVariantGroups,
    routeTypographyVariantGroups: evidence.routeTypographyVariantGroups,
    affectedCandidateGroups: evidence.affectedCandidateGroups,
    safelyRemovedDuplicateOptions: evidence.safelyRemovedDuplicateOptions,
    officialInvolvedSafeMerges: evidence.officialInvolvedSafeMergePairs,
    boundaryConflictPairsPreserved: evidence.preservedSameYearBoundaryConflictPairs,
  },
}, null, 2));
