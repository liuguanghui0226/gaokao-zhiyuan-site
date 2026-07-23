#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.330-jiangxi-official-rank2025-filing-score-policy-bonus-inclusive-full-table-replaced-868426records";
const sourceId = "official-jiangxi-rank-2025-v3330";
const oldSourceIds = ["dxsbb-rank-d2ed9325b0", "dxsbb-rank-60200dce4b"];
const readBytes = (file) => zlib.gunzipSync(fs.readFileSync(file));
const readJson = (file) => JSON.parse(readBytes(file));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

assert.ok(!projectRoot.startsWith("/Volumes/"), "Test must run from internal APFS staging");
const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
const liteFile = path.join(releaseDir, "knowledge-core-lite.json.gz");
const manifestFile = path.join(releaseDir, "manifest.json.gz");
const core = readJson(coreFile);
const lite = readJson(liteFile);
const manifest = readJson(manifestFile);
const item = manifest.shards["江西"];
const shardFile = path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`);
const shard = readJson(shardFile);
const applied = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "data/admissions/official-jiangxi-rank-conversion-2025-v3330-runtime-manifest.json"),
  "utf8",
));

assert.equal(core.modelVersion, modelVersion);
assert.equal(lite.modelVersion, modelVersion);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 130155);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5134);
assert.equal(manifest.rankConversionCount, 130155);
assert.equal(manifest.runtimeProfile.version, "v3.330");
assert.deepEqual(
  [core.admissionScoreLayer.rankSourceCoverage.sources, core.admissionScoreLayer.rankSourceCoverage.parsedSources],
  [219, 153],
);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedRecords, 130155);
const coverage2025 = core.admissionScoreLayer.rankSourceCoverage.byYear.find((row) => row.year === 2025);
assert.deepEqual([coverage2025.sources, coverage2025.parsedSources, coverage2025.parsedRecords], [85, 61, 26502]);

assert.equal(shard.records.length, 14099);
assert.equal(shard.rankConversions.length, 2297);
assert.equal(item.rankConversions, 2297);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId).length, 1137);
assert.equal(shard.rankConversions.filter((row) => oldSourceIds.includes(row.sourceId)).length, 0);
assert.equal(shard.rankConversions.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 2297);
assert.deepEqual(
  shard.rankConversions
    .filter((row) => row.year === 2025 && row.subjectType === "历史类" && row.score === 600)
    .map((row) => [row.rankStart, row.rankEnd]),
  [[2107, 2199]],
);
assert.deepEqual(
  shard.rankConversions
    .filter((row) => row.year === 2025 && row.subjectType === "物理类" && row.score === 600)
    .map((row) => [row.rankStart, row.rankEnd]),
  [[8683, 8985]],
);
assert.deepEqual(
  shard.rankConversions
    .filter((row) => row.year === 2025 && (
      (row.subjectType === "历史类" && [441, 375].includes(row.score))
      || (row.subjectType === "物理类" && row.score === 572)
    ))
    .map((row) => [row.subjectType, row.score, row.rankStart, row.rankEnd]),
  [
    ["历史类", 441, 76388, 76985],
    ["历史类", 375, 121362, 122112],
    ["物理类", 572, 20571, 21129],
  ],
);

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 1671);
assert.equal(linked.filter((row) => row.subjectType === "历史类").length, 442);
assert.equal(linked.filter((row) => row.subjectType === "物理类").length, 1229);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 596);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 1075);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 1511);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 146);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 9);
assert.equal(linked.filter((row) => row.dataType === "school-admission-summary").length, 5);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 1);
assert.ok(linked.every((row) => row.rankDerivedFromScore === true));
assert.ok(linked.every((row) => row.rankScoreBasis === "gaokao-total-including-policy-bonus"));
assert.ok(linked.every((row) => row.rankPolicyBonusIncluded === true));
assert.ok(linked.every((row) => row.rankRangeText.endsWith("（最低分换算）")));
const pku = linked.find((row) => row.id === "pku-01c29f9a89ac8d4c9d");
assert.equal(pku.rankRangeText, "1-24（最低分换算）");
assert.ok(pku.cautions.some((value) => value.includes("不生成档内伪精确位次")));

const special = shard.records.filter((row) => (
  row.year === 2025
  && ["历史类", "物理类"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 100
  && Number(row.minScore) <= 750
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank)
));
assert.equal(special.length, 160);
assert.ok(special.every((row) => row.rankSourceId !== sourceId));
assert.equal(shard.records.filter((row) => row.year === 2025 && ["艺术类", "体育类"].includes(row.subjectType) && row.rankSourceId === sourceId).length, 0);
assert.equal(shard.records.filter((row) => row.year === 2025 && Number(row.minScore) < 100 && row.rankSourceId === sourceId).length, 0);

const rankSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.equal(rankSource.scoreBasis, "gaokao-total-including-policy-bonus");
assert.equal(rankSource.rankPolicyBonusIncluded, true);
assert.equal(rankSource.replacedRuntimeRecords, 1137);
assert.equal(rankSource.replacementExactMatches, 1134);
assert.equal(rankSource.replacementDifferences.length, 3);
for (const oldSourceId of oldSourceIds) {
  const oldSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === oldSourceId);
  assert.equal(oldSource.supersededBy, sourceId);
  assert.equal(oldSource.activeRuntimeRecords, 0);
}
const hdu = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-hdu-national-2014-2025-school-major-admission");
assert.equal(hdu.jiangxi2025ScoreDerivedRankRecords, 24);
assert.equal(hdu.jiangxi2025RankPolicyBonusIncluded, true);
assert.ok(hdu.rankAlignmentBoundary.includes("江西2025年24条"));
assert.ok(hdu.rankAlignmentBoundary.includes("江西使用含政策加分的档案分表并公开至100分"));
assert.ok(core.admissionScoreLayer.currentFinding.includes("修正3个截断分档"));
assert.ok(core.admissionScoreLayer.currentFinding.includes("1671条普通整数最低分"));
assert.ok(core.admissionScoreLayer.currentFinding.includes("160条特殊路径继续隔离"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("物理117分与101分无考生"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("不自动套表"));

assert.equal(applied.dataset, "official-jiangxi-rank-conversion-2025-v3330-runtime");
assert.equal(applied.after.linkedAdmissionRecords, 1671);
assert.equal(applied.after.officialLinkedRecords, 596);
assert.equal(applied.after.specialPathExcludedRecords, 160);
assert.equal(applied.after.topBucketLinkedRecords, 1);
assert.equal(applied.after.sourceNotes, 5134);
assert.equal(applied.after.officialRankConversionsAdded, 1137);
assert.equal(applied.after.thirdPartyRankConversionsRemoved, 1137);
assert.equal(applied.after.replacementExactMatches, 1134);
assert.equal(applied.after.replacementDifferences.length, 3);
assert.equal(sha256(readBytes(shardFile)), item.sha256);
assert.equal(sha256(readBytes(coreFile)), manifest.core.sha256);
assert.equal(sha256(readBytes(liteFile)), manifest.coreLite.sha256);

console.log("Jiangxi 2025 official rank runtime v3.330 tests passed");
