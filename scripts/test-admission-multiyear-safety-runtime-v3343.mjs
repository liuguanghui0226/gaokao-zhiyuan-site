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

const core = readGzip("knowledge-core.json.gz");
const lite = readGzip("knowledge-core-lite.json.gz");
const manifest = readGzip("manifest.json.gz");
const runtime = readJson("admission-multiyear-boundary-safety-v3343-runtime-manifest.json");
const evidence = readJson("evidence-v3343-admission-multiyear-boundary-volatility-manifest.json");
const liteAudit = readJson("runtime-core-lite-v3343-manifest.json");
const policy = core.modelPolicy.admissionEvidencePolicy;
const optionPolicy = policy.optionNameCanonicalization;
const guardPolicy = policy.multiyearBoundaryGuard;

assert.equal(core.modelVersion, expectedVersion);
assert.equal(lite.modelVersion, expectedVersion);
assert.equal(manifest.modelVersion, expectedVersion);
assert.equal(runtime.after.modelVersion, expectedVersion);
assert.equal(manifest.runtimeProfile.version, "v3.343");
assert.equal(liteAudit.modelVersion, expectedVersion);
assert.equal(core.generatedAt, "2026-07-30T06:30:00+08:00");
assert.equal(manifest.generatedAt, "2026-07-30T06:30:00+08:00");
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
assert.equal(guardPolicy.officialEvidenceOnly, true);
assert.equal(guardPolicy.maximumRecentYears, 6);
assert.equal(guardPolicy.rankBasisMustMatchLatest, true);
assert.equal(guardPolicy.scoreBasisMustMatchLatest, true);
assert.equal(guardPolicy.candidateCategoryAndRankUsageMustMatch, true);
assert.equal(guardPolicy.majorCodeRouteMustMatch, true);
assert.equal(guardPolicy.oneExtremeOutlierDiscardedWhenThreeOrMoreYears, true);
assert.equal(guardPolicy.guardDirection, "downgrade-only");
assert.equal(guardPolicy.neverPromotesFromHistoricalBoundary, true);
assert.equal(guardPolicy.officialMultiyearGroups, 70735);
assert.equal(guardPolicy.officialRankMultiyearGroups, 41133);
assert.equal(guardPolicy.officialScoreMultiyearGroups, 29211);
assert.equal(guardPolicy.guardedGroups, 36799);
assert.equal(guardPolicy.rankGuardedGroups, 25100);
assert.equal(guardPolicy.scoreGuardedGroups, 11699);
assert.equal(guardPolicy.rankPotentialZoneShiftGroups, 18659);
assert.equal(guardPolicy.rankSevereVolatilityGroups, 5309);
assert.equal(guardPolicy.scoreSevereVolatilityGroups, 6639);
assert.equal(guardPolicy.discardedSingleOutlierGroups, 21630);
assert.equal(guardPolicy.mixedRankBasisGroupsIsolated, 503);
assert.equal(guardPolicy.mixedScoreBasisGroupsIsolated, 394);
assert.equal(guardPolicy.latestYearRemainsVisible, true);
assert.equal(guardPolicy.safetyBoundaryVisibleInRecommendation, true);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 133640);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5136);
assert.equal(evidence.provinces, 31);
assert.equal(evidence.admissionRecords, 794934);
assert.equal(evidence.namedMajorRecords, 596431);
assert.equal(evidence.canonicalTrendGroups, 460081);
assert.equal(evidence.typographyConflictGroups, 138);
assert.equal(evidence.officialMultiyearGroups, 70735);
assert.equal(evidence.officialRankMultiyearGroups, 41133);
assert.equal(evidence.officialScoreMultiyearGroups, 29211);
assert.equal(evidence.guardedGroups, 36799);
assert.equal(evidence.rankGuardedGroups, 25100);
assert.equal(evidence.scoreGuardedGroups, 11699);
assert.equal(evidence.rankPotentialZoneShiftGroups, 18659);
assert.equal(evidence.rankSevereVolatilityGroups, 5309);
assert.equal(evidence.scoreSevereVolatilityGroups, 6639);
assert.equal(evidence.discardedSingleOutlierGroups, 21630);
assert.equal(evidence.mixedRankBasisGroups, 503);
assert.equal(evidence.mixedScoreBasisGroups, 394);
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
  multiyearBoundaryGuard: {
    officialMultiyearGroups: evidence.officialMultiyearGroups,
    guardedGroups: evidence.guardedGroups,
    rankGuardedGroups: evidence.rankGuardedGroups,
    scoreGuardedGroups: evidence.scoreGuardedGroups,
    rankPotentialZoneShiftGroups: evidence.rankPotentialZoneShiftGroups,
    discardedSingleOutlierGroups: evidence.discardedSingleOutlierGroups,
    mixedRankBasisGroupsIsolated: evidence.mixedRankBasisGroups,
    mixedScoreBasisGroupsIsolated: evidence.mixedScoreBasisGroups,
  },
}, null, 2));
